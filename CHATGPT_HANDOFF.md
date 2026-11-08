# HANDOFF — 2026-11-08 (Claude) · 알바몬 따라 하기 1~6번 + 머리 줄·메뉴·바닥

## 1. 현재 상태
- 이름(Lee 11-08): 로고 글자는 브라우저 탭과 같은 "Việc gần Bạn"(머리 줄·바닥). 바탕색은 그대로(#f7f7f7). 약관·SEO 제목까지 전부 "Việc gần Bạn"(주소 viecganban.vn·이메일 그대로).
- 머리 줄·메뉴·바닥(Lee 11-08 "메인 화면만 빼고 다 적용"): 알바몬 PC 실측 기준 — 로고+검색 칸(/viec-lam/tim-kiem?q=), 메뉴 18px 굵게·이모지 없음·펼침 4칸(col)·아래 어둡게, 오른쪽 버튼 회색/흰 테두리(원래 자리 첫 줄 오른쪽 — 로그인 시 버튼이 늘어 메뉴 줄에 두면 넘침, 960 이하 검색 돋보기), 바닥 SiteFooter(PC·휴대폰 공용). CSS는 src/components/siteChrome.css 한 곳. 메인 본문·공고 카드·상세는 그대로(카드 변경 데모는 Lee 거부로 되돌림 — 카드 틀 변경 금지 재확인).
- 알바몬 따라 하기(Lee 11-08 "이거먼저", DB 변경 없음): ① 고객센터 FAQ·공지 /ho-tro ② 벽보 만들기 /lam-poster(내 공고만, 그림 받기·인쇄) ③ 테마 채용관 /chu-de/:slug 8개(ServicePages.tsx) ④ 등록 화면 급여 칸 'Tính lương Gross ↔ Net' 링크 ⑤ 임시저장(이 브라우저에만, 사진·핀 제외) ⑥ PC(≥1240) 오른쪽 체크 목록. 미리보기는 상세 화면(승인된 틀)을 고쳐야 해서 뺌. 7번(새 입력 칸, DB)·8번(간편 템플릿)은 미승인 — 데모 브랜치 demo/albamon-template에만.
- master 946cd4f(#533 급여 동 금액) — deploy-verify 42382412330 성공 [직접 확인].
- 회사 이름 읽기(Lee 11-07, 기존 방향 변경): src/lib/companyReader.ts 한 곳(사이트 칸 → 원문 → 포스터 글자). 회사 이름 없으면 수집 안 함(no_company / poster_read_failed). 소개소는 소개소 이름 + recruiter_agency(DB #525), 수수료·보증금 소개소는 수집 안 함(agency_fee). 잘못 읽은 공고는 companyReader.test.ts 사례 추가 → 함수 수정(#523~#528). 기존 공개 공고 이름은 바꾸지 않음(company-reread 읽기 전용 목록).
- 카드 상호(#531, Lee 11-07): 회사 형태 낱말(CÔNG TY·TNHH·CỔ PHẦN·CTY) 빼고 최대 2줄, 지점은 지역 줄("지점, 성"), 지역뿐인 지점은 버림, 제목에서 상호·지점 반복 안 함. 카드만(src/lib/cardText.cardCompanyParts — JobCard·HomeDiscovery). DB·상세 그대로.
- 급여 읽기(#533): salaryReader에 동 전체 금액·k 금액(지급 단위 붙은 것만, 수당·비용 줄 제외), "/N tiếng·/Nh"(N≥2) = 일급. detail-fill이 #5633 급여를 채움(빈칸 → 320.000đ/12 tiếng). 미리 보기: company-reread.yml field=salary(읽기 전용).
- 대표 사진·로고·Google 월 한도·브랜드 로고 그림·주소 읽기 한 곳: 이전 스냅샷 그대로(#516~#521, WORK_LOG).
- 모바일 홈 검사(mobile-home)의 지도 미표시 안내 시험은 계속 실패 — 병합 필수 검사 아님, Lee: 오래된 폰은 신경 쓰지 않음(그대로 둠).
- 소개소 표시(Lee 11-07): 원래 '채용 형태' 칸 recruitment_type='agency' 하나만(#536, 따로 만든 recruiter_agency 칸은 #537로 삭제·migrations-apply 42391081797 성공). 화면 "Qua công ty cung ứng" 보통 색(경고색 뺌) — 상세 맨 위·메인 지도 창·카드 접힌 조건·휴대폰 지도 거르기. 판정 = 이름 인력 낱말+다른 근무지 / 다른 회사를 위해 뽑는 문구 / 같은 번호가 회사 코드표에 다른 회사로 쓰임. 소개소끼리 중복은 실제 근무 공장·공단(agency_workplace_key, 화면 미사용, #540 migrations-apply 42392546481·deploy-verify 42392718489 성공)까지 비교.
- VPS AZDIGI 다음 납부 2027-02 초 — 기한 전 Lee에게 알림.

## 2. 다음 할 일 3개
1. Lee 지시 시 Muaban·Chợ Tốt 수집(집에서). 알바몬 7번(DB 칸)·8번(템플릿)·미리보기는 Lee 결정 대기.
2. (완료 #540) 소개소 중복 판정 공장·공단 비교 — 다음: Lee 지시 시 Facebook·Muaban 수집.
3. Facebook 1건씩 등록 계속(원문 업무 먼저 읽기).

## 3. 필수 규칙
- 확인하고 말한다(추측 금지), 기존 프로세스 먼저 확인, 덧대기 금지. 보고는 한국어·최종 보고만·짧게. 프로세스대로 끝났으면 완료(임의 조건 붙이지 않음).
- 운영 DB 직접 SQL·번호 지정 덮어쓰기 금지, DDL·데이터 변경은 STRICT(Lee 승인).
- 비밀값(키·쿠키) 어디에도 출력 금지. 로그인은 Lee가 VPS에서.
- 완료 = PR → 검사 → 병합 → 배포 → deploy-verify → 화면 확인 → HANDOFF·WORK_LOG.
