## 2026-11-04 — 대표 사진 공통 규칙 수정 (Codex)
- 요청: Lee 명시 지시, fix/card-photo-images-first. 로컬 push 금지, GitHub 연결 도구로 커밋·PR·필수 검사·기존 봇 병합·운영 확인.
- 변경: 공통 jobRepresentativeImageUrl(브랜드 → 허용 imageUrl → 공개 images[0] → 업종 사진), 카드·상세 상단/기업정보에 적용. 하단 사진·CSS·위치·DB 변경 없음. 지도 목록은 JobCard 사용, 브랜드 디렉터리/메뉴는 공고 대표 이미지가 아닌 브랜드 자체 아이콘으로 해당 없음. 관리자 입력/업로드 미리보기는 입력값 확인용으로 해당 없음.
- 검증 [직접 확인]: 새 대표 사진 단위 시험 실패 확인 후 통과, companyLogo 기존 시험 통과, desktop baseline 8/8. 전체 단위 시험 84/109(의존성 누락·환경 제약으로 25개 실패), 상세 회귀 시험도 @supabase/supabase-js 누락으로 중단. 로컬 build: sh: 1: tsc: not found. 최종 tsc/build/전체 시험/화면 검사는 PR CI로 확인 예정. 카드 레이아웃 시험에 images[0] 및 차단된 imageUrl 대체 경우 추가.
- 상태: 연결 도구로 2b93993 커밋·PR #465 생성 성공. 첫 CI 타입 검사에서 node:fs 타입 선언 부재(TS2307) 확인. 브라우저용 src 시험에서 파일 접근을 빼고 기존 Node용 카드 레이아웃 시험으로 하단 사진 소스 검사를 이동. f55711a의 GitHub 타입·전체 시험·빌드는 통과(41930320351). 화면 비교 41930296693은 AssertionError [ERR_ASSERTION]: KDA approved frame 390/none, .jd2-header 높이 실제 279 / 기존 262.5로 실패. 새 업종 사진으로 제목 줄바꿈이 변함. CSS 수정/검사 완화 없이 PR #465 Draft 전환, 병합·배포 중단. 운영 화면 접속도 curl: (56) CONNECT tunnel failed, response 403으로 불가(아직 배포 안 함).
- 후속 지시: Lee "별도 허락요청하지말고 … 다 진행". 독립 검토 결과 none 기준의 이미지 존재 상태가 달라 발생한 기능 효과로 판정. none만 기존 baseline 로고 칸이 있는 입력과 비교하고 로고·제목 상대 위치·크기·gap, fallback URL·실제 로드를 추가 검사. loaded/failed는 원래 동일 입력 비교 유지. CSS/JSX 수정·높이 허용 오차 확대 없음.
- 이전 HANDOFF 상세 보존:
```markdown
# HANDOFF — 11-04 저녁: 상세 항목 정리안(결정 대기)·칸 나누기·공고 4건 (2026-11-04 18:15, Claude → GPT 인수인계)

## 1. 현재 상태
- master(운영) e196ce2 = PR #462, deploy-verify 41814801256 통과. 오늘 오후 병합: #459 상세요강 필요 없는 줄 거르기, #461 칸 나누기(모집 소개 줄 아래 직무→업무, Vị trí→업무, Địa điểm→기타, QR·이메일·gửi CV→채용 절차, FULL-TIME→시간·형태), #462 근무조건 한쪽 칸 비면 반씩 나눔(Lee 승인 없이 반영 — Lee 지적, 아래 1번으로 교체 예정).
- 상세요강 규칙 변경(Lee 11-04 적용): 원문 전체 → 필요 없는 줄 거름(OCR 조각·반복 연락처·기타 칸 홍보 인사말·해시태그, 애매하면 남김, 근무 조건 낱말 있는 '!' 줄은 남김). 뺀 줄은 detail_fill.dropped. 11-01 이후 공고 10건 다시 만듦(job-ocr-check 41798722777).
- 공고 4건 공개: #5421 Thanh Phệ(9402, 급여 협의 → 메인 카드 없음), #5422 Regal Edu, #5437 DOOKKI(급여 원문 없음 → 메인 카드 없음, 근무지 3곳 중 주소 칸은 Vincom), #5438 New Team Robotics(건물 사진).
- Google 위치 찾기 켜짐: Vercel Production GOOGLE_PLACES_API_KEY(서버 전용 키, Places API New만) + 강제 배포. 비교 41769879663 오류 0.
- 상세 화면: 최신 4칸 틀(.jd2-page--v2)만 새 디자인(상자 높이 내용만큼·간격 24px·연한 테두리·머리 급여 PC 26px/모바일 22px·상세요강 문서형·보험 짧은 표시). 여러 직무 급여 칸 = 직무 | 금액 두 칸(roleSalaryRows). KDA(sb-4824)·예전 3건(sb-4878·4879·4982)은 그대로(Lee: 앞으로 들어오는 것만).
- 공고: #5342 Joy Thái(JoyThai 브랜드·식당 분류), #5368 Bảo An VCC(위치 Google 링크로 관리자 확정), #5405 Tâm Hồ Nhất Hạch(Google 주소). 검사표 연속 통과 7/10.
- 위치: 공단 밖 공고 회사 이름 찾기(Goong → Google) 추가. Google 단계는 Vercel에 키가 없어 꺼져 있음(비교 41668349505 전부 not_configured). 절차: 원문에 도로 없으면 Google에서 회사 주소 글자 → 주소 칸 → VietMap·Goong 계산, 이미 올라간 공고는 관리자 위치 확정(수동 도구 admin-location-confirm.yml: 공고 번호 + Google 지도 링크, 링크는 /place/…/data=!3d…!4d… 전체).
- 알바몬 구직자 상세 데모(보류, 운영 미반영): 브랜치 demo/detail-header-albamon(b06134b). 1단계 최신 틀 제목 맨 위+인증 태그(dc3a85d), 2단계 알바몬 모바일 캡처(쿠팡CLS 8장) 색·크기 맞춤(6229a6d: 상자 없음·구분선 #e8e8e8·제목 22/구역 20px·이름 칸 80px·주황 탭/지원 버튼·로고 48px+회사명 한 줄). Lee 11-04 09:37 "아까랑 똑같다" → 원인: 머리(큰 급여·복리후생 아이콘·주소줄·저장 상자)와 회색 테두리 상자가 그대로. Lee 09:45 "일단 놔두고 나중에".
- 알바몬 데모 결정된 것: 역 도보시간→Google 지도 링크, 지원자 통계 빼기, 이미지·표 상세는 다음 주, 유료상품은 자리만. 남은 단계 2) 지원방법·담당자·사기주의·기업정보 3) 고용주 작성 1/6~6/6 4) 고용주 템플릿·직무표.
- 등록 방식 결정(Lee 11-04): 공고는 모아서 PR 한 번에(건당 시간 단축), 등록 전 검사표를 미리 돌림.

## 2. 다음 할 일
1. **Lee 결정 대기 — 상세 항목 정리안**: docs/plans/2026-11-04-detail-items-proposal.md(엑셀 2개와 같은 내용). ① 근무조건을 "번호 순서·앞이 없으면 당김·PC/휴대폰 같은 항목"으로, ② 모집조건 중복·확정 목록 밖 항목 정리, ③ 근무지 여러 곳 모두 표시. 10-30 확정 목록 변경이라 Lee "예" 후 구현(예상 40~50분: 코드 15분+PR 검사+배포 검증). 구현 시 #462(balanceConditionColumns) 대체, JobDetail.tsx 바꾸면 jobDetailSections.test.ts도 바꿔야 정책 검사 통과, desktop baseline 해시 갱신.
2. Lee: FB 수집기 — 쿠키 재등록 또는 베트남 IP/전용 계정(결정 대기). 그동안 Lee가 글·캡처를 주면 공고 파일 → ops-insert-job → 검사(job-ocr-check) → 운영 상세 글 직접 확인.
3. (보류) 알바몬 상세 데모(demo/detail-header-albamon b06134b, 데모 링크는 이 데모로 복구해 둠). #5422 "05 chuyên viên tuyển sinh"(특수 글꼴) 줄은 기타 칸에 남음(원문 글자라 손 안 댐).
## 3. 필수 규칙 (이번 지적)
- 질문("왜 비었어?")에는 답만. 고치라는 말 없으면 고치지 말 것(#462 사고). 화면 변경은 글 모형 → Lee 결정 → 구현. 보고는 한국어로만(영어로 쓰지 말 것 — 오늘 여러 번 지적).
- 확인용 촬영(demo-capture)을 demo/** 브랜치로 돌리면 데모 고정 주소가 바뀜 → 끝나면 vercel-deploy를 demo/detail-header-albamon으로 다시 실행해 복구.
- 공고 등록 뒤 운영 상세 화면 글을 직접 처음부터 끝까지 읽고 보고(검사표 통과만으로 완료 금지). 근무지 실제 사진도 공고 사진으로 넣음. 기존 프로세스는 웬만하면 건드리지 말고 내가 만든 문제만 고침. Lee가 하던 일을 대신하면 먼저 말할 것. 한국어로만.
- 결과만 보고. 중간보고 금지. 끝나면 바로 "완료". 모르면 먼저 확인하고 말할 것(이미 있는 키·설정 확인 없이 요청 금지).
- 얘기 끝나기 전에 작업 시작 금지. 시킨 범위만(예: "앞으로 들어가는 것만" → 기존 공고 손대지 않음).
- 같은 얘기 반복 금지. 이미 정한 건 다시 묻지 말 것. 시간 추정은 실제 작업 기준으로.
- "똑같이 만들어" = 참고 화면을 그대로 옮기는 것(우리 화면 덧칠 아님). 참고 화면이 없으면 먼저 캡처를 받을 것.
- 데모 링크는 https://jobi-demo-mshw1895-6089s-projects.vercel.app/… (고정 주소. CLAUDE.md의 jobi-git-… 형식은 옛 것).
```

