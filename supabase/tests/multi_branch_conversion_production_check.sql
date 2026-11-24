-- 운영 점검(읽기만): 20261124120000_multi_branch_conversion 적용 뒤. 실패하면 RAISE.
do $chk$
begin
  -- 확정 위치 지점이 있는 공고에 지점이 2곳 이상 남아 있으면 안 된다(확정 지점 없는 공고는 기준 ①로 그대로 둠)
  if exists (
    select 1 from public.job_work_locations w
     where exists (select 1 from public.job_work_locations c where c.job_id = w.job_id and c.lat is not null and c.lng is not null
                    and (c.point_kind = 'gate' or (c.point_kind = 'exact' and c.location_verified)))
     group by w.job_id having count(distinct coalesce(nullif(w.normalized_address, ''), public.admin_location_key(w.raw_address))) > 1) then
    raise exception 'multi-branch check: 확정 지점이 있는 다중 지점 공고가 남음';
  end if;
  -- 보류함으로 옮긴 지점마다 원래 줄이 이력에 정확히 1개(복구 근거)
  if exists (select 1 from public.research_artifacts a where a.kind = 'location-hold' and a.meta->>'reason' = 'branch_split' and
       (select count(*) from location_private.retained_rows r where r.job_id = (a.meta->>'from_job_id')::bigint
         and (r.row_data->>'id') = a.meta->>'work_location_id') <> 1) then
    raise exception 'multi-branch check: 보류 지점의 원래 줄 이력이 없거나 여러 개';
  end if;
  -- 남는 지점의 공고 위치 글자 = 남은 근무지 주소
  if exists (select 1 from public.research_artifacts a join public.local_jobs j on j.id = (a.meta->>'from_job_id')::bigint
              where a.kind = 'location-hold' and a.meta->>'reason' = 'branch_split'
                and not exists (select 1 from public.job_work_locations w where w.job_id = j.id
                                 and coalesce(nullif(w.normalized_address, ''), public.admin_location_key(w.raw_address)) = public.admin_location_key(j.location))) then
    raise exception 'multi-branch check: 공고 위치 글자가 남은 지점과 다름';
  end if;
end $chk$;
