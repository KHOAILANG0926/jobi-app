## 2026-11-26 — C·D·E 이어서(Claude): 직업분류 공용화·추가 고용형태·관리자 자동 채우기·수집기 시험 CI
- 요청(Lee 11-25·26): #717 B ①(근거 있을 때만 코드·근거 전달, 규칙 공통화, 업직종 아래 안내 줄), C·D·E 잔여, 수집기 시험 2개 CI 연결.
- 변경: #1072(data/occupations/occupation_rules.json 한 곳을 Python·웹이 함께 읽음, 고용주 등록 buildJobFields·안내 줄) / #1073(시험 2개 수정) / #1080(employment_type_extra) / #1083(AdminDashboard 자동 채우기 = companyReader·addressReader·salaryReader·phonesIn·occupationReader) / #1079(crawl-install에 시험 2개) / #1084(admin-line-pick-e2e에 자동 채우기 확인, 저장 없음).
- 검증 [직접 확인]: 규칙 이동 전후 동일·공용 사례 32건 같은 결과, npm test 138/138·tsc·build, 로컬 화면 PC·모바일, crawl-install에서 시험 실제 실행, deploy-verify 34af3dbc·75c8d24a 성공.
- 남은 것: 실제 고용주·관리자 계정 운영 확인(#1084 병합 뒤 E2E), #728 A4, 규칙 없는 후보 코드, Actions 한도 소진 반복(봇 병합 실행 수 — 승인 영역, 원인 추정).

## 2026-11-25 — C·D 잔여·#701 후속(Claude): #973 연락처·마감, 고용형태, 보류함 이력, #717 B 초안, 수집기 시험 CI
- 요청(Lee 11-25): #973 부분(연락처 8자리 통일·마감 지난 공고 제외+원문 보존), #717 B 대응표 초안, 오류 기록 축적(기존 구조), 고용형태 판독, E 작업·정기 수집 실증.
- 변경: #1056 검사표 '연락처' = DB 공개 게이트와 같은 8자리 / #1057 마감 지난 새 공고는 등록 입구 한 곳에서 보류함(rejected·deadline_expired)에 원문 보존·미등록, 기존 공고 다시 수집은 갱신 안 함(수집기별 마감 처리 3곳 합침, Facebook '지난 날짜 빼기' 결함 수정) / #1059 원문에 고용형태 낱말이 한 종류일 때만 employment_type / #1060 보류함 줄 meta.history(판정이 바뀐 때만, 최근 10) / #1061 docs/plans/2026-11-25-717b-category-occupation-map.md(A33·B4·C67·D55, 대표 확인 6개) / #1063 CI 누락 수집기 시험 9개를 crawl-install에(Lee Approve 대상).
- 검증 [직접 확인]: 각 PR 고치기 전 실패→후 통과 사례, crawler/test_*.py 전부, npm test 136/136·tsc·build(#1056). deploy-verify 0a63b62 실패(#1055, map-summary-check.mjs:156 대기 초과 — 문서만 바뀐 커밋)는 재실행 성공으로 닫음.
- 정기 수집 실증 [직접 확인]: 11-25 예약 2개 중 '23 8'만 18:41 UTC(약 10시간 늦게) 실행 — 10건 → 신규 2·위치 못 찾음 8(보류함 unfound), 보류 재확인 rejected 4·unfound 1. '23 2' 예약은 실행 기록 없음(원인 미확인).
- 남은 것: #717 B 대표 확인 6개, #1063 Lee Approve, test_address_pipeline_integration·test_geocode 고친 뒤 CI 추가, employment_type_extra, Lee 실행 대기(read-occupation-unclassified)·Facebook 새 계정 쿠키.

## 2026-11-25 — JOBI 앱 2단계 완료 기록(운영 확인)
- 병합: #1049·#1050·#1051·#1052·#1053, master 44ad686 deploy-verify·Vercel 배포 통과(운영 배포 확인·실제 화면 검사 success).
- 운영 `/app` 직접 확인 [직접 확인]: 홈(탭바·카드 10·미니 지도)·마이·CV·메시지·면접·맞춤 조건·알림·커뮤니티·기업 입구 5화면·기업 탭 4개 모두 열림, 페이지 오류 0. 웹 `/dang-tin`(코드를 lib로 옮긴 곳)도 열리고 빈 제출 시 웹과 같은 첫 검사 문구.
- 못 본 것: 실제 계정으로 로그인한 뒤의 제출(지원·CV 저장·글쓰기·공고 등록·상태 변경). 이슈: `/app/`(끝 슬래시)는 웹 화면으로 열림(0단계 vercel.json 규칙, 수정은 승인 필요).

## 2026-11-25 — JOBI 앱 2단계 ⑤: 기업 공고 등록(웹 PostJob 검사·저장 칸을 lib로 공용화)
- 요청(Lee): 최종 V3 기준 개발 연속 진행 — 기업 공고 등록(6단계 순서는 CLAUDE.md 확정 순서 그대로). 진행표 #1031.
- 변경: `src/lib/postJobSubmit.ts`(웹 `PostJob`의 폼 값·필수 12칸 검사·저장 칸 만들기·사진 올리기·핀 저장을 그대로 옮긴 공용 함수 — 웹은 그 함수를 부름, 동작 변경 없음, 시험 `postJobSubmit.test.ts`) / `src/app/biz/PostJobScreen.tsx`(`/biz/dang-tin`: 모집내용→근무조건→근무지→접수기간·방법→담당자→상세, 저장은 웹과 같은 `addPostedJob`→`ingest_job`).
- 검증 [직접 확인]: tsc·build·npm test 136/136, Playwright(가짜 기업 세션·모든 Supabase 호출 가로챔, 실제 DB 쓰기 없음) 필수 검사 12단계가 웹과 같은 순서·문구로 걸림 → 제출 → 성공 화면.
- 안 한 것(웹에만 있음): 작성 템플릿 편집기(descriptionHtml)·지도 핀 선택·임시저장·미리보기·비로그인 빠른 등록/이메일 등록. 실제 기업 계정 제출은 계정이 없어 직접 못 봄.
## 2026-11-25 — JOBI 앱 2단계 ⑦⑧: 맞춤 조건 설정 + 알림 목록
- 요청(Lee): 최종 V3 기준 개발 연속 진행 — 맞춤(Phù hợp) 조건·알림. 진행표 #1031.
- 변경: `src/app/account/ConditionsScreen.tsx`(`/ho-so/dieu-kien`: 저장한 조건 목록·추가·수정·일시정지·삭제·결과 보기, 웹 `JobAlertsPanel`과 같은 `lib/jobAlerts` 검사·저장·판정, 이동거리는 웹과 같이 아직 안 씀) / `src/app/account/NotificationsScreen.tsx`(`/ho-so/thong-bao`, 웹과 같은 `NotificationContext` — `AppProviders`에 같은 공급자 추가) / 마이에 두 줄, 맞춤 목록의 '조건 설정' 버튼은 로그인 구직자만 앱 화면으로(그 외는 웹 로컬 조건 화면 그대로).
- 검증 [직접 확인]: tsc·build·npm test·Playwright 조건 8/8(가짜 구직자 세션·쓰기 가로챔, 필수 조건 검사 문구가 웹과 같음)·알림 6/6(웹과 같은 localStorage 키).
- 안 한 것: 비로그인 로컬 조건 편집(웹 RecommendSection)은 웹 연결 유지, 홈 상단 알림 점.
## 2026-11-25 — JOBI 앱 2단계 ⑥: 메시지·면접(구직자·기업) + 기업 계정 화면
- 요청(Lee): 최종 V3 기준 개발 연속 진행 — 소통(메시지·면접). 진행표 #1031.
- 변경: `src/lib/interviewSchedule.ts`(웹 `ScheduleInterviewModal`의 '일정 저장 + 지원 상태 interview' 순서를 그대로 옮긴 공용 함수 — 웹 모달도 이 함수를 부름, 동작 변경 없음) / `src/app/inbox/` — 구직자 메시지함 `/ho-so/tin-nhan`(웹 `MessagesInbox`와 같은 `messagesStorage`)·면접 일정 `/ho-so/phong-van`·대화 화면 / `src/app/biz/` — 기업 메시지함 `/biz/tin-nhan`·기업 계정 `/biz/doanh-nghiep`(계정·안 읽은 메시지·예정 면접·로그아웃)·면접 일정 시트(지원자 카드의 '면접 잡기'). 대화를 연 상태에서는 하단 탭을 숨김(입력창).
- 검증 [직접 확인]: tsc·build·npm test 136/136, Playwright 14/14(가짜 구직자·기업 세션, 쓰기 호출은 전부 가로채 실제 DB 쓰기 없음: 대화 열기·보내기·면접 시트 → 일정 저장+지원 상태 변경 호출 순서 확인). 실제 계정 화면은 직접 못 봄.
- 대표 결정 필요: 회사 소개 같은 별도 '기업 정보' 저장소는 지금 DB에 없어(웹에도 없음) 만들지 않음 — DB 구조 변경(STRICT)이라 Lee 결정 필요.
- 남은 것: 맞춤(Phù hợp) 조건 설정, 알림.

## 2026-11-25 — JOBI 앱 2단계 ④: 기업 탭 홈·공고 관리·지원자 관리
- 요청(Lee): 최종 V3 기준 개발 연속 진행 — 기업 기능 첫 묶음. 진행표 #1031.
- 변경: `src/app/biz/` — 기업 입구 `BizGate`(웹 RequireEmployer와 같은 서버 `account_roles` 판정, 조회 실패와 '기업 아님' 구분), 홈 `/biz`(통계·새 지원자·바로가기), 공고 관리 `/biz/quan-ly-tin`(내 공고 목록·긴급 표시·삭제 확인, 지원자 목록·공고별 거르기·상태 변경·지원 시점 CV 보기). 자료는 웹 대시보드와 같은 `fetchEmployerJobs`·`applicationsStorage`, 계산은 순수 함수 `bizView.ts`(+시험).
- 검증 [직접 확인]: tsc·build·npm test 135/135, Playwright 게스트 10/10(기업 입구 로그인 안내·기업 탭 4개·redirect 유지·가입 시 기업 선택). 기업 계정 화면(공고·지원자·상태 변경)은 계정이 없어 직접 못 봄.
- 남은 것: 공고 등록 6단계(`/biz/dang-tin`), 기업 정보(`/biz/doanh-nghiep`), 기업 쪽 메시지·면접 일정, 맞춤 조건.

## 2026-11-25 — JOBI 앱 2단계 ③: 커뮤니티(목록·상세·글쓰기·댓글·좋아요·신고)
- 요청(Lee): 최종 V3 기준 개발 연속 진행 — 커뮤니티. 진행표 #1031.
- 변경: `src/app/community/` — 목록(`/cong-dong`: 분류·검색·정렬, 웹과 같은 `lib/communityStorage.loadPosts`), 상세(`/cong-dong/:id`: 조회수·좋아요·댓글·신고 = 웹과 같은 `communityStorage`·`adminOperations.createReport`), 글쓰기 시트(웹과 같은 항목·검사·`addPost`, 사진 4장). 분류·검색·정렬·상대 시간은 순수 함수 `communityView.ts`(+시험). 로그인 안 한 글쓰기·좋아요·댓글·신고는 앱 로그인 화면으로.
- 검증 [직접 확인]: tsc·build·npm test 134/134, Playwright 10/10(실제 글 6건 표시·분류·검색·비로그인 글쓰기→로그인·상세·없는 글 안내). 주의: 이 시험이 실제 글 1건을 열어 운영 조회수가 1 올라감(읽기 전용 아님을 몰랐음, 이후 시험은 글 열기 생략). 글쓰기·댓글·좋아요·신고 제출은 계정이 없어 직접 못 봄.
- 남은 것: 맞춤 조건 설정(JobAlertsPanel), 기업 기능.

## 2026-11-25 — JOBI 앱 2단계 ②: CV(이력서) 작성 화면
- 요청(Lee): 최종 V3 기준 개발 연속 진행 — 이력서. 진행표 #1031.
- 변경: `src/lib/cvAccountSync.ts`(웹 `CvBuilder`의 계정 CV 읽기·저장 순서를 그대로 옮긴 공용 함수, 웹도 이 함수를 부름 — 동작 변경 없음) / `src/app/account/CvScreen.tsx`(`/ho-so/cv`: 기본 정보·사진·경력·학력·기술·추천인, 로그인 전 이 기기 저장·로그인 후 계정 저장, 자료 모양은 `lib/cvStorage` 그대로). 마이·메뉴의 CV 링크를 웹 화면에서 앱 화면으로 교체.
- 검증 [직접 확인]: tsc·build·npm test 133/133, Playwright 게스트 CV 흐름 10/10(저장 키가 웹과 같은 `vgb_cv_draft`, 새로고침 유지, 항목 추가·삭제). 계정 저장·사진 업로드는 이 환경에 인증 열쇠가 없어 직접 못 봄.
- 남은 것: CV PDF 내려받기·미리보기(웹 CvBuilder 전용 화면), 기기 CV를 계정으로 가져오기 제안(웹 Profile), 맞춤 조건·커뮤니티·기업.

## 2026-11-25 — JOBI 앱 2단계 ①: 로그인·가입·마이 탭·지원 내역·사이트 안 지원
- 요청(Lee): 최종 V3 기준 개발 연속 진행 — 구직자 핵심 다음 단계(회원·지원). 진행표 #1031.
- 변경: `src/lib/applySubmit.ts`(웹 `useApply`의 buildProfile·제출을 그대로 옮긴 공용 함수, 웹은 그 함수를 부름 — 동작 변경 없음) / `src/app/account/` — 로그인·가입(웹 같은 AuthContext·문구·검사, 이동은 /app 안 경로만), 지원 시트(`useAppApply`, 상세 하단 "Ứng tuyển ngay"가 웹 상세로 보내던 임시 연결을 대체), 마이 탭(`/ho-so`), 지원 내역(`/ho-so/ung-tuyen`: 웹과 같은 `applicationsStorage` 목록·실시간·철회).
- 검증 [직접 확인]: tsc·build·npm test 133/133, Playwright 게스트 흐름 14/14(마이·지원 내역 로그인 유도·로그인/가입 검증 문구·외부 redirect 차단). 로그인 후 지원 제출은 이 환경에 인증 열쇠가 없어 직접 못 봄(병합 뒤 운영 확인 불가 — 계정 필요).
- 남은 것: Zalo 로그인·비밀번호 찾기·CV는 웹 화면 연결(다음 PR), 이력서(CV)·커뮤니티·기업 기능.

