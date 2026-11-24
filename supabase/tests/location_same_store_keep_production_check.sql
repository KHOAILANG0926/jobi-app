-- 읽기 전용(공고 번호·건수 고정 없음): 위치 쓰기 함수에 같은 지점 확정 줄 보존 단계가 있고, 권한은 그대로인지.
do $$declare d text:=pg_get_functiondef('location_private.write_location(bigint,text,jsonb)'::regprocedure);begin
 if position('같은 지점의 확정 줄' in d)=0 then raise exception 'same-store keep step missing in write_location';end if;
 if exists(select 1 from pg_roles r where r.rolname in ('anon','authenticated','service_role')
  and has_function_privilege(r.rolname,'location_private.write_location(bigint,text,jsonb)','EXECUTE')) then raise exception 'private writer exposed';end if;
 if has_schema_privilege('location_writer','location_private','CREATE') then raise exception 'temporary writer schema CREATE not restored';end if;
end$$;
