-- 지도 정상화 W7 dry-run(Lee 2026-11-24): 기존 데이터 재확인·복구 대상 집계 + W3b·W4·W6 운영 실증용 조회. W2(location-keep-recovery-preview)의 조회를 넓혀 다시 쓴다.
-- 읽기 전용(데이터 변경 없음). 실행: ops-run-sql.yml(master, Lee 계정 수동, name=location-w7-recovery-preview). run-sql-plan이 처음부터 읽기 전용 트랜잭션을 건다.
-- 같은 사업장 판정은 운영에 적용된 한 곳(location_private.same_site_address, 20261124150000)을 그대로 부른다 — 이 파일에 따로 판정을 만들지 않는다.
-- 복구 방법(승인 뒤 별도 migration)은 이 집계에 없다. 운영 데이터는 대표 승인 전까지 바꾸지 않는다.
set transaction read only;
\pset tuples_only on
\pset format unaligned
-- [W7-1] 무효화·덮어쓰기로 확정 좌표를 잃은 줄(쓰기 기록 write_log, 줄마다 가장 최근 1건) → 지금 줄과 대조해 분류.
with ev as (
  select distinct on (l.work_location_id) l.id, l.job_id, l.work_location_id, l.operation, l.created_at, l.previous_row as p
    from location_private.write_log l
   where l.previous_row is not null and l.next_row is not null and l.previous_row->>'lat' is not null
     and (l.previous_row->>'point_authority' in ('admin_confirmed', 'auto_reuse') or coalesce((l.previous_row->>'location_verified')::boolean, false))
     and not (l.next_row->>'point_authority' in ('admin_confirmed', 'auto_reuse') or coalesce((l.next_row->>'location_verified')::boolean, false))
   order by l.work_location_id, l.created_at desc, l.id desc),
c as (
  select e.*, w.id as wid, w.raw_address as now_addr, j.company, j.active, j.admin_hidden,
         (w.lat is not null and (w.location_verified or w.point_authority in ('admin_confirmed', 'auto_reuse'))) as now_confirmed,
         location_private.same_site_address(e.p->>'raw_address', w.raw_address, array[w.province, w.district, w.ward, w.resolved_province] || coalesce(w.resolved_wards, '{}'::text[])) as same_site,
         (coalesce(e.p->>'point_company_key', '') = '' or public.admin_location_key(e.p->>'point_company_key') = public.admin_location_key(j.company)) as same_company
    from ev e left join public.job_work_locations w on w.id = e.work_location_id left join public.local_jobs j on j.id = e.job_id)
select '::notice::[W7-1 확정 좌표를 잃은 줄] 전체 ' || count(*)
       || ' · 줄 없음(삭제됨) ' || count(*) filter (where wid is null)
       || ' · 지금 다시 확정됨(복구 불필요) ' || count(*) filter (where wid is not null and now_confirmed)
       || ' · 복구 후보(같은 사업장·같은 회사·지금 확정 없음) ' || count(*) filter (where wid is not null and not now_confirmed and same_site and same_company)
       || ' · 주소가 달라짐(이전·다른 지점 — 기존 위치 확인 절차) ' || count(*) filter (where wid is not null and not now_confirmed and not coalesce(same_site, false))
       || ' · 회사가 달라짐 ' || count(*) filter (where wid is not null and not now_confirmed and same_site and not same_company)
  from c;
with ev as (
  select distinct on (l.work_location_id) l.id, l.job_id, l.work_location_id, l.operation, l.created_at, l.previous_row as p
    from location_private.write_log l
   where l.previous_row is not null and l.next_row is not null and l.previous_row->>'lat' is not null
     and (l.previous_row->>'point_authority' in ('admin_confirmed', 'auto_reuse') or coalesce((l.previous_row->>'location_verified')::boolean, false))
     and not (l.next_row->>'point_authority' in ('admin_confirmed', 'auto_reuse') or coalesce((l.next_row->>'location_verified')::boolean, false))
   order by l.work_location_id, l.created_at desc, l.id desc)
