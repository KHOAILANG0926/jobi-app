-- korea_jobs에 베트남어 번역 필드를 additive로 추가한다. 원문 title/description은
-- rename하지 않고 그대로 유지 — UI는 title_vi가 있으면 그걸, 없으면 title로 fallback한다
-- (컴포넌트 쪽 로직, 이 migration은 스키마/뷰만 다룬다).
--
-- company/contact_method/working_hours 등 다른 한국어 필드는 이번 범위에 넣지 않는다
-- (company는 보통 고유명사라 번역 대상이 아닐 가능성이 높고, 나머지는 별도 판단 필요).

begin;

alter table public.korea_jobs
  add column if not exists title_vi text,
  add column if not exists description_vi text;

-- korea_jobs_public 뷰 재정의 — title_vi/description_vi 추가 외 기존 정의와 동일
-- (status='active' AND 미만료 필터, source_url 조건부 노출, 내부 컬럼 제외 그대로 유지).
-- CREATE OR REPLACE VIEW는 기존 컬럼 순서/이름을 바꿀 수 없어(중간 삽입 시
-- "cannot change name of view column" 에러) title_vi/description_vi를 끝에 추가한다
-- — PostgREST는 이름으로 선택하므로 컬럼 순서는 프론트에 영향 없음.
create or replace view public.korea_jobs_public as
select
  id,
  created_at,
  title,
  company,
  region,
  salary,
  deadline,
  description,
  category,
  province,
  district,
  salary_type,
  salary_min,
  salary_max,
  working_hours,
  working_days,
  days_off,
  headcount,
  gender_condition,
  age_condition,
  korean_level_required,
  experience_required,
  visa_status_required,
  dormitory,
  meals,
  transportation,
  contact_method,
  posted_at,
  expires_at,
  case when show_source_link then source_url else null end as source_url,
  title_vi,
  description_vi
from public.korea_jobs
where status = 'active'
  and (expires_at is null or expires_at > now());

-- 뷰를 재생성했으므로 grant도 다시 명시(0013에서 겪은 default privileges 유출을
-- 반복하지 않기 위해 매번 revoke-then-grant로 고정한다).
revoke all privileges on public.korea_jobs_public from anon, authenticated;
grant select on public.korea_jobs_public to anon, authenticated;

commit;
