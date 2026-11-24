## 2026-11-24 — 지도 정상화 A(확정 위치 유실 방지)·C(API 오류 구분) + B dry-run 준비 (운영 변경 없음)
- 원인 [직접 확인]: write_location이 기존 줄을 admin_location_key 완전 일치로만 찾아, 지역을 덧붙여 저장된 기존 확정 줄("…, TP. Bắc Ninh")과 재수집 글자가 다르면 새 줄 취급 → replace가 확정 줄을 지움(retained_rows에만 남음). C: Google·Goong 장애(provider_failed)·VietMap 월 한도(deferred)가 '못 찾음(not_found)'으로 기록돼 7일 뒤 재확인·최대 2번 경로로 감.
- 변경: supabase/migrations/20261124130000_location_same_store_keep.sql(+tests setup·local·production_check) — 완전 일치 줄이 없을 때만 기존 같은 매장 규칙(addressReader.sameStore·pin_guard._same)을 '지역 덧붙임' 모양(한쪽이 다른 쪽의 낱말 단위 앞부분 + 짧은 쪽에 번지 숫자)으로 좁혀, 그리고 후보 1줄·확정 줄일 때만 그 줄 사용·주소 글자 유지(거리 이름만·12≠112·앞에 글자가 붙은 포함은 다른 지점, 시험 6~8번). src/lib/locationPrecheck.ts checkBlocked/providerErrorKind 한 곳(precheckVerdict·autoLocationResolver 공용), Goong 오류 기록, 매장 여러 곳 보류 일반화, crawler DEFERRED_REASONS에 provider_quota. B: scripts/ops/jobs/location-keep-recovery-preview.sql(읽기 전용).
- 검증 [직접 확인]: 로컬 PostgreSQL 16 fixture→setup→migration→local→production_check 통과, autoLocationResolver·googleQuotaCache·locationPrecheck·location-hook 시험·crawler test_ingest_gateway·tsc 통과, dry-run SQL은 run-sql-plan 검증 + 시험 DB 실행.
- 남은 것: A 병합·운영 적용 뒤 Lee가 ops-run-sql(name=location-keep-recovery-preview)로 dry-run 실행 → 결과 보고. 복구 migration은 대표 승인 뒤 별도.

## 2026-11-24 — 3순위 1차: 변경 영향 범위로 기존 화면 검사 고르기 (병합은 2순위 운영 검증 뒤)
- 변경: scripts/ci/change-impact.mjs(+시험), app-screen-check(BASE 판정기로 screen·map·menu, 브랜치 이름 조건 대체), pr-checks 시험 1단계, 규칙 문서 3개 현재 구현 줄, 계획 문서.
- 위치 영향 PR: 실제 공고 지도 요약(map-summary-check)은 PR 빌드에 지도 열쇠가 없어 안 그려짐(첫 실행 실패로 확인) → 이관 PR용 기존 HEAD 격리 핀 검사(location-canonical-browser-fixtures)를 재사용, 실제 공고 대조는 병합 뒤 deploy-verify 그대로. 이 격리 검사는 11-21 스타일 사본 도입 뒤 가짜 응답(JSON)을 그림으로 읽어 지도 실패로 넘어가 묶음 핀 선택이 깨져 있었음(첫 실행 실패·로컬 재현) → 그림 요청만 빈 1×1 그림으로 주게 고침, 로컬 PC·모바일 0·1·여러 곳 통과.
- 분류 안 된 파일(화면 무관·지도·메뉴 어디에도 안 맞음)은 화면·지도·메뉴 검사를 모두 돌리게 보수적으로(Lee 11-24).
- 검증 [직접 확인]: 판정 시험(최근 병합 PR 파일 목록), 기존 CI 시험·비밀값 분리 검사 통과.

