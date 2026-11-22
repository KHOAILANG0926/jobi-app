# HANDOFF — 2026-11-22 (Claude) · JOBI 4단계 — 1-B·1-C Draft PR
## 1. 현재 상태
- 코드: master 최신(#959 병합 포함). Draft PR 3개 — #970(1-B 코드·시험: 마감 당일 열림·베트남 날짜, 연락처 8자리, 필수 9개 일치 시험, 정책 판정기 일치 시험) · #971(1-B DB: 만료 cron 기준 날짜 = 베트남 날짜, Lee Approve 대기) · 1-C(`claude/1c-db-rule-reject-kept`: Facebook이 DB 규칙 거부 공고의 원문·출처·규칙 코드·사유를 보류함에 rejected로 보존). 병합·배포·운영 DB 변경 없음.
- 1-C 범위: ingest_gateway.ingest_job(hold=True) 포장만. 관리자·고용주 위치 처리, DB ingest_job 트랜잭션, vieclam24h hold=False, 공개 정책은 변경 없음. 위치 거부(unfound·held)·수집 금지 사유(수수료 소개소 등)는 기존 결정 그대로.
- 남은 결정: F4 `khac`가 점검기 공개를 막는 의도 / F5 관리자 review 예외 / 고용주 작성 화면 12개 필수와 필수 9개 문서 차이 / 화면 연락 버튼의 8자리 미만 표시 / Facebook 지난 마감일 제외 여부. 운영 DB 조회 불가(프록시) → 공개 24건별 판정 분포·운영 확인 미검증.
## 2. 다음 할 일 3개
1. Lee: Draft PR 3개 검토(#971은 migration이라 공식 Approve). 세 PR이 WORK_LOG·HANDOFF를 같이 바꿔 병합 순서대로 충돌을 정리해야 함.
2. 위 남은 결정 5건 확인 후 필요한 것만 별도 PR.
3. Facebook 쿠키 갱신(계정 잠금 해제) 뒤 실제 dryrun→보류함·거부 보존 확인(#940).
## 3. 필수 규칙
- CLAUDE.md·.claude/RULES_CORE.md 먼저. 확인한 것만 [직접 확인]/[기존 기록]/[추정], 5줄 이내.
- 운영 DB는 migration + production_check PR로만. 새 검사·규칙·승인 절차·대기열을 덧붙이지 않는다. 필수 9개 목록·상세 구성은 Lee 지시 없이 바꾸지 않는다.
- 위치를 모르면 핀을 찍지 않는다·못 찾은 공고는 등록하지 않는다(보류함에 보관). 정기 수집은 승인 없이 켜지 않는다.
