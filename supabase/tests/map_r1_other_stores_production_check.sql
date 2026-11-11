-- 읽기 전용 운영 확인(공고 번호·건수 고정 없음): map_r1_complete가 다른 매장 핀을 기록하는 판이고 권한은 그대로인지.
do $$declare d text;bad boolean;begin
 if to_regprocedure('public.map_r1_complete(bigint,uuid,jsonb)') is null then raise exception 'map_r1_complete missing';end if;
 d:=pg_get_functiondef('public.map_r1_complete(bigint,uuid,jsonb)'::regprocedure);
 if position('p_result->''others''' in d)=0 or position('write_location(p_id,''upsert''' in d)=0 then raise exception 'map_r1_complete is not the other-stores version';end if;
 if position('o->>''kind''=''exact'' and nullif(btrim(o->>''evidence''),'''') is null' in d)=0 then raise exception 'other-store exact must require evidence';end if;
 if has_function_privilege('anon','public.map_r1_complete(bigint,uuid,jsonb)','EXECUTE')
  or has_function_privilege('authenticated','public.map_r1_complete(bigint,uuid,jsonb)','EXECUTE')
  or not has_function_privilege('service_role','public.map_r1_complete(bigint,uuid,jsonb)','EXECUTE') then
  raise exception 'map_r1_complete privileges changed';end if;
 if to_regprocedure('public.location_integrity_issues()') is not null then
  execute 'select exists(select 1 from public.location_integrity_issues())' into bad;
  if bad then raise exception 'location integrity check failed after other-stores change';end if;
 end if;
end$$;
