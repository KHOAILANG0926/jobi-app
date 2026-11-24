-- 시험 DB 확인(폐기용): 20261124120000_multi_branch_conversion — 보존·중복 방지·복구 가능성만.
do $t$
declare n int;
begin
  -- 기준 ①: 확정 지점 없는 공고는 그대로(줄 4개·위치 글자·보류함 없음)
  if (select count(*) from public.job_work_locations where job_id = 9101) <> 4 then raise exception 'FAIL ①: 9101 줄이 바뀜'; end if;
  if exists (select 1 from public.research_artifacts where meta->>'from_job_id' = '9101') then raise exception 'FAIL ①: 9101 보류함 생김'; end if;
  -- 기준 ②: 확정 지점이 기존 번호에 남음, 위치 글자도 남는 지점(9102만 입구로 고침)
  if (select array_agg(id order by id) from public.job_work_locations where job_id = 9102) <> array[91022::bigint] then raise exception 'FAIL ②: 9102 남은 줄'; end if;
  if (select array_agg(id order by id) from public.job_work_locations where job_id = 9103) <> array[91031::bigint] then raise exception 'FAIL ②: 9103 남은 줄'; end if;
  if (select location from public.local_jobs where id = 9102) <> '148 Trần Phú, Từ Sơn, Bắc Ninh' then raise exception 'FAIL ⑤: 9102 위치 글자'; end if;
  if (select location from public.local_jobs where id = 9103) <> 'Số 37 Lý Thái Tổ, Bắc Ninh' then raise exception 'FAIL ⑤: 9103 위치 글자가 바뀜'; end if;
  if (select count(*) from public.mbc_test_ingest_calls) <> 1 then raise exception 'FAIL ⑤: 입구 호출 수'; end if;
  -- 기준 ③: 나머지 지점은 보류함(held)에 원문과 지점 주소로 — 기존 retry_held가 집는 모양
  if (select count(*) from public.research_artifacts where kind = 'location-hold' and meta->>'reason' = 'branch_split') <> 2 then raise exception 'FAIL ③: 보류함 줄 수'; end if;
  if not exists (select 1 from public.research_artifacts where meta->>'from_job_id' = '9102' and meta->>'work_location_id' = '91021' and meta->>'status' = 'held'
                 and payload->>'location' = '152 Trần Hưng Đạo, Kinh Bắc, Bắc Ninh' and payload->>'branch_location' = payload->>'location'
                 and payload->>'source_text' = 'nguyên văn B' and payload->>'company' = 'KRIK' and not (payload ? 'id') and not (payload ? 'active')
                 and payload->'work_locations' = jsonb_build_array(jsonb_build_object('raw_address', '152 Trần Hưng Đạo, Kinh Bắc, Bắc Ninh'))) then
    raise exception 'FAIL ③: 9102 보류 내용'; end if;
  -- 보존: 지운 줄은 원래 줄 그대로 retained_rows·write_log에(복구 근거), 그 밖의 줄은 그대로
  select count(*) into n from public.mbc_test_before b join location_private.retained_rows r on (r.row_data->>'id')::bigint = b.id and r.row_data = b.row_data and r.reason = 'writer_delete';
  if n <> 2 then raise exception 'FAIL 보존: 원래 줄 그대로 보관된 수 %', n; end if;
  if (select count(*) from location_private.write_log where operation = 'delete' and work_location_id in (91021, 91032)) <> 2 then raise exception 'FAIL 보존: 쓰기 기록'; end if;
  if exists (select 1 from public.mbc_test_before b join public.job_work_locations w on w.id = b.id where to_jsonb(w) <> b.row_data) then raise exception 'FAIL 보존: 남은 줄이 바뀜'; end if;
  if (select count(*) from public.job_work_locations where job_id = 9104) <> 1 then raise exception 'FAIL: 한 곳 공고가 바뀜'; end if;
end $t$;
-- 중복 방지: 같은 전환을 한 번 더 실행해도 아무것도 바뀌지 않는다(대상 없음)
\i supabase/migrations/20261124120000_multi_branch_conversion.sql
do $t$
begin
  if (select count(*) from public.research_artifacts where meta->>'reason' = 'branch_split') <> 2 then raise exception 'FAIL 중복: 보류함 줄이 늘어남'; end if;
  if (select count(*) from location_private.retained_rows where reason = 'writer_delete') <> 2 then raise exception 'FAIL 중복: 보관 줄이 늘어남'; end if;
  if (select count(*) from public.mbc_test_ingest_calls) <> 1 then raise exception 'FAIL 중복: 입구가 다시 불림'; end if;
  if (select count(*) from public.job_work_locations where job_id between 9101 and 9104) <> 7 then raise exception 'FAIL 중복: 줄 수'; end if;
end $t$;
-- 복구 가능성: 보류함 meta(from_job_id·work_location_id) → retained_rows의 원래 줄을 정확히 하나 찾는다(되돌리기 migration의 근거)
do $t$
begin
  if exists (select 1 from public.research_artifacts a where a.meta->>'reason' = 'branch_split' and
       (select count(*) from location_private.retained_rows r where r.job_id = (a.meta->>'from_job_id')::bigint
         and (r.row_data->>'id') = a.meta->>'work_location_id' and r.row_data->>'raw_address' = a.payload->>'location') <> 1) then
    raise exception 'FAIL 복구: 보류 지점마다 원래 줄 1개가 대응하지 않음'; end if;
end $t$;
select 'multi_branch_conversion.local: 통과' as result;
