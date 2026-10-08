-- chotot 100건 공개 전환 dry-run (읽기 전용 SELECT 1개 — 아무것도 바꾸지 않는다). Supabase SQL Editor에서 실행.
-- 결과 1행: 건수 요약 + rows(JSON). rows 셀을 그대로 복사해 주면 정확한 KCN 분류를 계산한다
-- (scripts/ops/chotot_publish_classify.ts, 앱과 같은 findIndustrialPark 사용).
-- 공개 대상 기준(공개 SQL과 동일): chotot ID 4685~4784 · 지금 비공개(admin_hidden) · active
--   · 회사명 2자 이상 · 연락처(전화) 숫자 8자리 이상 · 마감일 없음 또는 오늘(베트남 시간) 이후.
with today as (select (now() at time zone 'Asia/Ho_Chi_Minh')::date d),
t as (
  select j.id, j.company, j.employer_phone, j.application_deadline, j.recruitment_type, j.active, j.admin_hidden,
         length(btrim(coalesce(j.company, ''))) >= 2 as company_ok,
         length(regexp_replace(coalesce(j.employer_phone, ''), '\D', '', 'g')) >= 8 as phone_ok,
         (j.application_deadline is null or j.application_deadline > (select d from today)) as deadline_ok,
         exists (select 1 from public.job_location_candidates c where c.job_id = j.id and c.status = 'approved') as approved_pin,
         exists (select 1 from public.job_work_locations w where w.job_id = j.id and w.industrial_park is not null) as kcn_text,
         coalesce((select json_agg(json_build_object('raw_address', w.raw_address, 'industrial_park', w.industrial_park) order by w.sort_order)
                   from public.job_work_locations w where w.job_id = j.id), '[]'::json) as wl,
         j.location
  from public.local_jobs j
  where j.source like 'chotot:%' and j.id between 4685 and 4784
),
e as (select t.*, (admin_hidden and active and company_ok and phone_ok and deadline_ok) as eligible from t)
select
  count(*)                                                            as chotot_rows,
  count(*) filter (where eligible)                                    as publish_targets,
  count(*) filter (where not eligible and not admin_hidden)           as already_public,
  count(*) filter (where admin_hidden and not active)                 as excluded_inactive,
  count(*) filter (where admin_hidden and not company_ok)             as excluded_no_company,
  count(*) filter (where admin_hidden and not phone_ok)               as excluded_no_phone,
  count(*) filter (where admin_hidden and not deadline_ok)            as excluded_expired,
  count(*) filter (where eligible and approved_pin)                   as targets_with_approved_pin,
  count(*) filter (where eligible and not approved_pin and kcn_text)  as targets_kcn_text_proxy,
  count(*) filter (where eligible and not approved_pin and not kcn_text) as targets_call_only_proxy,
  count(*) filter (where eligible and recruitment_type = 'agency')    as targets_agency,
  (select count(*) from public.local_jobs where active and not admin_hidden) as public_jobs_now,
  json_agg(json_build_object('id', id, 'company', company, 'phone_ok', phone_ok, 'deadline', application_deadline,
           'agency', recruitment_type = 'agency', 'eligible', eligible, 'approved_pin', approved_pin, 'location', location, 'wl', wl)
           order by id) as rows
from e;
