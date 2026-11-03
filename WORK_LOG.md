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

## 2026-11-01 밤 — 수평 전개: 브랜드 로고·급여 표시 모든 화면 (Claude)
- 요청: Lee "수평 전개가 하나도 안 돼".
- 브랜드 로고(lib/brandLogo.ts): 공고 카드 로고 칸, 상세 맨 위 로고, 상세 회사 정보 로고(브랜드 메뉴·브랜드 화면은 이미). 해당 없음: 모바일 목록·지도 창·추천 카드(로고 칸 없음), 관리자 입력 화면.
- 급여 표시 한 곳(components/SalaryText.tsx): 지도 창(PC·모바일), 추천, 추천 페이지, 급구 표, 저장 목록·표, 최근 본 표, 내 정보 저장 목록, 지원 창, 알림 목록(카드·모바일 목록은 같은 cardSalary 규칙). 해당 없음: 관리자·고용주 입력 화면, 상세 화면(원문 그대로 보여 주는 칸).
- CLAUDE.md "수평 전개 점검" 규칙 추가.

## 2026-11-01 밤 — 공고 카드 정리 운영 반영 (Claude)
- 요청: Lee "적용" — 데모 demo/card-albamon.
- 변경: 급여 한 줄(지급 단위 색: 월급 빨강·시급/연봉 파랑·일급 보라, 금액 회색, 직무 여럿이면 회색 "₫ Xem lương theo vị trí" — 10-30 직무별 2줄 규칙을 Lee가 바꿈), 위치는 동/성까지(shortArea), 제목 보통 굵기, 카드 글자만: 회사 끝 지역·제목 속 회사 이름 빼기·전부 대문자 제목 완화(cardText). 로고 칸·유료 그라데이션 띠 그대로. PC 카드(JobCard)·모바일 목록(HomeDiscovery).

## 2026-11-01 밤 — 브랜드 로고(공식 사이트 아이콘) (Claude)
- 요청: Lee "대기업들은 자체 로고가 있잖아 그거 넣어줘". 화면은 domain의 공식 사이트 아이콘을 로고로 씀.
- 변경: migration 20261101230000 — Highlands(highlandscoffee.com.vn), Trung Nguyên Legend(trungnguyenlegend.com), Wallace(wallacevn.com), Xanh SM(greensm.com) domain. 공식 주소 확인 못 한 브랜드(SPX·Tamba·Orange·Americano 등)는 그대로.

## 2026-11-01 저녁 — 확인된 체인 브랜드 3개 등록 (Claude)
- 요청: Lee "진행하자"(브랜드: 공식 출처 지점 3곳 이상 + 매장 일치).
- [직접 확인] Highlands 1,000호점(tapchicongthuong 2026-06-12), Trung Nguyên Legend 22(중국)+5(미국)(VCCI), Wallace 공식 페이지 24개 지점(gà rán·hamburger). Wallace 공식 페이지는 CS9 "219 Nguyễn Trãi", 공고·foody는 216 — 1번지 차이 기록.
- 변경: migration 20261101210000(job_brands 확인 칸 4개 + 브랜드 3개·별칭), production check, CI 단계. 기존 13개 브랜드 불변.

## 2026-11-01 저녁 — 확인된 음식점이 "Vệ sinh / Giúp việc" 메뉴에 나오던 문제 (Claude)
- 원인 [직접 확인]: 코드 5 → category dich_vu → 메뉴 "Vệ sinh / Giúp việc"(cat=dich_vu). #5247 Wallace(닭튀김).
- 변경: businessType.ts 업종 종류 kind(fnb·retail·service, 이름 낱말 또는 검색 답) 기록, business-type.mjs가 kind 없는 코드 5 공고 재확인(web-v4). DB migration 20261101200000: category_for_job(code, ocr_check) — 코드 5만 fnb→am_thuc_do_uong, retail→quan_ly_ban_hang. 직업 코드·근거·공개 변경 없음. 로컬 PostgreSQL CI 스크립트·시험 통과. 운영 적용은 Lee 확인 후.
