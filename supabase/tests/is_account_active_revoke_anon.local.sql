-- 로컬 폐기용 PostgreSQL 전용(운영 접근 없음): 적용 뒤 anon 실행 불가·authenticated·service_role 실행 가능(운영 점검과 같은 기준).
\set ON_ERROR_STOP 1
do $$
begin
  if has_function_privilege('anon', 'public.is_account_active(uuid)', 'execute') then raise exception 'is_account_active revoke anon: anon이 아직 실행 가능'; end if;
  if not has_function_privilege('authenticated', 'public.is_account_active(uuid)', 'execute') then raise exception 'is_account_active revoke anon: authenticated가 못 씀(정책 평가가 깨짐)'; end if;
  if not has_function_privilege('service_role', 'public.is_account_active(uuid)', 'execute') then raise exception 'is_account_active revoke anon: service_role이 못 씀'; end if;
end $$;
select 'PASS: is_account_active_revoke_anon local' as result;
