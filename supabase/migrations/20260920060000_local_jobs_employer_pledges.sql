-- 기업 자가서약(pledge) 컬럼 추가 (2026-09-20, 알바몬 벤치마킹 "신뢰 정보"
-- 2단계 착수 — 실제 검증(기업인증)은 관리자 승인 플로우가 필요해 STRICT
-- 대상으로 계속 보류, 이번엔 검증 없이도 정직하게 표시 가능한 자가서약만.
--
-- job_duration/gender_requirement와 동일한 패턴: nullable boolean, DB 레벨
-- CHECK 제약 없음. 순수 additive이며 기존 컬럼/제약/RLS/데이터를 변경하지
-- 않는다. 크롤러 소스는 채우지 않고 employer가 PostJob.tsx로 직접 등록할
-- 때만 값이 채워진다.
--
-- 화면 표시 문구는 job.companyVerified("✓ Doanh nghiệp đã xác minh", 관리자
-- 검증됨)와 명확히 다르게("Cam kết ..." = 약속/서약) 구분해 자가서약을
-- 검증된 사실처럼 보이게 하지 않는다.

alter table public.local_jobs
  add column if not exists labor_contract_pledge boolean;

alter table public.local_jobs
  add column if not exists social_insurance_pledge boolean;

comment on column public.local_jobs.labor_contract_pledge is
  '기업이 근로계약서 작성을 약속했는지 — 제3자 검증 아닌 자가서약(self-pledge).
   true = 서약함, null/false = 표시 안 함. 크롤러는 채우지 않고 employer
   직접등록(PostJob.tsx) 전용 체크박스로 시작한다.';

comment on column public.local_jobs.social_insurance_pledge is
  '기업이 4대보험(BHXH/BHYT 등) 가입을 약속했는지 — 제3자 검증 아닌
   자가서약(self-pledge). true = 서약함, null/false = 표시 안 함. 크롤러는
   채우지 않고 employer 직접등록(PostJob.tsx) 전용 체크박스로 시작한다.';
