-- 시험 DB 준비(폐기용): 빈 시험 DB에 관리자 함수 4개의 시그니처만 가진 대역을 둔다(본문·역할별 실제 동작은 격리 실제 스택 E2E와 real_chain_structure가 실제 정의로 시험).
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;
create or replace function public.admin_handle_report(target_report_id uuid, next_status text, note text default '') returns text language sql as $f$ select 'x' $f$;
create or replace function public.admin_list_users() returns text language sql as $f$ select 'x' $f$;
create or replace function public.admin_set_account_status(target_user_id uuid, next_status text, reason text default '') returns text language sql as $f$ select 'x' $f$;
create or replace function public.admin_set_job_hidden(target_job_id bigint, hidden boolean, reason text) returns text language sql as $f$ select 'x' $f$;
-- 운영과 같은 시작 상태: anon도 실행 가능
grant execute on function public.admin_handle_report(uuid, text, text), public.admin_list_users(), public.admin_set_account_status(uuid, text, text), public.admin_set_job_hidden(bigint, boolean, text) to anon, authenticated, service_role;