## 2026-11-24 — 2순위 다중 지점 공고 전환 최종 확인(운영 적용 뒤 대조, 코드·DB 변경 없음)
- 요청: #999 병합·운영 적용 뒤 #4825·#5992·#5994 실제 결과를 dry-run 예상(계획 문서 7절)과 대조, 원본 보존·보류함·공개 상태·지도 핀 확인.
- 결과 [직접 확인]: migrations-apply 45320415496 NOTICE — #4825 그대로, #5992 줄 1776→보류함·위치 글자 맞춤, #5994 줄 1800→보류함(위치 글자는 이미 남는 지점과 같아 그대로) / 같은 실행의 multi_branch_conversion_production_check 통과(보류 지점마다 원래 줄 이력 1개·위치 글자 일치) / /api/map-locations: 5992=줄 1798, 5994=줄 1778 핀 1개씩, 4825 없음 / 상세 sb-4825=404(비공개 유지), sb-5992·5994=200, 상세 주소 5992 148 Trần Phú·5994 Số 37 Lý Thái Tổ. 예상과 다른 점 0.
- 남은 것(2순위 범위 밖): 보류함 두 지점은 다음 보류 다시 확인(retry_held) 때 기존 위치 정책대로.

## 2026-11-24 — 2순위 다중 지점 공고 전환 migration(승인용, 운영 적용 전)
- 요청: dry-run(45314812701) 뒤 Lee 확정 기준 5개로 승인용 PR.
- 변경: supabase/migrations/20261124120000_multi_branch_conversion.sql, supabase/tests/multi_branch_conversion.{setup,local}.sql·_production_check.sql, 계획 문서 6·7절, HANDOFF.
- 검증 [직접 확인]: 로컬 PostgreSQL 16(CI와 같은 순서 fixture→setup→migration→local→production_check) 통과, 다시 실행해도 변화 없음, 지운 줄 원래 그대로 보관, 전환 전 자료에는 production_check가 실패(검사 의미 확인).

