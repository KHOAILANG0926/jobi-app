# HANDOFF — 2026-11-22 (Claude) · JOBI 4단계 개발 구조 개선 — 1-B Draft PR 2개
## 1. 현재 상태
- 코드: master 최신(#959 병합 `beed0e9` 포함). 1-B는 Draft PR 2개 — ① 코드·시험(`claude/1b-criteria-code`: 마감·연락처·필수 9개 기준 단일 원천 policy/job-criteria.json, 수집기·점검 코드 정렬) ② DB(`claude/1b-db-cron-vn`: 만료 cron 기준 날짜를 베트남 날짜로, migration 1개). 병합·배포·운영 DB 변경 없음.
- 1-A 측정 결과 [직접 확인]: 정책 평가기 Python·JS·SQL 4,057건 불일치 0(F1, 일치 시험은 job_posting_rules.pglite.test.mjs에 편입). 실제 불일치는 F2 마감·F3 연락처·F4 khac/점검기·F5 review 처리·F7 필수 항목. 이번 1-B는 F1·F2·F3·F7만 변경.
- 아직 안 한 것: F4(`khac`가 점검기 공개를 막는 것이 의도인지)·F5(관리자 review 예외는 문서상 "설계만")는 기존 결정이 불명확해 코드 변경 없음 — Lee 결정 필요. F6 원문 롤백·F8 위치 보호는 1-C. 운영 DB 조회는 이 환경에서 불가(프록시)라 공개 24건별 판정 분포·운영 확인은 미검증.
## 2. 다음 할 일 3개
1. Lee: Draft PR 2개 검토. 코드 PR은 `.github`를 안 건드림. DB PR은 migration이라 Lee 공식 Approve 대상.
2. 1-C: F6 원문 접수 롤백 / F8 위치 보호를 접수·비공개 보존·공개를 구분하는 방향으로 설계(차단 추가 없음). F4·F5 결정 확인.
3. 운영 확인: DB PR 병합 뒤 `deactivate_expired_vn_date_production_check.sql` 결과와 공개 공고 전후 차이 조회(운영 읽기).
## 3. 필수 규칙
- CLAUDE.md·.claude/RULES_CORE.md 먼저. 확인한 것만 [직접 확인]/[기존 기록]/[추정], 5줄 이내.
- 운영 DB는 migration + production_check PR로만. 새 검사·규칙·승인 절차·대기열을 덧붙이지 않는다. 필수 9개 목록·상세 구성은 Lee 지시 없이 바꾸지 않는다(이번엔 목록을 한 곳에 모으기만 했고 내용·필수 여부는 그대로).
- 위치를 모르면 핀을 찍지 않는다·못 찾은 공고는 등록하지 않는다(보류함에 보관). 정기 수집은 승인 없이 켜지 않는다.
