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

## 2026-10-25 — 배포 방식 변경 1단계: GitHub Actions에서 빌드 → Vercel에 결과만 올림
- Lee 지시: "Vercel 무료 한도가 다해서 GitHub Actions + Vercel API 직접 배포로 변경".
- 변경: .github/workflows/vercel-deploy.yml 추가(master→운영, demo/**→미리보기, 끝나면 GitHub 배포 기록 생성 → deploy-verify 그대로 사용). 필요한 비밀값: GitHub Secrets VERCEL_TOKEN 하나(없으면 빨간색+안내).
- 2단계(이 PR 아님): Actions 배포가 운영에서 한 번 성공한 걸 확인한 뒤 vercel.json에서 Vercel 자동 배포(git 연결) 끄기 — 먼저 끄면 운영 배포가 멈출 수 있어 순서를 나눔.

## 2026-10-25 — 운영 화면 검사가 공고 수에 묶여 실패하던 것 수정
- 원인[직접 확인]: deploy-verify '지도 요약' 단계가 핀 2개·합계 2를 고정값으로 검사. 10-24 #4878(TEFAL) 공개 후 bd9674b부터 매번 실패(마지막 통과 10-22 6269d56). 화면 고장이 아니라 검사 고정값 문제 [추정: 운영 화면 직접 접속 불가로 실패 화면은 미확인].
- 변경: scripts/ops/map-summary-check.mjs 핀 수·합계를 "2개 이상"으로.

## 2026-10-25 — 운영 배포 실패 복구(서버 함수 개수 초과)
- 원인[직접 확인]: 9e0c05d(PR #219)부터 Vercel 운영 배포 failure. api/ 아래 시험 파일 2개(cty-kda-*.test.ts)가 밑줄(_) 없이 있어 서버 함수로 잡혀 함수가 14개 [추정: 요금제 한도 12개 초과]. 운영은 bd9674b(10-24) 상태로 멈춤.
- 변경: api/cty-kda-endpoint.test.ts → api/_cty-kda-endpoint.test.ts, api/cty-kda-guard.test.ts → api/_cty-kda-guard.test.ts (기존 _*.test.ts 관례). 내용 변경 없음.
- 검증: npm test 74/74, build 통과.

## 2026-10-25 — 상세요강 급여 총액 반복 제거 (Lee 결정)
- Lee 결정(채팅 2026-10-25): 상세요강 아래에는 급여 구성(기본급·수당 내역)만 두고 상단 급여 총액은 반복하지 않는다. 이전 2026-10-19 "급여 줄은 위에 있어도 남긴다"를 대체.
- 변경: src/lib/jobDetailSections.ts(salaryAmounts·isSalaryTotalRepeat, 예외 ③에 급여 총액 반복·값 없는 급여 이름표 추가), src/pages/JobDetail.tsx(상단 급여 전달), 시험 추가(jobDetailSections.test.ts).
- 검증: tsc 통과, npm test 74/74, build 통과(이 세션 직접 실행).
- 남은 문제(같은 날 진단, 별도 작업): AI가 원문 글을 고쳐 쓰고 빠진 줄 자동 보충이 원문을 다시 붙여 중복 발생 · 사이트 화면 글자(Hiện số 등) 혼입 · 복리후생 표시가 단어 목록 · 4879 ADTEK 공단 이름 있는데 근무지 미생성 · 10-24 저녁 위치 보고 사용량 한도로 실패.

## 2026-10-22 — 급여 선택 글자 크기를 제목과 동일하게
- Lee 진행 승인: 숫자/전체/일급·시급/협의/월급 복귀를 제목과 같은14px로 통일. CSS 공통변수 사용, browser check에서 실제 computed font size 일치 확인. 색/배치/검색 기준 변경 없음.
- 이전 HANDOFF 보존:
# CHATGPT_HANDOFF — 흰색 급여 선택표 데모 (2026-10-22)

## 1. 현재 상태
- demo/home-job-filters / PR201. 시작 조회8850bcf open/draft, 운영 미반영.
- Lee 승인: 2번 티켓에서 상단 남색 배경과 모든 중복 문구(MỨC LƯƠNG MONG MUỐN/상단 Tất cả/MỨC LƯƠNG)를 삭제. 제목→금액 선택표→일급·시급/협의만 유지.
- 흰색 배경, 선택 항목만 연한 빨강 배경/빨간 글씨. 숫자18px, 전체14px 한 줄, 설명12px, 하단13px. 6/8/10/12/15M+·전체, 일급/시급·협의. 선택 재클릭 유지/상호 배타/월급 복귀 기억 유지.
- 검색 기준·DB·공고 카드/상세·지도 좌표/반경은 변경 없음. 월급은 공고 명시 금액, 기본급 라벨 불필요, 범위 하한, 일급/시급 월환산 없음.
- PC·모바일 모두 같은 SalaryTicket/CSS. 보호된 PC 파일 변경 없음. 최종 tsc/build·CI·캡처·Preview READY는 PR201 최신 기록 조회.

## 2. 다음 할 일 3개
1. 새 흰색 선택표 PC/모바일 캡처·필수 CI·Preview READY 확인 후 로그인 없는 데모 링크 전달.
2. Lee 운영 적용/승인 후 같은 소스 병합→Production READY/SHA→실제 운영 PC/모바일 확인. 중복 승인 금지.
3. 실제 기간·계약 혼합 공고 결과는 데이터 축적 후 검증(Lee 유보). 한국 준비 기능·SNS 유지.

## 3. 필수 규칙
- AGENTS/CLAUDE 준수. 남색 영역/상단 선택값 중복 표시 복원 금지. 데모 화면 승인 전 운영 임의 반영 금지.
- 원문/분류/공개 게이트·위치·공고 틀·DB/Auth/RLS/secret·STATUS 보호. 가짜 공고 공개 금지.
- 회사 PC 저장 안내·현장 방문 제안·미확인 완료 보고 금지. 실제 데이터와 구성 검사를 구분.

## 2026-10-22 — Lee 급여 티켓 정리 승인
- 상단 남색 영역과 MỨC LƯƠNG MONG MUỐN/중복 Tất cả/MỨC LƯƠNG 전부 삭제. 흰색 배경, 선택 항목만 연한 빨강 배경/빨간 글씨. 금액18px, 전체14px 한 줄, 설명12px, 하단13px. 하단 표시 Ngày / giờ(접근성 이름 기존 Lương ngày / giờ). 검색 기준·DB·지도·카드 변경 없음.
- 최신 CI/캡처/Preview는 PR201. 직전8850bcf의 새 티켓 캡처 확인은 기존 기록.
- 이전 HANDOFF 보존:
# CHATGPT_HANDOFF — 급여 티켓 디자인 데모 (2026-10-22)

## 1. 현재 상태
- demo/home-job-filters / PR201. 시작 조회 open/draft, head c712b5d, 운영 미반영. c712b5d의 모든 필수 CI 성공 확인.
- Lee 디자인 시안 4번 선택 후 “2번으로하자”로 변경. 최종 디자인은 2번 급여 티켓. 4번 숫자 다이얼은 미커밋/미배포 상태에서 폐기.
- SalaryTicket 공용 컴포넌트/전용 CSS: 선택 금액 상단 크게, 3열 사각 금액표(6M/8M/10M/12M/15M+·전체), 아래 일급·시급/협의. 별도 항목에서 월급 복귀 시 이전 금액 기억. PC·모바일 동일. 재클릭 유지/상호 배타 선택.
- 검색 기준은 c712b5d 그대로: 명시된 월급, 기본급 라벨 필수 아님, 범위 하한, 시·일급 월환산 없음. 협의 금액 조건 자동 포함 없음. DB/카드/상세/지도 좌표·반경 변경 없음.
- 메인 기간·계약 조건 칸/0건 안내 뒤 기존 공고 유지 기능 포함. 최종 tsc/build·baseline·CI/실제 캡처·Preview READY는 PR201 기록.

## 2. 다음 할 일 3개
1. PR201 새 티켓 디자인 PC/모바일 캡처·CI·Preview READY 확인, 로그인 없는 데모 링크 전달.
2. Lee가 운영 적용/승인하면 동일 소스 병합→Production READY/SHA→실제 운영 PC·모바일 확인. 재승인 요구 금지.
3. 기간·계약 혼합 공고 실제 결과는 데이터 축적 후 검증(Lee 유보). 한국 준비 기능·SNS 유지.

## 3. 필수 규칙
- AGENTS/CLAUDE 준수. 최종 디자인은 2번이며 4번으로 되돌리지 말 것. 데모 화면 승인 전 운영 임의 반영 금지.
- 원문·분류·공개 게이트·위치·공고 틀·DB/Auth/RLS/secret·STATUS 보호. 테스트 공고 공개 금지.
- 회사 PC 저장 안내·현장 방문 제안·미확인 완료 보고 금지. 상태/증거는 PR201 최신 조회.

## 2026-10-22 — Lee 최종 선택: 급여 디자인 2번 티켓
- 4번 숫자 다이얼 선택 후 Lee가 2번으로 변경. 최종 구현은 급여 티켓, 다이얼은 폐기(미커밋/미배포). 선택 금액 상단 크게, 아래3열 사각 금액표(6/8/10/12/15M+·전체), 하단 일급/시급·협의. PC·모바일 동일. 검색 판정/DB/공고 카드/지도 변경 없음.
- 이전 c712b5d 데모 CI는 전부 성공(직접 조회), 이번 새 디자인의 CI/캡처/Preview는 PR201 기록.
- 이전 HANDOFF 보존:
# CHATGPT_HANDOFF — 급여 검색 간소화 데모 (2026-10-22)

## 1. 현재 상태
- demo/home-job-filters / PR201. 운영 미반영. 이번 시작 조회 PR201 open/draft, base b720bcc, 이전 head cfe0268.
- Lee 승인 구성: 제목 Tìm theo mức lương(급여로 찾기). Tất cả·6M+·8M+·10M+·12M+·15M+·Lương ngày/giờ(일급·시급)·Thỏa thuận(급여 협의). PC·모바일 동일. 한 번 클릭 적용/재클릭 유지, 항목 간 배타 선택, 전체로 해제.
- 월 금액은 공고에 명시된 월급 기준. 기본급 라벨 필수 조건 폐기. 일급/시급/교대급은 월환산 없이 별도 항목. 협의는 별도 항목이며 월 금액 조건에 섞이지 않음. 범위는 하한 기준 유지, 별도 수당·상여 합산 없음.
- 메인 조건 칸/0건 안내 후 기존 실제 공고 유지 동작은 이전 데모와 동일. 카드·상세·DB·지도 좌표/반경 변경 없음.
- 직접 검사: tsc/build·npm test72/72·desktop baseline8/8 통과. 날짜/이유와 PC 해시 갱신. 최종 SHA/화면·CI/Preview READY는 PR201 조회.

## 2. 다음 할 일 3개
1. 새 데모 PC·모바일 실제 버튼 화면 및 PR201 필수 CI·Preview READY 확인, 링크 전달.
2. Lee가 데모 적용/운영 승인하면 동일 소스 병합→Production READY/SHA→운영 PC·모바일 확인. 재승인 요구 금지.
3. 실제 기간·계약 조건 공고 축적 후 결과 검증(Lee 유보). 한국 준비 기능·SNS는 유지 결정.

## 3. 필수 규칙
- AGENTS/CLAUDE 준수. 이전 ‘기본급만 검색’ 결정은 이번 승인으로 대체. 실제 데이터와 구성 검사를 구분.
- 화면 데모 승인 전 임의 운영 반영 금지. 원문/분류/공개 게이트·위치·카드 틀·DB/Auth/RLS/secret·STATUS 보호.
- 운영 테스트 공고 등록·회사 PC 저장 안내·현장 방문 제안·근거 없는 완료 보고 금지.

## 2026-10-22 — 급여 검색 간소화: 월 금액 + 일급·시급 + 협의
- Lee가 승인한 구성: Tìm theo mức lương, 기존6/8/10/12/15M+ 옆 Lương ngày/giờ·Thỏa thuận. 서로 배타 선택, 재클릭 유지. 월 금액은 명시된 월급 기준으로 기본급 라벨 없이도 검색. 일급·시급 월환산 없음. 월 범위는 하한 유지.
- tsc/build·npm test72/72·baseline8/8 통과. 데모 화면/최종 CI는 PR201 기록. 운영 미반영, DB/카드 틀 변경 없음.
- 이전 HANDOFF 보존:
# CHATGPT_HANDOFF — 월 기본급 구간 확정 데모 (2026-10-22)

## 1. 현재 상태
- 작업 가지 demo/home-job-filters / PR201. 운영 미반영. 이전 운영 기준 b720bcc, 운영 검사39721208749 성공은 기존 기록.
- Lee 최종 확정: 월 기본급 기준, 600만·800만·1000만·1200만·1500만 동 이상. 이전 최대 총급여 우선→기본 금액 fallback 기준은 폐기.
- PC·모바일 제목 Lương cơ bản/tháng, 버튼 Tất cả + 6M/8M/10M/12M/15M+, 한 번 클릭 적용·재클릭 유지. 기본급 명시 문구/구조화 base 값만 사용. 범위는 보장 하한. 총급여·잔업·수당·상여·일급 월환산·주기 불명 값을 기본급으로 추정하지 않음.
- 현재 공개 공고는 이전 직접 조회로 #4828 기본급550만/월, #4824 일급31~36만. 550만은 최저600만 미만이라 새 금액 구간에 나오지 않음. 이 이유로 공고를 수정하지 않음.
- 기존 데모의 메인 조건 칸은 실제 공고 위에 유지. 조건0건이면 안내 후 기존 공고를 그대로 보여주며 ‘현재 공고’로 구분. 카드 틀·DB·지도 위치/반경 변경 없음.
- npm test72/72·baseline8/8 통과. DesktopHomeMapExplorer 해시·상단 날짜/이유 갱신. 브라우저 격리 fixture는 새 기본급 의미를 명시. 최종 tsc/build·필수 CI·Preview READY·캡처는 PR201/Actions 조회.

## 2. 다음 할 일 3개
1. PR201 최신 Preview·PC/모바일 구성 검사 확인 후 데모 링크 전달. 기본급550만이600만이상에 뜬다고 보고 금지.
2. Lee 적용/승인 지시 후 동일 소스를 병합→Production READY/SHA→실제 운영 화면 확인. 재승인 요구 금지.
3. 기간·계약/보험 혼합 공고가 쌓이면 실제 결과 검증. 한국 취업검사·한국 커뮤니티·SNS 미연결은 Lee 유지 결정.

## 3. 필수 규칙
- AGENTS/CLAUDE 준수. 실제 데이터 검증과 구성 검사를 구분. 화면 승인 전 데모 운영 임의 반영 금지.
- 공고 원문·직업코드·공개조건·위치·카드 틀·DB/Auth/RLS/secret 보호. STATUS 직접 수정 금지.
- 운영 DB 테스트 공고 금지. 회사 PC 저장 안내·현장 방문 제안 금지. 근거 없는 완료 보고 금지.

## 2026-10-22 16:52 — Lee 확정: 월 기본급 6/8/10/12/15M
- 요청: 최대 총급여→기본급 기준으로 변경. Lee가 600만·800만·1000만·1200만·1500만 동 이상 구간 확정.
- 변경: PC·모바일 제목 Lương cơ bản/tháng. 명시된 기본급 문구 또는 salary_basis=base인 금액만 비교, 기본급 범위는 보장 하한 사용. 잔업·수당·상여 포함 총액/명시 최대 총급여/주기 불명/일급 환산을 기본급으로 취급하지 않음. 6M/8M/10M/12M/15M+와 Tất cả, 재클릭 유지. DB·카드·지도 위치/반경 변경 없음.
- 검증: 이전 총급여15M를 기본급8M 대신 쓰는 재현 assertion 실패 확인 후 수정. 기본급 우선/현재550만·일급 공고/범위 하한/정확한 구간 등 검사 통과. npm test72/72·baseline8/8 통과, tsc/build·최종 CI/Preview는 PR201에 기록.
- 데이터: 이전 직접 공개 조회 #4828 기본급550만/월, #4824 일급31~36만. 550만은 새 최저600만 미만이므로 전체에서만 나오는 것이 정상. 공고·DB 변경하지 않음.
- 배포: demo/home-job-filters / PR201 갱신, 운영 미반영. 화면 승인 후 반영 대상.
- 이전 HANDOFF 보존:
# CHATGPT_HANDOFF — 메인 조건·급여 데모 수정 (2026-10-22)

## 1. 현재 상태
- 운영 기준 master b720bcc(#198/#200). 운영 검사39721208749 성공(기존 기록). 현재 작업은 demo/home-job-filters / PR201, 운영 미반영.
- Lee 데모 수정: 조건은 실제 메인 공고 위에 표시. 조건 0건이어도 기존 공고 목록을 비우지 않음. 현재0건일 때는 상단 칸 안에서 일치 공고가 없으며 아래는 기존 공고라는 점을 안내. PC·모바일 실제 공고 영역 동일 적용.
- 급여 버튼 한 번 클릭=해당 기준 선택, 재클릭=유지. 전체 급여는 Tất cả로 명시 선택. 협의라는 이유로 금액 필터를 자동 통과시키던 checkbox 제거.
- 금액 기준: 공고에 명시된 최대·범위 상한 우선, 없으면 명시된 기본 금액. salary/rawSalary/salaryNote 및 급여 본문 줄 사용. 명시된 월급만 비교하고 시·일급 환산/시간·일수/별도 수당·상여/외화 변환을 섞지 않음. 기본 금액이 적힌 협의 공고는 그 금액으로 비교. DB·원문·카드 틀 변경 없음.
- tsc/build, npm test72/72, baseline8/8 통과. HomeDesktop/DesktopHomeMapExplorer 해시·맨 위 날짜/이유 갱신. 최종 SHA·Preview READY·화면/모바일 검사 결과는 PR201/Actions 조회.
- 지난 데모8b1da178은 PC/모바일 CI 성공 후 Lee가 빈 화면·급여 토글/협의 통과 문제 지적, 이번 변경으로 대체. #197 위치·반경 기능 재구현 금지.

## 2. 다음 할 일 3개
1. PR201 최신 Preview·필수 검사 확인, PC·모바일 0건에서도 기존 공고 유지·급여 재클릭 유지 캡처 확인 후 데모 링크 전달.
2. Lee 화면 승인/적용 지시 후 동일 소스를 병합→Production READY/SHA→운영 화면 확인. 재승인 요구 금지.
3. 기간·계약/보험 혼합 공고가 쌓이면 실제 결과 검증. 한국 취업검사·한국 커뮤니티·SNS 미연결은 Lee 유지 결정.

## 3. 필수 규칙
- AGENTS/CLAUDE 준수. 실제 데이터 검증과 구성 검사를 구분. 데모 화면 승인 전 운영 임의 반영 금지.
- 공고 원문·직업코드·공개조건·위치·카드 틀·운영 DB/Auth/RLS/secret 보호. STATUS 직접 수정 금지.
- 운영 DB에 테스트 공고 등록 금지. 회사 PC 저장 안내·현장 방문 제안 금지. 근거 없는 완료 보고 금지.


## 2026-10-22 12:54 — Lee 데모 수정: 공고 유지·급여 단일 선택·명시 최대→기본
- 요청: 조건이 0건이어도 기존 실제 공고 영역을 비우지 않음. 급여 버튼은 한 번 선택하면 적용·재클릭 유지. 공고에 적힌 최대 금액 우선, 없으면 기본 금액 사용(협의로 숫자 추정 금지).
- 변경: 메인 상단 조건 칸은 유지하며 0건이면 기존 공고를 그 아래 유지하고 해당 공고가 조건 일치 결과는 아님을 한 문장으로 표시. PC·모바일 실제 공고 영역 동일. 지도 급여 버튼 toggle 삭제, Tất cả 별도 선택. 협의 자동 통과 checkbox 제거. 공고 salary/rawSalary/salaryNote·급여를 명시한 본문 줄에서 월급 상한/최대 금액 우선, 없으면 기본 금액. 시·일급 월환산/상여·수당 합산/근무시간·일수 금액화 없음. DB·카드 틀 유지.
- 검증: 기존 협의 급여가 30M를 통과하는 재현 assertion 실패 후 수정. 명시 최대→기본/협의+기본/급여 범위/금액·주기 미확인/일급/상여·수당/일수/외화 및 본문 명시 최대 시험 통과. npm test72/72, tsc/build, baseline8/8 통과. 최종 PR/모바일/브라우저 검사는 PR201 참조.
- 배포: demo/home-job-filters / PR201 갱신 대상. 운영 미반영, 운영 데이터 변경 없음. 실제 기간·계약 혼합 공고 검증은 사용자 지시로 보류.
- 이전 HANDOFF 보존:
# CHATGPT_HANDOFF — 메인 공고 상단 조건 구성 (2026-10-22)

## 1. 현재 상태
- 기준 master b720bccefeeefee95d1409bd5ea0e3fffcf8c0b9. #198 기간·계약 전체 검색, #200 운영 0건 조건 전환 검사 대기 반영. 운영 검사39721208749 성공(이전 턴 직접 확인).
- Lee 수정 지시: 기간·계약 조건을 별도 페이지가 아닌 메인 공고 나열 상단에 표시. 실제 공고 축적 후 데이터 검증, 지금은 구성만.
- demo/home-job-filters: PC 메인 기존 카드 위·모바일 실제 HomeDiscovery 캐러셀 위 HomeJobFilters(기간7종·계약/보험·조건 요약·해제), 메뉴 /?duration=…#home-job-filters /?pledge=1#home-job-filters. 명시된 데이터만 기존 filterAndSortJobs로 메인 카드에 적용. 모바일 실제 캐러셀/하단 목록에도 같은 조건 적용(지도 원본 jobs는 유지). 지도·카드 틀·DB 변경 없음. 급구 메뉴는 기존 전용 경로 유지.
- tsc/build·npm test71/71·desktop baseline8/8 통과. HomeDesktop/LayoutDesktop 해시·날짜/이유 갱신. CI는 메뉴 경로/배치/선택·해제 구성만 검사; 실제 공고 검색 검증 완료라고 보고 금지.
- 데모 검토 대상, 운영 미반영. 최신 Preview/검사 결과는 이 가지 PR/Actions 조회. #197 지도 완료 재구현 금지.

## 2. 다음 할 일 3개
1. 데모 Preview와 PC·모바일 구성 검사 결과 확인, 실제 데모 링크 전달.
2. Lee가 화면 확인 후 적용하면 동일 소스를 필수검사→병합→Production READY/SHA→운영 화면 확인까지 진행. 재승인 요구 금지.
3. 실제 기간/계약/보험 공고가 쌓이면 조건별 결과 검증. 한국 취업검사·한국 커뮤니티·SNS 미연결은 Lee 유지 결정.

## 3. 필수 규칙
- AGENTS/CLAUDE 준수. 구성 확인과 실제 데이터 검증을 구분. 화면 승인 전 데모를 운영에 임의 반영하지 않음.
- 공고 원문·직업코드·공개조건·위치·카드 틀·운영 DB/Auth/RLS/secret 보호. STATUS 직접 수정 금지.
- 실제 운영 DB에 테스트 공고 등록 금지. 회사 PC 저장 안내·현장 방문 제안 금지.


## 2026-10-22 11:36 — 메인 공고 목록 상단 기간·계약 조건 구성
- 요청: 별도 검색/급구 화면이 아닌 메인 공고 목록 상단에 조건 표시·변경·해제. 실제 조건별 공고가 쌓인 뒤 데이터 검증, 지금은 구성만.
- 변경: PC 메인 카드 앞·모바일 HomeDiscovery 실제 캐러셀 앞 HomeJobFilters 공용 칸(모바일 실제 하단 공고에도 동일 조건), 기간 7종/계약·보험 체크/선택 요약/해제. 헤더 기간·계약 링크를 /?조건#home-job-filters로 연결, 해당 위치로 스크롤. 기존 공유 필터로 메인 카드만 좁히며 카드 틀·지도 위치/반경/유료 등급·DB 변경 없음. 급구 전용 메뉴·별도 검색 경로는 유지.
- 상태: demo/home-job-filters. 사용자 화면 구성 검토용 데모, 운영 미반영. 실제 혼합 공고 데이터 검증 보류. UI 구조/메뉴/선택·해제만 CI 검사.
- 검증: tsc/build, npm test71/71, desktop baseline8/8 통과. 최종 PR 화면/모바일 검사와 Preview 상태는 PR/Actions 조회.
- 이전 결과: #198 운영40b80e4, #200 운영b720bcc. 운영 검사39721208749 성공; 0건 조건 전환 검사 대기 보완. 일반 공고 포함은 격리 시험, 실제 조건 데이터 부족은 남음.
- 이전 HANDOFF 보존:
# CHATGPT_HANDOFF — 메뉴 전체 공고 검색 수정 (2026-10-22)

## 1. 현재 상태
- 지도 #197 운영9a4c980 반영. 운영 검사39699196032 성공, 실제 지도 타일·대표 핀2·m 입력·지도 아래/추천 위 결과·모바일 확인 완료. 지도 재구현 금지.
- Lee 승인: 기간별/계약·사회보험 메뉴가 급구만 검색하던 문제 수정. fix/menu-full-search는 PC·모바일 메뉴를 /viec-lam/tim-kiem?duration=… /?pledge=1에 연결. 급구 메뉴는 기존 /viec-lam/tuyen-gap 유지.
- 공유 jobSearch URL parser/filter에서 명시된 근무 기간, 계약/보험 어느 하나 true만 인정. 일반 공고도 포함, 미기재값 추정 금지. 검색 화면 기간 select·계약/보험 checkbox·조건 해제·같은 페이지에서 메뉴 전환/뒤로 가기 URL 동기화 구현. SSR도 동일 필터 사용.
- 재현: 기간 조건 무시 assertion 실패 확인 후 일반공고 포함/미기재 제외/조건 교집합/급구 전용 유지 통과. tsc/build·npm test71/71·desktop baseline8/8 통과. 실제 브라우저 회귀/운영 캡처 검사 추가, 최종 결과는 PR/Actions 확인 필요.
- DB·공고·카드 틀·메인 지도 변경 없음. LayoutDesktop 기준 해시·맨 위 날짜/이유 갱신. 최종 검사→병합→운영 확인 진행 대상.

## 2. 다음 할 일 3개
1. fix/menu-full-search 필수검사, 일반/급구 혼합 브라우저 격리 시험·PC/모바일 메뉴/필터 동기화 확인.
2. 병합 후 Production READY·SHA 일치, 실제 운영 메뉴가 전체 검색에 조건을 전달하는지 확인하고 링크·짧은 결과 보고. 조건 미기재로 실제0건인 것과 기능 실패를 구분.
3. 공고가 쌓이면 실제 기간/계약/보험 혼합 데이터 추가 확인. 한국 취업검사·한국 커뮤니티·SNS 계정 미연결은 Lee가 유지 결정, 임의 수정 금지.

## 3. 필수 규칙
- AGENTS/CLAUDE 준수. 승인된 수정은 운영까지, 재승인 요구 금지. 실제 없는 기능/검사를 완료로 보고하지 않음.
- 공고 원문·직업코드·공개조건·위치·카드 틀·운영 DB/Auth/RLS/secret 보호. STATUS 직접 수정 금지.
- 실제 운영 DB에 테스트 공고 등록하지 않음. fixtures는 CI 브라우저 요청 내부만. PC 저장 안내 금지.


## 2026-10-22 — 기간/계약·보험 메뉴 전체 검색 연결
- Lee “ok” 승인. 근무기간과 계약/사회보험 메뉴를 급구전용에서 일반 전체 검색으로 수정. 급구 링크/검색 유지. 실제 DB 변경 없음.
- 공유 URL parser/filter(SSR/클라이언트 공통) duration/pledge 지원. 명시적 값만 인정, 근거 없는 일반 공고 제외. JobSearchPage 조건 UI/리셋/페이지초기화·같은 mounted 검색에서 메뉴 전환 URL 동기화 추가. PC/모바일 메뉴 링크·Desktop baseline 갱신.
- TDD 기간조건 무시 assertion 실패→일반공고 포함/미기재제외/계약또는보험/교집합/급구전용 유지 통과. tsc/build·npm test71/71·baseline8/8 통과. PR 격리 브라우저 혼합 데이터와 운영 실제 메뉴 전달/캡처 확인 추가. 결과는 이어서 조회.
<details><summary>교체 전 HANDOFF</summary>
# CHATGPT_HANDOFF — 지도 요약 운영 적용 승인 (2026-10-22)

## 1. 현재 상태
- Lee가 데모에 “적용” 승인. demo/map-summary / PR197의 운영 반영 허가, 재승인 요구 금지.
- 승인 화면: 오른쪽 현재 지도·반경의 전체/업종/급구 요약, 업종 클릭 검색 결과는 지도 바로 아래·추천보다 위. m 직접 입력(400→400m), 기존100m~20km 범위 유지. 카드·모바일·DB·위치 판정 보호.
- 기존 타입/빌드·70개 회귀 통과. 필수 화면 검사 실패는 새 결과 영역과 같은 이름의 버튼2개, 삭제된 PC 안내 선택자, 이전 종료 route 처리 때문. 앱 화면은 그대로, 검사 선택자/실제 API 브리지/종료 처리 수정.
- 운영 verify에 실제 운영 지도 요약·m 입력·위쪽 검색 결과·반경·핀 B·PC/모바일 검사와 캡처 보존 연결. 실제 공개2개 기준, DB 쓰기 없음. 최종 CI/배포/실제 캡처 확인은 이번 작업에서 이어 진행.
- 유료 상품·결제·순위는 미구현/기준 미확정. 추천과 조건 안 검색 결과만 독립 구조로 준비. urgent/featured를 유료로 간주하지 않음.

## 2. 다음 할 일 3개
1. PR197 최신 필수검사 통과 후 병합, Production READY·도메인 커밋 일치 확인.
2. 운영 verify의 지도 요약·m 입력·위쪽 결과 성공과 캡처 직접 열기. 실패면 성공 보고 금지, 원인 해결.
3. 운영 링크와 직접 확인 결과만 짧게 보고. 공고가 쌓인 뒤 혼합 업종/대량/유료 상품 테스트는 별도 후속.

## 3. 필수 규칙
- AGENTS/CLAUDE 준수. 승인된 데모는 검사→병합→운영→실제 화면까지, 추가 승인 요구 금지.
- 위치는 정확 좌표/공단·동 대표 위치, 둘 다 없으면 지도·요약 제외. 대표 핀은 반경 밖에도 남지만 목록·요약은 반경 준수.
- 기준 공고 틀·운영 DB/Auth/RLS/secret 보호. STATUS 직접 수정 금지. PC 저장 안내 금지.

</details>

## 2026-10-22 — 지도 요약 데모 운영 적용 승인
- Lee “적용”. PR197 최종 필수검사→병합→운영 READY·SHA 일치→실제 화면 확인까지 허가.
- 직접 로그: run39698308792는 Bỏ lọc ngành 두 버튼 strict selector, run39698308644는 삭제된 PC hme-intro 안내 선택자 오류. 검사 위치를 명확히 하고 승인 요약 제목을 확인. 실제 공개 지도좌표를 테스트 시작 시 읽어 local API bridge에 재사용, 종료 중 비동기 요청 경합 제거/teardown만 정리. 앱·DB 변경 없음.
- 실제 운영 검증에 m400 입력·2개 업종카드·추천보다 위·반경0·핀 B·지도이동·모바일 보존 캡처 추가. 공개 DB 읽기만, 가짜 공고 없음.
<details><summary>교체 전 HANDOFF</summary>
# CHATGPT_HANDOFF — 지도 요약 하단 결과 연결 데모 (2026-10-22)

## 1. 현재 상태
- 최신 Lee 수정: 반경 입력 단위 m(400 입력=400m, 기존100m~20km 범위·100m 간격 유지). 클릭 검색 결과는 지도 바로 아래·추천 영역 위로 이동. 이전 km 입력/추천 아래 배치는 폐기. 데모만, 기능 테스트 보류 유지.
- 추가 요청: PC Bán kính tìm kiếm 숫자 입력(km) 구현. 0.1~20km, Enter/입력칸 이탈 시 적용, 기존 슬라이더·빠른 버튼과 값 공유. 0.4km=400m. 모바일 별도 파일 변경 없음.
- Lee 첨부 직접 확인: 위 Việc làm nổi bật는 기존 추천 영역, 아래 Việc làm Sản xuất trong khung bản đồ가 요약 클릭 검색 결과. 현재 실제 공고2건이라 두 영역에 같은 공고가 보이는 구조. 이번 요청2는 설명만, 추천 영역 임의 삭제/중복 정책 변경하지 않음.
- 운영 master556f2c0: 업종 자동 분류까지 반영. 오른쪽 요약은 demo/map-summary / Draft PR197에만 있음. 승인 전 운영 병합 금지.
- 이번 Lee 지시: “일단 구현만, 테스트는 공고가 쌓이면”. 요약 업종 클릭→선택 표시→추천/향후 유료 노출과 분리된 하단 검색 결과→부드러운 스크롤. 지도 범위·반경·필터를 통과한 실제 공고만, 20개 페이지·선택 해제 구현. 기존 공고 카드 틀 재사용.
- DesktopHomeMapExplorer→HomeDesktop 결과 전달, MapSummaryResults 추가. 모바일 파일·DB·위치 판정·공개조건 변경 없음. DesktopHomeMapExplorer/HomeDesktop 기준 해시·날짜·이유 갱신.
- 유료 순위·결제·상품은 미구현, 상품 기준 미확정. 기존 추천 영역은 독립 유지. 결제했다고 범위 밖 공고를 검색 결과에 끼워 넣지 않음. urgent/featured를 유료 자격으로 쓰지 않음.
- 사용자 지시로 새 기능·대량 공고 테스트는 보류. 기본 tsc --noEmit/build 통과(이번 직접 실행). 이전 자동 검사39695252076은 기능 assertions 후 route.fulfill 종료 오류로 실패, 미해결. 테스트 완료로 보고 금지.
- demo 고정 주소: https://jobi-git-demo-map-summary-mshw1895-6089s-projects.vercel.app/ (기존 공유 링크 7일). 운영 미반영.

## 2. 다음 할 일 3개
1. 이번 데모 배포 READY 확인 후 같은 데모 링크로 Lee에게 구현만 보고. 실제 테스트 완료라고 하지 않음.
2. 공고가 쌓이면 실제 업종 혼합·지도 이동·반경·페이지·선택 해제 테스트와 이전 검사 종료 오류 처리. 미리 가짜 공고 공개 금지.
3. 유료 상품 기준 확정 시 추천 영역의 상품별 배치와 조건 안 검색 결과의 광고 우선순위·표시를 연결. 운영은 Lee 데모 승인 후 검사→병합→운영·실제 화면까지.

## 3. 필수 규칙
- AGENTS/CLAUDE 준수. 키·작업 파일 PC 저장 안내 금지. 운영 DB/Auth/RLS/secret·기준 공고 틀 보호.
- 정확 위치/공단·동 대표 위치 공유 유지. 대표 위치도 없으면 지도·요약 제외. STATUS 직접 수정 금지.
- 사용자 승인 전에 운영 미반영. 보고는 실제 데모 링크와 확인한 범위만, 테스트 보류 사실 명시.

</details>

## 2026-10-22 — m 입력·검색 결과 위쪽 이동
- Lee 지시: km 아닌 m 입력, 아래가 아닌 위쪽 결과 표시. SearchRadiusInput m↔내부km 변환, HomeDesktop 검색 결과를 지도 바로 아래·추천 위로 이동. 카드·모바일·DB 불변. 기준 해시·날짜/이유 갱신.
- 같은 데모 반영, 기능 테스트는 이전 지시에 따라 보류.

## 2026-10-22 — 반경 숫자 입력·상하 결과 구분
- 요청1: PC 반경 km 직접 입력. SearchRadiusInput 추가, 0.1~20km(기존 normalize), 비정상/빈칸 복원, Enter/blur 적용. 슬라이더·프리셋 외부 변경 동기화. DesktopHomeMapExplorer 기준 해시·날짜/이유 갱신.
- 요청2 첨부3장 직접 확인: 위 추천/아래 선택 업종 검색 결과. 같은2건 반복 노출 이유 설명. 해당 영역 배치·추천 정책은 변경하지 않음.
- 사용자 이전 지시에 따라 기능 테스트 보류. tsc --noEmit·build 통과(직접 실행). 데모만 반영.
<details><summary>교체 전 HANDOFF</summary>
# CHATGPT_HANDOFF — 지도 요약 하단 결과 연결 데모 (2026-10-22)

## 1. 현재 상태
- 운영 master556f2c0: 업종 자동 분류까지 반영. 오른쪽 요약은 demo/map-summary / Draft PR197에만 있음. 승인 전 운영 병합 금지.
- 이번 Lee 지시: “일단 구현만, 테스트는 공고가 쌓이면”. 요약 업종 클릭→선택 표시→추천/향후 유료 노출과 분리된 하단 검색 결과→부드러운 스크롤. 지도 범위·반경·필터를 통과한 실제 공고만, 20개 페이지·선택 해제 구현. 기존 공고 카드 틀 재사용.
- DesktopHomeMapExplorer→HomeDesktop 결과 전달, MapSummaryResults 추가. 모바일 파일·DB·위치 판정·공개조건 변경 없음. DesktopHomeMapExplorer/HomeDesktop 기준 해시·날짜·이유 갱신.
- 유료 순위·결제·상품은 미구현, 상품 기준 미확정. 기존 추천 영역은 독립 유지. 결제했다고 범위 밖 공고를 검색 결과에 끼워 넣지 않음. urgent/featured를 유료 자격으로 쓰지 않음.
- 사용자 지시로 새 기능·대량 공고 테스트는 보류. 기본 tsc --noEmit/build 통과(이번 직접 실행). 이전 자동 검사39695252076은 기능 assertions 후 route.fulfill 종료 오류로 실패, 미해결. 테스트 완료로 보고 금지.
- demo 고정 주소: https://jobi-git-demo-map-summary-mshw1895-6089s-projects.vercel.app/ (기존 공유 링크 7일). 운영 미반영.

## 2. 다음 할 일 3개
1. 이번 데모 배포 READY 확인 후 같은 데모 링크로 Lee에게 구현만 보고. 실제 테스트 완료라고 하지 않음.
2. 공고가 쌓이면 실제 업종 혼합·지도 이동·반경·페이지·선택 해제 테스트와 이전 검사 종료 오류 처리. 미리 가짜 공고 공개 금지.
3. 유료 상품 기준 확정 시 추천 영역의 상품별 배치와 조건 안 검색 결과의 광고 우선순위·표시를 연결. 운영은 Lee 데모 승인 후 검사→병합→운영·실제 화면까지.

## 3. 필수 규칙
- AGENTS/CLAUDE 준수. 키·작업 파일 PC 저장 안내 금지. 운영 DB/Auth/RLS/secret·기준 공고 틀 보호.
- 정확 위치/공단·동 대표 위치 공유 유지. 대표 위치도 없으면 지도·요약 제외. STATUS 직접 수정 금지.
- 사용자 승인 전에 운영 미반영. 보고는 실제 데모 링크와 확인한 범위만, 테스트 보류 사실 명시.

</details>

## 2026-10-22 — 요약 업종 클릭→독립 하단 검색 결과 구현
- Lee: “일단 구현만, 테스트는 공고가 쌓이면”. 기존 데모에 이어 구현, 운영 승인 아님. 신규 기능/대량 데이터 테스트 추가 실행하지 않음. 타입 tsc --noEmit·빌드 통과(직접 실행).
- DesktopHomeMapExplorer가 실제 visibleEntries·선택 category·선택 버전을 HomeDesktop에 전달. MapSummaryResults는 기존 추천/향후 유료 노출 영역과 독립된 검색 결과 영역. 선택 업종+지도 범위+반경+기존 필터 결과만, 20개 페이지·선택 해제·헤더 아래 스크롤/포커스 지원. 기존 카드 틀 재사용·모바일 파일 변경 없음.
- 유료 상품/결제/우선순위 저장 구조는 아직 없음. urgent/featured를 유료로 간주하지 않음. 실제 유료 랭킹/광고 표시는 상품 기준과 권한이 생긴 뒤 eligible 검색 결과에만 연결해야 함.
- 이전 요약 브라우저 run39695252076은 기능 assertions 통과 후 route.fulfill 이미 처리 오류로 종료 실패. 종료 처리 미해결, 이번 범위에서 추가 반복 수정하지 않음. 테스트 완료로 보고 금지.
<details><summary>교체 전 HANDOFF</summary>
# CHATGPT_HANDOFF — 지도 오른쪽 요약 데모 (2026-10-22)

## 1. 현재 상태
- master556f2c0: 업종 자동 분류 #194·검사 수정 #196 운영 반영. 운영 검증39691810986 성공, PC/모바일 실제 업종 공고2개 캡처 직접 확인(이번 대화 이전 작업).
- demo/map-summary: PC 지도 오른쪽 긴 공고 목록을 전체 건수·업종별 건수·급구 요약으로 변경. 기존 viewport+반경 결과를 중복 공고 없이 집계. 업종 클릭 필터·해제, 대표 위치 안내 포함.
- 정확한 좌표 우선→공단/지역 대표 위치→둘 다 없으면 지도/요약 제외. 대표 핀은 반경 밖에도 남고 요약은 반경 준수. 위치 판정·DB·공개조건 변경 없음.
- 모바일 기존 구성·핀 B 상세·공고 카드 유지. CSS module 추가, DesktopHomeMapExplorer 기준 해시/맨 위 날짜·이유 갱신.
- tsc/build·npm test70/70·desktop baseline8/8 통과. PR에 실제 공개 공고 기반 지도 이동/반경/업종/핀 상세/모바일 검사와 캡처 보존 추가, 결과 확인 필요.
- 운영 미반영: Lee는 데모만 요청. 데모 확인 승인 전 master 병합·Production 배포하지 않음.

## 2. 다음 할 일 3개
1. demo/map-summary Vercel READY·실제 데모 링크 확인, 지도 요약 브라우저 검사 및 캡처 직접 확인 후 Lee에게 제시.
2. Lee가 수정 요청하면 같은 데모에 반영. 가짜 공고/숫자를 공개하지 않음.
3. Lee가 승인하면 필수검사→병합→운영 READY/커밋 일치→실제 PC·모바일 확인까지 이어서 처리, 재승인 요구 금지.

## 3. 필수 규칙
- AGENTS/CLAUDE 준수, 승인 전 데모만. 운영 DB/Auth/RLS/secret·공개조건·기준 공고 틀 보호.
- 지도·메인/상세 위치 공유 유지. 공단 대표 위치는 현재 수준 허용, 대표 위치도 없으면 지도 미표시(Lee 이번 결정).
- STATUS 직접 수정 금지. 실제 앱 링크·직접 확인으로 보고, PR/SQL 검토를 Lee에게 떠넘기지 않음.

</details>

## 2026-10-22 — 지도 오른쪽 요약 데모
- 요청: 긴 공고 목록 대신 지도 범위·반경의 전체/업종/급구 요약, 지도 이동 시 갱신. 대표 위치 유지, 위치 없는 공고 지도·집계 제외.
- 변경: PC 오른쪽 기본 패널만 MapAreaSummary로 교체. 저장된 category로 업종 건수, 클릭 필터/해제. 핀 B 상세·모바일 기존 패널·공고 카드·위치 판정 유지. CSS module 사용, DesktopHomeMapExplorer 기준 해시/날짜·이유 갱신.
- 검증: 요약 없음 assertion 실패 확인 후 viewport/radius/no-point/중복/업종/급구 회귀 통과. tsc/build, npm test70/70, desktop baseline8/8 통과. 브라우저 실제 공개2건·반경/지도이동·클릭·모바일 검사는 PR Actions에 추가(결과 확인 필요).
- 배포: demo/map-summary 전용. 운영 병합/DB 변경 금지, 데모 링크로 Lee 확인 대기.
<details><summary>교체 전 HANDOFF</summary>
# CHATGPT_HANDOFF — 업종 자동 분류 운영 적용 (2026-10-22)

## 1. 현재 상태
- 기존 지도 #188~191·승인 후 운영 절차 #192~193 운영 반영. 재구현·재승인 금지.
- #194 병합322e1a3, Production READY와 www 도메인 SHA 일치 직접 조회. DB 자동 적용39691122833 성공, migration20261021224712·두 업종 트리거 활성 확인.
- 공식 occupation_code→앱13업종이 등록/수정 공통 DB에서 자동 지정. R8 코드 무효화 후 khac 재설정. 원문 근거·공개조건·RLS·secret 변경 없음. 기존 두 공개 공고의 저장업종과 함수 결과 모두 생산직 일치.
- 실제 운영 브라우저 /viec-lam/tim-kiem?cat=san_xuat_xay_dung에서 업종 선택·두 실제 공고 확인. STATUS 2026-10-22 06:06 VN: 공개2, tsc/test69/build 통과. 기존 규칙 시험 실패5건 별도 잔존.
- 운영 기본 PC/모바일 검사 성공. 추가 업종 캡처 검사39691122829는 메뉴 선택자 오류로 실패(이슈195): link가 아닌 button, hover 후 click 필요. #196은 검사만 바로잡음. 최종 PC·모바일 캡처 성공 여부는 최신 deploy-verify 조회 필요.

## 2. 다음 할 일 3개
1. #196 필수검사→병합→운영 업종 캡처 검사 성공 확인. UI·DB 기능 재구현하지 않음.
2. 최신 production-screen-proof에서 category-results-1366/390.png 직접 열어 확인 후 실제 운영 링크·화면으로 Lee에게 보고. 실패를 성공이라고 하지 않음.
3. 끝나면 이슈195를 실제 성공 실행 근거로 정리. 오래된 데모는 승인·master 포함 여부 대조 없이 일괄 병합 금지.

## 3. 필수 규칙
- AGENTS/CLAUDE 준수. 승인된 데모는 검사→병합→운영→실제 화면까지, 재승인 요구 금지.
- DDL은 구체 dry-run 승인 후 적용(#194 이번 SQL 승인 완료). 공식 코드/업무를 추정·세분화하지 않음. 연결표는 정부 업종표 아닌 앱 메뉴 규칙.
- STATUS 직접 수정 금지. 기존 공고 틀·공개조건·Auth/RLS/secret 보호, PC 저장 안내 금지. 기술 PR 검토를 Lee에게 떠넘기지 않음.

</details>

## 2026-10-22 — 업종 자동 분류 운영 적용과 실제 메뉴 점검
- #194 병합 322e1a3. 운영 DB 적용39691122833 성공, migration20261021224712 기록·두 트리거 활성·4824/4828 저장업종과 함수 결과 일치 직접 조회. www 도메인 READY 같은 SHA 확인.
- 실제 브라우저에서 생산직 검색 페이지의 선택된 업종·실제 공고 두 건 확인. STATUS 2026-10-22 06:06 VN 공개2건, tsc/test69/build 통과. 기존 규칙시험 실패5건은 이번 변경과 별개로 남음.
- 운영 기본 PC/모바일 화면 검사는 성공. 추가 업종 검사39691122829는 메뉴가 link라는 잘못된 선택자로 실패(이슈195). 실제 DOM은 hover 메뉴와 button. #196은 검사 선택자만 수정하고 이후 운영 검사에도 유지. 앱·DB 추가 변경 없음.
<details><summary>교체 전 HANDOFF</summary>
# CHATGPT_HANDOFF — 업종 자동 분류 적용 (2026-10-22)

## 1. 현재 상태
- 기존 지도 #190·#191과 승인 후 운영까지 절차 #192·#193 반영. 재구현하지 않음.
- feat/occupation-category-20261022: 공식 occupation_code→앱13업종 연결표/SQL 생성기/실제 PostgreSQL 회귀 시험 준비. 자동 지정은 DB에서 관리자·수집·직접등록 공통 강제.
- 두 트리거: 정책 판단 전 업종 지정, R8의 코드 무효화 후 khac 재설정. 원문 근거·공개조건·공식 코드·RLS·secret 변경 없음.
- 공식1505코드·신규/수정/덮어쓰기방지/근거소실/공개차단/메뉴조회·기존 공개조건 회귀 통과. npm test69/69, tsc/build 통과.
- 운영 읽기 dry-run: 4824(82022),4828(8) 현재/예정 모두 san_xuat_xay_dung. 바꿀 기존 분류0건.
- Lee가 2026-10-22 채팅으로 운영 DB 적용 승인. SQL을 migrations로, 점검SQL을 tests로 이동. PR194 검사→병합→자동 DB 적용→실제 업종 메뉴 확인 진행.

## 2. 다음 할 일 3개
1. 승인 완료. PR194 필수검사→병합→DB 자동 적용 확인.
2. 운영 점검 SQL 및 실제 저장 코드·업종 연결을 조회하고, 실제 사이트 업종 메뉴에서 공고 노출 확인.
3. Lee에게 PR/SQL 검토를 떠넘기지 않고 실제 사이트 링크·확인 화면으로 짧게 보고.

## 3. 필수 규칙
- AGENTS/CLAUDE 준수. DDL은 dry-run으로 보여주고 승인 후 적용, 승인 전 pending.
- 실제 업무/공식 직업코드를 임의로 변경·세분화하지 않음. 연결표는 정부 업종표가 아닌 기존 앱 메뉴용 규칙.
- STATUS 직접 수정 금지. 기존 공고 틀·공개조건·RLS·secret 보호, PC 저장 안내 금지.

</details>


## 2026-10-26 관리자 E2E 수정 전 인계 스냅샷
# CHATGPT_HANDOFF — 상세요강 하나의 흐름·검사표·저장 순간 신호 (2026-10-25)

## 1. 현재 상태 (master 790bfda 이후, 운영 반영·DB 적용 확인)
- 상세요강: 원문이 있는 공고는 **기계가 원문에서 다시 만든다**(src/lib/jobDescriptionBuild.ts, scripts/ocr/detail-fill.mjs). AI가 상세요강 글을 쓰거나 고치지 않는다 — 고쳐도 다음 실행에서 원문 기준으로 덮인다. 원래 글은 local_jobs_description_backup(reason=rebuild-from-source-20261025).
- 칸 못 정한 줄·복리후생: AI(scripts/ocr/ai-classify.mjs)가 정해진 칸 01~07·복리후생 번호표 중에서만 고르고, 안전장치(src/lib/aiClassifyGuard.ts)가 목록 밖·원문 밖·부정 문장을 버림. 정한 줄은 detail_line_kinds에 저장(Lee가 정한 칸은 AI가 못 바꿈).
- 위쪽 칸(급여 총액·나이·성별·근무시간 등)과 같은 내용은 상세요강에서 반복하지 않음. 급여 칸이 비면 원문 급여를 글자 그대로 채움(src/lib/sourceSalary.ts). "Nhà máy Quế Võ III"처럼 공단 표 이름과 같은 공장 이름은 그 공단.
- 공고 검사표(src/lib/jobInspect.ts, scripts/ops/job-inspect.mjs): 11항목, 이슈 "공고 검사표"에 결과 + **연속 통과 N/10**(현재 4/10). 10/10이 크롤링 시작 조건(Lee 결정).
- 실행 시점: **공고 저장 순간 DB가 GitHub 작업을 시작**(migration 20261025160000, Vault github_dispatch_token, pg_cron 1분). GitHub 예약 실행은 실제로 몇 시간에 한 번만 돌아 믿지 않는다. 하루 1번(05:10) 안전망.
- 수집 자동 멈춤(20261025120000): 같은 소스·같은 원인 3건 연속 실패 → 그 소스만 DB가 저장 거부 → crawl-guard.yml 알림·자동 수리(최대 2번)·자동 재개. 크롤링은 아직 꺼져 있음(실제 끝까지 동작은 크롤링 재개 때 확인).
- 배포: GitHub Actions에서 빌드 → Vercel에 결과만 올림(vercel-deploy.yml, Secrets VERCEL_TOKEN). Vercel 자동 배포 꺼짐. **무료 한도 하루 100번** — 앱 파일(src·api·public·설정)이 바뀐 커밋만 배포, 한도 실패분은 2시간마다 따라잡기.
- 검사 규칙: migration은 결정 0002대로 삭제·되돌리기 어려운 것만 막음(scripts/check-repository-policy.mjs).

## 2. 다음 할 일 3개
1. Lee가 새 공고를 하나씩 올림 → 검사표 ❌ 항목이 나오면 원인 고치고 **그 공고를 실제 사례 시험으로 추가**(jobDescriptionBuild.fixtures.ts / jobInspect.test.ts 등). 연속 10개 통과까지.
2. 관리자 페이지 "고르기" 대기 목록: detail_line_kinds·검사표 ❌를 Lee가 클릭으로 정함(decided_by='lee'). 직접 입력 방식 금지.
3. 정리 완료(2026-10-25): 해결된 운영 배포 실패 이슈 17건 닫음, AGENTS.md·CLAUDE.md·.cursor/rules의 위치/길찾기 옛 규칙을 최신 2026-10-13 핀 무조건·2026-10-14 위치 순서표에 맞춤. 데모는 REST 별칭 API로 연결했고 모든 demo/**에 공통 주소 `jobi-demo-mshw1895-6089s-projects.vercel.app`를 사용하도록 #252 반영(공통 주소 실배포 갱신 검증은 무료 한도 해제 후 실제 데모 배포 때). 관리자 시험 계정 비밀값은 Lee 등록 대기.

## 3. 필수 규칙
- AI가 상세요강·원문 글자를 고쳐 쓰지 않는다. 새 문제는 규칙·번호표·시험으로 고친다(공고 하나만 손으로 고치지 않는다).
- 완료 보고 = 운영 반영 + 실제 조회 근거([직접 확인]/[기존 기록]/[추정]). 실행 안 한 것을 했다고 쓰지 않는다. Claude가 원본(DB·GitHub 실행 결과)으로 검증한다.
- 배포 한도 아끼기: 작은 변경은 모아서 한 번에. 운영 DB·Auth·RLS·Secrets·STATUS 보호, 가짜 공고 금지, 회사 PC 저장 안내·현장 방문 제안 금지.


## 2026-10-26 원문 근거 보완 전 인계 스냅샷
# CHATGPT_HANDOFF — 관리자 E2E 복구 (2026-10-26)

## 1. 현재 상태 (코드·배포·DB)
- 기준: master 8f355da, 작업 fix/admin-e2e-generated-ids-20261026. pg 개발 의존성과 잠금 갱신, 두 시험의 수동 공고 ID 제거. SQL RETURNING / REST select로 생성 ID를 받아 삭제까지 사용.
- 공개 전용 위치 대기 목록에는 비공개 시험 공고를 넣지 않음. 4824·4828·4879·4878 실제 DOM 확인 후 비공개 후보를 로그인한 관리자 JWT로 준비하고 화면에서 승인 클릭·자동 재사용·정리 검증.
- 좌표 기억 삭제는 기존 DB secret 사용(서비스 역할 DELETE 권한 없음). 필수 비밀값 누락은 실패. pg만 추가된 경우 Vercel 배포 제외, 기존 빌드/운영 의존성 변경은 배포 판정 유지.
- [직접 확인] 로컬 tsc·build 성공, npm test 78/78 파일, 배포 판정 회귀 2개 성공. GitHub push 가능; CLI API 인증은 실패하여 연결된 GitHub 도구 사용.
- PR 검사·봇 병합·실제 관리자 E2E 결과는 아직 미확인. 이번 작업은 Vercel 배포 금지, 운영 DB 스키마/권한 변경 없음.

## 2. 다음 할 일 3개
1. Draft PR의 최종 SHA 필수 검사 성공을 확인한 뒤 근거를 기록하고 Ready 전환, 봇 병합 확인.
2. 병합 후 두 실제 E2E의 로그인·클릭·승인·재사용·정리 로그와 실패/건너뜀 단계를 전부 확인.
3. Vị trí 목록 네 ID 노출을 실제 로그로 확인하여 직접 확인/추정을 구분해 보고. 크롤링 재개는 기존 Lee 결정 유지.

## 3. 필수 규칙
- 시험 공고는 active=false, admin_hidden=true 유지. 공개 공고 좌표를 시험으로 승인하지 않음. Secret 출력·저장 금지.
- 사용자 지시대로 코드 실수는 직접 수정하며 권한·외부 서비스·Lee 결정 필요 시만 중단. 이번 작업 Vercel 배포 금지.
- PR → 필수 검사 → 봇 병합. 실제 통과와 workflow 성공을 구분하고 미실행·건너뜀을 통과로 보고하지 않음. STATUS 보호, 승인 공고 틀 보존.


## 2026-10-26 R7 운영 API 수정안 전 인계 스냅샷
# CHATGPT_HANDOFF — 관리자 E2E 복구 (2026-10-26)

## 1. 현재 상태 (코드·배포·DB)
- 기준: master 122a12b(PR #267 봇 병합), 작업 fix/admin-e2e-source-evidence-20261026. pg 개발 의존성과 잠금 갱신, 두 시험의 수동 공고 ID 제거. SQL RETURNING / REST select로 생성 ID를 받아 삭제까지 사용.
- 공개 전용 위치 대기 목록에는 비공개 시험 공고를 넣지 않음. 4824·4828·4879·4878 실제 DOM 확인 후 비공개 후보를 로그인한 관리자 JWT로 준비하고 화면에서 승인 클릭·자동 재사용·정리 검증.
- 좌표 기억 삭제는 기존 DB secret 사용. 실 DB 권한 조회에서 서비스 역할 DELETE 허용 확인(마이그레이션 파일만 보고 권한 없다고 추정했던 이전 설명을 정정). 필수 비밀값 누락은 실패. pg만 추가된 경우 Vercel 배포 제외, 기존 빌드/운영 의존성 변경은 배포 판정 유지.
- [직접 확인] 로컬 tsc·build 성공, npm test 78/78 파일, 배포 판정 회귀 2개 성공. GitHub push 가능; CLI API 인증은 실패하여 연결된 GitHub 도구 사용.
- PR #267 CI 성공·봇 병합 확인. 실제 E2E 40244312182(위치)·40244310661(줄 선택)은 R3 원문/출처 없는 시험 데이터로 실패. 두 fixture에 회사명 포함 원문·시험 코드 출처를 추가해 보완 중. Vercel run 40244309060 성공이지만 실제 업로드 단계 skipped(배포 없음). 이번 작업은 Vercel 배포 금지, 운영 DB 스키마/권한 변경 없음.

## 2. 다음 할 일 3개
1. Draft PR의 최종 SHA 필수 검사 성공을 확인한 뒤 근거를 기록하고 Ready 전환, 봇 병합 확인.
2. 병합 후 두 실제 E2E의 로그인·클릭·승인·재사용·정리 로그와 실패/건너뜀 단계를 전부 확인.
3. Vị trí 목록 네 ID 노출을 실제 로그로 확인하여 직접 확인/추정을 구분해 보고. 크롤링 재개는 기존 Lee 결정 유지.

## 3. 필수 규칙
- 시험 공고는 active=false, admin_hidden=true 유지. 공개 공고 좌표를 시험으로 승인하지 않음. Secret 출력·저장 금지.
- 사용자 지시대로 코드 실수는 직접 수정하며 권한·외부 서비스·Lee 결정 필요 시만 중단. 이번 작업 Vercel 배포 금지.
- PR → 필수 검사 → 봇 병합. 실제 통과와 workflow 성공을 구분하고 미실행·건너뜀을 통과로 보고하지 않음. STATUS 보호, 승인 공고 틀 보존.


## 2026-10-26 관리자 URL 탭 수정 전 인계 스냅샷
# CHATGPT_HANDOFF — 관리자 E2E / R7 최소 수정안 (2026-10-26)

## 1. 현재 상태 (코드·배포·DB)
- master 436957e: PR #267·#268 모두 github-actions[bot] 병합. pg devDependency·lock, DB 생성 ID 사용, 원문·출처가 있는 비공개 fixture, 정리 검증 반영. Vercel run 40244309060·40244890104의 업로드 단계 skipped: 배포 안 함.
- [직접 확인] 위치 E2E 40244894578: 로그인·후보 실제 승인 클릭·두 공고 좌표/자동 재사용·기억/후보/공고 삭제 모두 PASS. job 121324274333 전 단계 success, 실패·skipped 없음. Vị trí 실제 DOM 4824·4828·4879·4878 각각 PASS 로그 확인.
- [직접 확인] 줄 선택 E2E 40244892760: 로그인·시험 줄 #4950 표시 성공, 저장 뒤 줄 미제거 timeout 실패. 정리 PASS, setup-node 후처리 skipped. 운영 API가 선택 저장 뒤 service_role로 ocr_check를 수정하여 R7에 걸리는 원인 실 DB rollback 시험으로 확인.
- 작업 fix/admin-line-pick-r7-signal-20261026: API의 section 선택 경로에서 불필요한 OCR 수정 제거, 기존 job_signal_queue 예약 유지. DB 규칙·권한·OCR 보호 유지. 회귀 시험은 수정 전 500 실패 → 수정 후 성공, 관리자 외 접근 거부 포함.
- 이 수정은 운영 API 변경: 사용자의 시험 코드만 변경/배포 없음 조건과 달라 Draft에서 검토. Lee의 배포 예외 결정 전 병합·배포 금지. 실제 줄 선택 최종 통과는 아직 아님.

## 2. 다음 할 일 3개
1. R7 API 수정안의 필수 CI·리뷰를 확인해 구체적 Draft PR 제시, 운영 API 배포 1회 예외에 대한 Lee 결정 받기.
2. 허용되면 PR 검사→봇 병합→운영 API 반영 후 줄 선택 실제 E2E 재실행. 로그인·선택 저장·원문 상세 재생성·정리 모두 확인할 때까지 수정.
3. 실제 통과와 워크플로 성공, 실패/건너뜀 단계를 구분해 최종 보고. 위치 시험·네 ID 노출은 이미 위 실행에서 직접 확인(근거 없이 반복하지 않음).

## 3. 필수 규칙
- 시험 공고 active=false, admin_hidden=true 유지. 공개 공고를 시험 승인하지 않음. Secret 출력·저장 금지. STATUS·운영 DB/권한·승인 화면 틀 보호.
- 코드 실수는 직접 수정, 권한·외부 서비스·Lee 결정이 필요할 때만 중단. 현재 배포 예외는 Lee 결정 필요.
- PR → 필수 검사 → 봇 병합. 미실행·skipped·실패를 통과로 보고하지 않음. R7을 완화하거나 service_role OCR 쓰기를 허용하지 않음.


## 2026-10-26 위치 검사 승인 좌표 누락 보완 전 스냅샷
# CHATGPT_HANDOFF — 관리자 URL 탭·확정 후 스크롤 유지 (2026-10-26)

## 1. 현재 상태 (코드·배포·DB)
- 기준 master 6840b46: #269 봇 병합·운영 배포 dpl_GSKFrFq6JHi6YJymG5Hpho5TSS6b READY, 운영 도메인 SHA 일치. 줄 선택 E2E 40245878808 attempt2 실제 로그인·section02/decided_by=lee·원문 상세 재생성·정리 PASS, 실패/skipped 없음.
- 작업 fix/admin-tab-scroll-20261026: AdminDashboard 탭을 URL searchParams에서 읽고 탭 변경마다 history push, 같은 탭은 중복 기록 안 함. 다른 쿼리는 보존하고 잘못된 tab은 dashboard로 처리.
- 위치 대기/후보 목록은 응답 직전 현재 스크롤을 기억해 목록 렌더 직후 복원. 스타일·장식·테두리 변경 없음. Google/근거/공고 상세 링크는 기존 target=_blank 유지 확인.
- 새 관리자 브라우저 회귀(PC1366·모바일390): 실제 앱 + 브라우저 내부 인증/API fixture(운영 DB 쓰기 없음). URL·reload·back/forward·Google popup·공고 링크·앞쪽 동일주소 자동재사용 삭제 후 스크롤 유지 검사. app-screen 필수 CI에 추가.
- 실제 관리자 위치 E2E에도 reload·history·Google popup·승인 후 탭/스크롤 검사 추가. 공개 시험 공고를 만들거나 운영 공개 좌표를 시험 승인하지 않음.
- [직접 확인] 수정 전 tab=locations에서 Dashboard, 동시 자동재사용 카드 삭제 시 스크롤2400→1949 재현. 수정 후 개발 브라우저 PC·모바일, 타입·빌드·npm test79/79 성공. 별도 리뷰 차단 문제 없음. PR CI/봇 병합/이번 운영 배포/실제 E2E는 아직 대기.

## 2. 다음 할 일 3개
1. 최종 빌드 브라우저·PR CI 성공 근거로 Ready 전환, 봇 병합 확인.
2. 이번 작업 운영 배포 1회 후 운영 도메인 새 SHA/READY와 실제 관리자 탭·스크롤 E2E 확인. 배포 전 자동시험은 구분해 필요시 시험만 재실행.
3. 실제 확인과 추정, 워크플로 성공과 실제 시험 통과 및 실패/skipped 단계를 구분해 보고.

## 3. 필수 규칙
- Lee 요청: URL 탭/뒤로가기, 확정 후 스크롤·탭 유지, 관리자 외부/공고 링크 새 탭. 새 장식·둥근 테두리 금지. 운영 배포 1회 허용.
- DB/Auth/RLS/Secrets/STATUS·승인 공고 틀 보호. 시험은 비공개·생성 ID로 정리. Secret 출력·저장 금지.
- PR→검사→봇 병합→배포→실제 확인. 미실행/skipped/실패를 통과로 보고하지 않음.


## 2026-10-26 실제 관리자 응답 수명 시험 보완 전 스냅샷
# CHATGPT_HANDOFF — 관리자 URL 탭·확정 후 스크롤 유지 (2026-10-26)

## 1. 현재 상태 (코드·배포·DB)
- 기준 master 6840b46: #269 봇 병합·운영 배포 dpl_GSKFrFq6JHi6YJymG5Hpho5TSS6b READY, 운영 도메인 SHA 일치. 줄 선택 E2E 40245878808 attempt2 실제 로그인·section02/decided_by=lee·원문 상세 재생성·정리 PASS, 실패/skipped 없음.
- 작업 fix/admin-tab-scroll-20261026: AdminDashboard 탭을 URL searchParams에서 읽고 탭 변경마다 history push, 같은 탭은 중복 기록 안 함. 다른 쿼리는 보존하고 잘못된 tab은 dashboard로 처리.
- 위치 대기/후보 목록은 응답 직전 현재 스크롤을 기억해 목록 렌더 직후 복원. 스타일·장식·테두리 변경 없음. Google/근거/공고 상세 링크는 기존 target=_blank 유지 확인.
- PR #270 첫 CI: 새 관리자 회귀 성공, 기존 공고 위치 검사는 #4824의 승인 좌표(candidate45)를 읽지 않아 오판. ground truth에 현재 회사/주소·승인 상태·정밀도·유효 좌표를 모두 확인해 포함, 오류는 건너뛰지 않고 실패. selftest 수정 전 실패→수정 후 성공. 실제 E2E 네 공고 고정 대기 가정도 현재 서버 목록과 DOM 일치 검사로 보완(확정된 #4824를 되돌리지 않음). 운영 DB/좌표/공개 화면 코드 변경 없음.
- 새 관리자 브라우저 회귀(PC1366·모바일390): 실제 앱 + 브라우저 내부 인증/API fixture(운영 DB 쓰기 없음). URL·reload·back/forward·Google popup·공고 링크·앞쪽 동일주소 자동재사용 삭제 후 스크롤 유지 검사. app-screen 필수 CI에 추가.
- 실제 관리자 위치 E2E에도 reload·history·Google popup·승인 후 탭/스크롤 검사 추가. 공개 시험 공고를 만들거나 운영 공개 좌표를 시험 승인하지 않음.
- [직접 확인] 수정 전 tab=locations에서 Dashboard, 동시 자동재사용 카드 삭제 시 스크롤2400→1949 재현. 수정 후 개발 브라우저 PC·모바일, 타입·빌드·npm test79/79 성공. 별도 리뷰 차단 문제 없음. PR #270 보완 CI/봇 병합/이번 운영 배포/실제 E2E는 아직 대기.

## 2. 다음 할 일 3개
1. 최종 빌드 브라우저·PR CI 성공 근거로 Ready 전환, 봇 병합 확인.
2. 이번 작업 운영 배포 1회 후 운영 도메인 새 SHA/READY와 실제 관리자 탭·스크롤 E2E 확인. 배포 전 자동시험은 구분해 필요시 시험만 재실행.
3. 실제 확인과 추정, 워크플로 성공과 실제 시험 통과 및 실패/skipped 단계를 구분해 보고.

## 3. 필수 규칙
- Lee 요청: URL 탭/뒤로가기, 확정 후 스크롤·탭 유지, 관리자 외부/공고 링크 새 탭. 새 장식·둥근 테두리 금지. 운영 배포 1회 허용.
- DB/Auth/RLS/Secrets/STATUS·승인 공고 틀 보호. 시험은 비공개·생성 ID로 정리. Secret 출력·저장 금지.
- PR→검사→봇 병합→배포→실제 확인. 미실행/skipped/실패를 통과로 보고하지 않음.


## 2026-10-26 PC 헤더 작업 전 스냅샷

# CHATGPT_HANDOFF — 관리자 URL 탭 운영 반영·E2E 보완 (2026-10-26)

## 1. 현재 상태 (코드·배포·DB)
- #270 검사 성공·github-actions[bot] 병합, 운영 e60c5a7. Vercel dpl_BAto9DTNaUgkCPwBynwr7oEB7zuk READY, 운영 도메인 SHA 일치. 이번 작업 실제 운영 배포 1개 확인. 스타일·장식·테두리 변경 없음.
- 관리자 탭은 /admin?tab=locations 등 URL/history로 관리. 확정 목록 렌더 후 스크롤 복원. PC1366·모바일390 실제 빌드 브라우저 회귀 및 필수 CI 성공.
- 기존 공통 위치 시험은 별도 관리자 승인 좌표를 읽지 않아 #4824 오판. 시험 oracle에 현재 회사/주소·승인 상태·정밀도·유효 좌표를 포함했고 취소/불일치/area/null은 거부. 공개 화면·운영 승인 데이터는 변경하지 않음.13개 구조 사례+승인 유효성 시험 성공.
- 실제 위치 E2E 40249186543: attempt1은 배포 전 화면에서 URL tab 없음으로 실패, 정리 성공. attempt2는 새 화면 로그인·현재 대기/DOM 일치까지 성공한 뒤 새로고침으로 과거 로그인 응답 본문이 폐기되어 response.json Protocol error. 시험 행 정리 성공. 제품 동작 실패와 구분.
- 작업 fix/admin-navigation-e2e-login-response-20261026: 로그인 응답을 새로고침 전 즉시 읽도록 시험 코드만 이동. 운영 파일 변경 없음, 추가 실제 배포 불필요. 후속 PR 검사/봇 병합/실제 E2E 대기.

## 2. 다음 할 일 3개
1. 시험 응답 수명 수정 PR 검사→봇 병합. 운영 코드 차이 없음 확인하여 Vercel 업로드 생략 확인(이번 실제 배포 1회 유지).
2. 실제 관리자 E2E에서 URL/reload/back/forward/Google 새 탭 복귀/승인 후 스크롤·탭/재사용/정리를 모두 확인. 코드 실수는 직접 수정.
3. 운영 화면 검사 결과와 실제 E2E 결과, 실패·건너뜀을 구분해 보고. 추정으로 통과 처리 금지.

## 3. 필수 규칙
- Lee 요청: URL 탭/뒤로가기, 확정 후 스크롤·탭 유지, 외부/공고 링크 새 탭. 새 장식·둥근 테두리 금지. 운영 배포 1회(현재 완료).
- DB/Auth/RLS/Secrets/STATUS·승인 공고 틀 보호. 시험 공고 비공개·생성 ID로 정리. Secret 출력·저장 금지.
- PR→검사→봇 병합. 시험만 고치면 추가 운영 업로드 하지 않음. 워크플로 성공과 실제 사용자 동작 통과를 구분.


## 2026-10-26 위치 원본 단일화 검토 전 스냅샷

# CHATGPT_HANDOFF — PC 헤더·기업 메뉴 (2026-10-26)

## 1. 현재 상태 (코드·배포·DB)
- 작업 branch fix/desktop-header-employer-menu-20261026, base9ecfbc5. Lee가 PC 헤더 정리와 운영 배포 1회 승인. 모바일 헤더 소스·기존 버튼 색/크기/모서리 불변.
- 비로그인 로그인/가입 통합, 별도 Zalo/가입 제거. 기업 화살표는 기존 메가메뉴 스타일4링크, 바깥클릭/Esc 닫힘. 기업 대시보드 URL 탭과 로그인 복귀 query 보존. PC Login Zalo를 맨 위로 이동, 모바일 기존 위치/문구 유지, env 조건 동일.
- 실제 Chromium PC1440 세 상태(비로그인/구직자/기업)의 격리 auth/API fixture로 메뉴·탭·로그인 복귀 통과, 모바일390 헤더/로그인 유지 통과. 실제 계정 비밀번호 인증과 구분. Zalo 설정 유무는 dev/build로 검사.
- npm test79/79, tsc/build 성공. 공개 데이터·DB·권한·인증 체계 변경 없음. 코드 리뷰 중요 문제 없음.
- 로컬 환경 outbound 정책이 운영 도메인을 403 차단. 우회하지 않고 기존 GitHub 운영검사 runner에서 실제 운영 비로그인·모바일 및 격리 로그인 상태 캡처를 수행하도록 연결. 캡처는 desktop-header-production artifact에 보존, 추가 배포 아님. 보호된 deploy-verify 수정은 CI가 차단하여 원복했고, 별도 읽기전용 desktop-header-proof가 기존 Vercel 성공 후 실행되도록 분리. 배포 workflow·가드 변경 없음.
- 운영은 아직 이전 e60c5a7(dpl_BAto9DTNaUgkCPwBynwr7oEB7zuk) READY. 이전 관리자 실제 E2E40250098819 성공·데이터0; 이전 공통 운영검사40249275779 KDA 마커 선택 실패는 별개 미해결.

## 2. 다음 할 일 3개
1. 최종 빌드 브라우저검사→PR 필수검사→Ready→봇 병합.
2. 이번 실제 운영 배포 정확히1회와 Production READY·도메인SHA 일치 확인.
3. 운영 비로그인 실제 화면 및 격리 로그인 상태 캡처·메뉴동작 확인. 공통 운영검사 실패/건너뜀 있으면 구분 보고.

## 3. 필수 규칙
- PC만 화면 변경. 새장식/아이콘/둥근테두리 금지. 로그인 알림·이름·로그아웃 불변.
- DB/Auth/RLS/Secrets/STATUS·승인 공고틀 보호. Secret 출력·저장 금지.
- PR→검사→봇 병합→운영 배포1회. 직접확인/추정, 워크플로/실제시험 구분. 최종 보고는 운영링크와 캡처결과만.


## 2026-10-27 위치 단일 원본 실행 전 이전 인계

# CHATGPT_HANDOFF — 위치 원본 단일화 STRICT dry-run (2026-10-26)

## 1. 현재 상태 (코드·배포·DB)
- Lee 요청6번에 따라 지금은 dry-run SQL/핵심 구조 검토 단계. branch design/location-single-source-20261026, base master6affdc2. 운영 DDL/DML·PR·병합·배포는 하지 않음.
- 읽기 전용 운영 조회: 승인/기억 candidate45는 4824 확정21.1959873,106.0087454(10-25 23:52 UTC), 근무지1116 좌표NULL, map_r1 옛area21.1965731,105.9932563. 공고번호조건없는 회사/주소 전수preflight에서도4824가 이관대상으로선택됨. 다른공개공고에도캐시만좌표/근무지행없음이있음.
- 원인확인: 승인/기억만쓰는관리자경로, 후보/캐시만쓰는자동완료경로, 별도수집/작성자핀직접쓰기. 프런트도후보덧씌우기/코드공단좌표/캐시별도선택을함.
- 검토안 docs/plans/2026-10-26-location-single-source.md. SQL초안+읽기전용preflight+생성ID시험은 supabase/pending/location-single-source-20261026/.
- 핵심SQL은 private NOLOGIN역할의 단일writer, 직접쓰기트리거, 기억팬아웃, 원본→전체캐시점집합, 정방향/역방향불일치감시. 격리PostgreSQL17에서 검증성공. 운영DB이름가드로실행금지. 운영전체스키마/RPC/RLS/PostGIS/큐를복제한최종이관본은아님.
- 시험: 확인/동일회사주소재사용/다른회사와성조차이거부/원본행생성/원본누락감시/관리자확정우선/직접쓰기고유오류/가짜GUC거부/오래된자동응답·작성자핀차단/취소연쇄/다중근무지/동일확정revision유지/무효확정역방향감시 통과. SQL초안의다른DB실행거부도통과. 리뷰중요지적보완완료.
- AGENTS/CLAUDE에Lee규칙기록, DB규칙표4행은미적용SQL로준비. 문서추가만으로DB강제가적용됐다고주장하지않음.
- 별개PC헤더A안데모bb97b9e는demo브랜치에만보존. 이작업에합치지않음.

## 2. 다음 할 일 3개
1. Lee에게SQL/구조안과격리검증결과보고→요청한STRICT확인대기. 운영4824아직미변경을명시.
2. 확인후호환RPC·기존RLS최소권한·읽기원본전환·기존20시감시·번호비의존전수/E2E·일반이관SQL을완성. 운영실행본으로승격전에전체통합/동시성/권한/소급이관검증.
3. 승인범위운영DB적용후PR→검사→봇병합→운영배포1회→deploy-verify실제통과/실패·건너뜀확인. 공통틀만으로4824가확정좌표가됐는지사후조회.

## 3. 필수 규칙
- 원본job_work_locations1곳·쓰기함수1개·캐시자동파생. 4824개별UPDATE금지. 회사/주소/승인유효성·정밀도/다중근무지보존.
- 운영위치시험은공고번호·회사명·고정건수의존금지. 메인/상세/원본점집합·정밀도독립대조.
- DBSTRICT: dry-run먼저Lee확인후적용. 기존R7/R8·공개범위·Secrets·STATUS보호. 직접확인/추정, 핵심시험/전체운영통과구분.


## 2026-10-27 정상 이관 경로 전환 전 인계

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


## 정상 이관 경로 준비 PR #276 병합 기록


## 2026-10-27 exact migration approval bridge: previous handoff archive

# CHATGPT_HANDOFF — PC 헤더·기업 메뉴 (2026-10-26)

## 1. 현재 상태 (코드·배포·DB)
- 작업 branch fix/desktop-header-employer-menu-20261026, base9ecfbc5. Lee가 PC 헤더 정리와 운영 배포 1회 승인. 모바일 헤더 소스·기존 버튼 색/크기/모서리 불변.
- 비로그인 로그인/가입 통합, 별도 Zalo/가입 제거. 기업 화살표는 기존 메가메뉴 스타일4링크, 바깥클릭/Esc 닫힘. 기업 대시보드 URL 탭과 로그인 복귀 query 보존. PC Login Zalo를 맨 위로 이동, 모바일 기존 위치/문구 유지, env 조건 동일.
- 실제 Chromium PC1440 세 상태(비로그인/구직자/기업)의 격리 auth/API fixture로 메뉴·탭·로그인 복귀 통과, 모바일390 헤더/로그인 유지 통과. 실제 계정 비밀번호 인증과 구분. Zalo 설정 유무는 dev/build로 검사.
- npm test79/79, tsc/build 성공. 공개 데이터·DB·권한·인증 체계 변경 없음. 코드 리뷰 중요 문제 없음.
- 로컬 환경 outbound 정책이 운영 도메인을 403 차단. 우회하지 않고 기존 GitHub 운영검사 runner에서 실제 운영 비로그인·모바일 및 격리 로그인 상태 캡처를 수행하도록 연결. 캡처는 desktop-header-production artifact에 보존, 추가 배포 아님. 보호된 deploy-verify 수정은 CI가 차단하여 원복했고, 별도 읽기전용 desktop-header-proof가 기존 Vercel 성공 후 실행되도록 분리. 배포 workflow·가드 변경 없음.
- 운영은 아직 이전 e60c5a7(dpl_BAto9DTNaUgkCPwBynwr7oEB7zuk) READY. 이전 관리자 실제 E2E40250098819 성공·데이터0; 이전 공통 운영검사40249275779 KDA 마커 선택 실패는 별개 미해결.

## 2. 다음 할 일 3개
1. 최종 빌드 브라우저검사→PR 필수검사→Ready→봇 병합.
2. 이번 실제 운영 배포 정확히1회와 Production READY·도메인SHA 일치 확인.
3. 운영 비로그인 실제 화면 및 격리 로그인 상태 캡처·메뉴동작 확인. 공통 운영검사 실패/건너뜀 있으면 구분 보고.

## 3. 필수 규칙
- PC만 화면 변경. 새장식/아이콘/둥근테두리 금지. 로그인 알림·이름·로그아웃 불변.
- DB/Auth/RLS/Secrets/STATUS·승인 공고틀 보호. Secret 출력·저장 금지.
- PR→검사→봇 병합→운영 배포1회. 직접확인/추정, 워크플로/실제시험 구분. 최종 보고는 운영링크와 캡처결과만.


## 2026-10-27 PR277 CI 보완 전 인계

# CHATGPT_HANDOFF — 위치 단일 원본 정상 이관 경로 (2026-10-27)

## 1. 현재 상태 (코드·배포·DB)
- Lee 설계·실행 승인 유효. 추가 지시: Codex/Supabase 도구의 운영 직접 접근은 읽기 포함 영구 금지. 정상 PR→검사→봇→migrations-apply→실제 배포1회만. migrations-apply 실패 시 원문 오류 보고 후 중단.
- 운영 DB 변경 없음. 이전 직접 apply_migration 요청은 cancelled, 이관·새 스키마 미생성을 당시 조회로 확인. 이후 운영 직접 접근하지 않음. 직접 접근 재시도 금지.
- 실제 CLI 생성 이관: supabase/migrations/20261026231445_location_single_source.sql. psql-1로 파일전체1트랜잭션. 원문 SHA256 2e8928cbcf97919ec1ac37a1df0300379e6267fce8cf98597de6de9dda108aaa. 검토본과 본문 동일, wrapper외 TRUNCATE권한도 회수. 공고번호조건 없음. 원본/캐시/제거행은 비공개 이력 보존.
- supabase/tests/location_single_source_production_check.sql: 기억/원본/캐시 불일치0·권한·트리거·RLS 검증, 전체 공개 좌표 읽기 증거. migrations-apply에서 이 점검만 집계/공개좌표 stdout 보존.
- 실제 migration파일을 NOSUPERUSER PostGIS에서 적용해3가지 rollback·권한/취소/주소/재사용·5동시실행 통과, 최종사후검사5항목0. tsc/build, npm81/81 통과. HEAD 격리 PC/모바일0·1·여러위치6경우브라우저 통과.
- 전환전PR화면은 BASE의 기존 실공개화면검사와 HEAD의 신규 격리화면검사를 명시적으로구분. 새 HEAD운영전수확인은 DB적용/배포후deploy-verify 실제소스검사만으로 판단. 기존 production검사완화/생략아님.
- 준비PR #276 봇 병합 완료(2ab3f8f): 기존파괴문구차단의 정확한승인파일경로+SHA1개만 trusted-base로확인. SQL·앱없음. 검사후봇병합. 기존배포비교로실제업로드제외확인필요. 앱+DB이관은 같은다음PR로제출. 미승인헤더A데모제외.

## 2. 다음 할 일 3개
1. #276 필수검사확인→Ready→봇병합; master새guard를현재branch에반영하고 앱+DB SQL·사후점검 같은PR 생성.
2. 그PR필수검사→봇병합→migrations-apply 실제실행확인. 실패하면원문그대로보고하고멈춤. 직접SQL/자동재시도금지.
3. 성공후실제운영배포1회→deploy-verify/관리자E2E확인. 정상워크플로의읽기증거로4824원본·캐시좌표, 메인/상세확인. 실패/필수단계건너뜀과조건부정상생략구분. 아직운영완료아님.

## 3. 필수 규칙
- 직접운영DB접근금지. 명시한정상경로만. 사용자에게설계재승인요청금지.
- 번호별보정금지·job_work_locations원본1곳·writer1개·캐시파생. 정밀도·근거·다중근무지 보존.
- 직접확인/추정, 로컬합성/실제운영, 워크플로성공/시험실제통과구분. Secrets·STATUS·R7/R8·공개범위·화면틀보존.
