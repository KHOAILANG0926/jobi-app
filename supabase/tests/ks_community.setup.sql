-- 빈 시험 DB 준비: Supabase의 auth 스키마 흉내(회원 표·auth.uid()).
create schema if not exists auth;
create table if not exists auth.users(id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
insert into auth.users values ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000b2') on conflict do nothing;
