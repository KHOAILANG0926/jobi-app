-- 초안(DRAFT) — 검토용으로만 작성. 사용자 승인 전에는 운영 DB에 실행하지 않는다.
--
-- 배경: ViecLam24h 원문 상세페이지 20건 실측 감사 결과, "근무기간"(계약기간 —
-- 예: "Dài hạn", "3 tháng thử việc + chính thức", 특정 프로젝트 기간 등) 개념에
-- 대응하는 컬럼이 local_jobs에 존재하지 않음을 information_schema.columns로
-- 직접 확인했다. 기존에 있는 hours/work_period/work_days/education/preference/
-- num_hires 6개 컬럼은 전부 다른 개념에 이미 쓰이고 있어(예: work_period는
-- 실제로 "근무형태"用, preference는 실제로 "경력"用 — JobDetail.tsx 렌더링
-- 라벨로 확인) 재사용할 수 없다 — 그래서 순수 추가 컬럼이 필요하다.
--
-- 순수 additive(nullable 컬럼 추가)이며 기존 컬럼/제약/RLS/데이터를 변경하지
-- 않는다. ViecLam24h 원문 자체가 이 정보를 구조화된 필드로 두지 않는 경우가
-- 많아(실측: 20건 중 다수가 본문 자유 텍스트에도 이 정보가 아예 없음),
-- 이 컬럼은 대부분 null로 유지될 것으로 예상된다 — 그 자체는 결함이 아니라
-- 원문에 그 정보가 없다는 뜻이다.

begin;

alter table public.local_jobs
  add column if not exists work_duration text;

comment on column public.local_jobs.work_duration is
  '근무기간(계약기간) — 예: "Dài hạn", "3 tháng thử việc + chính thức". ViecLam24h
   원문에 구조화된 필드가 없어 본문 자유 텍스트에서 확인될 때만 채워진다. 대부분
   null인 것이 정상(원문 자체에 이 정보가 없는 경우가 많음) — 파서 결함과
   혼동하지 말 것.';

commit;
