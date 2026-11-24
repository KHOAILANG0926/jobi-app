-- 되돌리기(대기 — 실행하려면 대표 승인 뒤 같은 내용을 supabase/migrations/로 옮겨 정상 경로로 적용): 20261124120000_multi_branch_conversion.
-- 보류함으로 옮긴 지점(meta reason=branch_split)마다 이력(retained_rows)의 원래 줄을 위치 원본 쓰기 함수(write_location 'upsert')로 원래 공고에 다시 쓰고,
-- 원래 공고 위치 글자(meta from_location)는 정식 입구(ingest_job sql_file)로 되돌린다. 보류함 줄은 지우지 않고 status=rejected, reason=conversion_reverted로 닫는다.
-- 이미 새 공고로 등록된 지점(status=registered)은 자동으로 되돌리지 않고 전체 취소한다(새 공고 처리는 대표 판단).
do $rev$
declare a record; r jsonb; j public.local_jobs;
begin
  if exists (select 1 from public.research_artifacts where kind = 'location-hold' and meta->>'reason' = 'branch_split' and meta->>'status' = 'registered') then
    raise exception 'multi-branch revert: 이미 새 공고로 등록된 지점이 있음 — 자동 되돌리기 중단(대표 판단)';
  end if;
  for a in select * from public.research_artifacts where kind = 'location-hold' and meta->>'reason' = 'branch_split' order by (meta->>'from_job_id')::bigint, (meta->>'work_location_id')::bigint loop
    select row_data into r from location_private.retained_rows
     where job_id = (a.meta->>'from_job_id')::bigint and row_data->>'id' = a.meta->>'work_location_id' and reason = 'writer_delete';
    if r is null then raise exception 'multi-branch revert: 원래 줄 이력 없음(공고 %, 줄 %)', a.meta->>'from_job_id', a.meta->>'work_location_id'; end if;
    perform location_private.write_location((a.meta->>'from_job_id')::bigint, 'upsert',
      jsonb_strip_nulls(jsonb_build_object('raw_address', r->>'raw_address', 'sort_order', r->'sort_order', 'lat', r->'lat', 'lng', r->'lng',
        'authority', r->>'point_authority', 'evidence', r->'point_evidence', 'precision', r->>'point_precision',
        'country', r->>'country', 'province', r->>'province', 'district', r->>'district', 'ward', r->>'ward', 'industrial_park', r->>'industrial_park',
        'address_accuracy', r->>'address_accuracy', 'address_evidence', r->>'address_evidence', 'resolved_province', r->>'resolved_province')));
    update public.research_artifacts set meta = meta || jsonb_build_object('status', 'rejected', 'reason', 'conversion_reverted')
     where kind = a.kind and name = a.name;
    select * into j from public.local_jobs where id = (a.meta->>'from_job_id')::bigint;
    if a.meta ? 'from_location' and j.location is distinct from a.meta->>'from_location' then
      perform public.ingest_job(jsonb_build_object('channel', 'sql_file', 'job_id', j.id, 'update_fields', jsonb_build_array('location'),
                                                   'location', a.meta->>'from_location', 'source_text', j.source_text, 'source', j.source, 'source_url', j.source_url));
    end if;
  end loop;
end $rev$;
