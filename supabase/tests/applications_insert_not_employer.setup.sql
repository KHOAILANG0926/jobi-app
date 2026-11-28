-- 시험 DB 준비(폐기용): 이 migration이 바꾸는 정책이 읽는 표·함수 대역(실제 동작은 applications_insert_not_employer.pglite.test.mjs가 시험).
create table if not exists public.account_roles (user_id uuid primary key, role text not null);
create table if not exists public.applications (id bigint generated always as identity primary key, job_id bigint, seeker_id uuid, employer_id uuid, status text);
alter table public.applications enable row level security;
create or replace function public.is_account_active(uid uuid) returns boolean language sql as $$ select true $$;
create policy applications_insert on public.applications for insert with check (true);
