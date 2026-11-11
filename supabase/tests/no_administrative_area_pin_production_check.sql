-- 읽기 전용(공고 번호·건수 고정 없음): 위치 쓰기 함수가 더는 성·시 중심 핀을 찍지 않는지, 권한은 그대로인지.
do $$declare d text:=pg_get_functiondef('location_private.write_location(bigint,text,jsonb)'::regprocedure);begin
 if position('location_private.administrative_area(' in d)>0 then raise exception 'write_location still creates administrative area pins';end if;
 if exists(select 1 from pg_roles r where r.rolname in ('anon','authenticated','service_role')
  and has_function_privilege(r.rolname,'location_private.write_location(bigint,text,jsonb)','EXECUTE')) then raise exception 'private writer exposed';end if;
 if has_schema_privilege('location_writer','location_private','CREATE') then raise exception 'temporary writer schema CREATE not restored';end if;
end$$;
