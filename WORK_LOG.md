## 2026-11-01 — 모집조건 왼쪽 빈칸 당기기 (Claude)
- 요청: Lee — #5157 'Thông tin tuyển dụng' 왼쪽 칸이 비고 직무가 오른쪽에만 있음 → 오른쪽을 왼쪽으로.
- 변경: src/lib/recruitColumns.ts(왼쪽에 PC 표시 항목이 없으면 한 칸으로 합침, 빈 칸 미표시) + JobDetail 사용. 시험 4개 + 기준 시험 1개.


## 2026-11-01 — 결정 0007 상단 회사명 줄 (Claude)
- 요청: Lee "하이랜드 마무리" — 결정 0007(제목에 회사명이 보이면 지점명만, 없으면 줄 없음) 화면 반영.
- 변경: src/lib/companyBranch.ts(표시 전용, DB company 그대로) + JobDetail 상단 회사명 줄. #5157 "Mường Thanh Bắc Ninh"만, KDA처럼 제목에 회사명이 다 있으면 줄 없음.
- 검증: companyBranch 시험 6개, npm test, build. 운영 화면은 deploy-verify로 확인.


## 2026-11-01 — 검사표가 "지금 내용"을 검사하고 통과해야만 공개 (Claude, Lee 지시 "니가 직접해")
- 원인(운영 DB·코드 직접 확인): #5157 검사표 11개 전부 통과로 공개됐지만 실제로 지원 방법 줄 누락·같은 교대 반복·직무 행 미표시. 검사 기록이 내용이 아니라 결과 지문만 남겨 무엇을 검사했는지 증명 불가. 규정 R10·R13은 막는 장치 없음.
- 변경: ① migration 20261101110000 — 내용 지문 함수 + 트리거(검사 통과 기록이 지금 내용과 같아야 공개, 아니면 비공개+inspect_hold) ② job-inspect: content_hash·publishable 기록, 'public' 항목 순환 제거, 통과 시 hold 공고 재공개·실패 시 비공개 ③ 검사 항목 3개 추가(roles·hours_twice·source_lost) ④ 상세요강: 지원 방법 줄 보존(phoneOnly), 이름표만 다른 같은 교대 제거, 소제목 없이도 "Nhân viên … Fulltime/partime" 직무 인식.
- 검증: 실제 PostgreSQL 시험 8개 경우, publishDecision 7개 경우, npm test 93/93, build. 운영 9개 공고 복사본으로 detail-fill→job-inspect 실행: #5157 재생성 후 전부 통과·공개, KDA 등 공개 4건 내용 그대로·공개 유지, #4982는 R11(10h-10h 관리자 확인)로 비공개.
- 남은 것: 운영 병합·migration 적용·#5157 화면 확인. 10-30 확정 "④ 원문 전체 보여줌"과 기존 급여 총액 빼기(repeat_above·salary_total_repeat)·포스터 머리글 기타란 처리는 Lee 확인 필요.


## 2026-10-31 — 재처리 큐/트리거 통합 + Highlands #5157 검증
- 요청: 배포·파서 변경 뒤 공고 재처리 자동 진행, 관리자 요청 API 제공, 실제 #5157의 DB/R7/공개/PC·모바일 전체 완료.
- 구조: `job_reprocess_queue` RLS/중복방지, 소스 코드 SHA256 버전별 영향 Facebook 공고 큐, GitHub Actions `refresh-facebook-existing.yml` push·예약·직접 요청, 기존 `ingest_job`, OCR/R7 검증 뒤에만 완료.
- 관리자 API: 기존 `api/admin.js`에 `/api/admin/reprocess-jobs` 추가, 인증·조회·등록, 서버 전용 GitHub 토큰 있으면 즉시 호출, 없으면 예약 워커가 처리. 새 Vercel 함수 없음.
- 검증: CI/봇/운영 적용 및 실제 #5157 R7/공개/화면 확인 완료 전 최종 성공 주장 금지.


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
