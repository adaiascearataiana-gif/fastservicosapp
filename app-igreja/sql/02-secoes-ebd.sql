-- ============================================================
--  APP IGREJA BATISTA EM NOVA METRÓPOLE  —  versão 1.1
--  Seções, ADM principal e ADMs de seção, Escola Bíblica Dominical
--
--  Rode DEPOIS do arquivo 01-base.sql.
--  Como usar:
--    Supabase  ->  SQL Editor  ->  New query  ->  cole tudo  ->  Run
--  Pode rodar quantas vezes quiser: não apaga dados existentes.
--
--  Como ficam as permissões:
--    ADM principal  = perfil com is_adm = true. Faz tudo, cria seções
--                     e escolhe quem cuida de cada uma.
--    ADM de seção   = pessoa comum que o ADM principal liberou para
--                     cuidar de uma ou mais seções (tabela ibnm_secao_adms).
--    Professor(a)   = cuida só da própria sala da Escola Bíblica
--                     (alunos, chamada, materiais, fotos e relatórios).
--  Tudo é conferido aqui no banco (RLS), não só na tela do app.
-- ============================================================

-- ------------------------------------------------------------
-- 1. FUNÇÕES DE APOIO
-- ------------------------------------------------------------

-- Verdadeiro quando o comando NÃO veio do app (SQL Editor, migração,
-- serviços internos do Supabase). Nesses casos não há usuário logado.
create or replace function public.ibnm_interno()
returns boolean
language sql stable
set search_path = public, pg_temp
as $$
  select coalesce(
           nullif(current_setting('request.jwt.claim.role', true), ''),
           (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
           ''
         ) in ('', 'service_role');
$$;

-- Converte texto em uuid sem dar erro (devolve null se não for um uuid).
create or replace function public.ibnm_uuid(p text)
returns uuid
language plpgsql immutable
set search_path = public, pg_temp
as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;

-- ------------------------------------------------------------
-- 2. SEÇÕES
--    tipo 'painel' = áreas do painel do administrador (já vêm no app)
--    tipo 'ebd'    = Escola Bíblica Dominical (já vem no app)
--    tipo 'livre'  = seções criadas pelo ADM principal (Jovens, Missões…)
-- ------------------------------------------------------------
create table if not exists public.ibnm_secoes (
  id            uuid primary key default gen_random_uuid(),
  chave         text not null unique
                check (chave ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  nome          text not null,
  icone         text not null default '📁',
  descricao     text not null default '',
  tipo          text not null default 'livre' check (tipo in ('painel','ebd','livre')),
  ordem         int  not null default 500,
  ativo         boolean not null default true,     -- aparece no app
  no_inicio     boolean not null default true,     -- atalho na tela inicial
  criado_por    uuid references auth.users(id) on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.ibnm_secoes enable row level security;   -- fechada desde a criação; as regras vêm na parte 7

-- Quem cuida de cada seção (ADMs de seção).
create table if not exists public.ibnm_secao_adms (
  secao_id      uuid not null references public.ibnm_secoes(id) on delete cascade,
  user_id       uuid not null references public.ibnm_perfis(id) on delete cascade,
  concedido_por uuid references auth.users(id) on delete set null,
  criado_em     timestamptz not null default now(),
  primary key (secao_id, user_id)
);
alter table public.ibnm_secao_adms enable row level security;   -- fechada desde a criação; as regras vêm na parte 7

create index if not exists ibnm_secao_adms_user_idx on public.ibnm_secao_adms (user_id);

-- O usuário logado cuida desta seção? (o ADM principal cuida de todas)
create or replace function public.ibnm_tem_secao(p_chave text)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.ibnm_is_adm() or exists (
    select 1
    from public.ibnm_secao_adms a
    join public.ibnm_secoes s on s.id = a.secao_id
    where a.user_id = auth.uid() and s.chave = p_chave
  );
$$;

create or replace function public.ibnm_tem_secao_id(p_secao uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.ibnm_is_adm() or exists (
    select 1 from public.ibnm_secao_adms a
    where a.user_id = auth.uid() and a.secao_id = p_secao
  );
$$;

create or replace function public.ibnm_secao_ativa(p_secao uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.ibnm_secoes s where s.id = p_secao and s.ativo);
$$;

-- Cuida da chave (endereço) da seção e protege as seções que já vêm no app.
create or replace function public.ibnm_secoes_protege()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_base text;
  v_chave text;
  v_n int := 1;
begin
  if tg_op = 'DELETE' then
    if old.tipo <> 'livre' and not public.ibnm_interno() then
      raise exception 'Esta seção faz parte do app e não pode ser excluída. Se quiser, desative.';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if not public.ibnm_interno() then
      new.chave := old.chave;
      new.tipo  := old.tipo;
    end if;
    new.nome := trim(coalesce(new.nome, ''));
    if new.nome = '' then new.nome := old.nome; end if;
    new.atualizado_em := now();
    return new;
  end if;

  -- INSERT
  new.nome := trim(coalesce(new.nome, ''));
  if new.nome = '' then
    raise exception 'Dê um nome para a seção.';
  end if;
  if not public.ibnm_interno() then
    new.tipo := 'livre';
    new.criado_por := auth.uid();
    new.chave := '';
  end if;
  if coalesce(new.chave, '') = '' then
    v_base := lower(translate(new.nome,
      'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
      'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn'));
    v_base := trim(both '-' from regexp_replace(v_base, '[^a-z0-9]+', '-', 'g'));
    v_base := trim(both '-' from left(v_base, 30));
    if length(v_base) < 2 then v_base := 'secao'; end if;
    v_chave := v_base;
    while exists (select 1 from public.ibnm_secoes s where s.chave = v_chave) loop
      v_n := v_n + 1;
      v_chave := v_base || '-' || v_n;
    end loop;
    new.chave := v_chave;
  end if;
  return new;
end;
$$;

drop trigger if exists ibnm_secoes_protege_trg on public.ibnm_secoes;
create trigger ibnm_secoes_protege_trg
  before insert or update or delete on public.ibnm_secoes
  for each row execute function public.ibnm_secoes_protege();

-- Registra quem liberou o acesso.
create or replace function public.ibnm_secao_adms_marca()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.ibnm_interno() then
    new.concedido_por := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists ibnm_secao_adms_marca_trg on public.ibnm_secao_adms;
create trigger ibnm_secao_adms_marca_trg
  before insert on public.ibnm_secao_adms
  for each row execute function public.ibnm_secao_adms_marca();

-- Seções que já vêm no app (o ADM principal pode mudar nome, ícone e ordem).
insert into public.ibnm_secoes (chave, nome, icone, descricao, tipo, ordem, no_inicio)
values
  ('igreja',     'Dados da igreja',          '⛪', 'Nome, endereço, horários e redes sociais.',            'painel', 10,  false),
  ('pix',        'PIX e oferta',             '💚', 'Chave PIX e tela de oferta.',                          'painel', 20,  false),
  ('radio',      'Rádio',                    '📻', 'Player da rádio da igreja.',                           'painel', 30,  false),
  ('devocional', 'Devocional',               '📖', 'Devocional do dia.',                                   'painel', 40,  false),
  ('eventos',    'Agenda',                   '📅', 'Cultos, programações e reuniões.',                     'painel', 50,  false),
  ('palavra',    'Palavra pastoral',         '💬', 'Mensagens do pastor.',                                 'painel', 60,  false),
  ('avisos',     'Avisos',                   '📌', 'Mural de avisos da tela inicial.',                     'painel', 70,  false),
  ('oracoes',    'Pedidos de oração',        '🙏', 'Pedidos enviados pelos membros (inclui os em sigilo).', 'painel', 80,  false),
  ('ofertas',    'Ofertas recebidas',        '💰', 'Registros de ofertas e comprovantes.',                 'painel', 90,  false),
  ('membros',    'Membros',                  '👥', 'Lista de pessoas cadastradas e seus contatos.',        'painel', 100, false),
  ('ebd',        'Escola Bíblica Dominical', '🎓', 'Salas, materiais, fotos, chamada e relatórios.',       'ebd',    110, true)
on conflict (chave) do nothing;

-- ------------------------------------------------------------
-- 3. ESCOLA BÍBLICA DOMINICAL — salas, matrículas, chamada, relatórios
-- ------------------------------------------------------------
create table if not exists public.ibnm_ebd_salas (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  descricao     text not null default '',
  faixa         text not null default '',          -- faixa de idade / público
  local         text not null default '',          -- onde a sala se reúne
  icone         text not null default '📘',
  ordem         int  not null default 100,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.ibnm_ebd_salas enable row level security;   -- fechada desde a criação; as regras vêm na parte 7

drop trigger if exists ibnm_ebd_salas_toque on public.ibnm_ebd_salas;
create trigger ibnm_ebd_salas_toque before update on public.ibnm_ebd_salas
  for each row execute function public.ibnm_toque();

-- Alunos e professores de cada sala.
-- user_id vazio = aluno sem conta no app (criança, idoso…), lançado pelo professor.
create table if not exists public.ibnm_ebd_matriculas (
  id            uuid primary key default gen_random_uuid(),
  sala_id       uuid not null references public.ibnm_ebd_salas(id) on delete cascade,
  user_id       uuid references public.ibnm_perfis(id) on delete set null,
  nome          text not null default '',
  papel         text not null default 'aluno' check (papel in ('aluno','professor')),
  status        text not null default 'ativo' check (status in ('pendente','ativo','inativo')),
  nascimento    date,
  telefone      text not null default '',
  responsavel   text not null default '',          -- para crianças
  observacao    text not null default '',
  criado_por    uuid references auth.users(id) on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.ibnm_ebd_matriculas enable row level security;   -- fechada desde a criação; as regras vêm na parte 7

create unique index if not exists ibnm_ebd_matriculas_unica
  on public.ibnm_ebd_matriculas (sala_id, user_id) where user_id is not null;
create index if not exists ibnm_ebd_matriculas_sala_idx on public.ibnm_ebd_matriculas (sala_id, papel, status);
create index if not exists ibnm_ebd_matriculas_user_idx on public.ibnm_ebd_matriculas (user_id);

-- Cada aula (domingo) de uma sala, com os números do relatório.
create table if not exists public.ibnm_ebd_aulas (
  id            uuid primary key default gen_random_uuid(),
  sala_id       uuid not null references public.ibnm_ebd_salas(id) on delete cascade,
  data          date not null,
  tema          text not null default '',
  professor     text not null default '',
  matriculados  int  not null default 0,
  presentes     int  not null default 0,
  visitantes    int  not null default 0 check (visitantes >= 0),
  biblias       int  not null default 0 check (biblias >= 0),
  revistas      int  not null default 0 check (revistas >= 0),
  oferta        numeric(12,2) not null default 0 check (oferta >= 0),
  observacao    text not null default '',
  criado_por    uuid references auth.users(id) on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (sala_id, data)
);
alter table public.ibnm_ebd_aulas enable row level security;   -- fechada desde a criação; as regras vêm na parte 7

create index if not exists ibnm_ebd_aulas_data_idx on public.ibnm_ebd_aulas (data desc);

drop trigger if exists ibnm_ebd_aulas_toque on public.ibnm_ebd_aulas;
create trigger ibnm_ebd_aulas_toque before update on public.ibnm_ebd_aulas
  for each row execute function public.ibnm_toque();

-- Presença de cada aluno em cada aula.
create table if not exists public.ibnm_ebd_presencas (
  aula_id       uuid not null references public.ibnm_ebd_aulas(id) on delete cascade,
  matricula_id  uuid not null references public.ibnm_ebd_matriculas(id) on delete cascade,
  presente      boolean not null default false,
  primary key (aula_id, matricula_id)
);
alter table public.ibnm_ebd_presencas enable row level security;   -- fechada desde a criação; as regras vêm na parte 7

create index if not exists ibnm_ebd_presencas_matricula_idx on public.ibnm_ebd_presencas (matricula_id);

-- Fotos do relatório/caderneta (arquivo fica no bucket privado "igreja").
create table if not exists public.ibnm_ebd_relatorios (
  id            uuid primary key default gen_random_uuid(),
  sala_id       uuid references public.ibnm_ebd_salas(id) on delete cascade,   -- vazio = relatório geral
  data          date not null default current_date,
  titulo        text not null default '',
  observacao    text not null default '',
  caminho       text not null,
  autor         text not null default '',
  criado_por    uuid references auth.users(id) on delete set null,
  criado_em     timestamptz not null default now()
);
alter table public.ibnm_ebd_relatorios enable row level security;   -- fechada desde a criação; as regras vêm na parte 7

create index if not exists ibnm_ebd_relatorios_idx on public.ibnm_ebd_relatorios (data desc);

-- O usuário logado é professor(a) ativo(a) desta sala?
create or replace function public.ibnm_ebd_professor(p_sala uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select p_sala is not null and exists (
    select 1 from public.ibnm_ebd_matriculas m
    where m.sala_id = p_sala and m.user_id = auth.uid()
      and m.papel = 'professor' and m.status = 'ativo'
  );
$$;

-- Pode cuidar da sala? (ADM da Escola Bíblica ou professor da sala)
create or replace function public.ibnm_ebd_gestor(p_sala uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.ibnm_tem_secao('ebd') or public.ibnm_ebd_professor(p_sala);
$$;

-- Participa da sala? (aluno ou professor ativo)
create or replace function public.ibnm_ebd_membro(p_sala uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.ibnm_ebd_matriculas m
    where m.sala_id = p_sala and m.user_id = auth.uid() and m.status = 'ativo'
  );
$$;

create or replace function public.ibnm_ebd_gestor_aula(p_aula uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.ibnm_ebd_aulas a
    where a.id = p_aula and public.ibnm_ebd_gestor(a.sala_id)
  );
$$;

create or replace function public.ibnm_ebd_minha_matricula(p_matricula uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.ibnm_ebd_matriculas m
    where m.id = p_matricula and m.user_id = auth.uid()
  );
$$;

-- Regras das matrículas:
--   * professor(a) só mexe em ALUNOS da própria sala;
--   * só o ADM da Escola Bíblica define quem é professor.
create or replace function public.ibnm_ebd_matricula_protege()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_livre boolean;
begin
  v_livre := public.ibnm_interno()
          or coalesce(current_setting('ibnm.rpc', true), '') = '1'
          or public.ibnm_tem_secao('ebd');

  if tg_op = 'DELETE' then
    if not v_livre and old.papel = 'professor' then
      raise exception 'Só o ADM da Escola Bíblica pode remover professores.' using errcode = '42501';
    end if;
    return old;
  end if;

  if not v_livre then
    if new.papel = 'professor' or (tg_op = 'UPDATE' and old.papel = 'professor') then
      raise exception 'Só o ADM da Escola Bíblica pode definir professores.' using errcode = '42501';
    end if;
    if tg_op = 'INSERT' then
      new.user_id := null;                 -- professor lança apenas alunos sem conta
    else
      new.user_id := old.user_id;
      new.sala_id := old.sala_id;
    end if;
  end if;

  if tg_op = 'INSERT' then
    if new.criado_por is null then new.criado_por := auth.uid(); end if;
    if new.user_id is not null and trim(coalesce(new.nome, '')) = '' then
      select p.nome into new.nome from public.ibnm_perfis p where p.id = new.user_id;
    end if;
    new.nome := trim(coalesce(new.nome, ''));
    if new.nome = '' then
      raise exception 'Informe o nome da pessoa.';
    end if;
  else
    new.nome := coalesce(nullif(trim(coalesce(new.nome, '')), ''), old.nome);
  end if;

  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists ibnm_ebd_matricula_protege_trg on public.ibnm_ebd_matriculas;
create trigger ibnm_ebd_matricula_protege_trg
  before insert or update or delete on public.ibnm_ebd_matriculas
  for each row execute function public.ibnm_ebd_matricula_protege();

-- O próprio membro entra em uma sala como aluno(a) ou professor(a).
--   aluno(a)     -> entra na hora (uma sala por vez)
--   professor(a) -> fica "aguardando" até o ADM da Escola Bíblica aprovar
create or replace function public.ibnm_ebd_matricular(p_sala uuid, p_papel text default 'aluno')
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_perfil public.ibnm_perfis%rowtype;
  v_row    public.ibnm_ebd_matriculas%rowtype;
  v_status text;
  v_nome   text;
begin
  if v_uid is null then
    raise exception 'Entre no app para participar da Escola Bíblica.' using errcode = '42501';
  end if;
  if p_papel is null or p_papel not in ('aluno', 'professor') then
    raise exception 'Escolha entre aluno(a) ou professor(a).';
  end if;
  select * into v_perfil from public.ibnm_perfis where id = v_uid;
  if not found then
    raise exception 'Complete o seu cadastro antes de participar.';
  end if;
  if not exists (select 1 from public.ibnm_ebd_salas s where s.id = p_sala and (s.ativo or public.ibnm_tem_secao('ebd'))) then
    raise exception 'Sala não encontrada.';
  end if;

  perform set_config('ibnm.rpc', '1', true);

  v_nome := coalesce(nullif(trim(v_perfil.nome), ''), split_part(coalesce(v_perfil.email, ''), '@', 1), 'Membro');
  v_status := case when p_papel = 'professor' and not public.ibnm_tem_secao('ebd') then 'pendente' else 'ativo' end;

  select * into v_row from public.ibnm_ebd_matriculas
   where sala_id = p_sala and user_id = v_uid;

  if not found and p_papel = 'aluno' then
    -- o professor já tinha lançado esta pessoa pelo nome? então só liga a conta
    select * into v_row from public.ibnm_ebd_matriculas
     where sala_id = p_sala and user_id is null and papel = 'aluno'
       and lower(regexp_replace(trim(nome), '\s+', ' ', 'g')) = lower(regexp_replace(v_nome, '\s+', ' ', 'g'))
     order by criado_em
     limit 1;
    if found then
      update public.ibnm_ebd_matriculas
         set user_id = v_uid, status = 'ativo',
             telefone = case when telefone = '' then coalesce(v_perfil.telefone, '') else telefone end,
             nascimento = coalesce(nascimento, v_perfil.nascimento)
       where id = v_row.id
       returning * into v_row;
    end if;
  end if;

  if v_row.id is null then
    insert into public.ibnm_ebd_matriculas (sala_id, user_id, nome, papel, status, nascimento, telefone, criado_por)
    values (p_sala, v_uid, v_nome, p_papel, v_status, v_perfil.nascimento, coalesce(v_perfil.telefone, ''), v_uid)
    returning * into v_row;
  elsif v_row.papel <> p_papel or v_row.status = 'inativo' then
    update public.ibnm_ebd_matriculas
       set papel = p_papel,
           status = case when v_row.papel = p_papel and v_row.status = 'pendente' then 'pendente' else v_status end,
           nome = v_nome
     where id = v_row.id
     returning * into v_row;
  end if;

  if p_papel = 'aluno' then
    update public.ibnm_ebd_matriculas
       set status = 'inativo'
     where user_id = v_uid and papel = 'aluno' and sala_id <> p_sala and status <> 'inativo';
  end if;

  return to_jsonb(v_row);
end;
$$;

-- O próprio membro sai de uma sala (o histórico de presença fica guardado).
create or replace function public.ibnm_ebd_sair(p_matricula uuid)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Entre no app para continuar.' using errcode = '42501';
  end if;
  perform set_config('ibnm.rpc', '1', true);
  update public.ibnm_ebd_matriculas
     set status = 'inativo'
   where id = p_matricula and user_id = auth.uid();
  return found;
end;
$$;

-- Salva a chamada de um domingo de uma vez só (aula + presenças + totais).
--   p_dados     = {"tema":"","professor":"","visitantes":0,"biblias":0,"revistas":0,"oferta":0,"observacao":""}
--   p_presencas = [{"m":"<id da matrícula>","p":true}, ...]
create or replace function public.ibnm_ebd_salvar_chamada(p_sala uuid, p_data date, p_dados jsonb, p_presencas jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_aula public.ibnm_ebd_aulas%rowtype;
  d      jsonb := coalesce(p_dados, '{}'::jsonb);
  v_pres int;
  v_mat  int;
begin
  if auth.uid() is null then
    raise exception 'Entre no app para fazer a chamada.' using errcode = '42501';
  end if;
  if not public.ibnm_ebd_gestor(p_sala) then
    raise exception 'Você não tem permissão para fazer a chamada desta sala.' using errcode = '42501';
  end if;
  if p_data is null then
    raise exception 'Informe a data da aula.';
  end if;
  if p_data > current_date + 1 then
    raise exception 'A data da aula não pode ser no futuro.';
  end if;

  insert into public.ibnm_ebd_aulas (sala_id, data, tema, professor, visitantes, biblias, revistas, oferta, observacao, criado_por)
  values (
    p_sala, p_data,
    coalesce(d->>'tema', ''),
    coalesce(d->>'professor', ''),
    greatest(coalesce(nullif(d->>'visitantes', '')::int, 0), 0),
    greatest(coalesce(nullif(d->>'biblias', '')::int, 0), 0),
    greatest(coalesce(nullif(d->>'revistas', '')::int, 0), 0),
    greatest(coalesce(nullif(d->>'oferta', '')::numeric, 0), 0),
    coalesce(d->>'observacao', ''),
    auth.uid()
  )
  on conflict (sala_id, data) do update
     set tema = excluded.tema,
         professor = excluded.professor,
         visitantes = excluded.visitantes,
         biblias = excluded.biblias,
         revistas = excluded.revistas,
         oferta = excluded.oferta,
         observacao = excluded.observacao
  returning * into v_aula;

  delete from public.ibnm_ebd_presencas where aula_id = v_aula.id;

  insert into public.ibnm_ebd_presencas (aula_id, matricula_id, presente)
  select v_aula.id, m.id, bool_or(coalesce((x->>'p')::boolean, false))
    from jsonb_array_elements(coalesce(p_presencas, '[]'::jsonb)) x
    join public.ibnm_ebd_matriculas m
      on m.id = public.ibnm_uuid(x->>'m') and m.sala_id = p_sala and m.papel = 'aluno'
   group by m.id;

  select count(*) filter (where presente), count(*)
    into v_pres, v_mat
    from public.ibnm_ebd_presencas where aula_id = v_aula.id;

  update public.ibnm_ebd_aulas
     set presentes = v_pres, matriculados = v_mat
   where id = v_aula.id
   returning * into v_aula;

  return to_jsonb(v_aula);
end;
$$;

-- Resumo de cada sala para mostrar no app (quantos alunos e quem ensina).
create or replace function public.ibnm_ebd_resumo()
returns table (sala_id uuid, alunos int, professores text)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select s.id,
         (select count(*)::int from public.ibnm_ebd_matriculas m
           where m.sala_id = s.id and m.papel = 'aluno' and m.status = 'ativo'),
         coalesce((select string_agg(m.nome, ', ' order by m.nome) from public.ibnm_ebd_matriculas m
           where m.sala_id = s.id and m.papel = 'professor' and m.status = 'ativo'), '')
    from public.ibnm_ebd_salas s
   where s.ativo or public.ibnm_tem_secao('ebd');
$$;

-- Busca de pessoas pelo nome, para o ADM da Escola Bíblica escolher professores.
-- Devolve só nome e foto (nada de endereço ou telefone).
create or replace function public.ibnm_ebd_buscar_pessoas(p_termo text)
returns table (id uuid, nome text, foto_url text)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select p.id, p.nome, p.foto_url
    from public.ibnm_perfis p
   where public.ibnm_tem_secao('ebd')
     and length(trim(coalesce(p_termo, ''))) >= 2
     and p.nome ilike '%' || replace(replace(replace(trim(p_termo), '\', ''), '%', ''), '_', '') || '%'
   order by p.nome
   limit 20;
$$;

-- Salas de exemplo (ficam ocultas até o ADM ativar). Só na primeira vez.
insert into public.ibnm_ebd_salas (nome, descricao, faixa, icone, ordem, ativo)
select v.nome, v.descricao, v.faixa, v.icone, v.ordem, false
  from (values
    ('Adultos',      'Estudo da lição do trimestre.',            'A partir de 25 anos', '📘', 10),
    ('Jovens',       'Estudo e conversa para a mocidade.',       '18 a 24 anos',        '🔥', 20),
    ('Adolescentes', 'A Bíblia na linguagem dos adolescentes.',  '12 a 17 anos',        '🎒', 30),
    ('Crianças',     'Histórias bíblicas, música e atividades.', 'Até 11 anos',         '🧸', 40)
  ) as v(nome, descricao, faixa, icone, ordem)
 where not exists (select 1 from public.ibnm_ebd_salas);

-- Dados gerais da Escola Bíblica (o ADM da seção edita no app).
insert into public.ibnm_config (chave, valor)
values ('ebd', jsonb_build_object('horario', '', 'tema', '', 'revista', '', 'aviso', ''))
on conflict (chave) do nothing;

-- ------------------------------------------------------------
-- 4. CONTEÚDO DAS SEÇÕES — mural, materiais e fotos
--    (na Escola Bíblica, sala_id diz de qual sala é; vazio = todas)
-- ------------------------------------------------------------
create table if not exists public.ibnm_secao_posts (
  id            uuid primary key default gen_random_uuid(),
  secao_id      uuid not null references public.ibnm_secoes(id) on delete cascade,
  titulo        text not null default '',
  texto         text not null default '',
  imagem        text not null default '',
  link          text not null default '',
  fixado        boolean not null default false,
  publicado     boolean not null default true,
  autor         text not null default '',
  criado_por    uuid references auth.users(id) on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.ibnm_secao_posts enable row level security;   -- fechada desde a criação; as regras vêm na parte 7

create index if not exists ibnm_secao_posts_idx on public.ibnm_secao_posts (secao_id, criado_em desc);

drop trigger if exists ibnm_secao_posts_toque on public.ibnm_secao_posts;
create trigger ibnm_secao_posts_toque before update on public.ibnm_secao_posts
  for each row execute function public.ibnm_toque();

create table if not exists public.ibnm_secao_materiais (
  id            uuid primary key default gen_random_uuid(),
  secao_id      uuid not null references public.ibnm_secoes(id) on delete cascade,
  sala_id       uuid references public.ibnm_ebd_salas(id) on delete cascade,
  titulo        text not null default '',
  descricao     text not null default '',
  tipo          text not null default 'link' check (tipo in ('link','video','pdf','imagem','texto')),
  url           text not null default '',
  texto         text not null default '',
  data          date,
  publicado     boolean not null default true,
  autor         text not null default '',
  criado_por    uuid references auth.users(id) on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.ibnm_secao_materiais enable row level security;   -- fechada desde a criação; as regras vêm na parte 7

create index if not exists ibnm_secao_materiais_idx on public.ibnm_secao_materiais (secao_id, criado_em desc);

drop trigger if exists ibnm_secao_materiais_toque on public.ibnm_secao_materiais;
create trigger ibnm_secao_materiais_toque before update on public.ibnm_secao_materiais
  for each row execute function public.ibnm_toque();

create table if not exists public.ibnm_secao_fotos (
  id            uuid primary key default gen_random_uuid(),
  secao_id      uuid not null references public.ibnm_secoes(id) on delete cascade,
  sala_id       uuid references public.ibnm_ebd_salas(id) on delete cascade,
  url           text not null,
  miniatura     text not null default '',
  caminho       text not null default '',
  legenda       text not null default '',
  data          date not null default current_date,
  autor         text not null default '',
  criado_por    uuid references auth.users(id) on delete set null,
  criado_em     timestamptz not null default now()
);
alter table public.ibnm_secao_fotos enable row level security;   -- fechada desde a criação; as regras vêm na parte 7

create index if not exists ibnm_secao_fotos_idx on public.ibnm_secao_fotos (secao_id, data desc, criado_em desc);

-- Pode publicar conteúdo? ADM da seção, ou professor(a) quando o conteúdo é da própria sala.
create or replace function public.ibnm_pode_editar_conteudo(p_secao uuid, p_sala uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.ibnm_tem_secao_id(p_secao)
      or (p_sala is not null
          and public.ibnm_ebd_professor(p_sala)
          and exists (select 1 from public.ibnm_secoes s where s.id = p_secao and s.tipo = 'ebd'));
$$;

-- Guarda quem publicou (e, nos materiais e fotos, só aceita "sala" na Escola Bíblica).
create or replace function public.ibnm_conteudo_marca()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_novo jsonb := to_jsonb(new);
begin
  if tg_op = 'INSERT' then
    if not public.ibnm_interno() then
      new.criado_por := auth.uid();
    end if;
    if coalesce(new.autor, '') = '' and new.criado_por is not null then
      new.autor := coalesce((select p.nome from public.ibnm_perfis p where p.id = new.criado_por), '');
    end if;
  else
    new.criado_por := old.criado_por;
    if v_novo ? 'secao_id' then
      new.secao_id := old.secao_id;
    end if;
  end if;
  return new;
end;
$$;

-- Nos materiais e fotos, "sala" só vale dentro da Escola Bíblica.
create or replace function public.ibnm_conteudo_sala()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.sala_id is not null
     and not exists (select 1 from public.ibnm_secoes s where s.id = new.secao_id and s.tipo = 'ebd') then
    new.sala_id := null;
  end if;
  return new;
end;
$$;

drop trigger if exists ibnm_secao_posts_marca on public.ibnm_secao_posts;
create trigger ibnm_secao_posts_marca before insert or update on public.ibnm_secao_posts
  for each row execute function public.ibnm_conteudo_marca();

drop trigger if exists ibnm_secao_materiais_marca on public.ibnm_secao_materiais;
create trigger ibnm_secao_materiais_marca before insert or update on public.ibnm_secao_materiais
  for each row execute function public.ibnm_conteudo_marca();

drop trigger if exists ibnm_secao_materiais_sala on public.ibnm_secao_materiais;
create trigger ibnm_secao_materiais_sala before insert or update on public.ibnm_secao_materiais
  for each row execute function public.ibnm_conteudo_sala();

drop trigger if exists ibnm_secao_fotos_marca on public.ibnm_secao_fotos;
create trigger ibnm_secao_fotos_marca before insert or update on public.ibnm_secao_fotos
  for each row execute function public.ibnm_conteudo_marca();

drop trigger if exists ibnm_secao_fotos_sala on public.ibnm_secao_fotos;
create trigger ibnm_secao_fotos_sala before insert or update on public.ibnm_secao_fotos
  for each row execute function public.ibnm_conteudo_sala();

drop trigger if exists ibnm_ebd_relatorios_marca on public.ibnm_ebd_relatorios;
create trigger ibnm_ebd_relatorios_marca before insert or update on public.ibnm_ebd_relatorios
  for each row execute function public.ibnm_conteudo_marca();

-- ------------------------------------------------------------
-- 5. O QUE O USUÁRIO LOGADO PODE FAZER (o app pergunta ao entrar)
-- ------------------------------------------------------------
create or replace function public.ibnm_meu_acesso()
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'principal', public.ibnm_is_adm(),
    'secoes', coalesce((
        select jsonb_agg(s.chave order by s.ordem, s.nome)
          from public.ibnm_secao_adms a
          join public.ibnm_secoes s on s.id = a.secao_id
         where a.user_id = auth.uid()), '[]'::jsonb),
    'ebd', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', m.id, 'sala_id', m.sala_id, 'sala', sl.nome, 'icone', sl.icone,
                 'papel', m.papel, 'status', m.status) order by sl.ordem, sl.nome)
          from public.ibnm_ebd_matriculas m
          join public.ibnm_ebd_salas sl on sl.id = m.sala_id
         where m.user_id = auth.uid() and m.status <> 'inativo'), '[]'::jsonb),
    'ebd_pendentes', case when auth.uid() is not null and public.ibnm_tem_secao('ebd')
        then (select count(*)::int from public.ibnm_ebd_matriculas m where m.status = 'pendente')
        else 0 end
  );
$$;

-- ------------------------------------------------------------
-- 6. PROTEÇÕES EXTRAS
-- ------------------------------------------------------------

-- Só o ADM principal muda quem é ADM principal.
-- (Correção: agora o comando manual pelo SQL Editor também funciona.)
create or replace function public.ibnm_protege_adm()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.is_adm is distinct from old.is_adm then
    if public.ibnm_interno() then
      null;   -- SQL Editor / serviço interno: liberado
    elsif not public.ibnm_is_adm() then
      new.is_adm := old.is_adm;
    elsif old.is_adm and not new.is_adm
          and not exists (select 1 from public.ibnm_perfis p where p.is_adm and p.id <> old.id) then
      raise exception 'A igreja precisa ter pelo menos um ADM principal.';
    end if;
  end if;
  new.atualizado_em := now();
  return new;
end;
$$;

-- Dados da igreja: cada ADM de seção só altera a parte que lhe cabe.
--   seção "igreja" -> dados gerais   |  "pix" -> pix e oferta  |  "radio" -> rádio
create or replace function public.ibnm_config_protege()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v jsonb;
  k text;
begin
  new.atualizado_em := now();
  if public.ibnm_interno() or public.ibnm_is_adm() then
    return new;
  end if;
  new.chave := old.chave;
  if old.chave = 'igreja' then
    v := coalesce(old.valor, '{}'::jsonb);
    if jsonb_typeof(new.valor) = 'object' then
      if public.ibnm_tem_secao('pix') then
        if new.valor ? 'pix' then v := jsonb_set(v, '{pix}', new.valor -> 'pix', true); end if;
        if new.valor ? 'oferta' then v := jsonb_set(v, '{oferta}', new.valor -> 'oferta', true); end if;
      end if;
      if public.ibnm_tem_secao('radio') and new.valor ? 'radio' then
        v := jsonb_set(v, '{radio}', new.valor -> 'radio', true);
      end if;
      if public.ibnm_tem_secao('igreja') then
        for k in select jsonb_object_keys(new.valor) loop
          if k not in ('pix', 'oferta', 'radio') then
            v := jsonb_set(v, array[k], new.valor -> k, true);
          end if;
        end loop;
      end if;
    end if;
    new.valor := v;
  end if;
  return new;
end;
$$;

drop trigger if exists ibnm_config_protege_trg on public.ibnm_config;
create trigger ibnm_config_protege_trg
  before update on public.ibnm_config
  for each row execute function public.ibnm_config_protege();

-- Ofertas: o membro registra a oferta, mas só quem cuida das ofertas confirma.
create or replace function public.ibnm_oferta_protege()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if public.ibnm_interno() or public.ibnm_tem_secao('ofertas') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'pendente';
    new.confirmado_em := null;
  else
    new.status := old.status;
    new.confirmado_em := old.confirmado_em;
    new.valor := old.valor;
    new.user_id := old.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists ibnm_oferta_protege_trg on public.ibnm_ofertas;
create trigger ibnm_oferta_protege_trg
  before insert or update on public.ibnm_ofertas
  for each row execute function public.ibnm_oferta_protege();

-- ------------------------------------------------------------
-- 7. SEGURANÇA (RLS)
-- ------------------------------------------------------------
alter table public.ibnm_secoes          enable row level security;
alter table public.ibnm_secao_adms      enable row level security;
alter table public.ibnm_secao_posts     enable row level security;
alter table public.ibnm_secao_materiais enable row level security;
alter table public.ibnm_secao_fotos     enable row level security;
alter table public.ibnm_ebd_salas       enable row level security;
alter table public.ibnm_ebd_matriculas  enable row level security;
alter table public.ibnm_ebd_aulas       enable row level security;
alter table public.ibnm_ebd_presencas   enable row level security;
alter table public.ibnm_ebd_relatorios  enable row level security;

grant select on public.ibnm_secoes, public.ibnm_ebd_salas,
                public.ibnm_secao_posts, public.ibnm_secao_materiais to anon, authenticated;
grant select on public.ibnm_secao_adms, public.ibnm_secao_fotos, public.ibnm_ebd_matriculas,
                public.ibnm_ebd_aulas, public.ibnm_ebd_presencas, public.ibnm_ebd_relatorios to authenticated;
grant insert, update, delete on public.ibnm_secoes, public.ibnm_secao_adms,
                public.ibnm_secao_posts, public.ibnm_secao_materiais, public.ibnm_secao_fotos,
                public.ibnm_ebd_salas, public.ibnm_ebd_matriculas, public.ibnm_ebd_aulas,
                public.ibnm_ebd_presencas, public.ibnm_ebd_relatorios to authenticated;

-- funções que só fazem sentido para quem está logado
revoke all on function public.ibnm_ebd_matricular(uuid, text) from public, anon;
revoke all on function public.ibnm_ebd_sair(uuid) from public, anon;
revoke all on function public.ibnm_ebd_salvar_chamada(uuid, date, jsonb, jsonb) from public, anon;
revoke all on function public.ibnm_ebd_buscar_pessoas(text) from public, anon;
grant execute on function public.ibnm_ebd_matricular(uuid, text) to authenticated;
grant execute on function public.ibnm_ebd_sair(uuid) to authenticated;
grant execute on function public.ibnm_ebd_salvar_chamada(uuid, date, jsonb, jsonb) to authenticated;
grant execute on function public.ibnm_ebd_buscar_pessoas(text) to authenticated;
grant execute on function public.ibnm_meu_acesso() to anon, authenticated;
grant execute on function public.ibnm_ebd_resumo() to anon, authenticated;

-- SEÇÕES: todos veem; só o ADM principal cria, edita e exclui
drop policy if exists ibnm_secoes_ler on public.ibnm_secoes;
create policy ibnm_secoes_ler on public.ibnm_secoes
  for select to anon, authenticated using (true);

drop policy if exists ibnm_secoes_adm on public.ibnm_secoes;
create policy ibnm_secoes_adm on public.ibnm_secoes
  for all to authenticated
  using (public.ibnm_is_adm()) with check (public.ibnm_is_adm());

-- ADMs DE SEÇÃO: cada um vê o próprio acesso; só o ADM principal libera ou tira
drop policy if exists ibnm_secao_adms_ler on public.ibnm_secao_adms;
create policy ibnm_secao_adms_ler on public.ibnm_secao_adms
  for select to authenticated
  using (user_id = auth.uid() or public.ibnm_is_adm());

drop policy if exists ibnm_secao_adms_adm on public.ibnm_secao_adms;
create policy ibnm_secao_adms_adm on public.ibnm_secao_adms
  for all to authenticated
  using (public.ibnm_is_adm()) with check (public.ibnm_is_adm());

-- MURAL DAS SEÇÕES
drop policy if exists ibnm_secao_posts_ler on public.ibnm_secao_posts;
create policy ibnm_secao_posts_ler on public.ibnm_secao_posts
  for select to anon, authenticated
  using ((publicado and public.ibnm_secao_ativa(secao_id)) or public.ibnm_tem_secao_id(secao_id));

drop policy if exists ibnm_secao_posts_adm on public.ibnm_secao_posts;
create policy ibnm_secao_posts_adm on public.ibnm_secao_posts
  for all to authenticated
  using (public.ibnm_tem_secao_id(secao_id)) with check (public.ibnm_tem_secao_id(secao_id));

-- MATERIAIS
drop policy if exists ibnm_secao_materiais_ler on public.ibnm_secao_materiais;
create policy ibnm_secao_materiais_ler on public.ibnm_secao_materiais
  for select to anon, authenticated
  using ((publicado and public.ibnm_secao_ativa(secao_id)) or public.ibnm_pode_editar_conteudo(secao_id, sala_id));

drop policy if exists ibnm_secao_materiais_adm on public.ibnm_secao_materiais;
create policy ibnm_secao_materiais_adm on public.ibnm_secao_materiais
  for all to authenticated
  using (public.ibnm_pode_editar_conteudo(secao_id, sala_id))
  with check (public.ibnm_pode_editar_conteudo(secao_id, sala_id));

-- FOTOS (só para quem está logado)
drop policy if exists ibnm_secao_fotos_ler on public.ibnm_secao_fotos;
create policy ibnm_secao_fotos_ler on public.ibnm_secao_fotos
  for select to authenticated
  using (public.ibnm_secao_ativa(secao_id) or public.ibnm_pode_editar_conteudo(secao_id, sala_id));

drop policy if exists ibnm_secao_fotos_adm on public.ibnm_secao_fotos;
create policy ibnm_secao_fotos_adm on public.ibnm_secao_fotos
  for all to authenticated
  using (public.ibnm_pode_editar_conteudo(secao_id, sala_id))
  with check (public.ibnm_pode_editar_conteudo(secao_id, sala_id));

-- SALAS DA ESCOLA BÍBLICA
drop policy if exists ibnm_ebd_salas_ler on public.ibnm_ebd_salas;
create policy ibnm_ebd_salas_ler on public.ibnm_ebd_salas
  for select to anon, authenticated
  using (ativo or public.ibnm_tem_secao('ebd'));

drop policy if exists ibnm_ebd_salas_adm on public.ibnm_ebd_salas;
create policy ibnm_ebd_salas_adm on public.ibnm_ebd_salas
  for all to authenticated
  using (public.ibnm_tem_secao('ebd')) with check (public.ibnm_tem_secao('ebd'));

-- MATRÍCULAS: a pessoa vê a própria; todos os logados veem quem são os professores;
-- o ADM da Escola Bíblica e o professor da sala veem e cuidam da lista da sala
drop policy if exists ibnm_ebd_matriculas_ler on public.ibnm_ebd_matriculas;
create policy ibnm_ebd_matriculas_ler on public.ibnm_ebd_matriculas
  for select to authenticated
  using (user_id = auth.uid()
         or (papel = 'professor' and status = 'ativo')
         or public.ibnm_ebd_gestor(sala_id));

drop policy if exists ibnm_ebd_matriculas_gerir on public.ibnm_ebd_matriculas;
create policy ibnm_ebd_matriculas_gerir on public.ibnm_ebd_matriculas
  for all to authenticated
  using (public.ibnm_ebd_gestor(sala_id)) with check (public.ibnm_ebd_gestor(sala_id));

-- AULAS (chamadas)
drop policy if exists ibnm_ebd_aulas_ler on public.ibnm_ebd_aulas;
create policy ibnm_ebd_aulas_ler on public.ibnm_ebd_aulas
  for select to authenticated
  using (public.ibnm_ebd_gestor(sala_id) or public.ibnm_ebd_membro(sala_id));

drop policy if exists ibnm_ebd_aulas_gerir on public.ibnm_ebd_aulas;
create policy ibnm_ebd_aulas_gerir on public.ibnm_ebd_aulas
  for all to authenticated
  using (public.ibnm_ebd_gestor(sala_id)) with check (public.ibnm_ebd_gestor(sala_id));

-- PRESENÇAS: o aluno vê as próprias; quem cuida da sala vê todas
drop policy if exists ibnm_ebd_presencas_ler on public.ibnm_ebd_presencas;
create policy ibnm_ebd_presencas_ler on public.ibnm_ebd_presencas
  for select to authenticated
  using (public.ibnm_ebd_minha_matricula(matricula_id) or public.ibnm_ebd_gestor_aula(aula_id));

drop policy if exists ibnm_ebd_presencas_gerir on public.ibnm_ebd_presencas;
create policy ibnm_ebd_presencas_gerir on public.ibnm_ebd_presencas
  for all to authenticated
  using (public.ibnm_ebd_gestor_aula(aula_id)) with check (public.ibnm_ebd_gestor_aula(aula_id));

-- FOTOS DO RELATÓRIO: ADM da Escola Bíblica (todas) e professor (as da própria sala)
drop policy if exists ibnm_ebd_relatorios_gerir on public.ibnm_ebd_relatorios;
create policy ibnm_ebd_relatorios_gerir on public.ibnm_ebd_relatorios
  for all to authenticated
  using (public.ibnm_tem_secao('ebd') or public.ibnm_ebd_professor(sala_id))
  with check (public.ibnm_tem_secao('ebd') or public.ibnm_ebd_professor(sala_id));

-- ---------- tabelas da versão 1.0: agora aceitam também o ADM da seção ----------

-- PERFIS: quem cuida de "Membros" vê a lista (só o ADM principal edita ou apaga)
drop policy if exists ibnm_perfis_ler on public.ibnm_perfis;
create policy ibnm_perfis_ler on public.ibnm_perfis
  for select to authenticated
  using (id = auth.uid() or (select public.ibnm_tem_secao('membros')));

-- CONFIG: o ADM principal faz tudo; ADM de seção só atualiza (a função acima filtra o que pode)
drop policy if exists ibnm_config_secao on public.ibnm_config;
create policy ibnm_config_secao on public.ibnm_config
  for update to authenticated
  using ((chave = 'igreja' and (public.ibnm_tem_secao('igreja') or public.ibnm_tem_secao('pix') or public.ibnm_tem_secao('radio')))
      or (chave = 'ebd' and public.ibnm_tem_secao('ebd')))
  with check ((chave = 'igreja' and (public.ibnm_tem_secao('igreja') or public.ibnm_tem_secao('pix') or public.ibnm_tem_secao('radio')))
      or (chave = 'ebd' and public.ibnm_tem_secao('ebd')));

-- DEVOCIONAIS
drop policy if exists ibnm_devocionais_ler on public.ibnm_devocionais;
create policy ibnm_devocionais_ler on public.ibnm_devocionais
  for select to anon, authenticated
  using (publicado = true or (select public.ibnm_tem_secao('devocional')));

drop policy if exists ibnm_devocionais_adm on public.ibnm_devocionais;
create policy ibnm_devocionais_adm on public.ibnm_devocionais
  for all to authenticated
  using ((select public.ibnm_tem_secao('devocional'))) with check ((select public.ibnm_tem_secao('devocional')));

-- EVENTOS
drop policy if exists ibnm_eventos_ler on public.ibnm_eventos;
create policy ibnm_eventos_ler on public.ibnm_eventos
  for select to anon, authenticated
  using (publicado = true or (select public.ibnm_tem_secao('eventos')));

drop policy if exists ibnm_eventos_adm on public.ibnm_eventos;
create policy ibnm_eventos_adm on public.ibnm_eventos
  for all to authenticated
  using ((select public.ibnm_tem_secao('eventos'))) with check ((select public.ibnm_tem_secao('eventos')));

-- PALAVRAS
drop policy if exists ibnm_palavras_ler on public.ibnm_palavras;
create policy ibnm_palavras_ler on public.ibnm_palavras
  for select to anon, authenticated
  using (publicado = true or (select public.ibnm_tem_secao('palavra')));

drop policy if exists ibnm_palavras_adm on public.ibnm_palavras;
create policy ibnm_palavras_adm on public.ibnm_palavras
  for all to authenticated
  using ((select public.ibnm_tem_secao('palavra'))) with check ((select public.ibnm_tem_secao('palavra')));

-- AVISOS
drop policy if exists ibnm_avisos_ler on public.ibnm_avisos;
create policy ibnm_avisos_ler on public.ibnm_avisos
  for select to anon, authenticated
  using ((publicado = true and (expira_em is null or expira_em >= current_date)) or (select public.ibnm_tem_secao('avisos')));

drop policy if exists ibnm_avisos_adm on public.ibnm_avisos;
create policy ibnm_avisos_adm on public.ibnm_avisos
  for all to authenticated
  using ((select public.ibnm_tem_secao('avisos'))) with check ((select public.ibnm_tem_secao('avisos')));

-- ORAÇÕES
drop policy if exists ibnm_oracoes_ler on public.ibnm_oracoes;
create policy ibnm_oracoes_ler on public.ibnm_oracoes
  for select to authenticated
  using (user_id = auth.uid() or (select public.ibnm_tem_secao('oracoes')));

drop policy if exists ibnm_oracoes_editar on public.ibnm_oracoes;
create policy ibnm_oracoes_editar on public.ibnm_oracoes
  for update to authenticated
  using (user_id = auth.uid() or (select public.ibnm_tem_secao('oracoes')))
  with check (user_id = auth.uid() or (select public.ibnm_tem_secao('oracoes')));

drop policy if exists ibnm_oracoes_apagar on public.ibnm_oracoes;
create policy ibnm_oracoes_apagar on public.ibnm_oracoes
  for delete to authenticated
  using (user_id = auth.uid() or (select public.ibnm_tem_secao('oracoes')));

-- OFERTAS
drop policy if exists ibnm_ofertas_ler on public.ibnm_ofertas;
create policy ibnm_ofertas_ler on public.ibnm_ofertas
  for select to authenticated
  using (user_id = auth.uid() or (select public.ibnm_tem_secao('ofertas')));

drop policy if exists ibnm_ofertas_editar on public.ibnm_ofertas;
create policy ibnm_ofertas_editar on public.ibnm_ofertas
  for update to authenticated
  using (user_id = auth.uid() or (select public.ibnm_tem_secao('ofertas')))
  with check (user_id = auth.uid() or (select public.ibnm_tem_secao('ofertas')));

drop policy if exists ibnm_ofertas_apagar on public.ibnm_ofertas;
create policy ibnm_ofertas_apagar on public.ibnm_ofertas
  for delete to authenticated
  using (user_id = auth.uid() or (select public.ibnm_tem_secao('ofertas')));

-- ------------------------------------------------------------
-- 8. ARQUIVOS
--    igreja (privado)
--       comprovantes/<id do usuário>/…          comprovante de oferta
--       ebd/relatorios/<id da sala | geral>/…   foto do relatório da sala
--    igreja-publico
--       secoes/<chave>/<id da sala | geral>/…   fotos e imagens das seções
--       (outras pastas: imagens do painel — palavra, agenda, rádio…)
-- ------------------------------------------------------------

-- Pode ver/enviar este arquivo da Escola Bíblica no bucket privado?
create or replace function public.ibnm_ebd_arquivo(p_nome text)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select split_part(p_nome, '/', 1) = 'ebd'
     and (public.ibnm_tem_secao('ebd')
          or public.ibnm_ebd_professor(public.ibnm_uuid(split_part(p_nome, '/', 3))));
$$;

-- Pode enviar imagens públicas? (quem publica conteúdo no app)
create or replace function public.ibnm_pode_publicar()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.ibnm_is_adm()
      or exists (select 1 from public.ibnm_secao_adms a where a.user_id = auth.uid())
      or exists (select 1 from public.ibnm_ebd_matriculas m
                  where m.user_id = auth.uid() and m.papel = 'professor' and m.status = 'ativo');
$$;

-- Pode apagar este arquivo público? (ADM da seção dona da pasta, ou professor da sala)
create or replace function public.ibnm_arquivo_da_secao(p_nome text)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select split_part(p_nome, '/', 1) = 'secoes'
     and (public.ibnm_tem_secao(split_part(p_nome, '/', 2))
          or (split_part(p_nome, '/', 2) = 'ebd'
              and public.ibnm_ebd_professor(public.ibnm_uuid(split_part(p_nome, '/', 3)))));
$$;

drop policy if exists ibnm_storage_privado_ler on storage.objects;
create policy ibnm_storage_privado_ler on storage.objects
  for select to authenticated
  using (bucket_id = 'igreja' and (
       owner = auth.uid()
    or public.ibnm_is_adm()
    or (split_part(name, '/', 1) = 'comprovantes'
        and (split_part(name, '/', 2) = auth.uid()::text or public.ibnm_tem_secao('ofertas')))
    or public.ibnm_ebd_arquivo(name)
  ));

drop policy if exists ibnm_storage_privado_enviar on storage.objects;
create policy ibnm_storage_privado_enviar on storage.objects
  for insert to authenticated
  with check (bucket_id = 'igreja' and (
       public.ibnm_is_adm()
    or (split_part(name, '/', 1) = 'comprovantes' and split_part(name, '/', 2) = auth.uid()::text)
    or public.ibnm_ebd_arquivo(name)
  ));

drop policy if exists ibnm_storage_privado_apagar on storage.objects;
create policy ibnm_storage_privado_apagar on storage.objects
  for delete to authenticated
  using (bucket_id = 'igreja' and (public.ibnm_is_adm() or public.ibnm_ebd_arquivo(name)));

drop policy if exists ibnm_storage_publico_enviar on storage.objects;
create policy ibnm_storage_publico_enviar on storage.objects
  for insert to authenticated
  with check (bucket_id = 'igreja-publico' and (
       public.ibnm_pode_publicar()
    or (split_part(name, '/', 1) = 'perfis' and split_part(name, '/', 2) = auth.uid()::text)
  ));

drop policy if exists ibnm_storage_publico_apagar on storage.objects;
create policy ibnm_storage_publico_apagar on storage.objects
  for delete to authenticated
  using (bucket_id = 'igreja-publico' and (public.ibnm_is_adm() or public.ibnm_arquivo_da_secao(name)));

-- ------------------------------------------------------------
-- 9. PRONTO!
--    * O ADM principal continua sendo quem tem is_adm = true.
--      Para definir pelo SQL Editor (agora funciona):
--        update public.ibnm_perfis set is_adm = true where email = 'seu@email.com';
--    * No app: Mais › Painel do administrador › 👑 ADMs para liberar seções.
-- ------------------------------------------------------------
