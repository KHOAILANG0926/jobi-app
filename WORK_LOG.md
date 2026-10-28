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

## 2026-10-25 — Vercel 하루 배포 100번 한도 대응
- [직접 확인] a543503 운영 배포 실패: "api-deployments-free-per-day"(무료 하루 100번). 운영은 직전 버전 유지.
- 변경: vercel-deploy.yml — 앱 파일(src·api·public·설정)이 바뀐 커밋만 배포, 2시간마다 운영이 master보다 뒤처졌으면 따라잡기 배포(한도 풀리면 자동). detail-fill.mjs — 급여 규칙·실행기 자신이 바뀌어도 전부 다시 처리(#4879 급여 칸이 안 채워진 원인).

## 2026-10-25 — 검사표가 찾은 #4879 ADTEK 문제 수정(급여 칸·공단 근무지)
- 급여: 위쪽 급여 칸이 비어 있으면 원문 급여를 글자 그대로 채움(src/lib/sourceSalary.ts, detail-fill). "Lương tối thiểu/tối đa" → "9 - 17 triệu/tháng". 금액 없으면 비움.
- 위치: "Nhà máy Quế Võ III"처럼 공장 이름이 공단 표 이름과 같으면 그 공단(industrialPark.ts KCN_TOKEN에 nha may). 회사 이름 공장은 해당 없음(시험).
- 운영 배포 뒤 위치 못 찾은 공고 바로 다시 찾기(vercel-deploy.yml, map_r1_retry_unlocated) — 03:00까지 기다리지 않음.

## 2026-10-25 — AI 칸·복리후생 판정(정해진 번호표 중에서만)
- Lee 결정("단어 규칙으로는 끝이 없다", 검사표 결과 "ok"): 단어 규칙이 칸을 못 정한 줄 → AI가 01~07 중 고름 → detail_line_kinds 저장(다음부터 AI 없이), Lee가 정한 칸은 AI가 못 바꿈. 복리후생도 AI가 원문 근거로 번호표(xe đưa đón·ký túc xá·ăn ca·xăng xe·nhà ở·chuyên cần·năng suất) 고름 → "있음"만 기록.
- 안전장치 src/lib/aiClassifyGuard.ts: 목록 밖·준 적 없는 줄·원문에 없는 근거·부정 문장 버림. 글자 변경 없음.
- 변경: migration 20261025140000_detail_line_kinds.sql, scripts/ocr/ai-classify.mjs(job-ocr-check에서 상세요강 만들기 앞), jobDescriptionBuild(lineKinds), detail-fill(번호표 반영·버전), JobDetail(AI 번호표로 아이콘 켬).
- 시험: aiClassifyGuard.test.ts, detail_line_kinds.pglite.test.mjs.

## 2026-10-25 — 공고 1개 자동 검사표
- Lee 결정: 지금은 공고를 하나씩 올리며 문제를 찾는 단계, 크롤링 땐 문제가 나오면 안 됨 → 올린 공고마다 기계가 검사해 알림, 새 공고 연속 10개 통과가 크롤링 시작 조건.
- 변경: src/lib/jobInspect.ts(핀·칸 나누기·중복·사이트 글자·위쪽 반복·급여 칸·복리후생 표시·직업분류·포스터·새 종류 줄·공개 11항목), scripts/ops/job-inspect.mjs(바뀐 공고만 검사, ocr_check.inspect 저장, 이슈 "공고 검사표"에 쉬운 말 + 연속 통과 N/10), job-ocr-check.yml 마지막 단계로 연결(30분마다).
- 시험: src/lib/jobInspect.test.ts(#4878 통과, #4879 문제 4개: 핀·급여 칸·기숙사/식사 표시·비공개).

## 2026-10-25 — 수집 소스 자동 멈춤·자동 수리·자동 재개
- Lee 결정(채팅 "ok"): 같은 소스에서 같은 원인 3건 연속 실패 → 그 소스만 멈춤 → 알림 → 자동 수리 → 자동 재개, 2번 실패 시 원인별 Lee 할 일, 풀릴 때까지 매일 표시.
- DB(20261025120000_crawl_source_guard.sql, 추가만): crawl_source_state·crawl_job_outcomes, 결과는 트리거로 기록(위치 못 찾음·포스터 불일치=실패 / 공개·위치 재발견=성공). 멈춘 소스의 새 수집 공고는 DB가 저장 거부(수집기 코드와 무관). 원인 공고가 모두 성공하면 자동 재개.
- 알림·수리(AI 없이): .github/workflows/crawl-guard.yml 30분마다 — 이슈 알림, claude-auto.yml 수리 시작(최대 2번), [자동수리] PR 직접 검사 후 병합·배포·재처리, 재개 알림.
- 검사 규칙 정리: check-repository-policy.mjs가 모든 migration을 막던 것을 결정 0002대로 "삭제·되돌리기 어려운 변경만" 막게 수정.
- 시험: supabase/tests/crawl_source_guard.pglite.test.mjs.

## 2026-10-25 — 상세요강을 원문에서 기계가 다시 만듦(AI 글 고쳐 쓰기 제거) 1단계
- Lee 결정(채팅 10-25): AI가 원문 고쳐 쓰기 금지, 하나의 흐름으로. 원인[직접 확인]: #4878 AI가 "đảm bảo sản phẩm đẹp"→"bảo đảm sản phẩm"로 바꿈 → 빠진 줄 보충이 원문을 다시 붙여 같은 내용 2번.
- 변경: src/lib/jobDescriptionBuild.ts(사이트 화면 글자·가려진 번호 제거, 이름표/값 두 줄 합침, 칸 나누기, 위쪽 정보 반복·급여 총액·중복 제거, 글자 그대로). scripts/ocr/detail-fill.mjs: 원문 있는 공고는 description을 원문에서 다시 만듦(처음 한 번 local_jobs_description_backup에 원래 글 보관, reason=rebuild-from-source-20261025), 원문 없는 공고는 기존 보충. 규칙 파일이 바뀌면 전부 다시 만듦. AI가 다시 글을 고치면 다음 실행에서 다시 원문 기준으로 덮음.
- 화면: 위쪽 칸(나이·성별·학력·경력·근무시간+근무일 등)과 같은 줄은 상세요강에서 뺌(jobDetailSections coveredByAbove). 소제목 추가(Quyền lợi chính, Yêu cầu cơ bản), 줄 규칙(Kinh nghiệm→02, Ứng tuyển→06, Cộng tác viên→07).
- 시험: src/lib/jobDescriptionBuild.test.ts(실제 원문 #4878·#4879). tsc·npm test 75/75·build 통과.

## 2026-10-25 — 배포 방식 변경 2단계: Vercel 자동 배포 끔
- [직접 확인] ce59746: Actions 배포 성공(github-actions[bot] Production 기록) + deploy-verify 통과. 같은 커밋을 vercel[bot]도 배포해 이중 배포 → 이번에 끔.
- 변경: vercel.json git.deploymentEnabled=false(모든 브랜치). demo/** 는 Actions가 미리보기 배포 + 예전과 같은 고정 링크(jobi-git-<브랜치>-mshw1895-6089s-projects.vercel.app) alias.
- 일반 PR은 Vercel 미리보기를 만들지 않음(화면 검사는 app-screen-check가 Actions 안에서).

- 이전 HANDOFF 보존:
# CHATGPT_HANDOFF — CTY KDA 파서 연결 (2026-10-25)

## 1. 현재 상태
- 기준 master bd9674b; CTY KDA 변경 PR #218 및 #219(Draft) 상태. PR #219 브랜치 feat/cty-kda-integration-20261025.
- API: api/parse/cty-kda.js 인증 Bearer CTY_KDA_PARSER_TOKEN, OPENAI_API_KEY와 CTY_KDA_MODEL 필요. AI system prompt → guard → JSON 응답. DB 기록 없음.
- Python: crawler/crawl_topcv.py process_job_url 경로에 CTY_KDA_PARSER_ENABLED=true일 때만 API 호출. HTTPS CTY_KDA_PARSER_URL 및 CTY_KDA_PARSER_TOKEN 필요. Guard violations/호출 실패 시 _pipeline_failed → 기존 공고 덮어쓰기 차단. 기본 비활성.
- API mock contract 테스트 추가. 실제 TEFAL Raw Text → 실제 모델 응답 E2E 미실행. 별도 저장 스키마/공개 정책 매핑 미구현. 최종 CI 미확인. master/Production 미반영.

## 2. 다음 할 일 3개
1. 실제 TEFAL 원문의 비공개 서버 측 접근 경로와 AI provider 인증설정 확인 후 API 실호출 E2E 수행, JSON/Boolean/중복/violations 검증.
2. CTY KDA 정형 결과의 DB 비공개 저장 위치와 무손실 대응을 확정하고 회귀 테스트 추가 (DDL은 승인 전 금지).
3. PR #219 최종 SHA CI/빌드 확인 및 E2E 통과 후에만 사용자 지시 범위 내 병합/배포 검증.

## 3. 필수 규칙
- AGENTS.md, CLAUDE.md, CTY KDA 6대 불변 규칙 준수. thong_tin_khac는 UI ④ 마지막 소영역, 다섯 번째 영역 없음.
- 운영 DB·Auth·RLS·Secrets·공고 원문·위치 승인·STATUS 보호. 공개 자동 변경 및 가짜 공고 금지.
- 회사 PC 로컬 저장 안내/현장 방문 제안 금지. 미실행 E2E/CI/배포 성공을 완료로 보고 금지.


## 2026-10-28 — Bomunttl 이전 이관 스냅샷 보존

# CHATGPT_HANDOFF — FUSHAN 브랜치 전달 (2026-10-27)

## 1. 현재 상태 (코드·배포·DB)
- 사용자 최종 지시: 시험·빌드 후 새 브랜치 push만. PR은 Claude가 생성. 이번 작업에서 PR·운영 쓰기·병합·배포 금지.
- 브랜치 fix/fushan-source-rules-20261027, 시작 HEAD 1a05b64. FUSHAN 8줄을 공통 규칙으로 급여/고용형태/서류/환경·숙소에 분류; 원문 그대로 보존.
- 보너스는 급여에 합치지 않음. 중개 근거로 Tuyển qua nhà thầu 표시; 수수료 없음 문구는 중개 여부를 부정하지 않음. 공단명만으로 업무를 추정하지 않으며, 명시적 검토 안내는 재처리 시 보존.
- housing_search 번호표 추가, AI 재처리 hash에 번호표 정의 포함. 기존 화면틀/CSS 변경 없음.
- 공식 seed의 최상위 9와 FUSHAN 원문 증거 공개 게이트 시험 추가. DB 규칙 표 수정·production check SQL은 supabase/pending/fushan-20261027에 있음(운영 미적용).
- 최종 로컬 검증: npm test 82/82·tsc·build·PGlite 실제 사례+pending SQL/production check·approval scope 통과. 독립 검토 지적 수정, 남은 차단 없음.
- Git/npm 경로 정상. api.github.com은 환경 허용 목록에 없어 프록시가 차단. 토큰 만료는 확인되지 않았음.

## 2. 다음 할 일 3개
1. Claude가 전달 브랜치로 PR 생성하고 최종 HEAD 필수 CI 확인. 이번 브랜치의 로컬 검증 결과는 WORK_LOG 참고.
2. 후속 운영 작업: pending 규칙 SQL을 정상 migration으로 승격, 기존 등록 경로에서 실제 FUSHAN 등록·공식 코드 검증·회사+공단 기억 또는 공단 입구 위치 검증. 구직자 비용 요구 비공개 정책의 공통 집행은 별도 미구현 항목이며 등록 전 확인할 것.
3. 봇 병합→정상 migrations-apply→필요 시 배포 1회→deploy-verify·실제 검사표 전 항목 확인 후 연속기록 갱신. 로컬 fixture 성공을 운영 성공으로 보고하지 않음.

## 3. 필수 규칙
- 운영 DB 직접 조회/쓰기 금지. migration+production_check 정상 경로, 실패하면 원문 보고 후 중단.
- 공단 밖/공장 불명 기존 보류. 최상위 코드와 원문 부분문자열 존재는 공장 의미 검증의 자동 증명이 아님.
- 이번 작업은 브랜치 전달만. 공고 링크/좌표/연속기록은 아직 없음. 발견한 실패 때문에 0/10부터 다시 시작할 대상이나 운영 기록은 미갱신.


## 2026-10-28 — Bomunttl 등록 준비·Lee 출처 규칙

- Lee가 출처·지원 결정 우선 규칙과 확정 1~3번 방안을 명시 승인. 캡처 재요청·게시시각 계산 취소.
- API CONNECT 403 직접 확인; PR·운영 DB 직접 접근·운영 등록 없음. 새 브랜치 feat/bomunttl-lee-source-20261028.
- CLI 생성 migration 20261028034009/20261028034036 + production_check: Lee 확인 출처 허용, 원문 필수·위조 방지, Bomunttl 1건과 canonical unresolved 주소. posted_at NULL, 직무별 급여·시간 보존, 글로벌 식사 약속 없음.
- 직무별 조건을 자동 재생성에도 보존하는 공통 처리, 식사 범위 검사, 동일 시작/종료 시간 관리자 검사 추가. 옛 규칙 SQL 재적용으로 R3를 되돌리던 workflow는 정상 migration 이력 확인+시험만 하도록 변경; 회귀 시험 추가.
- 실패를 먼저 확인한 회귀: R3 URL/이미지 없는 Lee 확인, 원문 확인 위조, 직무별 조건 유실, 새 종류 분류 누락, 식사 범위, 동일시간, 옛 migration replay.
- 검증: npm test 83/83, 타입 검사·전체 build; PGlite R3·원문 규칙·실제 등록 SQL·멱등/충돌; occupation 실제 사례; 실제 PostgreSQL/PostGIS canonical writer+등록 1건+재실행+production_check; 관리자 queue 6/6; workflow replay 1/1; 독립 검토 지적 수정 후 차단 없음.
- 로컬 검사표 9/11, pin·hours_review 미충족. 이미지 없음 OCR 비대상. 운영 공고 링크·운영 전체 검사·연속 통과 수는 미확인. docs/ops/2026-10-28-bomunttl.md에 전 항목.
- 실제 PostgreSQL 시험 환경의 임시 초기화 서버·기본 DB extension 충돌·기존 축약 fixture incidents 누락은 시험 부트스트랩에서 수정. 실제 등록/원문 규칙 통과를 확인.


## 2026-10-28 — 이전 Bomunttl 이관 스냅샷 보존

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


## 2026-10-28 — 복수직무/핀 공통 수정

- Lee가 sb-4982 개별 수정 금지, 공통 규칙/시험 수정 지시. 상단 글 모형 승인. 상세 경과·직접 시험·운영 미확인·DB권한 실패/교정은 docs/ops/2026-10-28-bomunttl-followup.md.
- 브랜치 fix/multi-role-map-presentation-20261028, 기준 origin/master93c70ee. 코드/규칙 SQL만 준비, 운영 직접SQL/PR/병합/배포 없음.
- 전체85/85·tsc·build, PC/mobile KDA3image상태 틀 비교, 실제 canonical PG동시성/새행정fallback/복수target/권한정확복구, registration→fallback→presentation룰, PGlite·oracle검사 통과. 독립검토2개P2수정 후 차단 없음.
- 운영 익명API공개4개 모두canonicalpin, 기존도시좌표1개도시증빙미확인,4982공개목록미반환. 운영브라우저proxy차단. 새운영workflow는 모든공개메인/상세/source점 대조와 원문행정증명을 실패포함 보고.
