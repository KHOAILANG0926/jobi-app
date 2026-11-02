# HANDOFF — 모바일 메인 데모 정리 + Facebook 공고 1건(#5299) 공개 (2026-11-02 저녁, Claude)

## 1. 현재 상태
- master(운영) d97f1dc: PR #410(R8 보충이 기존 공고 보호 기준 지킴 + 꾸밈말 소제목 인식) 병합, deploy-verify 통과.
- 공고 #5299 Vua Nệm 판매 직원(Facebook, 446 Ngô Gia Tự Bắc Ninh) 공개. 검사표 전부 통과, 연속 통과 4/10.
- 데모 demo/home-photo-cards(bd83642, 운영 미반영), 링크 https://jobi-demo-mshw1895-6089s-projects.vercel.app (Vercel 로그인 필요 — GitHub로 로그인). 내용: PC 메인 칸 나누기·업종 사진, 모바일 메인 정리(급여 높은 공고 2열 카드 / 실시간 공고, 지도를 배너 바로 아래, 지도 위 글자 필터 줄, 지도 아래 한 줄 요약→목록 탭, 배너 210px, 위치 안내·조건 검색 상자 제거).
- Facebook 수집기: GitHub Secrets 쿠키 만료(session_expired). 대신 "Lee Chrome(Claude in Chrome)으로 원문 읽기 → 공고 파일 → ops-insert-job" 경로로 등록 가능(쿠키 불필요).

## 2. 다음 할 일
1. Lee 결정 대기: ① 업종 사진 2번 방안(AI가 정해진 목록에서 고르기)·데모 적용 시점·상세 로고 자리 82×94 ② 모바일 지도 미리보기+같은 지도 전체 화면 확대(결과를 움직이면 바로 / 버튼으로) ③ "Có phụ cấp ăn uống"(식비 수당)을 Ăn ca 아이콘에 켤지.
2. 공고 등록 대기: Hòa An(KCN Thuận Thành 3, 9329 lao động phổ thông, 포스터), Haidilao(Lee 제공, 복수 직무 → Theo vị trí). R3 Lee 확인 기록으로 출처 인정, 직업코드·근거 함께 등록.
3. 공고 파일 경로(ops-insert-job)가 저장 전 직업 분류기·필수 항목을 검사하게(장치로 강제). 상세 "Thông tin tuyển dụng" 필수(Hạn nộp·Số lượng·Hình thức, 미정/상시모집) 표시가 앱 전체에 없음 — 10-30 체크리스트와 차이, Lee 지시 전 변경 금지.

## 3. 필수 규칙 (이번 지적)
- 공고 등록 전 CLAUDE.md "공고 등록 전 직업분류 확인"·"공고 상세페이지 구성"·"Lee 제공 공고" 절을 먼저 대조. 직업코드·근거 없이 등록 금지.
- 계정을 바꾸면: GitHub 연결(KHOAILANG0926로 로그인된 상태), Claude in Chrome 로그인, 그 Chrome 프로필의 Facebook·Vercel 로그인부터 확인.
- 보고는 짧게, 한 번에, 한국어로만. 문제만 물으면 문제만. [직접 확인]/[기존 기록]/[추정] 구분.
