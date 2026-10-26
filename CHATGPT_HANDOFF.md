# CHATGPT_HANDOFF — 위치 단일 원본 구현·운영 도구 취소 (2026-10-27)

## 1. 현재 상태 (코드·배포·DB)
- Lee 설계와 2~5단계 실행 승인 완료. branch design/location-single-source-20261026, 운영 master6affdc2. 미승인 PC 헤더 A 데모는 포함하지 않음.
- 운영 SQL 완성: supabase/pending/location-single-source-20261026/production/10-apply.sql. SHA256 c1c06a08032c667d8a5751bb242db1e46bc811bd970380c6953c3543b548a67b. 단일 writer/최소권한/자동 캐시/재사용/취소·변경/호환 RPC/감시/규칙4행/이력 보존, 한 트랜잭션.
- 로컬 PostGIS 전체 관련 구조·RLS/실제 역할·이관·3가지 실패 원복·동시 실행5가지 통과. 최종 npm test81/81, tsc/build 통과. 격리 실제 브라우저 0개·1개·여러 근무지/묶음핀 통과. 최종 리뷰 중요 지적 모두 해결.
- 화면은 원본 전체 점 집합만 읽음. 운영 시험의 번호 의존 제거, 독립 원본과 메인/상세/캐시 비교, 관리자 E2E 원본/캐시/삭제 검사, 기존20시 보고 불일치 추가. 운영에서 실제 실행된 것은 아님.
- 운영 전체 예상 목록(blockers0)을 Lee에게 먼저 보고함: 4824확정 반영,4828캐시→원본 근사,4878근사보존/캐시정렬,4879원본근사생성,4825의4곳·4826미확인유지,4827미확인원본생성. 공개 여부/검색한도 유지.
- 실제 apply_migration 요청(name location_single_source_approved_20261027)이 Supabase에서 Migration was cancelled / status cancelled 반환. 이유 미제공. 뒤이어 읽기 전용 조회: location_private 없음, 이관기록 없음,4824원본lat/lng NULL. 운영 변경·병합·배포0회. 다른 쓰기 도구로 우회하지 않음.

## 2. 다음 할 일 3개
1. GitHub Draft PR에 코드·SQL·검증 보존. 운영 도구 취소 해소 전 Ready/봇 병합/배포 금지. DB 미적용으로 실데이터 화면 CI 실패 시 원인 구분.
2. 취소된 Supabase 운영 변경 승인을 해소한 뒤 같은 검토 SQL 적용, 원본/캐시/불일치/권한 사후 조회. 승인된 예상 목록 변경이나 근거 충돌은 rollback.
3. PR 필수 검사→봇 병합→운영 배포1회→deploy-verify 및 관리자 E2E 실제 통과 확인.4824원본·캐시·메인·상세좌표 및 정시알림 반영 여부 직접 확인. 아직 완료 보고 금지.

## 3. 필수 규칙
- 번호별 보정 금지. source job_work_locations, writer1개, 캐시 파생, 후보/기억은 근거만. 정밀도/근거/다중 근무지 보존.
- Lee 진행 승인 유효. 불필요한 재승인 요청 금지. 이번 중단 근거는 스킬 해석이 아니라 외부 도구의 실제 cancelled 응답.
- 직접 확인/추정, 로컬합성/실운영, 워크플로 성공/시험 실제 통과를 구분. Secrets·STATUS·R7/R8·공개범위·화면틀 보존.
