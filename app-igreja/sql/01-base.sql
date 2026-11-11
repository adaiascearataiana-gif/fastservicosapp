-- ============================================================
--  APP IGREJA BATISTA EM NOVA METRÓPOLE  —  versão 1.0
--  Banco de dados completo (tabelas, segurança e conteúdo base)
--
--  Como usar:
--    Supabase  ->  SQL Editor  ->  New query  ->  cole tudo  ->  Run
--  Pode rodar quantas vezes quiser: não apaga dados existentes.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. PERFIS (quem entra no app)
-- ------------------------------------------------------------
create table if not exists public.ibnm_perfis (
  id            uuid primary key references auth.users(id) on delete cascade,
  nome          text not null default '',
  email         text,
  telefone      text not null default '',
  nascimento    date,                       -- data de nascimento
  casamento     date,                       -- aniversário de casamento (opcional)
  batismo       date,                       -- data de batismo (opcional)
  ministerio    text not null default '',   -- onde a pessoa serve (opcional)
  endereco      text not null default '',
  numero        text not null default '',
  complemento   text not null default '',
  bairro        text not null default '',
  cidade        text not null default '',
  cep           text not null default '',
  foto_url      text not null default '',
  is_adm        boolean not null default false,
  origem        text not null default 'email',   -- email | google
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.ibnm_perfis add column if not exists casamento date;
alter table public.ibnm_perfis add column if not exists complemento text not null default '';
alter table public.ibnm_perfis add column if not exists batismo date;
alter table public.ibnm_perfis add column if not exists ministerio text not null default '';

-- ------------------------------------------------------------
-- 2. FUNÇÕES DE APOIO
-- ------------------------------------------------------------

-- Diz se o usuário logado é administrador.
create or replace function public.ibnm_is_adm()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce((select p.is_adm from public.ibnm_perfis p where p.id = auth.uid()), false);
$$;

-- O primeiro perfil cadastrado vira administrador automaticamente.
create or replace function public.ibnm_perfil_bootstrap()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.ibnm_perfis) then
    new.is_adm := true;
  end if;
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists ibnm_perfil_bootstrap_trg on public.ibnm_perfis;
create trigger ibnm_perfil_bootstrap_trg
  before insert on public.ibnm_perfis
  for each row execute function public.ibnm_perfil_bootstrap();

-- Ninguém consegue se transformar em ADM sozinho (só um ADM pode).
create or replace function public.ibnm_protege_adm()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.is_adm is distinct from old.is_adm and not public.ibnm_is_adm() then
    new.is_adm := old.is_adm;
  end if;
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists ibnm_protege_adm_trg on public.ibnm_perfis;
create trigger ibnm_protege_adm_trg
  before update on public.ibnm_perfis
  for each row execute function public.ibnm_protege_adm();

-- Cria o perfil automaticamente quando alguém cria conta (e-mail ou Google).
create or replace function public.ibnm_novo_usuario()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.ibnm_perfis (id, nome, email, foto_url, origem)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'nome', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    new.email,
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', ''),
    case when new.raw_app_meta_data->>'provider' = 'google' then 'google' else 'email' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists ibnm_novo_usuario_trg on auth.users;
create trigger ibnm_novo_usuario_trg
  after insert on auth.users
  for each row execute function public.ibnm_novo_usuario();

-- Atualiza "atualizado_em" sozinho nas tabelas de conteúdo.
create or replace function public.ibnm_toque()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 3. CONFIGURAÇÕES DA IGREJA (tudo que o ADM edita no app)
-- ------------------------------------------------------------
create table if not exists public.ibnm_config (
  chave         text primary key,
  valor         jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);

