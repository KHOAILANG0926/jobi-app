-- 읽기 전용 점검(데이터 변경 없음): is_account_active를 비로그인(anon)은 실행할 수 없고 로그인 세션(authenticated)·서버(service_role)는 그대로 실행할 수 있다.
\set ON_ERROR_STOP 1
do $$
begin
  if has_function_privilege('anon', 'public.is_account_active(uuid)', 'execute') then raise exception 'is_account_active revoke anon: anon이 아직 실행 가능'; end if;
  if not has_function_privilege('authenticated', 'public.is_account_active(uuid)', 'execute') then raise exception 'is_account_active revoke anon: authenticated가 못 씀(정책 평가가 깨짐)'; end if;
  if not has_function_privilege('service_role', 'public.is_account_active(uuid)', 'execute') then raise exception 'is_account_active revoke anon: service_role이 못 씀'; end if;
end $$;
select 'PASS: is_account_active_revoke_anon production check' as result;
