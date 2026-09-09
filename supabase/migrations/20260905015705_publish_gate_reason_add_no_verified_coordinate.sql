-- 이미 운영 Supabase(edhuesdnuxlbcfephutq)에 적용된 migration을 리포에
-- 사후 반영한 파일이다 — 이 파일을 실행해서 적용된 것이 아니다.
--
-- 적용 사실: supabase_migrations.schema_migrations에 version
-- '20260905015705' / name 'publish_gate_reason_add_no_verified_coordinate'로
-- 기록되어 있고, 그 statements가 아래 SQL 본문과 동일함을 2026-09-09에
-- 직접 조회해 확인했다. 운영 local_jobs_publish_gate_reason_check 제약도
-- 현재 'no_verified_coordinate'를 포함한다(재조회로 재확인).
-- 적용 시각(버전 타임스탬프 기준, UTC): 2026-09-05 01:57:05.
--
-- 과거 이력: 이 파일은 원래 0017_..._draft.sql로 존재했고, 2026-09-05
-- 00:09(+07) 커밋(6e12edb) 시점에는 "미실행 블로커"로 기록돼 있었다. 그
-- 이후 어느 시점에 파일/커밋 없이 운영 DB에 직접 적용된 것으로 보인다.
-- 2026-09-09에 실제 운영 상태와 리포를 맞추기 위해 파일명을 적용된
-- migration version(20260905015705)에 맞춰 변경하고 이 주석을 추가했다.
--
-- 배경(원래 draft에 적힌 이유, 그대로 유지): 2026-09-04 사용자 지시로
-- 공개 게이트 정책이 "모든 근무지가 C1(coordinate_accuracy=='exact')이고
-- 유효한 지원 경로가 있을 때만 통과"로 강화됐다(crawler/job_quality.py
-- gate_auto_publish()). 이 새 게이트는 'no_verified_coordinate'라는 새
-- 사유 값을 반환할 수 있는데, 기존 local_jobs.publish_gate_reason 체크
-- 제약(0015 migration)은 ('ok','no_address_text','no_application_path')만
-- 허용해 이 값을 실제 컬럼에 저장하려면 제약을 넓혀야 했다. 순수
-- additive(제약 재정의만, 컬럼/데이터 변경 없음).

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
