-- 근무기간(알바몬 스타일 7종 구간) 컬럼 추가 (2026-09-18 세션 합의).
--
-- 배경: 기존 0016_local_jobs_work_duration_draft.sql은 ViecLam24h 원문의
-- 자유 텍스트 계약기간(예: "Dài hạn")을 담는 draft였고 사용자 승인 전
-- 상태로 운영 DB에 적용된 적이 없다(information_schema로 확인). 이번
-- 세션은 그와 다른 설계로 진행한다 — 알바몬 "근무기간" 필터와 동일한
-- 고정 7구간(Một ngày / Dưới 1 tuần / 1 tuần - 1 tháng / 1 - 3 tháng /
-- 3 - 6 tháng / 6 tháng - 1 năm / Trên 1 năm)을 PostJob.tsx에서 선택형
-- 으로 입력받는다. DB에는 CHECK 제약을 걸지 않고 text로 유연하게 둔다.
--
-- 순수 additive(nullable 컬럼 추가)이며 기존 컬럼/제약/RLS/데이터를
-- 변경하지 않는다. 크롤러 소스(vieclam24h.vn)는 이 정보를 구조화된
-- 필드로 제공하지 않아(classifier.py 주석으로 확인) 당장은 채우지 않고,
-- employer가 PostJob.tsx로 직접 등록할 때만 값이 채워질 것으로 예상한다.

alter table public.local_jobs
  add column if not exists job_duration text;

comment on column public.local_jobs.job_duration is
  '근무기간 — 알바몬 스타일 7구간(Một ngày/Dưới 1 tuần/1 tuần - 1 tháng/
   1 - 3 tháng/3 - 6 tháng/6 tháng - 1 năm/Trên 1 năm) 중 하나를 기대하나
   DB 레벨 CHECK 제약은 없음(프론트 PostJob.tsx에서 select로 제한).
   크롤러는 채우지 않고(소스에 구조화된 필드 없음) employer 직접등록
   전용으로 시작한다. 기존 0016 draft(work_duration, 자유텍스트 계약기간
   개념)와는 이름/값 체계가 다른 별개 컬럼이며, 0016은 미적용 상태로 남아
   있다.';
