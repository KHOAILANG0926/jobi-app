-- 초안(DRAFT) — 검토용으로만 작성. 사용자 승인 전에는 운영 DB에 실행하지 않는다.
--
-- 배경: 2026-09-04 사용자 지시로 공개 게이트 정책이 "모든 근무지가
-- C1(coordinate_accuracy=='exact')이고 유효한 지원 경로가 있을 때만 통과"로
-- 강화됐다(crawler/job_quality.py gate_auto_publish()). 이 새 게이트는
-- 'no_verified_coordinate'라는 새 사유 값을 반환할 수 있는데, 기존
-- local_jobs.publish_gate_reason 체크 제약(0015 migration)은
-- ('ok','no_address_text','no_application_path')만 허용해 이 값을 실제
-- 컬럼에 저장하려면 제약을 넓혀야 한다.
--
-- 이번 라운드는 dry-run만 수행하고 DB에 쓰지 않으므로 이 migration은 아직
-- 필요 없다 — 실제 크롤 저장 경로를 다시 가동할 때(사용자 승인 후) 먼저
-- 실행해야 한다. 순수 additive(제약 재정의만, 컬럼/데이터 변경 없음).

begin;

alter table public.local_jobs
  drop constraint if exists local_jobs_publish_gate_reason_check;

alter table public.local_jobs
  add constraint local_jobs_publish_gate_reason_check
  check (publish_gate_reason in ('ok', 'no_address_text', 'no_verified_coordinate', 'no_application_path') or publish_gate_reason is null);

comment on column public.local_jobs.publish_gate_reason is
  'gate_auto_publish()의 판정 사유. 2026-09-04부터 공개 게이트는 상세주소
   텍스트 + 모든 근무지 coordinate_accuracy=="exact" + 유효한 지원 경로를
   전부 요구한다(이전 버전은 좌표 검증을 요구하지 않았음). active=false인
   크롤러 출처 공고는 반드시 이 값이 채워져 있어야 한다.';

commit;