insert into public.ibnm_config (chave, valor)
values ('igreja', jsonb_build_object(
  'nome',      'Igreja Batista em Nova Metrópole',
  'sigla',     'IBNM',
  'pastor',    '',
  'endereco',  '',
  'bairro',    '',
  'cidade',    'Caucaia',
  'uf',        'CE',
  'cep',       '',
  'telefone',  '',
  'whatsapp',  '',
  'email',     '',
  'boas_vindas', 'Que bom ter você aqui! Este é o nosso espaço para acompanhar a vida da igreja.',
  'horarios', jsonb_build_array(
     jsonb_build_object('dia','Domingo','hora','18:00','titulo','Culto de Celebração'),
     jsonb_build_object('dia','Quarta-feira','hora','19:30','titulo','Culto de Ensino e Oração')
  ),
  'links', jsonb_build_object(
     'instagram', '', 'youtube', '', 'facebook', '', 'site', '', 'maps', ''
  ),
  'pix', jsonb_build_object(
     'chave', '', 'tipo', 'telefone',
     'nome', 'IGREJA BATISTA EM NOVA METROPOLE',
     'cidade', 'CAUCAIA',
     'mensagem', 'Sua oferta ajuda a igreja a levar o evangelho e cuidar de pessoas.'
  ),
  'oferta', jsonb_build_object(
     'ativa', true,
     'tipos', jsonb_build_array('Dízimo','Oferta','Missões','Outro'),
     'texto', 'Escolha o valor e use o PIX. Se puder, envie o comprovante para a tesouraria.'
  ),
  'radio', jsonb_build_object(
     'ativa', false, 'ao_vivo', false,
     'nome', 'Rádio IBNM', 'url', '', 'capa', '',
     'mensagem', 'Ouça a rádio da igreja onde estiver.'
  )
))
on conflict (chave) do nothing;

