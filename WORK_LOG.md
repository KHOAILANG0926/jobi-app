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

## 2026-11-01 저녁 — 메인 화면 구분 기준 확정 (Lee)
- 순서: 특별한 알바(맨 위) → 주목받는 알바 → 브랜드 알바 → 전체. 브랜드=체인 3곳 이상+매장 일치, 특별=혜택 2개 이상 또는 높은 급여(숫자 기준은 구현 전 확정). 상세는 CHATGPT_HANDOFF.md.

## 2026-11-01 저녁 — 옛 HANDOFF 본문 보관 (Claude)
    # HANDOFF — 검사 통과해야 공개되는 틀 (2026-11-01, Claude)
    
    ## 1. 실제 상태
    - PR #376(fix/inspect-content-hash-20261101): 내용 지문 트리거 + 검사표 3항목 + 상세요강 빌더 수정. 병합·운영 migration·#5157 화면 확인 전에는 완료 아님.
    - 공개 규칙: crawler/admin 공고는 `ocr_check.inspect.content_hash`가 지금 내용과 같고 `publishable=true`일 때만 공개(트리거 trg_zzz_inspect_current). 공개 시작(새 공고·비공개→공개)만 막고, 공개 중인 공고는 내용이 바뀌어도 유지 → job-inspect가 재검사 실패 시 내림(20261101170000).
    - 직접 Supabase 운영 DB SQL 금지(읽기 전용 조회만). migration + production_check 경로만.
    
    - 결정 0007(회사명·지점명 줄) 화면 반영: src/lib/companyBranch.ts. 다수 지점(결정 3)은 아직 미구현.
    
    - 2026-11-01 "빠짐 0": 상세요강은 원문 줄을 소제목·사이트 글자·완전 중복 외엔 빼지 않음(10-30 ④). 칸 정하는 순서는 src/lib/jobDetailFill.ts 머리말 한 곳. 실제 공고 시험 src/lib/realJobs.test.ts(새 유형은 원문 추가).
    
    ## 2. 다음 할 일
    1. #376 병합 → migrations-apply 운영 적용 → job-ocr-check 실행 후 #5157 통과·공개, #4982 비공개(R11) 확인.
    2. Lee 확인: 10-30 "④ 원문 전체 보여줌"과 급여 총액 빼기·포스터 머리글(HIGHLANDS COFFEE/TUYỂN DỤNG 등) 기타란 처리 충돌.
    3. 규정 표 check_ref 강제(20261101150000): 새 규정은 장치(trigger:/inspect:/ci:/decision_*/work_rule)와 함께만 저장.
    
    - PR 설명란: 검사 결과는 미리 적지 않아도 됨(pending 허용). 실제 결과는 봇 병합이 확인.
    
    - publish_gate_reason은 DB 트리거(trg_zz0_publish_gate)가 계산·덮어씀. 수집기 값은 무시됨.
    
    ## 3. 필수 규칙
    - 특정 공고 번호 전용 코드 금지, 틀(규칙·검사)로만 수정. 검사 통과 전 공개 우회 금지.
