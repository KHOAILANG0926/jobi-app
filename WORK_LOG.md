## 2026-11-27 새벽 — #1124 병합·#1086 병합·검증 저장 2회(Claude)
- 요청(Lee 11-26): #1086 병합·운영 확인, 외부 호출 0건·다른 지점 미혼용 실증, vieclam24h 소량 수집·비공개 저장 검증, #1124 하루 20건 상한 재확인, #701 갱신.
- 변경: #1124 병합(자리 판정 crawl-slot.sh·조회 실패 닫힌 방향) / #1086 병합(54871b3, migrations-apply 45912997269·deploy-verify 45913293940 성공) / #1129(검증 저장 제목 분리)·#1130(위치 기억 운영 실증 조회) 대표 Approve 대기 / #1119 브랜치에 원문 전부 대조 시험 추가 / #1086 충돌 해소.
- 검증 [직접 확인]: 보충 호출 2번은 서로 다른 자리(위치 0·10), 동시 호출은 진행 중 실행을 보고 건너뜀 / 검증 저장 45912439934(저장 2·숨김)·45913548456(저장 0) 공개 0 / 오늘 수집이 자리마다 한 번 더 돈 것은 병합 전 실행 제목에 위치가 없던 일회성.
- 남은 것: #1130 실행(대표)·#1129 Approve·다음 예약 제목 확인(#1071)·Chợ Tốt/Muaban 수집기 없음(새 설계 필요)·지점별 8건 조회(대표).

## 2026-11-26 — 우리 사업장 위치 기억(Claude): 같은 공장을 Google에 다시 묻지 않기
- 요청(Lee 11-26 "진행하자"): Google로 확정된 위치도 회사 위치 기억으로 재사용, 성조·띄어쓰기·지역 꼬리만 다른 주소도 같은 사업장으로.
- 변경: migration 20261126090000_location_site_memory(public.location_site_memory, 확정 줄만 읽기·same_site_address 재사용) / autoLocationResolver ⓪(기억 → Google·VietMap·Goong, 300m 넘게 어긋나면 안 씀, 원래 출처 유지) / auto-location-runtime siteMemory·로고 찾기 장소 번호 재사용 / CLAUDE.md 「공고 위치 확인 프로세스」5번 ①-2·RULES_CORE.
- 검증 [직접 확인]: 로컬 PostgreSQL 16에서 CI 순서(fixture→reference→setup→migration→local→production_check→전후 대조 '변화 없음'), siteMemory.test·_logo-lookup.test·autoLocationResolver·googleQuotaCache·locationPrecheck·api 위치 시험, tsc.
- 남은 것: 11-10 이전 Google 줄 출처 표시 정정(데이터 전환, dry-run 뒤 Lee 확인).

## 2026-11-26 밤 — #1110 실증 완료·#1071 A안·생성기/검사기 불일치 조사(Claude)
- 요청(Lee 11-26): #1110 실증 완료 처리·HANDOFF/WORK_LOG/#701 갱신, 보관 단계 '30일' 정정, #1071 A안(정기 DB 저장 차단 유지), 생성기·검사기 판정 불일치 조사, #1119 안전한 운영 반영 방법 검토.
- 변경: #1124 Draft(crawl-catchup.sh+시험, crawl.yml sample_offset 입력·이름 정정, deploy-verify 보충 단계) / HANDOFF·WORK_LOG / #701 현행본 댓글 갱신.
- 검증 [직접 확인]: 예약 실행 45876190486 crawl 성공·save skipped·보관물 확인, crawl-catchup.test.sh 10항목·automerge-recovery·post-merge-chain·secret-isolation·tsc·build 통과, 저장소 원문 11개 재현 master 3줄→#1119 0줄.
- 남은 것: #1124 Approve·병합 뒤 실제 호출 확인, Lee 조회 실행, #1119는 웹 정상화 뒤(공개 전환 일시 중단은 대표 결정), 11-27 확인용 예약 작업 삭제는 권한 거부로 남음.

## 2026-11-26 저녁 — 크롤링 원문 보관 실증·검사표 원문 줄 빠짐(Claude)
- 요청(Lee 11-26): #1110 실제 실행 검증, read-inspect-failures 결과 재사용, 원문 누락 12건 원인 묶어 해결(검사 기준 완화 금지·지점별 독립 공고·원문 보존), #701 체크리스트 갱신.
- 변경: #1117(jobInspect 근무지 이름표 줄·job-inspect 같은 검사표 재알림 안 함) / #1118(read-source-lost-branches 조회) / #1119 Draft(jobDescriptionBuild가 inspectReading 기준으로도 빠짐 아닌 줄만 뺌, detail-fill RULE_FILES에 inspectReading) / 이 기록.
- 검증 [직접 확인]: 수집 45852160573(재접속 없음·30일·save skipped), #1117 새 시험 수정 전 실패→후 통과·병합 뒤 #6512 해소·#237 반복 중단, #1119 원문 JSON 3건 재현 빠짐 3→0·npm test 144/144·tsc·build, #1118 폐기용 PostgreSQL 16 가짜 자료.
- 남은 것: 예약 실행 확인(11-27), Lee 조회 실행, #1119 병합은 웹 정상화 뒤, #1071.

## 2026-11-26 오후 — API 한도·직업분류 재판정·크롤링 정리(Claude)
- 변경: #1091(봇 병합: 깨운 PR만·검사 먼저) / #1094(규칙 24개, ①③ 결정) / #1098(occupation-r8-apply가 공용 규칙 파일 변경에도 돌게 — 실행 45806011018: 9건 코드, 공개 상태 비교 통과) / #1099(같은 조회로 승인 전 대상 확정) / #1110(수집이 받은 상세 그대로 보관, 재접속 단계 제거, 원문 30일, 정기 DB 저장 일시 중단 — 승인 대기) / read-inspect-failures(이 PR).
- 확인 [직접 확인]: 봇 실행당 대상 PR 15→1~2·한도 오류 0, S6 잠금 해제(#1092는 다른 창), vieclam24h 5건 모두 연락처 없음.
- 남은 것: #1110 Approve, Facebook 계정(보류), 고용주·구직자 시험 계정, 검사 공통 실패 원인(조회 실행 뒤), #1071 A안은 정기 저장 재개 때.

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