## 2026-11-24 — 확정 순위 기록 + 2순위(기존 다중 지점 공고 전환) dry-run 준비 (운영 변경 없음)
- 요청: Lee 확정 순위 저장(1순위 완료·2순위 다중 지점 전환·3순위 격리 Preview 차등 검증), 2순위 착수.
- 변경: docs/plans/2026-11-24-multi-branch-conversion.md(대상 정의·기존 장치로 전환·복구·순서), scripts/ops/jobs/multi-branch-conversion-preview.sql(읽기 전용 집계, ops-run-sql), CHATGPT_HANDOFF.md.
- 검증 [직접 확인]: run-sql-plan 통과, 로컬 PostgreSQL 16 합성 자료로 집계 결과 확인. 운영 대상 건수는 미확인(운영 DB 읽기 권한 없음 — Lee가 ops-run-sql 실행).
- 이전 HANDOFF(#988 지점별 독립 공고 구현 스냅샷)는 git 이력에 있음.

## 2026-11-24 — #995 실전 검증 후속: approval-gate 대기 기준 시각 조회 실패를 '60분 초과'로 오판 수정 (병합·운영 DB 없음)
- 원인 [직접 확인 — 실행 45293080396 로그]: 대표 Approve 직후(23:56:50) pull_request_review 실행은 PR 브랜치의 봇 워크플로로 돌고 scripts는 master 사본(체크아웃 ref master)이라 새 판정 파일 recheck-since.jq가 없어 jq 실패 → 기준 시각 빈 값 → 재확인 대신 '60분 초과 판정 불가'로 보류. 그 시점 approval-gate는 아직 옛 판정이었고(approval-checks 45293102602가 23:57~23:58 갱신) pending 판독 자체는 맞음. 병합은 00:03:30 다른 실행(45293892608)이 함.
- 수정: 기준 시각 조회 실패 → head 커밋 시각으로 대신, 그것도 없으면 6분 재확인(판정 불가로 보지 않음). 60분 상한·승인 판정·approval-gate 확인은 그대로.
- 운영 연결 [직접 확인]: 41fb3f8 배포 → deploy-verify 45294048081 성공 → 작업 큐 호출 → claude-auto 45294331261 task-pickup "시작할 ai-task 이슈 없음"(대기 이슈 0건).

## 2026-11-24 — 1순위: 자동 병합 실패 복구 + 운영 성공 뒤 다음 작업 1건 연결 (#995 이어서, 병합·운영 DB 없음)
- 원인 [직접 확인 — run 45288046609·#955 check-runs]: 포크 PR(#955·#874)은 approval-checks가 판정하지 않아 approval-gate가 없는데, 봇은 '판정 대기'로 보고 6분 재확인을 상한 없이 예약 → 11-22부터 7분 간격 무한 반복. 같은 경로에 60분 상한이 없었음. 병합 거절은 모두 같은 '다음에 다시'(11-23 #995에서 분류 추가).
- 공통 수정: 봇 병합 — 재시도로 안 풀리는 차단(포크 PR·영구 거절·approval-gate 60분 넘게 무판정)은 재확인 예약 없이 사유를 실행 요약+PR 댓글(커밋·사유당 1번)에 기록, 일시 지연은 head 커밋/이 커밋 최신 리뷰 뒤 60분 안에서만 6분 재확인(recheck-since.jq).
- 다음 작업 연결: deploy-verify 마지막 단계(앞 단계 모두 성공 시만) → deploy-success-pickup.sh → 기존 task-pickup(pickup=true) 1번. 재실행·같은 커밋 두 번째 성공·master 아닌 옛 커밋은 안 부름. 봇 병합이 부른 deploy-verify는 workflow_run 계기를 못 만들어(administrative-pin-check 11-23 기록) 직접 호출로 함.
- 시험: scripts/ci/automerge-recovery.test.mjs(실제 YAML 쉘+가짜 gh, AMR_BEFORE_REF=f3bd111로 수정 전 실패 재현) + 기존 봇·승인·후속 연결 시험.

## 2026-11-23 — #992 대조 후 승인 기준 보완: 재확인 상한 60분·DB 구조(DDL)·pull_request_target 수동 (Draft, 병합·운영 DB 없음)
- 대조 결과 [직접 확인]: #992에 이미 반영 — 규칙 문서 3개·결정 문서·CODEOWNERS·필수 검사 구성(필수 이름 잡 정의 워크플로)·워크플로 경계(on·permissions·environment·runs-on·uses·secrets)·고권한(실제 설정) 명령 변경·STRICT·화면 틀 수동, 조회 실패 자동 재확인. 빠짐: ① 재확인 상한 없음 ② DB 구조(DDL)가 권한 신호만 보아 자동 ③ pull_request_target를 고권한으로 안 봄 ④ 격리 Preview 차등 검증(미구현, 후속).
- 변경: decision-approval-gate(RETRY_LIMIT_MINUTES=60 초과 시 '판정 불가' 사유 기록·대표 판단, DDL 신호는 supabase/migrations만, pull_request_target 고권한) · approval-checks·bot-pr-automerge가 head 나이를 넘김 · 규칙 문서 3개.
- 검증: 신규 시험 + S4 우회 시험·approval-checks·callpath·claude-publish·scope 통과, 최근 병합 42건 재판정 전환 0건(보안 미탐 0).

## 2026-11-23 — 이슈 #990 후속: 행정구역 핀 검사 6건·OCR 검사 2회 실패 원인별 수정 + PR 단계 읽기 전용 검사 (Draft→Ready, 병합·운영 DB 없음)
- 원인(공개 캐시·원본 불일치): #991이 공개 위치 요약 API를 확정 좌표만으로 맞춰 해결, 병합 커밋 deploy-verify 성공이 증거. 원인(핀 6건 5599·5876·5993·6043·6255·6309): #989 규칙(대략 area는 핀 아님) 뒤 확정 좌표가 없는 공개 공고를 행정구역 검사가 아직 '핀 없음 = 실패'로 봄. 원인(OCR 2회 실패): 공고 6311의 외부 사진 주소 HTTP 403(영구 접근 거부)이 매 실행 exit 2.
- 변경: oracle — 근무지 줄이 있으나 확정 좌표 없는 공고는 실패가 아니라 `unconfirmedLocationJobs`로 출력(줄 없는 공고·확정 좌표의 성 밖은 그대로 실패) / ocr-compare `imageFetchPermanent`(외부 주소 403·404·410만 건너뜀, 일시 오류·우리 저장소 오류는 실패 유지) + ocr-check 사용 / app-screen-check에 읽기 전용 운영 위치 검사 단계(PR 단계).
- 검증: 신규 시험 3종(수정 전 import 실패·수정 후 통과), 운영 읽기는 CI에서만(이 환경 운영 접근 없음). 미검증: 6건이 실제로 area/unresolved 줄만 가지는지는 CI 출력의 unconfirmedLocationJobs로 확인.

## 2026-11-23 — 이슈 #990: 공개 위치 요약(/api/map-locations)이 대략(area) 점을 내보내 운영 검증 실패(공고 5599) 수정 (Draft→Ready, 병합·운영 DB 없음)
- 원인 [직접 확인 — 코드]: #989가 핀 원천을 확정 좌표(exact·gate)로 좁히면서 원본 대조(oracle sourcePoints)와 화면 코드는 맞췄지만, 공개 캐시 읽기 `api/map-locations.js`의 허용 종류가 아직 exact·gate·area라 5599의 대략 줄이 응답에 남아 deploy-verify '지도 요약'(map-summary-check) 대조가 어긋남. 5599만의 문제가 아니라 area 줄이 있는 모든 공고.
- 변경: `api/map-locations.js` 허용 종류 exact·gate만(캐시 표·DB 줄은 그대로 보존), `api/map-locations.test.ts`·`api/_map-r1.test.ts` 기대값을 확정 좌표만으로(수정 전 실패 재현: area 포함 → 1 !== 2).
- 검증: tsc · npm test 125/125. 운영 화면·핀 검사는 병합 뒤 deploy-verify로 확인(미실행).

## 2026-11-23 — 이슈 #988: 지점별 독립 공고 + 위치 우선순위(Google→VietMap→Goong) 구현 + 자율 완주 규정 (Draft→Ready, 병합·운영 DB 없음)
- 요청: Lee 2026-11-23 — #987 규정의 실제 구현(지점별 독립 공고, Google→VietMap→Goong, 확정 좌표만 핀·거리검색)과 「자율 완주 및 승인 게이트 원칙」 문서 반영.
- 수정 전 실패 [직접 확인]: ① 옛 resolver는 Google이 찾아도 VietMap으로 다시 번지 확인하고 못 하면 대략(area) 위치로 낮춤(시험 'Google place adopted as confirmed exact' 실패, source=VietMap) ② 같은 글의 새 지점 find_existing이 첫 지점 공고를 돌려줌(1) ③ 같은 회사·일·공단 형제 지점 공고 중복 판정 `duplicate:1:same_company_job_location`(꺼짐) ④ 수집 입구는 지점 2곳을 공고 1개+근무지 2줄로 등록.
- 변경: autoLocationResolver(Google 채택·VietMap·Goong 순, 번지 재확인 단계 삭제) · locationPrecheck(area 회사 장소 분기 삭제) · jobCoords.resolveMapLocations(확정 좌표 exact+확인·gate만 → 핀·거리검색 한 곳) · ingest_gateway(지점마다 ingest_job 1회, branch_location) · migration 20261124000000_branch_job_identity(ingest_job 해시·find_existing에 지점 위치, verdict 같은 글 형제 면제) · 시험 갱신.
- 검증: tsc · npm test 125/125 · build · 크롤러 파이썬 시험 · branch_job_identity.pglite(운영 함수 본문에 줄 바꾸기 적용) · 로컬 PostgreSQL 16에서 CI와 같은 순서(fixture→setup→migration→local→production_check) 통과.
- TopCV·vieclam24h 지점 분리·Facebook refresh 형제 지점 분리·재수집 지점 누락 비종료는 구현+단위 시험(test_job_error_isolation·test_pin_guard). 미완료(범위 밖/미검증): 관리자 위치 확정 대기열(#985·#986 보류) · 기존 다중 근무지 공고 전환(dry-run·승인 필요) · 운영에서 ingest_job 전체 실행·기존 area 핀이 사라지는 건수는 운영 DB 조회 불가라 미확인.

## 2026-11-22 — JOBI 1-B(Lee 승인): 마감·연락처·필수 항목 기준 불일치 해소 — 코드·시험 Draft PR + DB cron Draft PR (병합·운영 DB 없음)
- 실제 실패 [직접 확인, 1-A 측정]: ① 마감 당일을 크롤러는 만료·Facebook은 기한 버림(→상시 공고로 등록), 화면·알림은 열림, 공개 판정 기본 날짜는 UTC ② 연락처: DB 8자리인데 Facebook·job_quality·화면은 값이 있기만 하면 통과(`0912345`·`abc`·`---`도) ③ 필수 9개 목록이 점검 코드·작성 화면·문서에 따로 있음(점검기는 독립성 규칙상 공유 불가 → 일치 시험으로 고정). 정책 평가기 3벌은 4,057건 불일치 0(F1).
- 변경(코드 PR): policy/job-criteria.json(마감·연락처·필수 9개 단일 원천) · crawler/job_criteria.py · src/lib/jobCriteria.mjs(+d.mts) · crawl_facebook/crawl_topcv/job_quality/finalize_reprocess_queue(베트남 날짜·마감 당일 열림·연락처 8자리) · jobInspect.ts(공개 판정 기본 날짜 = 베트남 — 검사기 독립성 시험(R2 #753) 때문에 공유 모듈을 import하지 않고 직접 계산, 필수 9개 목록은 jobCriteria.test.ts가 JSON과 일치를 고정) · 시험: 마감·연락처 경계, 정상 연락처 표기 회귀, 정책 판정기 Python·JS·SQL 일치 2,057건(job_posting_rules.pglite.test.mjs, 기존 CI 단계).
- 건드리지 않음: 화면 연락 버튼 표시(승인된 틀), 필수 여부·PostJob 12개, Facebook 지난 마감 새 제외, F4 khac·F5 review(기존 결정 미확정 → 코드 변경 없음), F6 원문 롤백·F8 위치 보호(1-C).
- 검증: 수정 전 새 시험 실패 재현(py 4·TS 1) → 수정 후 통과. npm test 125/125·tsc·py 시험·PGlite 일치 시험 통과(로컬). 변이 시험으로 일치 시험이 불일치를 잡는 것 확인. 운영 DB 조회 불가(프록시) → 운영 확인은 별도 보류.
- DB PR(별도 Draft): deactivate_expired_jobs 만료 기준 = 베트남 날짜(함수 한 개 교체, 되돌리기 = 이전 본문 복원 migration).
- 1-C(별도 Draft PR #972, Lee 승인): Facebook이 DB 규칙(job_rule_R*·정책 제외)으로 거부된 공고의 원문·출처·규칙 코드·사유를 기존 보류함에 rejected(종결, 자동 재시도 없음)로 보존 — crawler/ingest_gateway.py 포장(hold=True)만 변경. 보관 실패는 HoldStoreError → JOB_ERRORS → '본 글' 기록 안 됨. hold=False(TopCV·vieclam24h)·관리자·고용주 위치·DB ingest_job·공개 정책 변경 없음. 세 PR의 작업 기록은 이 PR에만 둠(병합 충돌 방지).
- 남은 결정·운영 확인 보류: 이슈 #973.
