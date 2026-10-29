-- Read-only. 20261029120000 운영 점검: 원문이 있는 공고의 자동 대략 핀은 원문에 그 성/시 이름이 있어야 한다.
do $check$
declare diff text := ''; bad text;
begin
 if to_regprocedure('location_private.area_in_text(jsonb,text)') is null then diff := diff || 'area_in_text 없음; '; end if;
 if position('location_private.area_in_text' in pg_get_functiondef('location_private.write_location(bigint,text,jsonb)'::regprocedure)) = 0 then
  diff := diff || 'write_location에 원문 확인 규칙 없음; '; end if;
 if exists(select 1 from pg_roles r where r.rolname in ('anon','authenticated','service_role')
   and has_function_privilege(r.rolname,'location_private.area_in_text(jsonb,text)','EXECUTE')) then diff := diff || 'area_in_text 공개 실행 권한; '; end if;
 select string_agg(w.job_id::text, ',') into bad from public.job_work_locations w join public.local_jobs j on j.id = w.job_id
  where w.point_authority = 'auto_area' and not w.location_verified and nullif(btrim(j.source_text),'') is not null
    and not location_private.area_in_text(location_private.administrative_area(
      case when w.point_evidence->>'administrativeAreaKey' like 'city:%' then 'tp ' else '' end || split_part(w.point_evidence->>'administrativeAreaKey', ':', 2)), j.source_text);
 if bad is not null then diff := diff || '원문에 없는 성/시 대략 핀: ' || bad || '; '; end if;
 if diff <> '' then raise exception 'area pin source-text check: %', diff; end if;
end $check$;
