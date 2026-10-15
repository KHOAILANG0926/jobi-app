# MAP-R1 최종 사전 검증 — PR #99

검사 대상: `9475d0c72c345e2e4e46c76dc052be713a16118c` 및 이 보고서와 함께 제출하는 수정.
브랜치: `feat/map-r1-auto-location-20261015`. 2026-10-15, Asia/Bangkok (UTC+7).
이번 범위: CI 상태·실패 조사, 기존 SQL 호환성, 승인/거부/철회·주소 이력 회귀, 환경·비용 한도, 적용·롤백 계획.
운영 DB 변경·운영/공급자 API 실행·자동화 활성화·master 병합·운영 배포는 금지하고 실행하지 않았다.
GitHub 조회/소스 push, npm 패키지 다운로드·audit 및 공개 문서 열람은 위 운영/API 검증과 구분한다.

## 판정

- **PASS [직접 확인]** 원래 SHA의 GitHub Actions: PR 검사, 화면 검사, STATUS 감시 모두 success. 실패 job 없음.
- **PASS [직접 확인]** 실제 승인 스키마/RPC, 비공개 캐시·사용량 RPC, 기존 R4/R1–R7/R8 트리거를 격리 PostgreSQL 17.10에 로드해 MAP-R1 SQL·회귀 검사 통과.
- **PASS [직접 확인]** 관리자 검토의 UPDATE 전 경합 결함을 재현·수정. 원래 잠금으로 새 검사가 실패하고 수정 잠금으로 UPDATE 전·후 검사 모두 통과.
- **PASS [직접 확인]** 수정 소스 `npx tsc --noEmit`, `npm run build` 종료 0. resolver/API 모의 회귀 검사 종료 0.
- **FAIL [직접 확인, 기존 의존성]** `npm audit --json` 종료 1: low 1, moderate 1, high 2, critical 0. 아래 상세. MAP-R1 기능 검사 실패와 구분한다.
- **미검증** 운영 스키마 drift, 운영 키의 등록/권한/실제 값, VietMap 실응답·실제 과금·계정별 공급자 한도, 최종 수정 커밋의 GitHub Actions.
- **미검증** Yên Phong 1단지 입구/OSM 근거, 실물 기기 GPS·핀치, 실제 타일 지도 통합. 기존 구현을 다시 만들거나 추정 좌표를 추가하지 않았다.

운영 승인/배포 완료 판정이 아니다. 위 미검증과 기존 취약점은 운영 전 판단 항목이다.

## CI 원본 근거

[직접 확인] GitHub `fetch_commit_workflow_runs(9475d0c...)` 및 각 run의 job/step 조회:

- PR 검사: https://github.com/KHOAILANG0926/jobi-app/actions/runs/38758292516 — checks success.
  job `116502485332` 로그: `npx tsc --noEmit`, `60/60 test files passed`, client/SSR build, STATUS mock smoke 모두 성공.
- 화면 검사: https://github.com/KHOAILANG0926/jobi-app/actions/runs/38758292697 — app-screen success.
  job `116502485242` 로그: `실제 화면 자동 검사: 통과`, 상세 `sb-4824`.
  이 기록은 앞선 CI 실행의 결과다. 이번 세션에서 운영 화면/API를 다시 열지 않았다.
- STATUS 감시: https://github.com/KHOAILANG0926/jobi-app/actions/runs/38758292706 — guard success.
  `status 브랜치 직접 수정 감지`는 해당 이벤트가 아니어서 skipped, PR 변경 감지 단계는 success.
- 실제 checkout은 GitHub 테스트 병합 SHA `ea9211c803ded208569e578738c922717dc05c0c`.
  로그에 `Merge 9475d0c... into 1abb6a4...`가 명시되어 있다. master에 실제 병합된 기록이 아니다.

실패처럼 보이는 로그의 구분: API 테스트의 423/429/TimeoutError는 가짜 응답 음성 테스트이며 60/60 성공.
화면 서버 시작 직후 첫 curl 연결 실패는 준비 반복에서 회복되어 최종 화면 단계가 성공했다.
500 kB 번들 경고·Node action 런타임 경고·npm audit 경고는 실제 경고로 남아 있다.

