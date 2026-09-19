-- 성별/연령 조건 컬럼 추가 (2026-09-19 세션 합의).
--
-- 배경: 급구 페이지 "Điều kiện khác" 패널에 이미 Giới tính(Nam/Nữ)/Độ tuổi
-- 선택 UI가 있었지만 local_jobs에 대응 컬럼이 없어 아무 것도 걸러내지
-- 못하는 장식용 UI였다(genderFilter/ageFilter state가 filtered 계산에
-- 반영 안 됨). 사용자가 "실제로 작동하게 만들기"를 선택해 컬럼을 추가한다.
--
-- job_duration과 동일한 패턴: nullable text, DB 레벨 CHECK 제약 없음
-- (PostJob.tsx의 select가 값 범위를 제한). 순수 additive이며 기존 컬럼/
-- 제약/RLS/데이터를 변경하지 않는다. 크롤러 소스는 이 정보를 구조화된
-- 필드로 제공하지 않으므로 당장은 채우지 않고, employer가 PostJob.tsx로
-- 직접 등록할 때만 값이 채워질 것으로 예상한다(job_duration과 동일 원칙).

alter table public.local_jobs
  add column if not exists gender_requirement text;

alter table public.local_jobs
  add column if not exists age_requirement text;

comment on column public.local_jobs.gender_requirement is
  '성별 조건 — "Nam"/"Nữ" 중 하나를 기대하나 DB 레벨 CHECK 제약은 없음
   (프론트 PostJob.tsx에서 select로 제한). null = 조건 없음. 크롤러는
   채우지 않고 employer 직접등록 전용으로 시작한다.';

comment on column public.local_jobs.age_requirement is
  '연령 조건 — 급구 페이지 필터와 동일한 5구간("18 - 24 tuổi"/"25 - 34
   tuổi"/"35 - 44 tuổi"/"45 - 54 tuổi"/"Trên 55 tuổi") 중 하나를 기대하나
   DB 레벨 CHECK 제약은 없음(프론트 PostJob.tsx에서 select로 제한).
   null = 조건 없음. 크롤러는 채우지 않고 employer 직접등록 전용으로
   시작한다.';
