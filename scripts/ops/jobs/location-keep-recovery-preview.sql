-- 지도 정상화 B(Lee 2026-11-24): A(같은 지점 확정 위치 유실 방지 — 20261124130000_location_same_store_keep) 적용 뒤 기존 공고 복구·재판정 대상 dry-run 집계.
-- 읽기 전용(데이터 변경 없음). 실행: ops-run-sql.yml(master, Lee 계정 수동, name=location-keep-recovery-preview). run-sql-plan이 처음부터 읽기 전용 트랜잭션을 건다.
-- 복구 대상 = 위치 원본 쓰기 함수가 지운 확정 줄(location_private.retained_rows reason=writer_delete, 관리자 확정·재사용·검증 좌표)이 있는데,
--   지금 같은 공고에 같은 지점 줄(A와 같은 규칙 — 한쪽이 다른 쪽의 낱말 단위 앞부분이고 짧은 쪽에 번지 숫자가 있을 때)이 확정 없이 남은 경우. (공고, 같은 지점) 한 쌍은 가장 최근 줄 1개로 중복 없이 센다.
-- 제외: 2순위 다중 지점 전환(branch-split 보류함 meta의 from_job_id·work_location_id)이 일부러 옮긴 줄 — 기존 정책대로 보류함이 처리한다.
-- 복구 방법(승인 뒤 별도 migration)은 이 집계에 없다 — 이 파일은 대상과 분류만 보여 준다. 운영 데이터는 대표 승인 전까지 바꾸지 않는다.
set transaction read only;
\pset tuples_only on
\pset format unaligned
with lost as (
  select distinct on (rr.job_id, public.admin_location_key(rr.row_data->>'raw_address'))
         rr.id as rid, rr.job_id, rr.row_data, rr.retained_at, public.admin_location_key(rr.row_data->>'raw_address') as k
    from location_private.retained_rows rr
   where rr.relation_name = 'job_work_locations' and rr.reason = 'writer_delete'
     and (rr.row_data->>'point_authority' in ('admin_confirmed', 'auto_reuse') or coalesce((rr.row_data->>'location_verified')::boolean, false))
     and rr.row_data->>'lat' is not null and public.admin_location_key(rr.row_data->>'raw_address') <> ''
     and not exists (select 1 from public.research_artifacts h where h.kind = 'location-hold'
                      and h.meta->>'from_job_id' = rr.job_id::text and h.meta->>'work_location_id' = rr.row_data->>'id')
   order by rr.job_id, public.admin_location_key(rr.row_data->>'raw_address'), rr.retained_at desc, rr.id desc),
_lost as (
select l.*,
   (select count(*) from public.job_work_locations w where w.job_id = l.job_id and public.admin_location_key(w.raw_address) <> ''
      and ((starts_with(public.admin_location_key(w.raw_address) || ' ', l.k || ' ') or starts_with(l.k || ' ', public.admin_location_key(w.raw_address) || ' ')) and (case when length(l.k) <= length(public.admin_location_key(w.raw_address)) then l.k else public.admin_location_key(w.raw_address) end) ~ '[0-9]')) as same_rows,
   (select count(*) from public.job_work_locations w where w.job_id = l.job_id and public.admin_location_key(w.raw_address) <> ''
      and ((starts_with(public.admin_location_key(w.raw_address) || ' ', l.k || ' ') or starts_with(l.k || ' ', public.admin_location_key(w.raw_address) || ' ')) and (case when length(l.k) <= length(public.admin_location_key(w.raw_address)) then l.k else public.admin_location_key(w.raw_address) end) ~ '[0-9]')
      and (w.location_verified or w.point_authority in ('admin_confirmed', 'auto_reuse'))) as same_confirmed
   from lost l)
select '::notice::[복구 dry-run] 지워진 확정 줄 (공고, 지점) ' || count(*) || '쌍 · 공고 ' || count(distinct job_id) || '건'
       || ' · 이미 확정 있음(복구 불필요) ' || count(*) filter (where same_confirmed > 0)
       || ' · 복구 대상(같은 지점 줄 1개, 확정 없음) ' || count(*) filter (where same_confirmed = 0 and same_rows = 1)
       || ' · 모호(같은 지점 줄 2개 이상 — 자동 복구 안 함) ' || count(*) filter (where same_confirmed = 0 and same_rows > 1)
       || ' · 같은 지점 줄 없음(이전·삭제 — 기존 정책) ' || count(*) filter (where same_rows = 0)
  from _lost;