수정 push에는 `[skip ci]`를 사용한다. 기존 `app-screen-check.yml`/`scripts/ops/app-smoke.mjs`가 운영 Supabase 공개 API를 읽기 때문에, 이번 실제 API 호출 금지 아래 새 화면 CI를 유발하지 않는다.
따라서 원래 SHA의 성공 결과를 최종 수정 SHA의 CI 성공으로 옮겨 적지 않는다. 운영 조회 허용 후 최종 SHA의 필수 CI를 확인해야 한다.

## 발견·수정한 결함

[직접 확인] `admin_review_location_candidate`는 `SELECT ... FOR UPDATE`로 RowShareLock/행 잠금을 얻은 뒤 status UPDATE의 RowExclusiveLock을 얻는다.
원래 `map_r1_complete`의 SHARE ROW EXCLUSIVE는 첫 RowShareLock과 호환된다.
관리자가 행을 잡은 뒤 UPDATE하기 전에 자동 완료를 실행하면 자동 승인이 먼저 들어가고, 뒤이어 기존 후보가 rejected가 되어 같은 공고에 승인 후보가 남았다.

격리 재현 결과: 자동 완료 `true`, 후보 상태 `approved` + `rejected`. 새 Python 회귀도 원래 잠금에서 `AssertionError: ('before_update', 't')`.
수정은 pending SQL의 테이블 잠금을 EXCLUSIVE로 바꾼 것뿐이다. 기존 관리자 RPC/승인 정책은 바꾸지 않는다.
수정 후: 자동 완료 `false`, 기존 후보 `rejected`, 새 승인 0, MAP-R1 result null. 기존 SELECT 공개 읽기는 AccessShareLock이므로 허용된다.
테이블 전체의 검토/쓰기와 직렬화하므로 처리량 저하·잠금 대기는 가능하다. 실제 운영 부하에서의 대기 시간은 미검증이며 활성화 전 소규모 검증 대상이다.

## SQL·회귀 검사 범위와 재현

[직접 확인] 이 PC의 Docker daemon은 없었다. 대신 작업 폴더의 일회용 네이티브 PostgreSQL 17.10을 `127.0.0.1:55439`, 합성 전용 DB `map_r1_preflight`로 실행했다. 운영 자격증명·DB URL을 사용하지 않았다.
기존 fixture의 관리자 인증 함수와 일부 기반 테이블은 합성 stub이다. 전체 Supabase/Auth/RLS 운영 복제는 아니다.
다음 파일의 실제 본문은 그대로 로드했다:

- `20260929120000_job_location_approvals.sql`: 후보 CHECK·FK·고유 승인 index·컬럼 권한·관리자 review RPC.
- `20261008000000_private_research_store.sql`: 실제 research_artifacts unique(kind,name), RLS·공유 quota RPC.
- `20261012153000_job_posting_policy_db_enforcement.sql`, `20261013100000_job_posting_rules.sql`, `20261015120000_local_jobs_occupation_r8.sql`: 기존 트리거 본문.
- `20261015_map_r1_auto_location.sql`: MAP-R1 pending SQL.

세 assertion 파일 모두 성공:

- `map_r1_assertions.sql`: lease 탈취 차단, 2회 상한·3회 거절, 멱등 완료, 정확/대표 분리, 공개 상태 보존, RLS, 주소 변경 시 오래된 대표 숨김.
- `map_r1_review_assertions.sql`: A→B→A 이력·사용량 보존, 회사명·공백·대소문자·근무지 ID/순서 변경 한도 보존, 관리자 승인·거부·철회 우선, 기존 pending/area 후보 보존, 새 검증 좌표만 저장, 타 공고 근무지 ID 차단, 실행 중 주소 변경 차단.
- `map_r1_preflight_assertions.sql`: 실제 quota 249→250 허용·251번째 거절, 거절 시 주소 사용량 추가 없음, 실제 캐시 upsert unique, 캐시·quota 비공개, 기존 R4/R3/R8 거절과 트리거 유지.

