## 2026-11-08 밤 — 봇 병합 뒤 검사·문서만 바뀐 커밋도 운영 검사 (Claude 밤 근무)
- 발견: #565·#568(시험·문서만) 봇 병합 뒤 vercel-deploy가 workflow_dispatch로 돌아 "앱 변경 없음, 운영 그대로" 기록 단계(push 전용)를 건너뜀 → deploy-verify 시작 안 됨, 수동 시작 시 20분 대기 실패(#572).
- 변경: .github/workflows/vercel-deploy.yml — 그 기록 단계를 workflow_dispatch에도 실행하고, dispatch일 때 deploy-verify를 시작.
- 검증: YAML 읽기 확인. 실제 확인은 이 PR 병합 뒤 운영 검사 실행.

## 2026-11-08 밤 — 휴대폰 메인 검사(mobile-home) 고장 고침 #559 (Claude 밤 근무)
- 요청: ai-team 이슈 #559(지도 못 그리는 휴대폰에서 안내 45초 안 보여 실패).
- 원인: 11-05부터 WebGL이 없으면 안내 대신 대체 지도(RasterMapCanvas)를 그림. 안내는 바탕 그림을 못 받을 때만 나와 시험 기대가 낡음(화면 버그 아님). 11-05 fix/map-webgl-unavailable 실행부터 계속 실패.
- 변경: scripts/test-mobile-home.mjs — 안내 대신 대체 지도(data-map-provider="raster")가 보이는지 확인. 화면 코드 변경 없음.
- 검증: tsc·npm test 119/119·build 통과, 로컬 WebGL 막은 390px에서 대체 지도 표시 확인.

## 2026-11-08 — 간편 템플릿 B안·1:1 문의·추가 고용형태 (Claude)
- 요청: Lee "3,4,5,6적용" → 5번 "B로 바꾸고 데모 먼저"(데모 demo/template-detail) → "마무리먼저".
- DB(#552, 추가만): local_jobs.description_html·employment_type_extra(공개 조회), support_inquiries(넣기 누구나, 읽기·처리 관리자, RLS).
- 화면: 공고 등록 맨 아래 'Mô tả chi tiết tuyển dụng' = 간편 템플릿(78틀, 전용 사진 없는 57틀은 같은 업종 우리 사진 임시) → 결과 HTML 저장, 상세 ④가 그 모양 그대로(화면 뜬 뒤 정리해 넣음, 휴대폰은 모바일 틀 크기). 고용형태 하나 더(Hợp đồng·Thực tập·Cộng tác viên). /ho-tro 'Hỏi đáp 1:1' 작성·바닥 'Liên hệ 1:1' 연결, 관리자 '💬 Hỏi đáp 1:1' 탭.
- 시험: job-preview-check(템플릿 → 미리보기 ④), jobSchema 38칸.
- 남은 것: 알바몬 원본 템플릿 사진 출처·사용 조건 확인(브라우저 연결 필요), 에디터 탭(패키지 설치 필요), 상세 AI 배경(다음 작업).

## 2026-11-08 — 공고 등록 미리보기·입력 칸 추가(알바몬 3·4번) (Claude)
- 요청: Lee "3,4,5,6적용" — 이 PR은 DB 없는 3번·4번(고용형태 3개 추가 제외).
- 변경: PostJob 미리보기 PC·Mobile(오른쪽 상자·아래 막대) → /xem-truoc-tin 새 창이 JobDetail(previewJob)로 저장 전 입력값을 그대로 보여 줌(단추 막힘). 입력 칸: Không cần kinh nghiệm·Có thể đi làm cùng bạn bè·우대조건 선택 창(7개)·근무기간 Thỏa thuận·Phụ cấp ăn riêng·Có thời gian thử việc·Cách ứng tuyển·Tên người liên hệ(+저장). DB 새 칸 없이 preference·salary_note·상세요강 '채용 절차'에 넣음.
- 시험: scripts/layout/job-preview-check.mjs(app-screen).
- 남은 것: 5번(템플릿 표시 방식 A/B)·6번 1:1 문의·고용형태 3개 추가(DB) — Lee 답 대기.

## 2026-11-08 — 로고 이름 하나로(Việc gần Bạn) (Claude)
- 요청: Lee "색깔은 그냥 놔두고 로고는 하나로 맞춰 브라우저 탭으로".
- 변경: 머리 줄 로고(PC·휴대폰)·바닥 로고·저작권 Việcganban/Việt Gần Bạn → Việc gần Bạn, 바닥의 중복 회사 이름 줄 삭제, 브랜드 목록·지도 창 문구 Việcganban → Việc gần Bạn. 바탕색 그대로(데모 demo/white-bg 미적용).
- 이어서(Lee "운영 링크만 빼고 통일"): 약관·개인정보·가입·검색 제목(SEO, api/ssr.js·representativeSearchPages)·상세·지원 안내 문구도 Việc gần Bạn. 주소(viecganban.vn)·이메일은 그대로.

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
