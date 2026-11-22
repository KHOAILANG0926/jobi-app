# HANDOFF — 2026-11-21 (Claude) · #808 S1~S8 마감 뒤

## 1. 현재 상태
- 코드: master `1a83668`(#948 — 독립 검토·4대 보고를 병합 조건에서 뺌, 병합 뒤 호출 목록 +ai-reader-calibration·job-ocr-check, PR 본문 형식 F12, MAP-1 상세·관리자 지도 스타일 대기 15·20초). ai-review 검사 삭제 PR(브랜치 `claude/s808-remove-ai-review`) — 검사 장치 변경이라 Lee 공식 Approve 뒤 봇 병합.
- 병합 조건: 필수 기계 검사(checks·guard·app-screen·publication-gate) + approval-gate(고위험은 Lee 공식 Approve, 최신 커밋) + S6 배포 잠금. Ruleset "S4 검사 앱" 필수 = approval-gate·publication-gate(ai-review는 Lee가 11-21 뺌). 독립 검토는 수동·선택.
- 배포: deploy-verify 44883165886(1a83668) 성공 — 잠금 #943·#945는 풀림 조건 충족(이슈는 열린 채, 닫아도 됨).
- #808 닫음(완료/보류/운영 위험 댓글). 보류: vieclam24h 실제 공고 1건(시험 2건 모두 본문 전화번호 없음). 운영 위험: 봇 병합 뒤 pr-checks·occupation-publication-check 안 돎, STATUS 하루 1회, master 기본 보호 '관리자 제외'(PROT-1), Facebook 수집 계정 잠금(Lee 쿠키 필요), B3 응답 정지 시 PR당 923초.
- DB: 이번 작업 변경 없음.

## 2. 다음 할 일 3개
1. ai-review 삭제 PR: 필수 검사 → Lee Approve(최신 커밋) → 봇 병합 → deploy-verify 실행 번호 확인.
2. Lee: Facebook 쿠키(FB_C_USER·FB_XS, ops-keys 환경) 새로 넣기 → 계정 잠금 해제 뒤 Facebook 시험 수집 1건.
3. vieclam24h publish_one: 본문에 전화번호 있는 공고가 나오면 1건 원본→검증→DB→PC·모바일 확인(공개 기준 완화 금지).

## 3. 필수 규칙
- CLAUDE.md·.claude/RULES_CORE.md 먼저. 확인한 것만 [직접 확인]/[기존 기록]/[추정]으로 보고, 5줄 이내.
- 운영 DB는 migration + production_check PR로만. 비밀값·권한·DB 삭제·검사 장치 변경은 Lee 공식 Approve.
- 운영 DB·보안·공고 공개·배포 잠금 같은 필수 보호는 실패해도 경고로 낮추지 않는다. 새 검사·규칙·워크플로를 덧붙이지 않는다(기존 기능의 오류만 최소 수정).
