# CHATGPT_HANDOFF — 정상 이관 시작 요청 GitHub500 중단 (2026-10-27)

## 1. 현재 상태 (코드·배포·DB)
- 준비PR#276 봇병합2ab3f8f, Vercel40419438063실제업로드skipped. 앱+이관+사후점검 같은PR#277봇병합70fe1c60dd8092b595938c0160bd714fded2b227 완료.
- 최종source868f9d216a211ccf00386ddd315cf09e333e54ec 필수검사모두성공: PRchecks/migration-postgres40420082126, appscreen40420082134, mobile40420082148, publication40420082130, guard40420082310. 실제migration파일PostGIS검사·권한·원복·동시성통과. 사전화면BASE실공개/HEAD격리구분, 운영HEAD검증아님.
- 운영migration파일20261026231445_location_single_source.sql SHA2562e8928cbcf97919ec1ac37a1df0300379e6267fce8cf98597de6de9dda108aaa. 파일전체psql-1, 번호조건없음, 실패RAISE. 사후검사 location_single_source_production_check.sql에0건불변식+전체공개원본/캐시읽기로그. 기존20시불일치보고포함.
- PR277병합봇 run40420801113/job121914436624에서이관시작요청실패: could not create workflow dispatch event: HTTP 500: Failed to run workflow dispatch (https://api.github.com/repos/KHOAILANG0926/jobi-app/actions/workflows/388182152/dispatches)
- source70fe1c6 actions/runs 조회결과[]: migrations-apply실행생성없음, 운영배포/실제deploy-verify미실행. 이후재시도/우회안함. 실제운영배포0회.4824원본/캐시이번정상경로읽기증거없어미확인.
- 운영Supabase직접접근(읽기포함)영구금지. 이전직접apply시도cancelled는절차실수로기록; 이후금지지시부터사용안함. 현재운영DB상태를직접조회하지않음.

## 2. 다음 할 일 3개
1. Lee에게정확한GitHubHTTP500와시작미생성을보고하고중단. SQL오류라고추정하거나workflow성공/운영시험통과라보고금지.
2. 외부GitHub실행문제가해소되어정상migrations-apply가실행되면기록확인. 실패시원문보고후중단; 직접SQL/별도경로/자동재시도금지.
3. 정상적용성공후에만운영배포1회→deploy-verify/관리자E2E. 정상워크플로읽기로그로4824원본·캐시와메인·상세확인. 현재미완료.

## 3. 필수 규칙
- 운영직접DB접근금지. 승인된정상PR/봇/migrations-apply경로만. Lee진행승인은유효하나이번외부실패중단지시우선.
- source1곳/write1개/캐시파생/번호별보정금지/정밀도·근거·다중근무지보존. Secrets·STATUS·R7/R8·공개범위·화면틀보존.
- 직접확인/추정, 로컬합성/운영실제, 워크플로성공/실제시험통과구분. 추가원인추정·불필요조사금지.
