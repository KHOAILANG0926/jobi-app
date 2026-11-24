-- 시험 DB 확인(폐기용): 20261124120000_multi_branch_conversion — 보존·중복 방지·변경 시 중단·실제 복원.
-- 1) 전환 결과(기준 ①②③⑤)와 보존
do $t$
declare n int;
begin
  if (select count(*) from public.job_work_locations where job_id = 4825) <> 4 then raise exception 'FAIL ①: 4825 줄이 바뀜'; end if;
  if exists (select 1 from public.research_artifacts where meta->>'from_job_id' = '4825') then raise exception 'FAIL ①: 4825 보류함 생김'; end if;
  if (select array_agg(id order by id) from public.job_work_locations where job_id = 5992) <> array[1798::bigint] then raise exception 'FAIL ②: 5992 남은 줄'; end if;
  if (select array_agg(id order by id) from public.job_work_locations where job_id = 5994) <> array[1778::bigint] then raise exception 'FAIL ②: 5994 남은 줄'; end if;
  if (select location from public.local_jobs where id = 5992) <> '148 Trần Phú, Từ Sơn, Bắc Ninh' then raise exception 'FAIL ⑤: 5992 위치 글자'; end if;
  if (select location from public.local_jobs where id = 5994) <> 'Số 37 Lý Thái Tổ, Bắc Ninh' then raise exception 'FAIL ⑤: 5994 위치 글자가 바뀜'; end if;
  if (select count(*) from public.mbc_test_ingest_calls) <> 1 then raise exception 'FAIL ⑤: 입구 호출 수'; end if;
  if (select count(*) from public.research_artifacts where kind = 'location-hold' and meta->>'reason' = 'branch_split' and meta->>'status' = 'held') <> 2 then raise exception 'FAIL ③: 보류함 줄 수'; end if;
  if not exists (select 1 from public.research_artifacts where meta->>'from_job_id' = '5992' and meta->>'work_location_id' = '1776'
                 and meta->>'from_location' = '152 Trần Hưng Đạo, Kinh Bắc, Bắc Ninh'
                 and payload->>'location' = '152 Trần Hưng Đạo, Kinh Bắc, Bắc Ninh' and payload->>'branch_location' = payload->>'location'
                 and payload->>'source_text' = 'nguyên văn B' and payload->>'company' = 'KRIK' and not (payload ? 'id') and not (payload ? 'active')) then
    raise exception 'FAIL ③: 5992 보류 내용'; end if;
  select count(*) into n from public.mbc_test_before b join location_private.retained_rows r on (r.row_data->>'id')::bigint = b.id and r.row_data = b.row_data and r.reason = 'writer_delete';
  if n <> 2 then raise exception 'FAIL 보존: 원래 줄 그대로 보관된 수 %', n; end if;
  if exists (select 1 from public.mbc_test_before b join public.job_work_locations w on w.id = b.id where to_jsonb(w) <> b.row_data) then raise exception 'FAIL 보존: 남은 줄이 바뀜'; end if;
end $t$;
-- 2) 중복 방지: 같은 전환을 다시 실행해도 아무것도 바뀌지 않는다
\i supabase/migrations/20261124120000_multi_branch_conversion.sql
do $t$
begin
  if (select count(*) from public.research_artifacts where meta->>'reason' = 'branch_split') <> 2 then raise exception 'FAIL 중복: 보류함 줄이 늘어남'; end if;
  if (select count(*) from location_private.retained_rows where reason = 'writer_delete') <> 2 then raise exception 'FAIL 중복: 보관 줄이 늘어남'; end if;
  if (select count(*) from public.mbc_test_ingest_calls) <> 1 then raise exception 'FAIL 중복: 입구가 다시 불림'; end if;
end $t$;
-- 3·4는 한 트랜잭션 안에서 보고 끝에 되돌린다(뒤의 운영 점검은 전환된 상태를 본다).
begin;
-- 3) 실제 복원: 되돌리기 SQL(같은 쓰기 함수·같은 입구)로 원래 공고에 줄과 위치 글자를 되돌린다
\i supabase/pending/20261124_multi_branch_conversion_revert.sql
do $t$
begin
  if exists (
    select 1 from public.mbc_test_before b
     where not exists (select 1 from public.job_work_locations w where w.job_id = b.job_id
        and w.raw_address = b.row_data->>'raw_address' and w.sort_order = (b.row_data->>'sort_order')::int
        and w.lat is not distinct from (b.row_data->>'lat')::float8 and w.lng is not distinct from (b.row_data->>'lng')::float8
        and w.point_kind = b.row_data->>'point_kind' and w.point_authority = b.row_data->>'point_authority'
        and w.location_verified = (b.row_data->>'location_verified')::boolean and w.point_precision is not distinct from b.row_data->>'point_precision'
        and w.point_evidence = b.row_data->'point_evidence')) then
    raise exception 'FAIL 복원: 원래 근무지 줄(주소·순서·좌표·위치 근거)이 모두 돌아오지 않음'; end if;
  if (select count(*) from public.job_work_locations where job_id in (4825, 5992, 5994, 9104)) <> (select count(*) from public.mbc_test_before) then raise exception 'FAIL 복원: 줄 수'; end if;
  if exists (select 1 from public.mbc_test_jobs_before b join public.local_jobs j using (id) where j.location is distinct from b.location) then raise exception 'FAIL 복원: 위치 글자'; end if;
  if (select count(*) from public.research_artifacts where meta->>'reason' = 'conversion_reverted' and meta->>'status' = 'rejected') <> 2 then raise exception 'FAIL 복원: 보류함 줄 닫힘'; end if;
end $t$;
-- 4) dry-run 뒤 변경 시 중단: 되돌린 줄은 번호가 바뀌어 승인된 계획과 다르다 → 다시 전환하면 전체 취소(아무것도 안 바뀜)
savepoint before_rerun;
\set ON_ERROR_STOP 0
\i supabase/migrations/20261124120000_multi_branch_conversion.sql
\set ON_ERROR_STOP 1
rollback to savepoint before_rerun;
do $t$
begin
  if (select count(*) from public.job_work_locations where job_id in (5992, 5994)) <> 4 then raise exception 'FAIL 중단: 계획이 달라졌는데 전환됨'; end if;
  if (select count(*) from location_private.retained_rows where reason = 'writer_delete') <> 2 then raise exception 'FAIL 중단: 이력이 늘어남'; end if;
end $t$;
rollback;
do $t$ begin
  if (select array_agg(id order by id) from public.job_work_locations where job_id in (5992, 5994)) <> array[1778::bigint, 1798::bigint] then raise exception 'FAIL: 시험 뒤 전환 상태로 돌아오지 않음'; end if;
end $t$;
select 'multi_branch_conversion.local: 통과' as result;
