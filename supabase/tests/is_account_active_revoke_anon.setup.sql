-- 시험 DB 준비(폐기용): 빈 시험 DB에 is_account_active 시그니처만 가진 대역을 둔다(실제 동작은 격리 실제 스택 E2E가 검증).
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;
create or replace function public.is_account_active(user_id uuid) returns boolean language sql as $f$ select true $f$;
-- 운영과 같은 시작 상태: anon도 실행 가능
grant execute on function public.is_account_active(uuid) to anon, authenticated, service_role;
