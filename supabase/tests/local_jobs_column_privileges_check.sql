-- 열 단위 권한 적용 결과 확인(운영 DB, 읽기 전용). 하나라도 어긋나면 에러로 끝나 워크플로가 실패한다.
do $c$
declare col text; role_name text; bad text := '';
begin
  foreach role_name in array array['anon','authenticated'] loop
    foreach col in array array['source_url','source_text','ocr_text','ocr_check','guest_manage_token'] loop
      if has_column_privilege(role_name, 'public.local_jobs', col, 'select') then bad := bad || role_name || '.' || col || ' 읽힘; '; end if;
    end loop;
    foreach col in array array['id','title','company','active','admin_hidden','employer_id','images','policy_decision'] loop
      if not has_column_privilege(role_name, 'public.local_jobs', col, 'select') then bad := bad || role_name || '.' || col || ' 막힘(앱이 읽는 열); '; end if;
    end loop;
  end loop;
  if has_table_privilege('anon', 'public.local_jobs', 'select') then bad := bad || 'anon 테이블 단위 SELECT가 남아 있음; '; end if;
  if not has_column_privilege('service_role', 'public.local_jobs', 'guest_manage_token', 'select') then bad := bad || 'service_role 막힘; '; end if;
  if bad <> '' then raise exception '열 권한 점검 실패: %', bad; end if;
  raise notice '열 권한 점검 통과';
end $c$;
