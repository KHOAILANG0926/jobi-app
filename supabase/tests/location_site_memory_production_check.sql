-- 운영 적용 뒤 점검(읽기만): 함수가 있고, 밖(anon·authenticated)에서 확정 위치를 읽을 수 없으며, 대략 위치 줄은 기억으로 나오지 않는다.
do $$
begin
 if to_regprocedure('public.location_site_memory(text,text)') is null then raise exception 'location_site_memory missing'; end if;
 if not (select prosecdef from pg_proc where oid = 'public.location_site_memory(text,text)'::regprocedure) then
  raise exception 'location_site_memory must be security definer';
 end if;
 if has_function_privilege('anon', 'public.location_site_memory(text,text)', 'execute')
  or has_function_privilege('authenticated', 'public.location_site_memory(text,text)', 'execute') then
  raise exception 'location_site_memory must not be executable by anon/authenticated';
 end if;
 if not has_function_privilege('service_role', 'public.location_site_memory(text,text)', 'execute') then
  raise exception 'service_role must execute location_site_memory';
 end if;
 -- 운영의 확정 줄마다 자기 주소로 물으면 자기 자신이 나온다(같은 사업장 판정이 운영 자료에서 동작). 대략 위치 줄은 나오지 않는다.
 if exists(select 1 from public.job_work_locations w join public.local_jobs j on j.id = w.job_id
  where w.point_kind = 'exact' and w.location_verified and w.point_authority in ('source_verified','admin_confirmed','auto_reuse')
   and w.lat between 8 and 24 and w.lng between 102 and 110 and nullif(public.admin_location_key(j.company),'') is not null
   and nullif(public.admin_location_key(w.raw_address),'') is not null
   and not exists(select 1 from public.location_site_memory(j.company, w.raw_address) m where m.work_location_id = w.id)) then
  raise exception 'confirmed row not found by its own company+address';
 end if;
 if exists(select 1 from public.job_work_locations w join public.local_jobs j on j.id = w.job_id
  where w.point_kind <> 'exact' and exists(select 1 from public.location_site_memory(j.company, w.raw_address) m where m.work_location_id = w.id)) then
  raise exception 'non-exact row leaked into site memory';
 end if;
end $$;
