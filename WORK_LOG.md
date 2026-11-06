# 편집기 구성 재수정 — 여전히 알바몬처럼 보인다는 사용자 피드백

- 설정 패널을 오른쪽으로, 템플릿을 2열 갤러리로 이동. 공고 본문은 넓은 배너/작은 삽화/카드형 항목으로 조정.
- 독립 데모만 수정. JSON 계약과 편집 기능 유지. Chromium 기능 검사 통과.

# 편집기 디자인 수정 — 사용자 명시 요청

- 알바몬과 너무 같은 외형을 청록색 JOBI 스타일로 조정. 편집 흐름/문서 API 유지.
- UI 1곳과 생성 HTML의 브랜드/제목/표 스타일 수정. 기존 앱·운영 상세는 해당 없음(독립 데모만).

# 2026-11-07 · Codex · 알바몬 기준 편집기 독립 데모

- 분리 worktree의 public/demos/albamon-editor/index.html과 전용 브라우저 시험만 추가. 기존 앱·DB 미변경.
- Chromium 기능/보안/모바일 검사 통과. tsc --noEmit와 npm run build 통과.
- 전체 npm test 113/114: ingest-one-door-guard의 git spawnSync가 sandbox EPERM. 해당 파일을 네트워크 허용 실행 환경에서 재검증하여 732개 파일 검사 통과.
- 문서 API와 실제 PostJob 연결 지점은 데모 README에 기록. 운영 연결·DB 저장은 미구현.

## 이 작업 이전 HANDOFF 원문 보존

# HANDOFF — 2026-11-06 오후 (Claude) · 위치 Google 먼저·박닌 공고 3건·크롤링 소스 점검

## 1. 현재 상태
- master ba135dc. 코드 변경 최신 299a172(#488 Google 먼저) deploy-verify 42184464122 성공 [직접 확인].
- 위치: 회사 이름 있으면 Google부터(상세 Google 버튼과 같은 검색어) → VietMap 번지 검증 exact / 아니면 Google 좌표(area). 프로세스 문서 CLAUDE.md 「공고 위치 확인 프로세스」(#489): 키는 크롤러 자동 확인만, Lee 제공·기존 공고는 일반 Google 지도 링크 → admin-location-confirm. business-search-compare는 extra 1건만·동시 실행 차단·전체 비교는 confirm_compare=true.
- 2026-11-06 Google Places 429(한도 초과): 작업자가 비교 검색 14회(회당 16곳)·4개 동시 실행해 소진. 실제 한도 숫자는 콘솔에서만 확인 가능(미확인).
- 공고: #5505 Hojeong·#5507 nhẹ cafe 공개(검사표 기준) [직접 확인: 이슈 #237]. #5506 BĐS Phúc Lộc 공개. #494로 "~:" 제목+글머리 목록이 한 칸에 붙어 나옴(Lee 캡처 17:35로 확인). "로켓 장착" 묶음이 소득·수당 칸에 들어감 — 규칙 위반 아님, 둘지 고칠지 Lee 결정 대기. Haidilao 미등록 — R3 출처(FB 작성자 이름 또는 캡처) 필요, 원문은 Lee 대화에 있음.
- 검사/등록 변경: 범위 금액 앞 숫자 단위(#480), 원문에 없는 필수 항목은 경고만·새 공고도 공개(#479·#484), 목록 제목 줄 예외(#485), 포스터 옮김은 원문(source_text)에서 빼고 업체 이름 줄만(#485·#486, 규칙 ④①).
- 상세: 빈 칸 상자 빠지고 아래 칸 올라옴·연락 버튼 별도(#481, deploy-verify 42173749730 성공). mobile-home 시험은 11-05부터 실패 중(무관).
- 크롤링: Facebook session_expired(run 42185487440) → Lee 쿠키 갱신(VPS SOCKS) 대기. Chợ Tốt: 웹 403, 공개 gateway 목록·본문 읽힘·번호 가려짐(run 42187019576), Lee 계정 정지(ABB, 이의 메일 발송됨). Muaban 수집기 없음. TopCV/Vieclam24h 꺼짐(8월 지시).

## 2. 다음 할 일 3개
1. Facebook 쿠키 갱신 후 crawl-facebook-one dryrun → 박닌 1건 save(위치 확인 Google 먼저 적용 첫 실전).
2. Muaban 로그인 없이 읽기·번호 노출 시험(chotot_probe 방식, 저장 없음).
3. 등록 후 상세 화면은 작업자가 직접 읽는다(Lee 캡처 요청 금지, Lee 11-06): GitHub 「상세 화면 읽기」(detail-read.yml, 입력 job_ids) → 로그에 PC·모바일 화면 글 전체, 사진은 첨부. / Haidilao 출처 받아 등록(일반 Google 지도 위치 확인 먼저).

## 3. 필수 규칙
- 시키면 바로 실행(Lee 11-06). 운영 DB 직접 SQL·번호 지정 덮어쓰기 금지, STRICT만 승인.
- Google 키는 크롤러 자동 확인만. 사람 확인은 일반 Google 지도. 비교 검색 1건씩.
- 로그인·비밀번호 입력은 작업자 금지 — Lee가 VPS에서 로그인, 쿠키는 Secrets에만.
- GitHub 연결로 브랜치·PR, 필수 검사·봇 병합 우회 금지. 보고 5줄·앱 화면 기준.

- 중복 기준(Lee 2026-11-06 확정): 글이 같은지가 아니라 회사(핵심 이름+업종 소분류 — 카페·식당 따로, 하는 일로는 안 나눔; 이름 없으면 전화·Zalo)·하는 일(직업분류, 미기재면 큰 분류)·위치(정확한 핀 200m/같은 공단, 대략 위치는 묶지 않고 확인 목록)가 같으면 중복 → 기존 공고 갱신(숨김 공고 안 살림, 사장님 제공>관리자>수집). 기존 공고 포함. 순서: ①공개 공고 중복 세기(dup-count.yml, 읽기 전용 — 11-06 공개 19건 중 중복 0, 19건 모두 다른 회사) ②회사 코드표(jobIdentity 회사·지점 분리·업종 맞음 규칙 완료, 회사 코드표 Lee 승인 23:06 → migration 20261106230000_job_company_codes 적용) ③기존 공고 코드 부여(승인) ④등록 입구 순서 변경(승인). 기존 공고끼리 중복 처리(숨김·합치기)는 ① 결과 보고 Lee 결정. 보류(비공개) 공고는 검사에서 뺌(Lee: 해결될 때까지 둠) — 4단계에서 보류가 풀려 공개될 때도 중복 검사. 현행 장치: 링크 같음·글자 완전 같음만 잡음, Facebook 수집기 사전 비교는 11-01 상세 정리 뒤 [source:facebook] 표식이 빠져 사실상 고장.


## 2026-11-06 23:15 — 회사 코드표 운영 적용 (Claude)
- 요청: Lee 23:06 "진행해" — 회사 코드표 운영 DB 생성 승인.
- 변경: supabase/migrations/20261106230000_job_company_codes.sql(job_companies·names·phones·branches, local_jobs.company_id·company_branch_id 빈 칸, RLS·공개 권한 없음), supabase/tests/job_company_codes_production_check.sql.
- 남은 문제: 3단계(기존 공고 연결)·4단계(입구 규칙) 별도 승인.

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