일회용 PostgreSQL을 준비한 후에만, 운영 URL 없이 재현:

```sh
psql -X -v ON_ERROR_STOP=1 -d map_r1_preflight -f supabase/tests/map_r1_fixture.sql
psql -X -v ON_ERROR_STOP=1 -d map_r1_preflight -f supabase/pending/20261015_map_r1_auto_location.sql
psql -X -v ON_ERROR_STOP=1 -d map_r1_preflight -f supabase/tests/map_r1_assertions.sql
psql -X -v ON_ERROR_STOP=1 -d map_r1_preflight -f supabase/tests/map_r1_review_assertions.sql
psql -X -v ON_ERROR_STOP=1 -d map_r1_preflight -f supabase/tests/map_r1_preflight_assertions.sql
python3 supabase/tests/map_r1_concurrency.py LOCAL_CONTAINER map_r1_preflight
# 네이티브 대안: psycopg[binary]==3.2.9 설치 후. 연결 호스트는 코드에서 loopback 고정.
python3 supabase/tests/map_r1_concurrency.py --local map_r1_preflight 55439
```

마지막 실제 실행 결과: `MAP-R1 concurrency PASS: before_update` 및 `after_update - administrator rejection preserved`.
인증 helper stub 때문에 실제 JWT 인증·운영 관리자 권한·운영 기본 GRANT와의 동일성은 위 검사로 증명하지 않는다.
보류 중인 `20261011120000_location_approval_evidence_guard.sql`은 로드하지 않았다. 원본 파일 자체가 적용 금지로 표시되어 있다.
운영에 이 guard/다른 추가 트리거가 존재하면 현재 호환성 판정에 포함되지 않으므로 운영 적용 전에 카탈로그를 대조해야 한다.
MAP-R1 SQL은 기존 함수/트리거를 교체하거나 local_jobs/job_work_locations를 쓰지 않는다.

## 환경변수·실제 연동 전 조건

[직접 확인: 소스 정적 검사] 등록 상태나 값 자체는 읽지 않았다.

