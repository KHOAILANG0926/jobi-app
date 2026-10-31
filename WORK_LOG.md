## 2026-10-31 — Highlands #5157 분류·표시·R7 공통 구조 및 운영 검증
- Lee 지시: #5157 전체 15개 오류를 개별 SQL 손수정 없이 처리하고 운영 앱 PC·모바일에서만 완료 판정. 중간보고 금지.
- PR #368: 원문 모집 직무·Fulltime/Parttime 구조화 표시, 실제 업무 ④ 아래 분류, 빈 원문 이름표 제거, 복리후생 'Xem thêm' 단독 표시 방지. 기존 KDA 회귀·원문 보존 시험.
- R7 원문/포스터 출처별 대조(본문 필드는 포스터에 없어도 됨); 실제 OCR 포스터 급여를 역할에 임의 배정하지 않고 ingest_job으로 기록; 금액 없는 경쟁 급여 공개 보류; R7 비교 버전 재검사. Facebook 기존 공고 ingest_job 갱신 뒤 R7 즉시 실행, 독립 R7 CI 추가.
- 작업 중 검증: CI/운영 실행 결과는 PR/Actions 원본 확인. PR 병합·운영 데이터 갱신·R7 공개 상태·실제 화면 미확인 시 완료 처리하지 않음.
- 관련 파일: src/pages/JobDetail.tsx, src/components/ConditionLines.tsx, src/lib/{sourceRecruitmentRoles,jobDetailSections}{,.test}.ts, scripts/ocr/ocr-{compare,check}.mjs, crawler/refresh_facebook_existing.py, .github/workflows/refresh-facebook-existing.yml, CHATGPT_HANDOFF.md, WORK_LOG.md.

