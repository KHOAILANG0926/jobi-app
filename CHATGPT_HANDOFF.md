# HANDOFF — 검사 통과해야 공개되는 틀 (2026-11-01, Claude)

## 1. 실제 상태
- PR #376(fix/inspect-content-hash-20261101): 내용 지문 트리거 + 검사표 3항목 + 상세요강 빌더 수정. 병합·운영 migration·#5157 화면 확인 전에는 완료 아님.
- 공개 규칙: crawler/admin 공고는 `ocr_check.inspect.content_hash`가 지금 내용과 같고 `publishable=true`일 때만 공개(트리거 trg_zzz_inspect_current). 내용이 바뀌면 비공개+inspect_hold → job-inspect가 통과 시 재공개.
- 직접 Supabase 운영 DB SQL 금지(읽기 전용 조회만). migration + production_check 경로만.

## 2. 다음 할 일
1. #376 병합 → migrations-apply 운영 적용 → job-ocr-check 실행 후 #5157 통과·공개, #4982 비공개(R11) 확인.
2. Lee 확인: 10-30 "④ 원문 전체 보여줌"과 급여 총액 빼기·포스터 머리글(HIGHLANDS COFFEE/TUYỂN DỤNG 등) 기타란 처리 충돌.
3. 규정 표(job_posting_rules) 연결 없는 규정 CI 실패 장치(3단계) — 미착수.

## 3. 필수 규칙
- 특정 공고 번호 전용 코드 금지, 틀(규칙·검사)로만 수정. 검사 통과 전 공개 우회 금지.
