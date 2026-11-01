-- CI 전용 최소 준비물: 브랜드 표 migration(20260910120000)이 기대하는 auth·관리자 함수 껍데기.
create schema if not exists auth;
create table if not exists auth.users(id uuid primary key);
create or replace function public.is_admin() returns boolean language sql stable as $$ select false $$;
create or replace function public.require_admin() returns uuid language plpgsql as $$ begin raise exception 'not admin'; end $$;
