-- 시험 DB 준비(폐기용): 운영 20261107070000의 job_duplicate_decide 중 이 migration이 바꾸는 줄을 가진 대역(실제 본문·역할별 동작은 .concurrent.mjs가 운영 정의로 시험).
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
create or replace function auth.role() returns text language sql stable as $f$ select nullif(current_setting('request.jwt.claim.role', true), '') $f$;
create or replace function public.is_admin() returns boolean language sql stable as $f$ select false $f$;
create or replace function public.job_duplicate_decide(p_job bigint, p_decision text) returns text
language plpgsql security definer set search_path = pg_catalog, public as $f$
begin
  if not (current_user in ('postgres', 'supabase_admin', 'service_role') or (auth.uid() is not null and public.is_admin())) then
    raise exception 'duplicate decide: 관리자만' using errcode = 'insufficient_privilege';
  end if;
  return 'ok';
end $f$;
revoke all on function public.job_duplicate_decide(bigint, text) from public, anon;
grant execute on function public.job_duplicate_decide(bigint, text) to authenticated, service_role;
