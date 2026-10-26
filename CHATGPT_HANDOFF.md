# CHATGPT_HANDOFF — 위치 단일 원본 정상 이관 경로 (2026-10-27)

## 1. 현재 상태 (코드·배포·DB)
- Lee 설계·실행 승인 유효. 추가 지시: Codex/Supabase 도구의 운영 직접 접근은 읽기 포함 영구 금지. 정상 PR→검사→봇→migrations-apply→실제 배포1회만. migrations-apply 실패 시 원문 오류 보고 후 중단.
- 운영 DB 변경 없음. 이전 직접 apply_migration 요청은 cancelled, 이관·새 스키마 미생성을 당시 조회로 확인. 이후 운영 직접 접근하지 않음. 직접 접근 재시도 금지.
- 실제 CLI 생성 이관: supabase/migrations/20261026231445_location_single_source.sql. psql-1로 파일전체1트랜잭션. 원문 SHA256 2e8928cbcf97919ec1ac37a1df0300379e6267fce8cf98597de6de9dda108aaa. 검토본과 본문 동일, wrapper외 TRUNCATE권한도 회수. 공고번호조건 없음. 원본/캐시/제거행은 비공개 이력 보존.
- supabase/tests/location_single_source_production_check.sql: 기억/원본/캐시 불일치0·권한·트리거·RLS 검증, 전체 공개 좌표 읽기 증거. migrations-apply에서 이 점검만 집계/공개좌표 stdout 보존.
- 실제 migration파일을 NOSUPERUSER PostGIS에서 적용해3가지 rollback·권한/취소/주소/재사용·5동시실행 통과, 최종사후검사5항목0. tsc/build, npm81/81 통과. HEAD 격리 PC/모바일0·1·여러위치6경우브라우저 통과.
- 전환전PR화면은 BASE의 기존 실공개화면검사와 HEAD의 신규 격리화면검사를 명시적으로구분. 새 HEAD운영전수확인은 DB적용/배포후deploy-verify 실제소스검사만으로 판단. 기존 production검사완화/생략아님.
- 준비PR #276 https://github.com/KHOAILANG0926/jobi-app/pull/276 : 기존파괴문구차단의 정확한승인파일경로+SHA1개만 trusted-base로확인. SQL·앱없음. 검사후봇병합. 기존배포비교로실제업로드제외확인필요. 앱+DB이관은 같은다음PR로제출. 미승인헤더A데모제외.

## 2. 다음 할 일 3개
1. #276 필수검사확인→Ready→봇병합; master새guard를현재branch에반영하고 앱+DB SQL·사후점검 같은PR 생성.
2. 그PR필수검사→봇병합→migrations-apply 실제실행확인. 실패하면원문그대로보고하고멈춤. 직접SQL/자동재시도금지.
3. 성공후실제운영배포1회→deploy-verify/관리자E2E확인. 정상워크플로의읽기증거로4824원본·캐시좌표, 메인/상세확인. 실패/필수단계건너뜀과조건부정상생략구분. 아직운영완료아님.

## 3. 필수 규칙
- 직접운영DB접근금지. 명시한정상경로만. 사용자에게설계재승인요청금지.
- 번호별보정금지·job_work_locations원본1곳·writer1개·캐시파생. 정밀도·근거·다중근무지 보존.
- 직접확인/추정, 로컬합성/실제운영, 워크플로성공/시험실제통과구분. Secrets·STATUS·R7/R8·공개범위·화면틀보존.
