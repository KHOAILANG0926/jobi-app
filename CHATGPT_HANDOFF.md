# CHATGPT_HANDOFF — 복수직무·대략 핀 공통 수정 (2026-10-28)

## 1. 현재 상태 (코드·배포·DB)
- 전달 브랜치: fix/multi-role-map-presentation-20261028, 시작 origin/master 93c70ee. API 403이므로 PR은 Claude가 생성한다. 운영 직접 SQL·쓰기·병합·배포 없음.
- Lee 승인 글 모형대로 KDA 상단 칸 배치·크기·순서·CSS 유지. 직무별 시간·형태·휴무, 직무 수와 인원 미기재를 구분하고 식사는 해당 직무만 표시한다. 기존 상세 칸 안에서 직무 묶음 제목 1회, 권유 문구 07, 같은 직무 급여 조각 결합. 저장된 구형 설명도 공통 표시로 교정한다. 개별 공고 특례 없음.
- 0006·AGENTS·CLAUDE·R10/R12/R13 수정: 핀 무조건 + 10-14 순서표. 원문 행정구역의 근거 있는 area 미확인 핀과 관리자 대기를 유지하며 canonical writer만 사용한다. 도시 gazetteer는 해당 대표점만 증명하고 임의 도시 좌표로 확대하지 않는다.
- Migration 순서: 20261028050507_administrative_area_fallback → 20261028051147_multi_role_presentation_rules. 각각 production_check 동봉. 정상 migrations-apply만 허용. 기존 writer 보호·멤버십·schema 권한 정확 복구 시험 통과.
- 직접 로컬 검증: 85/85·tsc·build. Chromium 390/1366에서 KDA 기준 3가지 이미지 상태 틀 일치 및 복수직무 표시 통과. 실제 PostgreSQL 동시성·지역 핀·구체 target·관리자 대기·권한 복구, 등록→map→rule 결합 및 PGlite 통과. 독립 검토 2개 P2 수정 후 차단 없음.
- 직접 운영 익명 API: 공개 4건 모두 canonical 핀 있음, 미확정 3건. 4982는 미반환이므로 비공개/삭제 여부 추정 금지. 4878 도시점은 성 안이지만 도시 경계 증빙 미확인. 운영 브라우저는 proxy 차단. 운영 해결·연속 통과 수 미확인.

## 2. 다음 할 일 3개
1. Claude가 전달 브랜치로 PR 생성 후 필수 CI, 두 migration의 실제 PostgreSQL 검사, KDA 틀 비교를 확인한다. 사용자 승인 모형은 이 대화·0006·계획 문서에 있다.
2. 봇 병합→정상 migrations-apply/production_check→배포 확인. 실패하면 원문 오류 그대로 보고하고 중단한다. 직접 SQL·우회·자동 재시도 금지.
3. 새 Public administrative pin verification을 운영 사이트 접근 가능 환경에서 실행한다. 전체 공개 메인·상세·source 동일 핀과 원문 성/시 증명을 확인한다. 기존 도시점 증빙 미확인과 4982 미반환은 정상 운영 경로에서 확인하며 개별 추정 수정·맹목적 재공개하지 않는다.

## 3. 필수 규칙
- 운영 DB는 migration+production_check 정상 경로만. 위치 원본은 job_work_locations/canonical writer 한 곳이다. 대표점을 확정 매장 위치로 표시하지 않는다.
- KDA 기존 PC·모바일 틀/CSS 보존. 시간 10h-10h는 보존하고 관리자 확인. 직무 수는 인원 수가 아니며 식사는 해당 직무만. 게시 시각 계산 취소 유지.
- STATUS·status 생성기 수정 금지. 직접 확인/추정 구분. 로컬 통과를 운영 전체 검사·공개·연속 기록 통과로 보고하지 않는다. 상세는 docs/ops/2026-10-28-bomunttl-followup.md·WORK_LOG.md.