- GitHub Actions secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VIETMAP_SERVICE_KEY`.
- GitHub Actions variable: `MAP_R1_ENABLED` (기본 비활성, 정확히 `true`일 때 master에서만 실행).
- Vercel 서버 환경: 위 서버용 세 변수와 `MAP_R1_ENABLED`. 런타임 admin API는 URL fallback이 있지만 반드시 의도한 프로젝트 URL을 명시·대조해야 한다.
- 지도 빌드 환경: `VITE_VIETMAP_TILEMAP_KEY`. 브라우저에 전달되는 타일 전용 키이며 도메인 제한 필요. 서버 Services key와 교환해서 쓰거나 VITE_에 service_role/Services key를 넣으면 안 된다.
- 관리자 API: Supabase `getUser(token)`과 `app_metadata.role==='admin'` 검증. 일반 user_metadata의 admin 주장은 허용 안 함(모의 검사 PASS).
- 선행 DB 객체: local_jobs/job_work_locations/job_location_candidates/research_artifacts, unique(kind,name), vietmap_usage_take(date,integer), 필요한 service_role 테이블·sequence·RPC 권한.
- 기능 flag를 끄면 새 관리자 실행·Actions 시작은 막지만, 이미 실행 중인 worker를 취소하거나 기존 승인 좌표·대표 조회를 제거하지 않는다.

[공식 문서 직접 열람] [Services/Tilemap 키 구분](https://maps.vietmap.vn/docs/map-api/console/register-api-key/), [키별·API별 제한과 도메인/IP 제한](https://maps.vietmap.vn/docs/map-api/console/manage-api-key/), [Geocode v4→Place v4](https://maps.vietmap.vn/docs/map-api/geocode-version/geocode-v4/).
실제 계정의 키 종류·권한·잔액·청구 한도와 v4 데이터 형식은 API 호출 없이 증명하지 못했다.

## 비용 제한

[직접 확인: 소스 + 격리 SQL/모의 검사]

- 공고 ID+정규화 주소 집합별 Search/Place 합계 최대 2회, A→B→A에도 기존 사용량 유지. 검색 2회에 Place가 추가되는 4회 한도가 아니다.
- 호출 전에 영속 예약한다. upstream 실패도 예약된 비용으로 센다. 캐시/예산 저장 장애는 외부 요청 중단.
- 기존 관리자 VietMap 프록시와 공유하는 하루 250회, 베트남 날짜(UTC+7) 기준. 주소 이력이 무제한 새로 바뀌면 주소별 한도와 별개로 일일 한도가 최종 방어다.
- Actions 6시간마다 10공고, 매번 20호출 이하: 정기 실행만 계산하면 하루 최대 80회. 관리자 배치 5공고/10호출 이하. 수동 Actions 추가 실행·기존 관리자 호출도 공유 250에 포함되어야 한다.
- 이 한도는 카운터를 사용하는 앱 경로만 보호한다. 키를 직접 쓰는 다른 앱/스크립트, 타일·스타일·위성 요청은 카운터 밖이다.
- 캐시에는 TTL 조건이 없다. 공급자 데이터가 바뀌어도 기존 응답을 재사용할 수 있으므로 공급자 오류 수정 후 무작정 재시도하거나 이력·카운터를 지우지 않는다. 해당 캐시의 근거를 검토한 뒤 별도 승인으로 무효화한다.

[공식 문서] [과금 단위](https://maps.vietmap.vn/docs/map-api/overview/): Search/Place 각각 1 transaction, 타일은 25 tiles = 1 transaction. 실제 요금제 단가·잔액은 미검증이므로 금액 상한을 계산·보장하지 않는다.
공급자 Console의 키별/API별 quota·도메인 제한·필요 시 IP 제한과 Daily Report를 별도 확인해야 한다. per-IP 제한만으로 계정 전체 금액 상한을 보장하지 않는다.
타일은 서버 250회 한도에 포함되지 않는다. **공급자 측 실제 제한 설정과 초과 청구 정책 확인 전 절대 과금 상한은 미검증**이다.

## 운영 적용 순서 — 계획만, 실행 금지 유지

1. 별도 사용자 승인으로 운영 DB 적용·실제 API 호출·병합/배포·자동화 활성화 범위를 각각 확정한다. 최종 PR SHA·master·STATUS 생성 시각을 다시 확인한다.
2. 운영의 pg_proc/pg_trigger/pg_constraint/pg_policies/권한과 위 선행 스키마를 읽기 전용으로 대조한다. 보류 guard가 켜졌거나 스키마가 다르면 적용을 멈추고 그 스키마로 격리 재검사한다.
3. 공급자 Console에서 Services/Tilemap 키 분리, API 권한·도메인·quota·잔액·초과 청구 조건을 확인한다. 값은 출력하지 않는다. 서버/Actions 양쪽 flag는 false 유지한다.
4. 기존 후보 ID·상태·회사/주소·근거, 공개 상태 fingerprint, DB 객체 정의를 비공개 서버 저장소에 보존한다. PC/CSV로 내보내지 않는다. 첫 배치부터 신규 자동 승인 candidate ID와 전후 상태를 식별하는 비공개 실행 기록을 남길 준비를 한다.
5. 최종 SHA의 필수 CI 확인 후, 별도 승인된 코드 병합/배포를 두 flag=false로 진행한다. 승인된 pending SQL을 단일 트랜잭션으로 한 번만 적용하고 migration 이력을 기록한다. 이 SQL은 create table/function 방식이므로 그대로 반복 적용하면 실패한다. 일괄 pending 폴더 적용 금지.
6. 새 테이블 RLS·service_role 권한·RPC 결과를 검사하고 기존 후보·공개 상태 fingerprint가 같은지 확인한다. 자동화는 아직 끈다. 실패하면 활성화 금지.
7. 실제 API 호출이 승인된 다음 서버 flag만 켜고 관리자 소규모 배치(최대 5공고)를 검증한다. 정확/대표/미확인·API 예약 수·실제 공급자 사용량·주소/근거를 대조한다. 이 단계는 운영 좌표 쓰기를 포함하므로 이번 세션에서는 실행하지 않는다.
8. 소규모 검증 후 별도 승인 범위에서 GitHub variable을 true로 하여 정기를 켠다. processed/exact/representative/unresolved/apiCalls/failed/deferred와 공급자 Daily Report를 함께 확인한다. 화면 수·길찾기·정확 반경 결과도 최종 운영 SHA에서 확인한다.

## 문제 발생 시 롤백 — 계획만

1. GitHub variable과 서버 `MAP_R1_ENABLED`를 false로 하고, 실행 중 Actions를 취소한다. 서버 환경 변경은 새 deployment 반영이 필요하며 구 deployment/실행 중 요청을 즉시 종료한다고 가정하지 않는다. 필요하면 공급자에서 해당 Services key/API를 중지한다(공유 소비자 영향 확인 후 승인).
2. 활성 worker가 끝나거나 취소됐는지 확인하고, lease·사용량이 안정된 뒤 후속 변경한다. 10분 lease 만료는 실행 중 코드 종료를 의미하지 않는다. 시간만 기다리고 안전하다고 판단하지 않는다.
3. 코드 문제면 승인된 이전 정상 release로 되돌리고 실제 반영 SHA·화면을 확인한다. DB는 additive이므로 즉시 DROP/CASCADE하지 않는다. 검색 이력·사용량·후보·캐시는 조사 근거로 보존한다.
4. flag=false만으로 좌표가 사라지지 않는다. 정확 좌표는 기존 job_location_candidates를 통해 계속 공개될 수 있고, map-locations 대표 조회도 flag와 독립이다. 화면만 되돌려도 자동 승인 후보가 기존 reader에 남을 수 있다.
5. 잘못 저장된 자동 정확 핀은 비공개 실행 기록의 **명시적 candidate ID**와 전후 snapshot으로 MAP-R1 신규 행임을 확인한다. 사용자 승인 후 기존 관리자 revoke RPC로 해당 ID만 철회해 감사 기록을 남긴다. 수동 승인·다른 공고·공개 상태를 일괄 수정하거나 review_note만으로 자동 판별해 삭제하지 않는다. 기존 데이터와 구분이 안 되면 데이터 복구를 자동 실행하지 않는다.
6. 대표 핀은 승인된 이전 코드로 기능 노출을 되돌린다. MAP-R1 데이터를 지우거나 운영 row를 임의 변경해 숨기지 않는다. 새 코드 유지가 필요하면 대표 조회 중단을 별도 수정·승인한다.
7. DB 객체 제거가 정말 필요하면 소비자가 모두 중단됐고 schema-only rollback을 별도 승인한 뒤, 함수 의존성과 데이터 보존을 검토한 명시적 제거 계획을 작성한다. 이번에는 DROP SQL을 실행하지 않았다. 호출 이력/일일 카운터를 초기화하면 재호출·비용 증가가 가능하므로 초기화하지 않는다.
8. 재개는 원인 수정→격리 회귀→최종 SHA CI→소규모 실연동 확인 순서로 다시 승인한다.

## 기존 의존성 경고

[직접 확인] `npm audit --json`은 dompurify(low), fflate(moderate), source-map-js(high), undici(high)를 보고했다.
`git diff 1abb6a4 -- package.json package-lock.json` 출력은 비어 있어 MAP-R1이 바꾼 의존성이 아니다.
이 검사는 알려진 advisory 일치이며 실제 exploit 재현/운영 영향은 미검증이다. 범위 밖 패키지 일괄 업데이트는 하지 않았다.
공급망 경고는 후속 보안 검토/최소 패치와 회귀 검사 대상으로 남기며, 이를 해결된 것으로 보고하지 않는다.
