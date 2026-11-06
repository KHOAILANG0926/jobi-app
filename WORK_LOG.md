## 2026-11-06 23:20 — 중복 2단계: 회사·지점 분리, 업종 맞음 규칙, 회사 코드표 변경안 (Claude)
- 요청: Lee "회사는 따로, 지점은 따로", "보류는 해결될 때까지 놔둬", "진행하자".
- 1단계 결과 [직접 확인 dup-count run 42245834965]: 공개 19건 중복 0, 회사만 같은 쌍 0(19건 모두 다른 회사). 허점 3개 발견: 지점명이 회사에 붙음(Highlands Mường Thanh), 동 이름 안 빠짐(Regal Edu Vân Dương), 업종 흔들림(Trung Nguyên Legend).
- 변경: src/lib/jobIdentity.ts companyCore → {core, kind, branch}(구분자·이름 뒤 가게 종류 낱말 뒤·끝에 붙은 성·군·동(옛 이름 포함)은 지점), kindsCompatible(큰 분류↔그 아래 소분류 같음, 소분류끼리 다르면 다른 회사). 흔한 동 이름(Thanh·Bảo An·Trung Nguyên)이 이름 가운데면 안 뗌. supabase/pending/company-code-20261106/01-schema-dryrun.sql(회사·이름·번호·지점 표, local_jobs.company_id 빈 칸) — 적용 전 Lee 승인.
- 검증: jobIdentity.test.ts 통과, 공개 19건 이름 대조.

## 2026-11-06 22:30 — 중복 기준 확정·1단계 중복 세기 도구 (Claude)
- 요청: Lee "같은 공고 두 번 안 올라오게 하는 프로세스가 제대로 작동하는지", "회사·하는 일·위치 같으면 중복", "기존 것도 다", "순서대로 제대로".
- 확인 [직접 확인: supabase/migrations/20261029010000_ingest_one_door.sql find_existing, crawler/crawl_facebook.py filter_new_jobs, scripts/ocr/detail-fill.mjs]: 입구는 링크 같음·(전화+회사+원문 md5) 같음만 잡음. Facebook 수집기 사전 비교는 [source:facebook] 표식 행만 보는데 11-01 이후 상세 정리가 글을 다시 써 표식이 빠짐 → 사실상 고장. 운영 중복 수 검사 없음.
- 변경: src/lib/jobIdentity.ts(+test) 중복 기준 계산, scripts/ops/dup-count.mjs + .github/workflows/dup-count.yml 공개 공고 중복 세기(읽기 전용).
- 남은 문제: 실행 결과 보고 → 2단계(회사 코드표).

## 2026-11-06 20:05 — 운영 상세 화면 읽기 도구 (Claude)
- 요청: Lee "1번 방법 OK" — 작업자가 상세 화면을 직접 읽는 도구(GitHub 서버에서 열기).
- 변경: .github/workflows/detail-read.yml(수동 실행, job_ids 입력), scripts/ops/detail-read.mjs(PC1366·모바일390으로 /viec-lam/sb-번호 열어 화면 글 전체를 로그·Summary, 전체 화면 사진 첨부). 읽기 전용.
- 검증: 문법 확인. 병합 후 #5506으로 실행해 결과 확인.

## 2026-11-06 17:50 — #5506 화면 확인·프로세스 점검 (Claude)
- 요청: Lee "프로세스대로 됐는지 먼저 봐", "캡처할 거면 왜 너랑 일해".
- 확인: #494 뒤 상세 화면에서 제목+혜택 5줄 한 칸·채용 절차 묶음 정상(Lee 캡처). 확실한 위반: 등록 후 상세 화면 읽고 보고 안 함, 같은 원인 2회 실패 뒤 Claude가 2번 더 수정(#492·#494). 회사명 줄(포스터→source_text)은 R3·R5상 위반 아님, #483·#486 번호 지정 수정은 "Lee 지시" 기록 — Lee 확인 질문 남음.
- 남은 문제: 상세 화면 읽기 도구 결정, "로켓 장착" 칸 이름 결정, Lee 지시 여부 확인.

## 2026-11-06 17:30 — 제목 줄+목록 한 덩어리 유지, 검사기 예외 제거 (Claude)
- 요청: Lee "예외가 계속 나온다" → "진행해": 검사기 예외 대신 글을 망가뜨린 정리 단계를 고침.
- 변경: src/lib/jobDescriptionBuild.ts keepListBlocks — "~:" 제목 줄과 바로 아래 글머리 줄은 같은 칸(덩어리 안 규칙 칸 우선, 없으면 제목 칸, 직무 제목 줄 제외). src/lib/jobInspect.ts·test #492 원문 순서 예외 제거. jobDescriptionBuild.test.ts 사례 추가(AI 칸이 갈라도 붙어 나옴·값 없는 이름표는 계속 잡음).
- 검증 [직접 확인]: 저장된 공고 11건 중 바뀐 것은 #5506뿐(두 덩어리 붙음). 전체 시험 86/113 — 수정 전과 같은 실패 목록(이 환경 패키지 없음). 새 시험은 이전 코드에서 실패.
- 남은 문제: 병합 후 운영 정리 재실행 → #5506 상세 화면·검사표 확인.

