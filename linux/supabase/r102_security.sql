-- FAST Serviços r102: usuários por setor e auditoria protegidos por RLS.
create extension if not exists pgcrypto;
create table if not exists public.fast_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  setor text not null check (setor in ('administracao','atendimento','logistica','financeiro','rh','motorista')),
  permissoes text[] not null default '{}',
  ativo boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.fast_audit (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id), acao text not null, entidade text not null,
  entidade_id text, detalhes jsonb not null default '{}', created_at timestamptz not null default now()
);
alter table public.fast_profiles enable row level security;
alter table public.fast_audit enable row level security;
drop policy if exists "perfil proprio" on public.fast_profiles;
create policy "perfil proprio" on public.fast_profiles for select to authenticated using (id = auth.uid());
drop policy if exists "auditoria propria inserir" on public.fast_audit;
create policy "auditoria propria inserir" on public.fast_audit for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "administrador le auditoria" on public.fast_audit;
create policy "administrador le auditoria" on public.fast_audit for select to authenticated using (
  exists(select 1 from public.fast_profiles p where p.id=auth.uid() and p.ativo and p.setor='administracao')
);
create or replace function public.fast_me() returns public.fast_profiles language sql stable security invoker
as $$ select * from public.fast_profiles where id=auth.uid() and ativo limit 1 $$;

