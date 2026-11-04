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

## 2026-11-02 18:30 — 모바일 메인 데모 정리 (Claude, demo/home-photo-cards bd83642, 운영 미반영)
- 요청: Lee 모바일 사용성("지도가 핵심", "너무 길다", 알바몬 구성).
- 변경: 모바일 메인 칸(급여 높은 공고 ≥월 7triệu 2열 카드 / 특별한 공고 / 실시간 공고, 모두 옆으로 넘김, src/lib/mobileHomeSections.ts), 카드 로고 자리(위·오른쪽), 배너 210px(10-16 축소가 #104로 되돌아간 것 복구), 위치 안내·조건 검색 상자 제거, 지도를 배너 바로 아래로, 지도 옆 설명 칸 → 한 줄 요약+목록 탭, 필터 아이콘 → 지도 위 글자 필터 줄.
- 검증: 데모 빌드·촬영(screens-home-photo) 매 커밋 확인. 목록 탭은 촬영으로 못 봄(누르기 필요).
- 남은 문제: 실시간 칸이 촬영본에서 2/2쪽으로 시작(확인 필요), "Bộ lọc" 버튼 오른쪽 잘림. 지도 미리보기·전체 화면 방식은 결정 대기.

## 2026-11-02 06:00 — 사진 없는 공고 업종 사진 데모 (Claude)
- 요청: Lee "사진 없는 공고는 사람인처럼 업종 사진으로 대신".
- 변경(demo/home-photo-cards, 운영 미반영): 처음에 카드를 사람인 모양으로 새로 만들었다가 Lee 지적("기존꺼는 왜 바꾼거야, 로고·사진 없는 것 대체용")으로 원래 카드로 되돌리고 로고 자리만 채움. 음식 사진을 카페/식당(고기구이·훠궈·일반)으로 나눔(Lee "보문뜰은 식당", "중국 식당 느낌").
- 수정 파일: src/lib/cardPhoto.ts(+test), src/components/JobCard.tsx/.css, src/lib/homeSections.ts, src/pages/HomeDesktop.tsx, public/images/industry/*, data/industry-photos/SOURCES.json, CLAUDE.md, 촬영·사진 받기 workflow.
- 검증: tsc·build·cardPhoto/homeSections 시험 통과, 데모 PC 화면 촬영(9239697) 직접 확인.
- 이전 HANDOFF(11-01 저녁): 메인 칸 구분·브랜드/특별 기준·업종 메뉴 오류·FB 로그인 — 위 HANDOFF 2번에 남은 항목만 옮김.

