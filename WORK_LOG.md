## 2026-11-08 — 머리 줄·메뉴·바닥 알바몬 기준 (Claude)
- 요청: Lee "왜 이렇게 촌스럽냐 … 지금 바꿔야", 데모 후 "메인 화면만 빼고 다 적용해".
- 변경: LayoutDesktop/LayoutMobile(메뉴 이모지 24개 빼기, PC 검색 칸·버튼 메뉴 줄로, 펼침 col 칸 묶음, 바닥 → SiteFooter.tsx), siteChrome.css(.layout--d/.layout--m 아래만), menu-search-check 메뉴 이름(이모지 뺌), test-desktop-baseline 기준값.
- 뺀 것: 메인 본문·공고 카드(데모에서 바꿨다가 Lee 지적으로 되돌림 — 승인 틀은 글 모형 먼저).
- 남은 문제: 사이트 바탕 연분홍·이름 세 가지(Việcganban / Việt Gần Bạn / Việc gần Bạn) — Lee 결정 전 그대로.

## 2026-11-08 — 알바몬 따라 하기 1~6번 운영 반영 (Claude)
- 요청: Lee "이거먼저"(데모 demo/albamon-template에서 DB 변경 없는 1~6번).
- 변경: src/pages/ServicePages.tsx/.css(/ho-tro FAQ·공지, /lam-poster 벽보, /chu-de/:slug 테마 8개 — 데모 표본 공고 버튼 뺌, 인쇄 CSS는 'In' 버튼 때만), App.tsx 경로, 메뉴 'Việc làm'에 'Theo chủ đề'(PC·모바일), 바닥 'Câu hỏi thường gặp'·'Làm poster tuyển dụng', PC 기업 메뉴 'Làm poster tuyển dụng'. PostJob: 급여 칸 계산기 링크, 임시저장(vgb:postjob-draft, 등록 성공 시 지움), 구역 id pj-s1~6, PC 오른쪽 상자(Lưu tạm·Đăng tin·체크 목록), 아래 막대에 Lưu tạm.
- 뺀 것: 미리보기(상세 화면 틀 변경 필요), 7·8번(미승인).

## 2026-11-07 23:30 — 소개소 표시 원래 칸 하나로 (Claude)
- 요청: Lee "같은내용을 두번 적는게 맞아? 원래대로", "빼"(경고색), 5번 A+B, "먼저수정하고 7,8번 확인".
- 원인 [직접 확인]: #525에서 기존 recruitment_type 칸을 확인하지 않고 recruiter_agency 칸을 새로 만듦(화면은 기존 칸만 봐서 표시 안 됨).
- 변경: #536 수집 입구가 recruitment_type='agency'에 적음, 경고색 뺌, 소개소 판정 문구·전화번호 기록(job_company_phones) 추가, 읽기 전용 확인(company-reread field=agency). #538 Lee 승인 기록, #537 recruiter_agency 칸 삭제(0건 확인, 있으면 멈춤).
- 배포: deploy-verify 42387724259 성공, migrations-apply 42391081797 성공. 이어서 #540(Lee "A"·"3번가자"): agency_workplace_key 칸 + dedupe_private.verdict(소개소끼리 공장 다르면 다른 공고, 모르면 애매) + companyReader.readWorkplace. migrations-apply 42392546481, deploy-verify 42392718489 성공.