with lost as (
  select distinct on (rr.job_id, public.admin_location_key(rr.row_data->>'raw_address'))
         rr.id as rid, rr.job_id, rr.row_data, rr.retained_at, public.admin_location_key(rr.row_data->>'raw_address') as k
    from location_private.retained_rows rr
   where rr.relation_name = 'job_work_locations' and rr.reason = 'writer_delete'
     and (rr.row_data->>'point_authority' in ('admin_confirmed', 'auto_reuse') or coalesce((rr.row_data->>'location_verified')::boolean, false))
     and rr.row_data->>'lat' is not null and public.admin_location_key(rr.row_data->>'raw_address') <> ''
     and not exists (select 1 from public.research_artifacts h where h.kind = 'location-hold'
                      and h.meta->>'from_job_id' = rr.job_id::text and h.meta->>'work_location_id' = rr.row_data->>'id')
   order by rr.job_id, public.admin_location_key(rr.row_data->>'raw_address'), rr.retained_at desc, rr.id desc),
_lost as (
select l.*,
   (select count(*) from public.job_work_locations w where w.job_id = l.job_id and public.admin_location_key(w.raw_address) <> ''
      and ((starts_with(public.admin_location_key(w.raw_address) || ' ', l.k || ' ') or starts_with(l.k || ' ', public.admin_location_key(w.raw_address) || ' ')) and (case when length(l.k) <= length(public.admin_location_key(w.raw_address)) then l.k else public.admin_location_key(w.raw_address) end) ~ '[0-9]')) as same_rows,
   (select count(*) from public.job_work_locations w where w.job_id = l.job_id and public.admin_location_key(w.raw_address) <> ''
      and ((starts_with(public.admin_location_key(w.raw_address) || ' ', l.k || ' ') or starts_with(l.k || ' ', public.admin_location_key(w.raw_address) || ' ')) and (case when length(l.k) <= length(public.admin_location_key(w.raw_address)) then l.k else public.admin_location_key(w.raw_address) end) ~ '[0-9]')
      and (w.location_verified or w.point_authority in ('admin_confirmed', 'auto_reuse'))) as same_confirmed
   from lost l)
select '::notice::[복구 대상] #' || j.id || ' ' || case when j.active and not coalesce(j.admin_hidden, false) then '공개' else '비공개' end
       || ' · ' || left(coalesce(j.company, ''), 40)
       || ' · 지워진 확정 줄 ' || (l.row_data->>'id') || ' ' || coalesce(l.row_data->>'point_authority', '검증좌표') || ' ' || left(l.row_data->>'raw_address', 70)
       || ' · 현재 줄 ' || w.id || ' ' || coalesce(w.point_kind, '없음') || '/' || coalesce(w.point_authority, '없음') || ' ' || left(w.raw_address, 70)
  from _lost l join public.local_jobs j on j.id = l.job_id
  join public.job_work_locations w on w.job_id = l.job_id and public.admin_location_key(w.raw_address) <> ''
   and ((starts_with(public.admin_location_key(w.raw_address) || ' ', l.k || ' ') or starts_with(l.k || ' ', public.admin_location_key(w.raw_address) || ' ')) and (case when length(l.k) <= length(public.admin_location_key(w.raw_address)) then l.k else public.admin_location_key(w.raw_address) end) ~ '[0-9]')
 where l.same_confirmed = 0 and l.same_rows = 1 order by j.id;
-- 재판정 후보(C: API 장애·한도가 '못 찾음'으로 기록됐을 수 있는 위치 보류함). 예전 기록은 장애와 결과 없음을 구분하지 않아 상한 추정치다 — 실제 재판정은 보류 다시 확인(retry_held)이 기존 정책대로 한다.
select '::notice::[재판정 후보] 위치 보류함 ' || coalesce(h.meta->>'status', '없음') || ' / ' || coalesce(h.meta->>'reason', '없음') || ' ' || count(*) || '건'
  from public.research_artifacts h where h.kind = 'location-hold'
 group by h.meta->>'status', h.meta->>'reason' order by 1;
