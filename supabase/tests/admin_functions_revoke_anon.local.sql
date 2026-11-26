-- 로컬 폐기용 PostgreSQL 전용(운영 접근 없음): 적용 뒤 anon 실행 불가·authenticated·service_role 실행 가능 확인(운영 점검과 같은 기준).
\set ON_ERROR_STOP 1
do $$
declare f text;
begin
  foreach f in array array['public.admin_handle_report(uuid,text,text)', 'public.admin_list_users()', 'public.admin_set_account_status(uuid,text,text)', 'public.admin_set_job_hidden(bigint,boolean,text)'] loop
    if has_function_privilege('anon', f, 'execute') then raise exception 'admin revoke anon: % 를 anon이 아직 실행 가능', f; end if;
    if not has_function_privilege('authenticated', f, 'execute') then raise exception 'admin revoke anon: % 를 authenticated가 못 씀(관리자 화면이 깨짐)', f; end if;
    if not has_function_privilege('service_role', f, 'execute') then raise exception 'admin revoke anon: % 를 service_role이 못 씀', f; end if;
  end loop;
end $$;
select 'PASS: admin_functions_revoke_anon local' as result;
