## 2026-11-07 09:00 — 중복 4단계 운영 적용·VPS 결제 확인 (Claude)
- 중복 4단계: PR #505 병합 → migrations-apply 42323400255(적용·운영 점검 성공), deploy-verify 42323599503 성공. 병합 지연 원인: PR 설명 시험표 SHA가 옛 커밋(checks 실패) → 갱신 후 병합.
- VPS: AZDIGI 청구서 431073(기한 11-09) Lee 결제(11-07). 3개월 주기, 다음 2027-02 초.

## 2026-11-07 06:30 — 중복 4단계 판정 (Claude, 승인 대기)
- 요청: Lee "4단계 진행", "애매하면 관리자 게시판(분류 못 한 줄 고르기)", "정상 공고가 잘못 버려지면 안 됨", "시작해".
- 설계: 입구(ingest_job) 대신 모든 경로가 저장 직후 부르는 위치 찾기(api/location-hook)에서 위치가 정해진 뒤 판정 — 보내는 곳 수정 불필요·위치 확정 후 비교. 판정 규칙은 DB 한 곳.
- 변경: supabase/migrations/20261107070000_job_duplicate_check.sql(job_identity_attach·job_duplicate_check·job_duplicate_decide, 공개 순간 판정 트리거, 판정 칸 공개 차단, 기존 회사 큰 분류 채움), api/_lib/auto-location-runtime.mjs applyDuplicateVerdict + api/location-hook.js, api/_lib/admin-users.js 의심 목록·결정, src/components/admin/AdminLinePicks.tsx 「🔁 Nghi trùng lặp」, src/lib/jobIdentity.ts companyIdentity·kindCategory, 시험 supabase/tests/job_duplicate_check.pglite.test.mjs·production_check, api/_admin-duplicates.test.ts.
- 검증 [직접 확인]: 로컬 폐기용 Postgres 16에서 판정 시험 14개 통과. 정확한 점 = 번지·공단 정문·관리자 확정(Google 업체 자리는 출처가 DB에 안 남아 애매로 감 → 게시판).
- 남은 문제: Lee 적용 승인 → draft 해제·병합 → 운영 적용·운영 점검.

## 2026-11-06 23:45 — 중복 3단계: 공개 공고 회사 코드 붙이기 도구 (Claude)
- 요청: Lee "기존 공고에도 회사 코드를 붙이라고 했잖아"(기존 공고 자동 작업 제외 규칙보다 Lee 직접 지시 우선 — 내용·화면은 안 바뀌고 코드 칸만).
- 변경: scripts/ops/company-code-assign.mjs + .github/workflows/company-code-assign.yml(수동, apply=false면 시험 후 되돌림). 대상 공개 공고(보류·숨김 제외), 규칙 jobIdentity.ts, 공고 번호 지정 없음.
- 정정: 30분 정리 작업에 넣자던 안은 "기존 공고 자동 작업 안 건드림" 규칙과 충돌해 철회. 중복 확인은 등록 입구(ingest_job)의 중복 단계를 고치는 방식(4단계).

## 2026-11-06 23:30 — 회사 이름 가게 종류 낱말 성조 그대로 찾기 (Claude)
- 요청: Lee "2단계 문제 없는 거야?" → 성조를 지워 Phở=Phố·Quán=Quận·Lẩu=Lâu가 같아지는 문제 발견 → "진행해".
- 변경: src/lib/jobIdentity.ts 가게 종류 낱말을 성조 그대로 찾음. 이름 전체에 성조가 없을 때만 지운 글자로 찾고, 헷갈리는 낱말(phở·quán·lẩu·cơm·bún·tiệm)은 안 씀. 테스트 추가.
- 한계: 성조 없이 "Lau Haidilao"처럼 쓰면 lau를 가게 종류로 못 봐 다른 회사로 갈림 → 회사 코드표에 다른 이름으로 등록해 해결.

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