select '::notice::[W7-1 목록] #' || e.job_id || ' ' || case when j.active and not coalesce(j.admin_hidden, false) then '공개' else '비공개' end
       || ' · ' || left(coalesce(j.company, ''), 36) || ' · 줄 ' || w.id || ' · ' || e.operation || ' ' || to_char(e.created_at, 'MM-DD HH24:MI')
       || ' · 전 ' || coalesce(e.p->>'point_authority', '없음') || '/' || coalesce(e.p->'point_evidence'->>'source', '없음') || ' ' || left(e.p->>'raw_address', 60)
       || ' → 지금 ' || coalesce(w.point_kind, '없음') || ' ' || left(w.raw_address, 60)
       || ' · 같은 사업장 ' || coalesce(location_private.same_site_address(e.p->>'raw_address', w.raw_address, array[w.province, w.district, w.ward, w.resolved_province] || coalesce(w.resolved_wards, '{}'::text[]))::text, '모름')
  from ev e join public.job_work_locations w on w.id = e.work_location_id join public.local_jobs j on j.id = e.job_id
 where not (w.lat is not null and (w.location_verified or w.point_authority in ('admin_confirmed', 'auto_reuse')))
 order by e.job_id, w.id limit 80;
-- [W7-2] 쓰기 함수가 지운 확정 줄(retained_rows writer_delete, W2와 같은 대상) — 판정만 지금 규칙(번지 없는 주소의 지역 덧붙임 포함)으로 다시.
with lost as (
  select distinct on (rr.job_id, public.admin_location_key(rr.row_data->>'raw_address'))
         rr.id as rid, rr.job_id, rr.row_data, rr.retained_at
    from location_private.retained_rows rr
   where rr.relation_name = 'job_work_locations' and rr.reason = 'writer_delete'
     and (rr.row_data->>'point_authority' in ('admin_confirmed', 'auto_reuse') or coalesce((rr.row_data->>'location_verified')::boolean, false))
     and rr.row_data->>'lat' is not null and public.admin_location_key(rr.row_data->>'raw_address') <> ''
     and not exists (select 1 from public.research_artifacts h where h.kind = 'location-hold'
                      and h.meta->>'from_job_id' = rr.job_id::text and h.meta->>'work_location_id' = rr.row_data->>'id')
   order by rr.job_id, public.admin_location_key(rr.row_data->>'raw_address'), rr.retained_at desc, rr.id desc),
m as (
  select l.rid, l.job_id,
         count(w.id) as same_rows,
         count(w.id) filter (where w.lat is not null and (w.location_verified or w.point_authority in ('admin_confirmed', 'auto_reuse'))) as same_confirmed
    from lost l left join public.job_work_locations w on w.job_id = l.job_id
     and location_private.same_site_address(l.row_data->>'raw_address', w.raw_address, array[w.province, w.district, w.ward, w.resolved_province] || coalesce(w.resolved_wards, '{}'::text[]))
   group by l.rid, l.job_id)
select '::notice::[W7-2 지워진 확정 줄] (공고, 지점) ' || count(*) || '쌍 · 공고 ' || count(distinct job_id) || '건'
       || ' · 이미 확정 있음(복구 불필요) ' || count(*) filter (where same_confirmed > 0)
       || ' · 복구 후보(같은 사업장 줄 1개, 확정 없음) ' || count(*) filter (where same_confirmed = 0 and same_rows = 1)
       || ' · 모호(같은 사업장 줄 2개 이상 — 자동 복구 안 함) ' || count(*) filter (where same_confirmed = 0 and same_rows > 1)
       || ' · 같은 사업장 줄 없음(이전·삭제 — 기존 정책) ' || count(*) filter (where same_rows = 0)
  from m;
-- [W7-3] 재확인 범위: 확정 좌표가 하나도 없는 공개 공고의 위치 줄(출처·주소).
with w as (
  select w.*, (w.lat is not null and (w.location_verified or w.point_authority in ('admin_confirmed', 'auto_reuse'))) as confirmed from public.job_work_locations w),
j as (select j.id, j.company from public.local_jobs j where j.active and not coalesce(j.admin_hidden, false)),
t as (select w.job_id from w join j on j.id = w.job_id group by w.job_id having bool_or(w.confirmed) is not true)
select '::notice::[W7-3 확정 없는 공개 공고] #' || w.job_id || ' ' || left(coalesce(j.company, ''), 36)
       || ' · 줄 ' || w.id || ' ' || coalesce(w.point_kind, '없음') || '/' || coalesce(w.point_authority, '없음')
       || ' · 출처 ' || coalesce(w.point_evidence->>'source', w.geocode_source, '없음')
       || ' · 좌표 ' || case when w.lat is null then '없음' else '있음' end || ' · ' || left(w.raw_address, 70)
  from w join j on j.id = w.job_id join t on t.job_id = w.job_id order by w.job_id, w.sort_order, w.id limit 120;
with w as (
  select w.point_authority, w.point_kind, (w.lat is not null and (w.location_verified or w.point_authority in ('admin_confirmed', 'auto_reuse'))) as confirmed
    from public.job_work_locations w join public.local_jobs j on j.id = w.job_id and j.active and not coalesce(j.admin_hidden, false))
