# HANDOFF — 2026-11-21 (Claude) · #808 S1~S8 마감 작업

## 1. 현재 상태
- 코드: master `0ac281d`(S1 B3 병합 직전 잠금 재확인). 마감 PR(브랜치 `claude/s808-finish`)이 열려 있다 — 독립 검토·4대 보고를 병합 조건에서 빼고(Lee 11-21, 11-14 결정 7①·#807 게이트 (3) 변경), 병합 뒤 호출 목록에 ai-reader-calibration·job-ocr-check 추가, PR 본문 형식 F12 2가지, MAP-1 상세·관리자 지도 스타일 대기 15·20초(메인은 12초 예비지도 제한 때문에 5·6초 유지). 안 쓰게 된 검토 판정 코드 삭제. 검사·보호 장치 변경이라 Lee 공식 Approve 뒤 봇 병합.
- 병합 조건(이 PR 병합 뒤): 필수 기계 검사(checks·guard·app-screen·publication-gate) + approval-gate(고위험은 Lee 공식 Approve, 최신 커밋) + S6 배포 잠금. ai-review는 neutral「필수 아님, 검토 안 함」— Lee가 Ruleset에서 빼면 지우는 PR을 따로 낸다.
- 배포: 운영 잠금 #943(804a4ae)·#945(0ac281d) 열림 — 지도 검사(MAP-1) 실패. 일반 PR 자동 병합은 잠금이 풀릴 때까지 멈춤(Lee 승인 PR만 통과).
- 운영 위험(#808·#946): 봇 병합 뒤 pr-checks·occupation-publication-check는 돌지 않음(Lee 결정: 최신 상태 요구 안 씀), STATUS는 하루 1회 예약에서만 갱신, master 기본 보호 필수 검사가 '관리자 제외'(PROT-1), Facebook 수집 계정 잠금(Lee 쿠키 필요), B3 응답 정지 시 PR당 923초.
- DB: 이번 작업 변경 없음.

## 2. 다음 할 일 3개
1. 마감 PR: 필수 검사 → Lee Approve(최신 커밋) → 봇 병합 → 병합 뒤 검사·deploy-verify 실행 번호 확인(MAP-1 수정 효과 포함). 실패하면 원인 하나만 고치고 1번 더, 핵심 보호 검사가 두 번 실패하면 멈추고 #808 '운영 위험'.
2. Lee: Ruleset "S4 검사 앱"에서 ai-review 제거 → 설정 조회로 확인 → ai-review 삭제 PR(③).
3. vieclam24h(crawl.yml publish_one) 실제 공고 1건 원본→검증→DB→PC·모바일 화면 확인 후 #808에 완료/보류/운영 위험 정리하고 닫기.

## 3. 필수 규칙
- CLAUDE.md·.claude/RULES_CORE.md 먼저. 확인한 것만 [직접 확인]/[기존 기록]/[추정]으로 보고, 5줄 이내.
- 운영 DB는 migration + production_check PR로만. 비밀값·권한·DB 삭제·검사 장치 변경은 Lee 공식 Approve.
- 운영 DB·보안·공고 공개·배포 잠금 같은 필수 보호는 실패해도 경고로 낮추지 않는다. 새 검사·규칙·워크플로를 덧붙이지 않는다(기존 기능의 오류만 최소 수정).
