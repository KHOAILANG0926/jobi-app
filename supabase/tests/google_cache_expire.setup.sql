-- 20261110091000_google_cache_expire.sql 시험 DB 준비: 비공개 저장소 표(운영과 같은 칸)와 service_role.
create table if not exists public.research_artifacts (
  id bigint generated always as identity primary key, kind text not null, name text not null, payload jsonb not null,
  meta jsonb not null default '{}'::jsonb, created_by uuid, created_at timestamptz not null default now(), unique (kind, name));
do $$ begin if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if; end $$;