select '::notice::[W7-3 공개 공고 위치 줄 분포] ' || coalesce(point_authority, '없음') || '/' || coalesce(point_kind, '없음')
       || ' · 확정 ' || confirmed || ' · ' || count(*) || '줄'
  from w group by point_authority, point_kind, confirmed order by 1;
-- [W7-4] 위치 보류함 상태(W2와 같은 조회 — 재판정은 기존 retry_held가 한다).
select '::notice::[W7-4 위치 보류함] ' || coalesce(h.meta->>'status', '없음') || ' / ' || coalesce(h.meta->>'reason', '없음') || ' ' || count(*) || '건'
  from public.research_artifacts h where h.kind = 'location-hold'
 group by h.meta->>'status', h.meta->>'reason' order by 1;
-- [W3b 실증] 지도 처리 상태: 장애·한도 근거로 끝난 건과 실패 상한에 닿은 건(하루 지나면 다시 확인 대상).
with r as (
  select state, (failures >= 2 or calls >= 2) as capped, updated_at > now() - interval '1 day' as recent,
         case when provider_result->>'evidence' ~ 'google:quota' then 'google:quota'
              when provider_result->>'evidence' ~ '(vietmap|goong):quota' then 'vietmap/goong:quota'
              when provider_result->>'evidence' ~ '(google|vietmap|goong):provider_failed' then 'provider_failed' else '없음' end as why
    from public.map_r1_location_jobs where state in ('failed', 'deferred') or provider_result->>'evidence' ~ '(quota|provider_failed)')
select '::notice::[W3b 지도 처리] 상태 ' || state || ' · 근거 ' || why || ' · 상한 ' || capped || ' · 최근 하루 안 갱신 ' || recent || ' · ' || count(*) || '건'
  from r group by state, why, capped, recent order by state, why, capped, recent;
-- [W4·W6 실증] 2026-11-24 뒤 쓰기 기록: 날짜·종류별 건수와, 확정 좌표가 확정 아님으로 바뀌거나 지워진 건(표기만 바뀐 같은 사업장이면 0이어야 함).
with l as (
  select l.*, (l.previous_row->>'lat' is not null and (l.previous_row->>'point_authority' in ('admin_confirmed', 'auto_reuse') or coalesce((l.previous_row->>'location_verified')::boolean, false))) as was_confirmed,
         (l.next_row is not null and l.next_row->>'lat' is not null and (l.next_row->>'point_authority' in ('admin_confirmed', 'auto_reuse') or coalesce((l.next_row->>'location_verified')::boolean, false))) as is_confirmed
    from location_private.write_log l where l.created_at >= timestamptz '2026-11-24 00:00+00')
select '::notice::[W4·W6 쓰기 기록] ' || to_char(created_at, 'MM-DD') || ' ' || operation || ' · ' || count(*) || '건'
       || ' · 확정 유지 ' || count(*) filter (where was_confirmed and is_confirmed)
       || ' · 확정 잃음 ' || count(*) filter (where was_confirmed and not is_confirmed)
  from l group by to_char(created_at, 'MM-DD'), operation order by 1;
with l as (
  select l.*, (l.previous_row->>'lat' is not null and (l.previous_row->>'point_authority' in ('admin_confirmed', 'auto_reuse') or coalesce((l.previous_row->>'location_verified')::boolean, false))) as was_confirmed,
         (l.next_row is not null and l.next_row->>'lat' is not null and (l.next_row->>'point_authority' in ('admin_confirmed', 'auto_reuse') or coalesce((l.next_row->>'location_verified')::boolean, false))) as is_confirmed
    from location_private.write_log l where l.created_at >= timestamptz '2026-11-24 00:00+00')
select '::notice::[W4·W6 확정 잃은 쓰기] #' || job_id || ' 줄 ' || coalesce(work_location_id::text, '없음') || ' ' || operation || ' ' || to_char(created_at, 'MM-DD HH24:MI')
       || ' · ' || left(coalesce(previous_row->>'raw_address', ''), 60) || ' → ' || left(coalesce(next_row->>'raw_address', '삭제'), 60)
       || ' · 같은 사업장 ' || coalesce(location_private.same_site_address(previous_row->>'raw_address', next_row->>'raw_address', array[next_row->>'province', next_row->>'district', next_row->>'ward', next_row->>'resolved_province'])::text, '해당 없음')
  from l where was_confirmed and not is_confirmed order by created_at desc limit 40;