-- ------------------------------------------------------------
-- 4. DEVOCIONAL DO DIA
-- ------------------------------------------------------------
create table if not exists public.ibnm_devocionais (
  id            uuid primary key default gen_random_uuid(),
  data          date not null unique,
  titulo        text not null default '',
  versiculo     text not null default '',
  referencia    text not null default '',
  texto         text not null default '',
  autor         text not null default '',
  publicado     boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

drop trigger if exists ibnm_devocionais_toque on public.ibnm_devocionais;
create trigger ibnm_devocionais_toque before update on public.ibnm_devocionais
  for each row execute function public.ibnm_toque();

-- ------------------------------------------------------------
-- 5. AGENDA: CULTOS, PROGRAMAÇÕES, ATIVIDADES E REUNIÕES
-- ------------------------------------------------------------
create table if not exists public.ibnm_eventos (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null default '',
  descricao     text not null default '',
  categoria     text not null default 'programacao'
                check (categoria in ('culto','programacao','atividade','reuniao','especial')),
  data          date,                        -- data do evento (null quando é toda semana)
  hora          time,
  hora_fim      time,
  local         text not null default '',
  recorrente    boolean not null default false,   -- repete toda semana
  dia_semana    int check (dia_semana between 0 and 6),  -- 0 = domingo
  imagem        text not null default '',
  destaque      boolean not null default false,
  publicado     boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint ibnm_evento_tem_data check (recorrente = true or data is not null)
);

create index if not exists ibnm_eventos_data_idx on public.ibnm_eventos (data);
create index if not exists ibnm_eventos_recorrente_idx on public.ibnm_eventos (recorrente, dia_semana);

drop trigger if exists ibnm_eventos_toque on public.ibnm_eventos;
create trigger ibnm_eventos_toque before update on public.ibnm_eventos
  for each row execute function public.ibnm_toque();

-- ------------------------------------------------------------
-- 6. PALAVRA PASTORAL
-- ------------------------------------------------------------
create table if not exists public.ibnm_palavras (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null default '',
  autor         text not null default '',
  resumo        text not null default '',
  texto         text not null default '',
  imagem        text not null default '',
  data          date not null default current_date,
  publicado     boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

drop trigger if exists ibnm_palavras_toque on public.ibnm_palavras;
create trigger ibnm_palavras_toque before update on public.ibnm_palavras
  for each row execute function public.ibnm_toque();

-- ------------------------------------------------------------
-- 7. AVISOS (mural)
-- ------------------------------------------------------------
create table if not exists public.ibnm_avisos (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null default '',
  texto         text not null default '',
  urgencia      text not null default 'normal' check (urgencia in ('normal','importante')),
  publicado     boolean not null default true,
  expira_em     date,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

drop trigger if exists ibnm_avisos_toque on public.ibnm_avisos;
create trigger ibnm_avisos_toque before update on public.ibnm_avisos
  for each row execute function public.ibnm_toque();

-- ------------------------------------------------------------
-- 8. PEDIDOS DE ORAÇÃO
-- ------------------------------------------------------------
create table if not exists public.ibnm_oracoes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome          text not null default '',
  pedido        text not null default '',
  privado       boolean not null default true,
  status        text not null default 'orando' check (status in ('orando','atendido')),
  resposta      text not null default '',
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists ibnm_oracoes_user_idx on public.ibnm_oracoes (user_id);

drop trigger if exists ibnm_oracoes_toque on public.ibnm_oracoes;
create trigger ibnm_oracoes_toque before update on public.ibnm_oracoes
  for each row execute function public.ibnm_toque();

-- ------------------------------------------------------------
-- 9. OFERTAS / DÍZIMOS
-- ------------------------------------------------------------
create table if not exists public.ibnm_ofertas (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome            text not null default '',
  valor           numeric(12,2) not null check (valor > 0),
  tipo            text not null default 'oferta',
  status          text not null default 'pendente' check (status in ('pendente','confirmado')),
  comprovante_url text not null default '',
  observacao      text not null default '',
  confirmado_em   timestamptz,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

create index if not exists ibnm_ofertas_user_idx on public.ibnm_ofertas (user_id);
create index if not exists ibnm_ofertas_criado_idx on public.ibnm_ofertas (criado_em desc);

drop trigger if exists ibnm_ofertas_toque on public.ibnm_ofertas;
create trigger ibnm_ofertas_toque before update on public.ibnm_ofertas
  for each row execute function public.ibnm_toque();

-- ------------------------------------------------------------
-- 10. ANIVERSARIANTES DO MÊS (só nome e dia, sem expor endereço)
-- ------------------------------------------------------------
create or replace function public.ibnm_aniversariantes(p_mes int default null)
returns table (id uuid, nome text, dia int, foto text)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select p.id,
         p.nome,
         extract(day from p.nascimento)::int as dia,
         p.foto_url as foto
  from public.ibnm_perfis p
  where p.nascimento is not null
    and (p_mes is null or extract(month from p.nascimento)::int = p_mes)
  order by extract(day from p.nascimento)::int;
$$;

revoke all on function public.ibnm_aniversariantes(int) from public, anon;
grant execute on function public.ibnm_aniversariantes(int) to authenticated;

-- ------------------------------------------------------------
-- 11. SEGURANÇA (RLS) — cada tabela com suas regras
-- ------------------------------------------------------------
alter table public.ibnm_perfis       enable row level security;
alter table public.ibnm_config       enable row level security;
alter table public.ibnm_devocionais  enable row level security;
alter table public.ibnm_eventos      enable row level security;
alter table public.ibnm_palavras     enable row level security;
alter table public.ibnm_avisos       enable row level security;
alter table public.ibnm_oracoes      enable row level security;
alter table public.ibnm_ofertas      enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.ibnm_config, public.ibnm_devocionais, public.ibnm_eventos,
                 public.ibnm_palavras, public.ibnm_avisos to anon, authenticated;
grant select, insert, update, delete on public.ibnm_perfis, public.ibnm_oracoes,
                 public.ibnm_ofertas to authenticated;
grant insert, update, delete on public.ibnm_config, public.ibnm_devocionais,
                 public.ibnm_eventos, public.ibnm_palavras, public.ibnm_avisos to authenticated;

-- PERFIS
drop policy if exists ibnm_perfis_ler on public.ibnm_perfis;
create policy ibnm_perfis_ler on public.ibnm_perfis
  for select to authenticated
  using (id = auth.uid() or public.ibnm_is_adm());

drop policy if exists ibnm_perfis_criar on public.ibnm_perfis;
create policy ibnm_perfis_criar on public.ibnm_perfis
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists ibnm_perfis_editar on public.ibnm_perfis;
create policy ibnm_perfis_editar on public.ibnm_perfis
  for update to authenticated
  using (id = auth.uid() or public.ibnm_is_adm())
  with check (id = auth.uid() or public.ibnm_is_adm());

drop policy if exists ibnm_perfis_adm_apagar on public.ibnm_perfis;
create policy ibnm_perfis_adm_apagar on public.ibnm_perfis
  for delete to authenticated
  using (public.ibnm_is_adm());

-- CONFIG
drop policy if exists ibnm_config_ler on public.ibnm_config;
create policy ibnm_config_ler on public.ibnm_config
  for select to anon, authenticated using (true);

drop policy if exists ibnm_config_adm on public.ibnm_config;
create policy ibnm_config_adm on public.ibnm_config
  for all to authenticated
  using (public.ibnm_is_adm()) with check (public.ibnm_is_adm());

-- DEVOCIONAIS
drop policy if exists ibnm_devocionais_ler on public.ibnm_devocionais;
create policy ibnm_devocionais_ler on public.ibnm_devocionais
  for select to anon, authenticated
  using (publicado = true or public.ibnm_is_adm());

drop policy if exists ibnm_devocionais_adm on public.ibnm_devocionais;
create policy ibnm_devocionais_adm on public.ibnm_devocionais
  for all to authenticated
  using (public.ibnm_is_adm()) with check (public.ibnm_is_adm());

-- EVENTOS
drop policy if exists ibnm_eventos_ler on public.ibnm_eventos;
create policy ibnm_eventos_ler on public.ibnm_eventos
  for select to anon, authenticated
  using (publicado = true or public.ibnm_is_adm());

drop policy if exists ibnm_eventos_adm on public.ibnm_eventos;
create policy ibnm_eventos_adm on public.ibnm_eventos
  for all to authenticated
  using (public.ibnm_is_adm()) with check (public.ibnm_is_adm());

-- PALAVRAS
drop policy if exists ibnm_palavras_ler on public.ibnm_palavras;
create policy ibnm_palavras_ler on public.ibnm_palavras
  for select to anon, authenticated
  using (publicado = true or public.ibnm_is_adm());

drop policy if exists ibnm_palavras_adm on public.ibnm_palavras;
create policy ibnm_palavras_adm on public.ibnm_palavras
  for all to authenticated
  using (public.ibnm_is_adm()) with check (public.ibnm_is_adm());

-- AVISOS
drop policy if exists ibnm_avisos_ler on public.ibnm_avisos;
create policy ibnm_avisos_ler on public.ibnm_avisos
  for select to anon, authenticated
  using ((publicado = true and (expira_em is null or expira_em >= current_date)) or public.ibnm_is_adm());

drop policy if exists ibnm_avisos_adm on public.ibnm_avisos;
create policy ibnm_avisos_adm on public.ibnm_avisos
  for all to authenticated
  using (public.ibnm_is_adm()) with check (public.ibnm_is_adm());

-- ORAÇÕES
drop policy if exists ibnm_oracoes_criar on public.ibnm_oracoes;
create policy ibnm_oracoes_criar on public.ibnm_oracoes
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists ibnm_oracoes_ler on public.ibnm_oracoes;
create policy ibnm_oracoes_ler on public.ibnm_oracoes
  for select to authenticated
  using (user_id = auth.uid() or public.ibnm_is_adm());

drop policy if exists ibnm_oracoes_editar on public.ibnm_oracoes;
create policy ibnm_oracoes_editar on public.ibnm_oracoes
  for update to authenticated
  using (user_id = auth.uid() or public.ibnm_is_adm())
  with check (user_id = auth.uid() or public.ibnm_is_adm());

drop policy if exists ibnm_oracoes_apagar on public.ibnm_oracoes;
create policy ibnm_oracoes_apagar on public.ibnm_oracoes
  for delete to authenticated
  using (user_id = auth.uid() or public.ibnm_is_adm());

-- OFERTAS
drop policy if exists ibnm_ofertas_criar on public.ibnm_ofertas;
create policy ibnm_ofertas_criar on public.ibnm_ofertas
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists ibnm_ofertas_ler on public.ibnm_ofertas;
create policy ibnm_ofertas_ler on public.ibnm_ofertas
  for select to authenticated
  using (user_id = auth.uid() or public.ibnm_is_adm());

drop policy if exists ibnm_ofertas_editar on public.ibnm_ofertas;
create policy ibnm_ofertas_editar on public.ibnm_ofertas
  for update to authenticated
  using (user_id = auth.uid() or public.ibnm_is_adm())
  with check (user_id = auth.uid() or public.ibnm_is_adm());

drop policy if exists ibnm_ofertas_apagar on public.ibnm_ofertas;
create policy ibnm_ofertas_apagar on public.ibnm_ofertas
  for delete to authenticated
  using (user_id = auth.uid() or public.ibnm_is_adm());

-- ------------------------------------------------------------
-- 12. ARQUIVOS (comprovantes e imagens)
--    igreja         -> privado (comprovantes de oferta)
--    igreja-publico -> fotos, capas e avatares
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('igreja', 'igreja', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public)
values ('igreja-publico', 'igreja-publico', true) on conflict (id) do nothing;

drop policy if exists ibnm_storage_privado_ler on storage.objects;
create policy ibnm_storage_privado_ler on storage.objects
  for select to authenticated
  using (bucket_id = 'igreja' and (owner = auth.uid() or public.ibnm_is_adm()));

drop policy if exists ibnm_storage_privado_enviar on storage.objects;
create policy ibnm_storage_privado_enviar on storage.objects
  for insert to authenticated
  with check (bucket_id = 'igreja');

drop policy if exists ibnm_storage_publico_ler on storage.objects;
create policy ibnm_storage_publico_ler on storage.objects
  for select to public
  using (bucket_id = 'igreja-publico');

drop policy if exists ibnm_storage_publico_enviar on storage.objects;
create policy ibnm_storage_publico_enviar on storage.objects
  for insert to authenticated
  with check (bucket_id = 'igreja-publico');

drop policy if exists ibnm_storage_publico_apagar on storage.objects;
create policy ibnm_storage_publico_apagar on storage.objects
  for delete to authenticated
  using (bucket_id = 'igreja-publico' and public.ibnm_is_adm());

-- ------------------------------------------------------------
-- 13. CONTEÚDO DE EXEMPLO (fica oculto até o ADM publicar)
-- ------------------------------------------------------------
insert into public.ibnm_devocionais (data, titulo, versiculo, referencia, texto, autor, publicado)
values (
  current_date,
  'A esperança que não decepciona',
  'Mas os que esperam no Senhor renovarão as suas forças.',
  'Isaías 40:31',
  'Todos nós temos dias em que as forças parecem acabar. E é justamente aí que a Palavra nos lembra: a esperança do cristão não está nas circunstâncias, está no Senhor. Ele não se cansa, não desiste e renova as nossas forças como a águia. Hoje, entregue a Ele o seu cansaço e descanse na certeza de que Ele cuida de você.',
  'Pastor',
  false
)
on conflict (data) do nothing;

insert into public.ibnm_eventos (titulo, descricao, categoria, recorrente, dia_semana, hora, local, publicado)
values
  ('Culto de Celebração', 'Venha adorar com a sua família.', 'culto', true, 0, '18:00', 'Templo da IBNM', false),
  ('Culto de Ensino e Oração', 'Estudo da Palavra e oração pelos pedidos da igreja.', 'culto', true, 3, '19:30', 'Templo da IBNM', false),
  ('Ensaio do Ministério de Louvor', 'Ensaio semanal da equipe de louvor.', 'atividade', true, 5, '19:30', 'Templo da IBNM', false),
  ('Reunião da Mocidade', 'Encontro dos jovens da igreja.', 'reuniao', true, 6, '19:30', 'Salão anexo', false)
on conflict do nothing;

insert into public.ibnm_palavras (titulo, autor, resumo, texto, publicado)
values (
  'Uma igreja que cuida de pessoas',
  'Pastor',
  'Este é um espaço para o pastor compartilhar uma palavra com a igreja.',
  'Escreva aqui a sua palavra pastoral. Você pode falar sobre a vida da igreja, um ensino, um agradecimento ou um convite especial. Para publicar, ligue a opção "Publicado" no painel do administrador.',
  false
);

insert into public.ibnm_avisos (titulo, texto, urgencia, publicado)
values (
  'Bem-vindos ao nosso app!',
  'Este aviso é um exemplo. No painel do administrador você cria, edita e publica os avisos que aparecem na tela inicial.',
  'normal',
  false
);

-- ------------------------------------------------------------
-- 14. PRONTO!
--    Para virar administrador, entre no app pela primeira vez.
--    Se já usava o app antes, rode:
--      update public.ibnm_perfis set is_adm = true where email = 'seu@email.com';
-- ------------------------------------------------------------
