# HANDOFF — 2026-11-23 (Claude) · 이슈 #988 지점별 독립 공고·위치 우선순위 구현
## 1. 현재 상태
- 코드: master e72d1f1(#987 규정 병합). 이 브랜치(feat/988-branch-jobs-location-order): Google→VietMap→Goong 위치 채택(Google은 추가 검증 없이 확정), 핀·거리검색은 확정 좌표(exact+확인, gate)만(`jobCoords.isConfirmedMapPoint`), 수집 입구가 한 글의 지점 A·B·C를 공고 3개로 등록(`ingest_gateway._ingest_branches`), migration `20261124000000_branch_job_identity`(같은 공고 판정=원문+지점 위치, 형제 지점 중복 면제 — Approve·병합 뒤 migrations-apply가 적용). 「자율 완주 및 승인 게이트 원칙」 문서 3개 반영.
- 미완료(구현 안 함): TopCV·vieclam24h 지점 분리, Facebook refresh의 새 지점 덧붙임(`refresh_facebook_existing.py`), 지점 누락 재수집 판정, 관리자 위치 확정 대기열(#985·#986 보류), 기존 다중 근무지 공고 전환(dry-run 후 Lee 확인). 운영 DB 조회 불가라 운영 실행·기존 area 핀 영향 건수는 미검증.
## 2. 다음 할 일 3개
1. Lee: 최종 PR Approve(검사 전체 통과·Ready 후 approval-gate만 남음).
2. 위 미완료 중 TopCV·Facebook refresh 지점 분리 → 같은 identity(원문+지점 위치) 적용 PR.
3. 기존 다중 근무지 공고 전환 설계(첫 지점 job_id 유지) → dry-run 결과를 Lee에게 확인 요청(허용된 승인 시점 ①).
## 3. 필수 규칙
- CLAUDE.md·.claude/RULES_CORE.md 먼저(「지점별 독립 공고」「위치 확인 우선순위」「기존 확정 규정 보호」「자율 완주 및 승인 게이트 원칙」). 확인한 것만 [직접 확인]/[기존 기록]/[추정], 5줄 이내. 운영 DB 직접 접근 금지.
