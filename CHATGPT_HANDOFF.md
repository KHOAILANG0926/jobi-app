# HANDOFF — 검사 통과해야 공개되는 틀 (2026-11-01, Claude)

## 1. 실제 상태
- PR #376(fix/inspect-content-hash-20261101): 내용 지문 트리거 + 검사표 3항목 + 상세요강 빌더 수정. 병합·운영 migration·#5157 화면 확인 전에는 완료 아님.
- 공개 규칙: crawler/admin 공고는 `ocr_check.inspect.content_hash`가 지금 내용과 같고 `publishable=true`일 때만 공개(트리거 trg_zzz_inspect_current). 공개 시작(새 공고·비공개→공개)만 막고, 공개 중인 공고는 내용이 바뀌어도 유지 → job-inspect가 재검사 실패 시 내림(20261101170000).
- 직접 Supabase 운영 DB SQL 금지(읽기 전용 조회만). migration + production_check 경로만.

- 결정 0007(회사명·지점명 줄) 화면 반영: src/lib/companyBranch.ts. 다수 지점(결정 3)은 아직 미구현.

- 2026-11-01 "빠짐 0": 상세요강은 원문 줄을 소제목·사이트 글자·완전 중복 외엔 빼지 않음(10-30 ④). 칸 정하는 순서는 src/lib/jobDetailFill.ts 머리말 한 곳. 실제 공고 시험 src/lib/realJobs.test.ts(새 유형은 원문 추가).

## 2. 다음 할 일
1. #376 병합 → migrations-apply 운영 적용 → job-ocr-check 실행 후 #5157 통과·공개, #4982 비공개(R11) 확인.
2. Lee 확인: 10-30 "④ 원문 전체 보여줌"과 급여 총액 빼기·포스터 머리글(HIGHLANDS COFFEE/TUYỂN DỤNG 등) 기타란 처리 충돌.
3. 규정 표 check_ref 강제(20261101150000): 새 규정은 장치(trigger:/inspect:/ci:/decision_*/work_rule)와 함께만 저장.

- PR 설명란: 검사 결과는 미리 적지 않아도 됨(pending 허용). 실제 결과는 봇 병합이 확인.

## 3. 필수 규칙
- 특정 공고 번호 전용 코드 금지, 틀(규칙·검사)로만 수정. 검사 통과 전 공개 우회 금지.
