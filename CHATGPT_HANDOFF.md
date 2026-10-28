# CHATGPT_HANDOFF — Bomunttl 브랜치 전달 (2026-10-28)

## 1. 현재 상태 (코드·배포·DB)
- 전달 브랜치: feat/bomunttl-lee-source-20261028. api.github.com CONNECT 403; PR은 Claude가 생성한다. 운영 DB 직접 조회/쓰기·PR·병합·운영 등록·배포 없음.
- Lee 확인 출처 허용·위조 방지 R3와 지원 결정 우선 규칙을 CLAUDE.md/AGENTS.md·결정 0006·새 migration에 반영 준비. 게시 시각 계산·저장·추정 표시 취소; posted_at NULL. 이미지 저장 선택.
- CLI 생성 migration: 20261028034009_lee_verified_sources.sql → 20261028034036_register_bomunttl.sql. 같은 PR의 bomunttl_production_check.sql로 확인한다. 새 브랜치 병합 시 정상 migrations-apply가 등록하므로 별도 직접 SQL·ops-run-sql 실행 불필요.
- Bomunttl 1건, 역할별 원문 조건 보존·상단 Theo vị trí — xem chi tiết·numeric salary NULL. 첫 직무 공식 9402, 둘째 5131 별도 검토. canonical writer로 unresolved 주소와 관리자 대기만 생성한다. 원문 10h - 10h를 그대로 두고 hours_review 실패.
- 로컬 검증: npm test 83/83·tsc·build, PGlite R3+위조/충돌+실제 등록 SQL, 공식 직업 사례, 실제 PostgreSQL/PostGIS canonical writer+중복 방지+production_check, 관리자 queue 6/6·replay guard 1/1 통과. 독립 검토 후 차단 없음. 운영 검사표/핀/화면/연속기록은 아직 미확인.
- 로컬 검사표 9/11, pin·hours_review 확인 대기; OCR은 이미지 없는 등록이므로 비대상. 전 항목 docs/ops/2026-10-28-bomunttl.md. 예전 migration을 재적용해 R3를 덮던 workflow는 이력 확인+시험만 수행하도록 수정했다.

## 2. 다음 할 일 3개
1. Claude가 전달 브랜치로 PR을 만들고 필수 CI·actual PostgreSQL migration 검사를 확인한다. 소스 근거는 Lee 확인이며 캡처를 다시 요청하지 않는다.
2. 봇 병합→migrations-apply 정상 적용·production_check 확인. 실패하면 원문 오류 그대로 보고하고 중단하며 직접 접근·우회·자동 재시도하지 않는다.
3. 정상 job-ocr-check(재생성·검사표 포함)와 deploy-verify의 운영 결과로 링크·전체 검사·연속 수를 보고한다. 위치 목록에서 상호명+도로 확인·근무시간 관리자 확인을 해결하되 원문은 임의 수정하지 않는다.

## 3. 필수 규칙
- 운영 DB는 정상 migration+production_check 경로만. 공개·핀·시각을 추정해 승인/보고하지 않는다. 운영 위치 원본은 job_work_locations의 canonical writer.
- 기존 카드·상세 PC/모바일 틀/CSS 유지. 단일 대표 직업코드를 두 직무의 공통 코드라고 주장하지 않는다. 설거지 식사를 홀서빙에도 약속하지 않는다.
- STATUS.md/status 브랜치/생성기 변경 금지. 원격 STATUS를 직접 읽었으나 연속 통과 수는 없어 미확인. 로컬 9/11은 운영 검사표가 아니다. 상세 이전 이관은 WORK_LOG.md에 보존했다.