## 2026-10-29 (지도 규칙: Goong 보조 + 대략 핀 원문 확인)
- 요청: Lee "바꾸고 앱에 올려" — 지도 정확도 규칙 수정(공고 손수정 금지, 규칙·시험으로).
- 변경: ① 위치 찾기에 Goong(두 번째 자료, Vercel GOONG_API_KEY) 추가 — VietMap이 못 찾을 때만, 같은 판정(번지·도로·동 일치 / 회사명 정확히 1곳 + 공단 경계 안), 판정당 최대 3번·결과 저장 재사용. ② migration 20261029120000: 성/시 대략 핀은 원문(source_text)에 그 이름이 있을 때만(시 없으면 성), 기존 자동 대략 핀 같은 writer로 재판정. ③ Facebook 수집기: 그룹 지역은 글에 있을 때만, "지역 없음" 거르기 제거.
- 원인(#5063): 수집기가 그룹 지역을 location에 채움(2026-08-16 66060c1) + 대략 핀(20261028050507)이 그 칸을 근거로 씀.
- 제외: 거리 가운데(#4982, 두 구간) — 이번 범위 아님.
- 검증: 로컬 resolver 시험(Goong 승인/번지 불일치/공단 밖/동명 2곳/키 없음/캐시) 통과, 크롤러 시험 28/28, 위치 hook 시험 통과. DB 규칙은 CI(PostGIS) 시험.

## 2026-10-29 06:10
- 요청: Lee — 남은 일 1(관리자·고용주·크롤러 등록을 입구로). "길마다 PR 따로" 대신 PR 하나로, 다른 길이 아예 없는 구조로(ok 05:15).
- 변경: migration 20261029010000_ingest_one_door(입구 밖 INSERT 거부 트리거, ingest_private 도우미, 판정 칸만 뺀 모든 칸, 기존 공고 중복, 다시 수집, 경로 사칭 금지, 관리자 등록 정책, admin_create_job 회수). 관리자 화면·JobsContext·크롤러(TopCV·Facebook)·E2E 4개를 ingest_job으로. 직접 등록 코드 차단 시험(api/_ingest-one-door-guard.test.ts). #308 SQL 파일 변환기는 1단계 칸 목록 유지.
- 발견: 관리자 화면 등록(admin_create_job)은 source_text를 안 넣어 R3에 걸리는 상태였음(코드 확인, 운영 실행 기록은 미확인). E2E p0-foundation·admin-operations는 8월 이후 실행 없음.
- 검증: 로컬 PostgreSQL 16(PostGIS 없이 운영 구조 fixture) — ingest_one_door.local.sql PASS, #308 SQL 파일 시험 PASS, 운영 점검 적용 전 실패·적용 후 통과, 일부러 고장 낸 2가지(거부 트리거 제거·판정 칸 허용)를 시험이 잡음. jobPolicyWrite.test 통과, 직접 등록 차단 시험 통과(옛 코드 5곳 잡음).
- 못 한 것: npm·PyPI 접속 막힘으로 로컬 tsc·build·전체 npm test·크롤러 시험 미실행 → PR 검사로 확인.
- commit/push/deploy: PR #309, Lee 적용(06:04) → 병합 0170c1a → migrations-apply 성공(run 40786334886) → Production 0170c1a → deploy-verify 통과(run 40786585971), 관리자 E2E 2개 통과. 검사 중 고친 것: 타입 1곳, 옛 함수 없는 환경, 트리거 순서 점검 과잉, 게스트 company_identity 권한(기존 문제), KDA 틀 시험 첫 화면 대기 20→90초(불안정 원인: 개발 서버 첫 준비).

## 2026-10-29 00:40
- 요청: Lee — 입구 전환 순서 ① SQL 파일 등록을 ingest_job으로.
- 변경: ops-insert-job이 공고 내용 JSON → scripts/ops/ingest-sql.mjs → ingest_job 한 번(허용 칸은 migration의 입구 목록에서 읽음, channel·판정·위치 칸 거부, images=올린 포스터 경로 확인, 단계별 결과 출력). ops-run-sql은 local_jobs·job_work_locations·job_ingest_raw/log insert 거부. 기존 kda/mao-yen .sql은 기록용(새 작업으로 실행 불가).
- 수정 파일: .github/workflows/ops-insert-job.yml, .github/workflows/ops-run-sql.yml, scripts/ops/ingest-sql.mjs, scripts/ci/bomunttl-postgres.sh, scripts/ci/check-postgres-migrations.sh, test-fixtures/ops/ingest-sql-file.json, docs/plans/2026-10-28-ingest-gateway.md
- 검증: 로컬 폐기용 PostgreSQL 16+PostGIS에서 bomunttl-postgres.sh 전체 PASS(같은 파일 2번 → 공고 1개·중복 기록, 원문 특수문자 그대로, 금지 칸 5종 거부), tsc·build 통과. 운영 실행 없음.
- 남은 문제: 운영 DB 접속 계정이 ingest_job 실행 권한을 가졌는지는 첫 실제 실행에서 확인(추정: 소유자 계정). 관리자 앱·크롤러 전환 남음.

## 2026-10-28 23:59
- 요청: Lee — #304·#305를 HANDOFF·WORK_LOG에 반영.
- 변경(이번): 문서만. 기록 대상 #304(9dc56b3): migration 20261028160000 — job_ingest_raw/log·job_ai_suggestions(RLS, service_role만), ingest_job()(원문 보존→중복→직업분류→위치→공개), 위치 결과가 공개를 바꾸지 않음(위치 보류 트리거 제거). #305(840834d): ai-classify가 AI 복리후생 판정을 job_ai_suggestions에 저장, 원문 단어 규칙과 같은 뜻일 때만 셔틀·기숙사·식사 칸 반영, 복수직무 식사 제외.
- 검증(기존 기록·이번 조회): migrations-apply 40723054027 성공(9dc56b3), 다시 공개될 대상 0건(run 40721734466), deploy-verify 40728704605 통과(840834d). 40725500882(9dc56b3)는 Vercel READY 단계 실패 — DB만 바뀐 커밋이라 배포 없음으로 추정.
- 남은 문제: 등록 경로 전환(SQL 파일→관리자 앱→크롤러) 미착수. browser 시험 불안정. 시험 브랜치 삭제.

## 2026-10-28 22:50
- 요청: Lee — 수집 입구 설계(구현 전), 위치가 공개를 바꾸지 않게, AI는 제안만.
- 변경: 경로 9곳 표·하나의 입구 설계(docs/plans/2026-10-28-ingest-gateway.md), dry-run SQL 01~03 + run-local.sh(로컬 PASS). 다른 세션 #300(f6af4d9)이 위치 판정의 공고 삭제 호출을 제거·배포(삭제 기록 0건, run 40719658451). 그 전 #283~#299: 점검 칸별 오류, 대략 핀 보류 해제, 복수직무 식사, 관리자 업체 검색 비교, 거리 가운데 미리보기, 순서표 결정, Android TWA, 아이콘 ✦ 제거, 결정 문서 승인 장치.
- 검증: 로컬 폐기용 PostgreSQL run-local.sh PASS. 운영 DB 적용 없음.
- 남은 문제: DB 적용은 Lee "적용" 대기. #288 보류. browser(KDA 틀) 시험 불안정 반복.

## 2026-10-28 16:20
- 요청: Lee — migrations-apply 점검 실패(sb-4982 active·meal_provided) 원인 확정과 공통 규칙 반영.
- 변경: canonical area 이상 핀이면 위치 보류 금지·해제(migration 20261028080000), 복수직무 공고 AI 전체 식사 칸 금지(aiClassifyGuard.jobFlagCodes), 규칙 점검 SQL 추가. 이전 HANDOFF(#282 전달 내용)는 docs/ops/2026-10-28-bomunttl-followup.md에 상세 보존.
- 수정 파일: supabase/migrations/20261028080000_area_pin_releases_unlocated_hold.sql, supabase/tests/area_pin_hold_meal_production_check.sql, scripts/ci/{bomunttl-postgres,check-postgres-migrations}.sh, scripts/ocr/ai-classify.mjs, src/lib/aiClassifyGuard{,.test}.ts, CHATGPT_HANDOFF.md
- 검증: 로컬 실제 PostgreSQL(postgis 17) bomunttl-postgres.sh 전체 PASS(보류 해제·재보류 없음·admin_hidden 유지·식사 위반 보고), aiClassifyGuard 시험, tsc, npm test 85/85.
- commit/push/deploy: PR 진행 중. 남은 문제: 기존 식사 칸 되돌리기는 Lee 승인 대기.

## 2026-10-27 — FUSHAN 원문 분류 규칙, 브랜치 전달
- 요청: FUSHAN 8줄 미분류 수정·시험·빌드 후 새 브랜치 push만. PR은 Claude 담당, 운영 변경/배포 없음.
- 변경: 공통 상세 분류 규칙, 원문/화면 칸별 시험, 중개 표시 및 업무 미기재 안내 재처리 보존, 숙소 찾기 별도 benefit code. AGENTS/CLAUDE·결정0005 한/영·DB 규칙 SQL 초안·공개 게이트 실제 사례.
- 최종 로컬 검증: npm test 82/82, npx tsc --noEmit, npm run build, occupation_publication PGlite(규칙 SQL+production_check 포함), approval-scope, JS 구문·git diff --check 통과. 독립 검토 지적 수정 후 차단 사항 없음.
- 재현: 수정 전 8 !== 0; 수정 후 FUSHAN 칸/글자/급여/검사표 fixture 통과. 검토에서 찾은 ‘수수료 없음’이 중개 표시를 지우는 오류도 실패 재현 후 수정.
- 환경: git/npm는 network.enabled로 가능. api.github.com은 프록시 CONNECT 403으로 차단. GH_TOKEN 만료 단정은 정정; 신규 토큰 불필요.
- 운영 등록·확정 위치·실제 검사표·연속기록은 미갱신. DB 규칙 SQL은 pending이며 Claude가 후속 PR에서 migration으로 승격해야 함. CLI는 쓰기 불가한 사용자 폴더 초기화에서 실패(2회); 우회 없음.
- WORK_LOG는 CLAUDE 지침대로 최근 10개만 유지; 이전 상세는 git 이력에 보존. 기존 HANDOFF는 아래 보존.

> # CHATGPT_HANDOFF — 위치 후속 E2E 수정 (2026-10-27)
>
> ## 1. 현재 상태 (코드·배포·DB)
> - Lee 요청: 70fe1c6 운영 deploy-verify와 admin-location-review-e2e 실패2건 수정→PR/검사/봇→운영배포1회→실제 통과 확인. 운영 직접 DB 접근(읽기 포함) 영구 금지. migrations-apply 실패 시 원문 보고 후 멈춤.
> - 직접 확인: 기존 migrations-apply 40421335438 성공, 공개 점 집합에서4824 원본/캐시21.1959873,106.0087454. deploy-verify40421605615는 모든 공개 공고 메인/상세/원본 대조 후 반경20km 입력 검사에서 actual400/expected20000 실패. 위치E2E40421468430은 공고 생성 단계에서 permission denied for function company_identity, 로그인 전 실패.
> - 로컬 실제 PostGIS 재현: service_role 공고 INSERT가 동일 함수권한 오류. 새 forward migration20261027042533은 순수 정규화 함수 EXECUTE만 authenticated/service_role에 허용. private schema/단일writer/원본 직접쓰기 차단 유지. 기존 적용 SQL 수정·공고번호조건·데이터 삭제 없음.
> - 실제 컴포넌트 DOM commit 회귀: 기존20:400 실패→수정20:20000 통과. SearchRadiusInput은 외부 반경 변경 시 편집값을 같은 렌더에서 맞춤. 기존 운영 map-summary-check 및 관리자E2E의 기대값/검사는 변경하지 않음.
> - 로컬 새권한 적용 후 service_role 공고/후보 INSERT+UPDATE, authenticated INSERT, 보호권한, 전체 canonical integration/5동시성/무결성0건 통과. 별도 production ACL 검사 추가. tsc/build/npm81/81, 반경 commit 회귀, PC·모바일0/1/여러위치6경우 모두 통과. 기존 운영70fe1c6 이후 이번 수정 운영 적용은 아직 안 됨.
>
> ## 2. 다음 할 일 3개
> 1. 로컬 검증 완료. PR 생성→최종 HEAD 필수 검사 확인. app-screen에 동일 DOM commit 회귀 검사 추가, migration-postgres는 실제 기존+새 migration을 NOSUPERUSER로 검증.
> 2. 최종 HEAD 필수검사 증거를 PR에 기록→Ready→봇병합→migrations-apply 성공 확인. 실패하면 원문그대로 보고하고 중단. GitHub dispatch만500등이면1회 재시도 허용.
> 3. 운영 실제배포1회와 deploy-verify·위치E2E의 로그인/확정/재사용/원본캐시/삭제까지 확인. 필수단계 실패·건너뜀 없는지 읽고 직접확인/추정 구분 보고.
>
> ## 3. 필수 규칙
> - 운영 DB 직접연결/SQL/조회 금지. 정상 migration+production_check PR/CI 경로만. 사용자 재승인 불필요.
> - 특정공고 개별보정 금지, job_work_locations 원본·writer1개·캐시파생 유지. R7/R8/STATUS/공개범위/화면틀 유지.
> - 로컬 합성 성공과 운영 실제 시험 통과를 구분. Secrets 출력 금지, 추가 운영배포 필요 시 멈춤.

## 2026-10-25 — 작업자 전환 기록
- Lee: 이후 진행은 GPT, Claude는 검증 담당. CHATGPT_HANDOFF.md를 오늘 상태로 덮어씀(이전 본문은 git 이력).

## 2026-10-25 — 공고 저장 순간 검사 신호(DB → GitHub)
- [직접 확인] GitHub 예약 실행이 30분마다가 아니라 몇 시간에 한 번(06:39→11:21)만 돌았고 crawl-guard는 한 번도 자동 실행 안 됨. Lee: "처음부터 정 방향으로".
- 변경(migration 20261025160000_job_signal_dispatch.sql): 공고 입력(제목·원문·이미지·근무지·회사·공개·분류)·위치 결과·수집 멈춤 상태가 바뀌면 신호 대기표 기록 → pg_cron 1분마다, 30초 조용하면 GitHub 작업(job-ocr-check·crawl-guard) 바로 시작. 결과 칸(상세요강·급여·ocr_check·복리후생) 변경은 신호 없음(자기 반복 방지). 하루 1번(05:10) 안전망. local_jobs.updated_at 추가.
- 열쇠: Supabase Vault github_dispatch_token(Lee 생성, jobi-app Actions 시작 권한만). 기존 열쇠(GitHub 자동 열쇠는 작업 중에만 존재, AI 계정은 코드 권한이 넓어 위험)는 이 용도로 못 씀.
- 시험: supabase/tests/job_signal_dispatch.pglite.test.mjs.