## 2026-11-06 17:00 — #5506 빈 이름표 원인·검사기 수정 (Claude)
- 요청: Lee "어쩌라고?" → Phúc Lộc 비공개 원인 찾아 고침.
- 원인 [직접 확인]: ocr 04:42 run 42163969733 "#5506 칸 17줄"(AI 줄 칸 지정) → 원문에서 다시 만들 때 글머리 줄이 다른 칸으로 가서 화면 순서에선 "🌟 CƠ CHẾ … :" 아래가 목록이 아님. #485 예외는 화면 바로 아래 줄만 봐서 못 잡음.
- 변경: src/lib/jobInspect.ts 원문(source_text) 순서에서도 바로 아래가 글머리면 목록 제목. src/lib/jobInspect.test.ts 사례 2개(통과/계속 잡음).
- 검증 [직접 확인]: jobInspect·realJobs·postingCompleteness·jobMultiRole·fushanSource 시험 통과(새 시험은 이전 코드에서 실패).
- 남은 문제: 병합 후 검사표에서 #5506 해소·공개 확인.

## 2026-11-06 15:50 — Google 먼저·위치 프로세스·박닌 3건 공개 처리·크롤링 소스 점검 (Claude)
- 요청: Lee "바로 구글로", "프로세스 정립 진행해", "나머지 항목 등록해", "2번(Chợ Tốt) 먼저", "박닌 1건 진행 크롤링".
- 변경: #480 범위 금액 단위, #482 비교 검색 extra 1건만, #483 #5506·#5507 화면 글 정리·보류 공고 재대조(v3), #484 필수 누락 경고만 공개, #485 목록 제목 줄 예외·#5507 원문 정리, #486 #5506 원문 정리, #481 상세 빈 칸 상자 빠짐·연락 버튼 별도, #488 Google 먼저, #489 위치 확인 프로세스·비교 검색 차단, #487·#490 Chợ Tốt 읽기 시험.
- 검증 [직접 확인]: deploy-verify 42173749730(#481)·42184464122(#488) 성공. 이슈 #237 검사표: #5505·#5507 공개, #5506 빈 이름표로 보류. Chợ Tốt 시험 run 42187019576. Facebook dryrun 42185487440 session_expired.
- 남은 문제: Google 429(한도 숫자 미확인), Facebook 쿠키, Chợ Tốt 계정 정지·번호 로그인 필요, Muaban 미시험, #5506 보류, Haidilao 출처.

## 2026-11-06 — 수집 첫 단계 = 위치 확인, 크롤러 자동 차단 (Claude)
- 요청: Lee "크롤링 할 때 제일 먼저 위치를 찾을 수 있는지 먼저… 제일 규칙으로", "자동으로 막는 기능도 넣고, 지도 구현한 것도 프로세스에도 적용".
- 변경: PR #474 최우선 규칙 문서. PR #475 crawler/ingest_gateway.py 새 공고 등록 전 위치 확인(못 찾음·확인 불가 → 등록 안 함, location_precheck_failed), api/location-hook.js precheck 모드(서버 키 인증, 공고·위치 쓰지 않음), api/_lib/auto-location-runtime.mjs precheckLocation(지도와 같은 resolver·같은 저장 결과), src/lib/locationPrecheck.ts 판정.
- 검증 [직접 확인]: locationPrecheck·location-hook·auto-location-runtime·companyPlaceSearch·autoLocationResolver 시험, crawler test_ingest_gateway·test_scheduled_cli·test_source_fields 통과.
- 남은 문제: 관리자·고용주·Lee 제공 등록 경로에는 차단 없음. 첫 실제 크롤링 결과 미확인.

## 2026-11-06 — 위치 "구글을 따라" + #5438 확정 (Claude)
- 요청: Lee "구글을 따라", "일단 바꾸고 앱에 적용 후 프로세스 변경", "허락받지말고 계속해".
- 변경: PR #471(8b6be39) Google 검색어=상세 Google 버튼과 같게(회사, 주소 전체), 같은 이름 1곳이면 Google 장소 좌표(area), 업체 검색 비교 로그에 Google이 집은 곳 표시. PR #472(1e019d0) 원래 성 경계(Natural Earth 단순화) 경계선 2km 오차 허용.
- 원인 [직접 확인]: 이전 검색어(주소 뒤 2토막)·경계 단순화로 Google이 찾은 NEW TEAMROBOTICS VIETNAM(21.22944,106.00377)을 "성 밖" 탈락(run 42127983264).
- #5438: admin-location-confirm run 42131119321 성공(21.229440,106.003770). deploy-verify 42130784784 성공(#472 SHA). 공개 경계 검사 42131233126: #5438 원본·상세 문제 없음, 메인 핀 읽기는 전 공고 16/16 실패(10-28부터 실패 중인 검사 도구 문제, 별도).
- 남은 문제: 이 Claude 환경은 viecganban.vn·Supabase 직접 접속 403 → PC·모바일 화면 직접 확인 못 함. "Google도 모르는 공고 수집 안 함" 자동 차단 미구현.

## (이전 HANDOFF 2026-11-05 사진 처리 판정 스냅샷 보관)