## 2026-11-07 22:00 — 회사 이름 읽기·카드 상호·급여 동 금액 (Claude)
- 요청: Lee 회사 이름 규정(#523~#528), "2번으로 하고 문제는 상호명이 긴거야"→OK(#531), 급여 못 읽음 문제점 확인 후 OK(#533).
- 변경: companyReader 한 곳·소개소/수수료(DB #525 recruiter_agency). 카드 cardCompanyParts(회사 형태 낱말 빼기·2줄·지점 지역 줄) + 레이아웃 회귀 시험, PC 기준값(LayoutDesktop — #520으로 이미 달랐음). salaryReader 동 전체 금액·k 금액, 교대 금액 일급, salary-reread 읽기 전용 미리 보기(대상 15건 중 #5633만 바뀜).
- 배포: #531 deploy-verify 42376344502 실패(#5633 급여 없어 메인 카드 없음) → #533 후 detail-fill 42382435615(#5633 급여 채움), deploy-verify 42382412330 성공.
- 남은 문제: 소개소 표시 화면(글 모형 대기).

## 2026-11-07 18:00 — 브랜드 로고 그림 (Claude)
- 요청: Lee "OK"·"1"(NETCO 카드에 마스코트 아이콘 → 선명한 로고).
- 변경: #519 job_brands.logo_url/logo_source_url/logo_sha256 + brand-logo.yml(공식 사이트 로고 받기·자동 맞춤·흰 그림 차단)·brand-logo-watch.yml(매달 비교). #520 brandImageUrl 한 곳(메뉴 PC·모바일·카드·상세), 검사표 그림 없는 브랜드 표시. #521 NETCO 두 줄 로고(Lee 제공).
- 배포: migrations-apply 42363733255·42364745319, deploy-verify 42364873642 성공. 남은 것: 다른 브랜드 로고 그림은 아직 사이트 아이콘(검사표에 표시).

## 2026-11-07 15:30 — 대표 사진·로고 자동 처리·Google 월 한도 (Claude)
- 요청: Lee "1번 전체 수정"·"진행"·"Ok"·"전체 진행해"(#5599 NETCO 공용 사진 — 로고 검색 단계가 크롤러 경로에 없었음).
- 원인 [직접 확인]: 로고·사진 검사는 수동 공고 파일 경로에만 연결. 페이스북 사진은 페북 서버 주소만 저장돼 화면(우리 저장소 사진만 허용, 10-06)에 안 나옴. Google 호출은 공고당 2번 제한뿐 월 한도 없음.
- 변경: DB #516(external_api_limits/calls·external_api_reserve, local_jobs.company_domain 공개·logo_lookup 비공개·보호 트리거·job_logo_lookup_record, NETCO POST 브랜드 81지점) → migrations-apply 42352856500 성공. 코드 #517: 페북 사진(fbcdn) 우리 저장소 복사(ingest_gateway), 사진·브랜드 없으면 저장된 Google 결과의 웹사이트 아이콘(applyLogoLookup, 월 900), Google 위치 검색 월 4,500(4곳 모두), companyLogo 순서 브랜드→사진→웹사이트→공용, 검사표 「대표 사진·로고」(공개·연속 통과 영향 없음), CLAUDE.md 로고 절 한 줄.
- 배포: deploy-verify 42354796132 성공. 기존 공고(15:50 이전)는 로고 찾기 대상 아님.

## 2026-11-07 13:30 — 주소 읽기 한 곳(addressReader) (Claude)
- 요청: Lee "왜 한번에 못하고 반복" → 주소 읽기를 급여처럼 한 곳으로 "진행해".
- 원인 [직접 확인]: 원문 주소를 읽는 기준이 소스마다 따로(페이스북 crawl_facebook.extract_district), 빠질 때마다 공고별로 덧댐(#5157, #5599).
- 변경: src/lib/addressReader.ts(① 이름표 줄 ② 이름표 없는 줄(끝 칸 원래 성 63곳) ③ 동·구·도로 조각, 옛 규칙 그대로 옮김) + addressReader.test.ts(#5157·#5599·FUSHAN 사례). locationPrecheck가 주소 칸 없으면 source_text를 이 함수로 읽어 "주소, 지역" 확인·응답(location). ingest_gateway가 원문을 보내고 응답 위치를 공고 위치로 저장. 페이스북 수집기의 주소 읽기 삭제. 다시 수집(refresh_facebook_existing)은 location-hook read_address(지도 조회 없음). CLAUDE.md 「수집 첫 단계」 절·RULES_CORE 한 줄.
- 수평 전개: 원문에서 주소를 읽는 곳은 페이스북 수집기뿐(고침). crawl_topcv·job_quality는 사이트 주소 칸 정리(그대로 먼저 씀). jobDetailFill/jobDetailSections는 주소 줄을 상세요강에서 빼는 용도(해당 없음). 관리자·Lee 제공(ops-insert-job)은 위치 확인 미연결(기존과 같음).
- 검증: addressReader·locationPrecheck·location-hook 시험, test_facebook_quality 28/28, test_ingest_gateway, test_job_quality 21/21(로컬). tsc/build는 CI.

## 2026-11-07 13:00 — 수평 전개: 핀 정확도 기준·이름표 없는 주소 줄 (Claude)
- 요청: Lee "수평 전개 진행해"(#5599 NETCO POST: 근무지역 "Bắc Ninh"만, 검사표 핀 "정확한 위치" vs 화면 "대략 위치").
- 원인 [직접 확인]: ① crawler/crawl_facebook.py extract_district가 "Địa điểm:/Địa chỉ:" 줄·quận/phường/đường/khu 낱말만 읽음(10-31 #5157 땜질) ② scripts/ops/job-inspect.mjs가 좌표 있으면 exact(10-25 작성, 10-26 핀 종류·10-28 대략 핀 좌표 뒤 미반영).
- 수평 전개(핀 정확도 판단하는 곳): 화면 src/lib/jobCoords.ts·mapR1.ts(exact+verified, 기준) / 검사표 job-inspect.mjs(고침) / 중복 판정 dedupe_private.precise_points(exact 미확인도 정확으로 봄 — migration 별도, 승인 필요) / api/map-locations.js·locationLevel.ts(종류만 전달·located 판정, 해당 없음) / locationPrecheck.ts(수집 첫 단계 찾을 수 있음 기준, 다른 목적이라 해당 없음).
- 수평 전개(주소 추출): crawl_facebook.py extract_district(고침) / crawl_topcv.py(사이트 구조화 주소, 해당 없음·꺼짐) / Chợ Tốt·Muaban 수집기 없음.
- 변경: extract_district에 이름표 없는 주소 줄(쉼표 2~6칸, 끝이 성 이름, 모집·급여·연락 낱말 없음, 앞 "…:" 이름표 뗌). job-inspect 핀 = exact+verified/gate/area(화면 기준). 시험: test_facebook_quality 30/30, 미리 보기 30건 재생(4건 주소 줄 잡힘, 오탐 없음).

## 2026-11-07 12:00 — 위치 확인 401 원인·VPS 공간 (Claude)
- 요청: Lee "두개 확인해서 최종 보고" → "OK".
- 확인 [직접 확인 vps-diag run 42340102791]: VPS→api/location-hook precheck가 HTTP 401 unauthorized 두 번 → 크롤러(GitHub Secrets)와 Vercel의 SUPABASE_SERVICE_ROLE_KEY 글자가 다름. #475(11-06) 뒤 크롤러 새 공고는 전부 location_precheck_failed: precheck_unavailable로 버려짐(EAGLEON 재시도 run 42338759387).
- 변경: api/location-hook.js 키 글자가 다르면 그 키로 Supabase 관리자 조회가 되는지(진짜 서버 키인지) 확인 후 통과. 테스트 추가. crawler 거부 이유 기록(#507). VPS 옛 실행기 버전 지우기 워크플로(vps-clean-old-runner.yml).
- VPS 공간 [직접 확인]: 11GB 중 9.7GB. 옛 실행기 2.338.0 약 680MB 지움 대상. 브라우저 chromium-1117은 Facebook 수집(playwright 1.44)이 쓰는 것 — 지우지 않음. chromium-1248 사용처 미확인 — 둠. root 필요: snap 옛 버전(791MB 중 일부)·apt 캐시 123MB.

## 2026-11-07 09:00 — 중복 4단계 운영 적용·VPS 결제 확인 (Claude)
- 중복 4단계: PR #505 병합 → migrations-apply 42323400255(적용·운영 점검 성공), deploy-verify 42323599503 성공. 병합 지연 원인: PR 설명 시험표 SHA가 옛 커밋(checks 실패) → 갱신 후 병합.
- VPS: AZDIGI 청구서 431073(기한 11-09) Lee 결제(11-07). 3개월 주기, 다음 2027-02 초.
