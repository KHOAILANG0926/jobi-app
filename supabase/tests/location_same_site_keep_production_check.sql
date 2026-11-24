-- 20261124150000: 같은 사업장 확정 좌표 보호가 운영에 들어갔는지(트리거·쓰기 함수·자격 view가 판정 함수를 쓰는지, 권한이 열리지 않았는지) 확인.
do $t$ declare tg text := pg_get_functiondef('location_private.job_identity_changed()'::regprocedure);
 wr text := pg_get_functiondef('location_private.write_location(bigint,text,jsonb)'::regprocedure);
begin
 if position('location_private.same_site_address(old.location,new.location' in tg) = 0 then raise exception 'trigger does not keep same-site confirmed rows'; end if;
 if (length(wr)-length(replace(wr,'location_private.same_site_address(x.raw_address,addr','')))/length('location_private.same_site_address(x.raw_address,addr') <> 2 then raise exception 'writer same-site lookup missing'; end if;
 if position('held.point_candidate_id = e.source_candidate_id' in pg_get_viewdef('location_private.valid_memory_targets'::regclass)) = 0 then raise exception 'held approval eligibility missing'; end if;
 if not location_private.same_site_address('KCN Quế Võ','KCN Quế Võ, Bắc Ninh',array['Bắc Ninh']) or location_private.same_site_address('KCN Quế Võ','Lô A2 KCN Quế Võ, Bắc Ninh',array['Bắc Ninh'])
  or location_private.same_site_address('12 Lê Lợi','112 Lê Lợi',null) then raise exception 'same-site judgement wrong'; end if;
 if has_function_privilege('anon','location_private.same_site_address(text,text,text[])','execute') or has_function_privilege('authenticated','location_private.same_site_address(text,text,text[])','execute') then raise exception 'same_site_address exposed'; end if;
 if (select proowner::regrole::text from pg_proc where oid='location_private.write_location(bigint,text,jsonb)'::regprocedure) <> 'location_writer' then raise exception 'writer owner changed'; end if;
 if has_schema_privilege('location_writer','location_private','CREATE') then raise exception 'writer kept schema create'; end if;
end $t$;