## 2026-11-04 18:15 — 칸 나누기·근무조건 빈칸·상세 항목 정리안 (Claude)
- 요청: Lee "다 고치고 링크줘"(칸 오분류) → #461 / "왼쪽 자리 왜 비운거지?"(질문) → 내가 마음대로 #462로 고침(Lee 지적) / "각 항목마다 번호가 있고 앞에꺼 없으면 앞당겨지는 형식" → 항목 목록·정리안 엑셀 2개 / "지피티가 이어서 하게 인수인계".
- 변경: #461 jobDetailSections·jobDetailFill 줄 규칙 + 홍보 거르기 칸 무관(지원 방법·근무 조건 낱말 있으면 남김) / #462 JobDetail balanceConditionColumns(최신 틀만) / docs/plans/2026-11-04-detail-items-proposal.md.
- 검증: demo-capture로 운영 데이터 4건 상세 글 확인, deploy-verify 41802750244·41814801256 success. 10-16 "영역 당기지 않기" 규칙은 PR #107(Lee 지시)에서 온 것 확인.
- 남은 문제: 정리안 Lee 결정 대기. 로컬 npm 저장소 차단으로 tsc·build는 CI만.

## 2026-11-04 15:40 — 공고 4건·Google 키·상세요강 거르기 (Claude)
- 요청: Lee "공고 2개 추가해"(#5421·#5422, Lee Chrome에서 FB), 캡처 2건(#5437 DOOKKI·#5438 Team Robotics), "GOOGLE_PLACES_API_KEY 없어?", "상세 페이지는 중요한 내용만" → 적용.
- 변경: #450·#452~#458 공고 파일·내 실수 고침(직업분류 9→9402, 급여 꼬리, 회사명 R5, 신청 링크 줄, 포스터 옮김 제거, 건물 사진) / #459 jobDescriptionBuild 거르기 + jobInspect 예외 + 옛 규칙 시험 갱신 + CLAUDE.md ④ / PR #451(카드 규칙 변경)은 Lee "기존 프로세스 건들지 마"로 닫음.
- 검증: 검사표(41798722777) 4건 공개, 남은 문제는 급여 없는 메인 카드 2건(기존 규칙). demo-capture로 운영 데이터 상세 글 직접 확인. deploy-verify 41798740354 success.
- 남은 문제: 상세요강 칸 오분류(위 HANDOFF 1번), 로컬 npm 저장소 차단으로 tsc·build는 CI에만 의존.

## 2026-11-04 09:50 — 알바몬 구직자 상세 데모 2단계 (Claude, 보류·운영 미반영)
- 요청: Lee "구직자 상세 최신 틀을 알바몬 모바일 상세와 똑같이"(카드 상자 없이·구분선·제목 20px·회색 이름 칸). 09:10 "우리 거 말고 알바몬과 정확히 똑같이" → 캡처 8장 받음. 09:45 "일단 놔두고 나중에, 지금까지 만든 거 프로세스에 등록".
- 변경(demo/detail-header-albamon): c99ccd1(우리 틀 덧칠 — 잘못 이해) → 6229a6d(캡처 색·크기 맞춤, src/index.css v2 전용 블록) → b06134b(demo-capture가 sb-5342 화면 전체 촬영). cty-kda-comparison에 4828 로고 크기·회사명 글자 제외 3항목, desktop baseline 해시 갱신.
- 검증: desktop baseline 8/8, 데모 deploy·capture success(CI npm run build 포함). 로컬 tsc·build는 npm 저장소 접속 막혀 못 돌림. KDA 비교 검사는 안 돌림.
- 남은 문제: 머리 부분·회색 테두리 상자가 그대로라 Lee 눈에 "아까랑 똑같음". 다음에 머리 정리 여부 Lee 예/아니오부터.

## 2026-11-04 07:35 — 11-03 저녁~11-04 아침 묶음 (Claude)
- 요청·변경: Joy Thái 사진(식당 우선 #430)·로고 막힘 제거·브랜드 분류 식당/판매(#431·#432, JoyThai 브랜드) / Bảo An VCC #5368 등록·포스터 소제목 규칙(#433~#435)·위치 확정(Google 링크, 수동 도구 #444) / 공단 밖 회사 이름 위치 찾기 Goong→Google(#438·#439·#442, Vercel에 Google 키 없음) / 여러 직무 급여 칸(#440, 11-04 직무|금액 두 칸) / 위치 계산 절차·Google 규칙(#436·#437·#443) / Tâm Hồ Nhất Hạch #5405(Lee Chrome에서 FB 글, #445·#446) / 최신 틀 디자인(#447: 상자 높이·간격·테두리·급여 26px·상세요강 문서형·보험 짧은 표시, KDA·예전 3건 제외).
- 검증: 각 PR 필수 검사 + deploy-verify(최종 41744451652 success, 663dce4).
- 남은 문제: Vercel GOOGLE_PLACES_API_KEY 없음(Google 위치 단계 꺼짐), FB 수집기 session_expired, 검사표가 좌표만 있으면 '정확한 위치'로 표시, DB만 바뀐 병합 뒤 deploy-verify 자동 시작 안 됨.

## 2026-11-03 17:15 — Joy Thái 공고 #5342·직무 제목 규칙·업종 사진 (Claude)
- 요청: Lee "페이스북 크롤링 1건 진행"(수집기 session_expired → Lee가 원문·글 주소 제공), "메인에 왜 없어?", "로고 없으면 사진 넣기로 하지 않았어?", "데모 진행해서 허락한 거는 다 완료".
- 변경: #424·#425 공고 파일(scripts/ops/jobs/fb-joythai-20261103.json, 첫 등록은 R3 출처 없음으로 거부 → 글 주소 추가) → ops-insert-job #5342 → ops-publish-jobs. #426 isRoleHeading 대문자 직무 제목·roleSalaryLines 금액만 줄·roleConditionSummary 없는 값 지어내지 않음·detail-fill 규칙 파일 추가. #427 JobCard 업종 사진(cardPhoto.ts, public/images/industry).
- 검증: 운영 상세 sb-5342 직접 확인, 운영 메인에 Joy Thái·업종 사진 직접 확인, deploy-verify 41615464877·41616250543 success.
- 남은 문제: FB 수집기 쿠키·잠금(Lee), 휴대폰 메인(한 번에).

## 2026-11-03 17:30
- 요청: Lee "거리재는 거 어디 갔냐 — 그냥 보이게 해", "저거 꼭 필요한 거야?" → 진행
- 변경: PC 메인 위치 칸 — 반경 칸 항상 표시, 펼침 메뉴·중복 Gần tôi 제거
- 파일: DesktopHomeMapExplorer.tsx, test-desktop-baseline.mjs(해시), test-home-map-providers.mjs, test-mobile-home.mjs(PC 부분 메뉴 열기 클릭 제거)
- 검증: desktop baseline 8/8, tsc 새 오류 없음(로컬 모듈 없음), CI는 PR 검사

## 2026-11-03 16:00 — 지역 기준 통일·지역별 일자리 페이지·지도 고르기 (Claude, PR #422 운영 반영 d2b40f0)
- 요청: Lee 11-03 "급구 페이지 지역 0건", "지역명 서로 맞춰야", "급구가 아니라 지역별로", "알바몬처럼", "A 지도 데모", "섬·Hoàng Sa·Trường Sa까지", "최근 행정구역 다시 확인", "5~8 수정진행", "PC 왼쪽 거리·급여만".
- 원인: 급구 지역 필터가 자동으로 채워지지 않는 DB 칸(resolved_*)을 봄 + 화면마다 지역 목록 3가지. 급구 0건은 urgent 공고 자체가 0건(급구 표시는 FB·TopCV 수집기만 켬).
- 변경: 지역 판정 함수 하나(jobArea/jobAreaWards, 주소 글자 기준), 행정구역 9월판 생성기(gen-vn-admin.py, 3월판으로 기존 자료와 동일 확인), 옛 동 대응표, /viec-lam/khu-vuc 페이지·메뉴 34개 성, 지도(ProvinceMap, 섬 vnIslands.ts), 알림 키워드 생성(regionKeywords.ts) + migration(미적용), 수집기 판·공통 시험.
- 검증: 대응표 10,023개 시험(후보 포함 100%, 틀린 단일 0), 전국 600 표본 동 정확 4%→98%, 데모 빌드 통과, 알림 migration 로컬 폐기 DB dry-run 통과. 화면은 Lee 캡처로만 확인.
- 운영: #422 병합(알림 migration 제외, PC 기준 화면 지문 갱신, jobCoords 회귀 시험 추가), Production READY, deploy-verify 41606871616 success.
- 남은 문제: 알림 34개 migration은 Lee가 공고 올린 뒤. 주소에 동이 없는 공고는 동 후보 여럿/없음(정보 부족). 휴대폰 화면은 나중에 한 번에.

## 2026-11-03 09:40 — R8 규칙 복구·상세 급여 줄·식비 수당·지도 묶음 확대·규칙 장치 (Claude)
- 요청: Lee 11-02 밤~11-03 지시(규칙 장치 "진행해", R8 "진행해", 급여 아래 줄 모양, "식사제공이나 식비제공", 지도 묶음 "확대할수록 위치가 정확해져야지", 검사 구멍 "1번은 다시 수정할수있는거야?").
- 변경: #413 규칙 장치(.claude/RULES_CORE.md·세션 시작/매 메시지/커밋 전 tsc·build 검사, CLAUDE.md 바꾸면 요약본도 바꾸게 검사). #414 R8 직업코드 1~5단계 허용 재적용(migration 20261103000000) + occupation-r8-apply가 옛 10-15 migration을 다시 돌리던 단계 제거(11-02 제가 수동 실행해 규칙이 되돌아간 사고). #415 급여 아래 줄(상여·수당·지급방식) 작은 회색 글씨·금액과 정렬, 식비 수당 → "Phụ cấp ăn"(src/lib/mealBenefit.ts, AI 분류 규칙 버전 올려 기준 이후 공고 재판정). #416 Phụ cấp ăn 분홍 태그 중복 숨김. #417 지도 묶음 핀 누르면 묶인 공고 전부 보이게 확대 + 확대 중 다시 묶기(PC·모바일 같은 코드). #418 PC 기준 화면 지문 갱신. #419 그 지문 검사가 상세 화면·CSS PR에서도 돌게.
- 검증: 각 PR 필수 CI 통과·병합, migrations-apply 41545099335·deploy-verify 41554557710 success, #5299 상세 직접 확인.
- 남은 문제: 데모(demo/home-photo-cards 0409871, 모바일 메인·업종 사진 5종 추가) 운영 반영은 Lee 결정 대기. 끝난 브랜치 삭제는 권한 없음(Lee).

## 2026-11-02 20:50 — Facebook 공고 1건(Vua Nệm, #5299) 등록·규칙 2개 수정 (Claude)
- 요청: Lee "페이스북 공고 1개 크롤링" → Vua Nệm 판매 직원 승인("공고 올리면 내가 볼께").
- 변경: FB 쿠키 만료(session_expired)로 수집기 대신 Lee Chrome(Claude in Chrome)으로 원문을 읽고 공고 파일(scripts/ops/jobs/fb-vua-nem-20261102.json) → ops-insert-job(입구 ingest_job)으로 등록. 직업코드를 넣지 않아(10-17 규칙 위반) 검사 실패 → PR #410: R8 보충이 기존 공고 보호 기준(cutoff) 지키게 + 꾸밈말 소제목("QUYỀN LỢI HẤP DẪN:") 인식. R8 수동 실행(보호 3건 그대로, #5299만 5223) → 재검사 통과·공개.
- 검증: 검사표 #5299 전부 통과, 연속 통과 4/10, deploy-verify d97f1dc success, 운영 상세 화면 직접 확인.
- 남은 문제: 상세 "Thông tin tuyển dụng"에 필수 Hạn nộp·Số lượng·Hình thức(미정/상시모집) 표시가 앱 전체에 없음(KDA도 없음, 10-30 체크리스트와 차이 — Lee 지시 전 변경 안 함). 공고 파일 경로가 직업 분류기를 안 돌림(후속).

