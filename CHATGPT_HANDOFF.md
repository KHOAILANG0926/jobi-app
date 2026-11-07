# HANDOFF — 2026-11-07 밤 (Claude) · 회사 이름 읽기 한 곳·카드 상호·급여 동 금액

## 1. 현재 상태
- master 946cd4f(#533 급여 동 금액) — deploy-verify 42382412330 성공 [직접 확인].
- 회사 이름 읽기(Lee 11-07, 기존 방향 변경): src/lib/companyReader.ts 한 곳(사이트 칸 → 원문 → 포스터 글자). 회사 이름 없으면 수집 안 함(no_company / poster_read_failed). 소개소는 소개소 이름 + recruiter_agency(DB #525), 수수료·보증금 소개소는 수집 안 함(agency_fee). 잘못 읽은 공고는 companyReader.test.ts 사례 추가 → 함수 수정(#523~#528). 기존 공개 공고 이름은 바꾸지 않음(company-reread 읽기 전용 목록).
- 카드 상호(#531, Lee 11-07): 회사 형태 낱말(CÔNG TY·TNHH·CỔ PHẦN·CTY) 빼고 최대 2줄, 지점은 지역 줄("지점, 성"), 지역뿐인 지점은 버림, 제목에서 상호·지점 반복 안 함. 카드만(src/lib/cardText.cardCompanyParts — JobCard·HomeDiscovery). DB·상세 그대로.
- 급여 읽기(#533): salaryReader에 동 전체 금액·k 금액(지급 단위 붙은 것만, 수당·비용 줄 제외), "/N tiếng·/Nh"(N≥2) = 일급. detail-fill이 #5633 급여를 채움(빈칸 → 320.000đ/12 tiếng). 미리 보기: company-reread.yml field=salary(읽기 전용).
- 대표 사진·로고·Google 월 한도·브랜드 로고 그림·주소 읽기 한 곳: 이전 스냅샷 그대로(#516~#521, WORK_LOG).
- 모바일 홈 검사(mobile-home)의 지도 미표시 안내 시험은 계속 실패 — 병합 필수 검사 아님, Lee: 오래된 폰은 신경 쓰지 않음(그대로 둠).
- 소개소 표시(Lee 11-07): 원래 '채용 형태' 칸 recruitment_type='agency' 하나만(#536, 따로 만든 recruiter_agency 칸은 #537로 삭제·migrations-apply 42391081797 성공). 화면 "Qua công ty cung ứng" 보통 색(경고색 뺌) — 상세 맨 위·메인 지도 창·카드 접힌 조건·휴대폰 지도 거르기. 판정 = 이름 인력 낱말+다른 근무지 / 다른 회사를 위해 뽑는 문구 / 같은 번호가 회사 코드표에 다른 회사로 쓰임.
- VPS AZDIGI 다음 납부 2027-02 초 — 기한 전 Lee에게 알림.

## 2. 다음 할 일 3개
1. Lee 지시 시 Muaban·Chợ Tốt 수집(집에서).
2. 소개소 중복 판정에 공장·공단 이름 비교(Lee A 결정) — 공장 이름 저장 방법을 Lee에게 보고 후 진행(위치 칸에 넣으면 공장 핀이 생겨 '핀=소개소 사무실'과 어긋남).
3. Facebook 1건씩 등록 계속(원문 업무 먼저 읽기).

## 3. 필수 규칙
- 확인하고 말한다(추측 금지), 기존 프로세스 먼저 확인, 덧대기 금지. 보고는 한국어·최종 보고만·짧게. 프로세스대로 끝났으면 완료(임의 조건 붙이지 않음).
- 운영 DB 직접 SQL·번호 지정 덮어쓰기 금지, DDL·데이터 변경은 STRICT(Lee 승인).
- 비밀값(키·쿠키) 어디에도 출력 금지. 로그인은 Lee가 VPS에서.
- 완료 = PR → 검사 → 병합 → 배포 → deploy-verify → 화면 확인 → HANDOFF·WORK_LOG.
