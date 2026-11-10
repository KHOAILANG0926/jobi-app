-- 운영 적용 뒤 점검(읽기만): 함수가 있고, 확정 위치를 밖(anon·authenticated)에서 읽을 수 없다.
do $$
begin
 if to_regprocedure('public.location_memory_point(text,text[])') is null then
  raise exception 'location_memory_point missing';
 end if;
 if not (select prosecdef from pg_proc where oid = 'public.location_memory_point(text,text[])'::regprocedure) then
  raise exception 'location_memory_point must be security definer';
 end if;
 if has_function_privilege('anon', 'public.location_memory_point(text,text[])', 'execute')
  or has_function_privilege('authenticated', 'public.location_memory_point(text,text[])', 'execute') then
  raise exception 'location_memory_point must not be executable by anon/authenticated';
 end if;
 -- 운영의 모든 재사용 대상에서 위치 확인 조회가 같은 확정 위치를 고른다(자격 한 곳)
 if exists(select 1 from location_private.valid_memory_targets t
  where not exists(select 1 from public.location_memory_point(t.company, array[t.address]) p where p.candidate_id = t.source_candidate_id)) then
  raise exception 'valid_memory_targets and location_memory_point disagree';
 end if;
 if not has_function_privilege('service_role', 'public.location_memory_point(text,text[])', 'execute') then
  raise exception 'service_role must execute location_memory_point';
 end if;
end $$;
