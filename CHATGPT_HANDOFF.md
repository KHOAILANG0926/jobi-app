# HANDOFF — 사진 없는 공고 대표 사진 데모, Lee 결정 대기 (2026-11-02 06시, Claude)

## 1. 현재 상태
- master(운영) 290461f. 공개 공고 8개(기존 기록). 아래 데모는 운영 미반영.
- 데모 브랜치 demo/home-photo-cards (HEAD 9239697). 데모 링크 https://jobi-demo-mshw1895-6089s-projects.vercel.app (모든 demo/** 공유, Vercel 로그인 필요할 수 있음 — AI는 아래 촬영 장치로 화면 확인).
  - PC 메인 칸 나누기(Việc làm đặc biệt / nổi bật / Thương hiệu, src/lib/homeSections.ts) — 카드는 기존 JobCard 그대로.
  - 사진 없는 공고: 기존 카드 로고 자리(PC 70×84)가 비거나 깨질 때만 업종 사진. 순서 브랜드 로고 → 포스터 → 업종 사진 → 회사 이름 글자. 한 곳: JobCard.tsx CompanyLogo + src/lib/cardPhoto.ts.
  - 사진 15장 public/images/industry, 출처·라이선스 data/industry-photos/SOURCES.json(Wikimedia CC0·PD·CC BY). 음식: 카페 / 식당(낱말 nướng→고기구이, lẩu→훠궈, 없으면 일반 식당).
- 사진 받기: media/industry-photos 브랜치 industry-photos-fetch.yml(ROUND·ONLY 바꿔 push → Actions가 후보 커밋). 작업 환경에서 사진 사이트 직접 접속 불가, Openverse는 Actions에서도 응답 없음.
- 화면 확인: demo/home-photo-cards push → demo-home-capture.yml이 PC·모바일 메인 촬영 → screens-home-photo 브랜치.

## 2. 다음 할 일 (Lee 답 대기)
1. 데모 "적용" → PR·병합·운영·PC/모바일 확인. 같이: 상세 맨 위 로고 자리(도면 82×94)도 업종 사진으로 채울지.
2. "2번 방안": 낱말 대신 AI가 원문을 읽고 정해진 사진 목록 중에서만 고름(가게 종류별 세트, 확신 없으면 일반 사진, 결과는 공고 기록에 저장해 모든 화면 공통, 맞는 사진 없는 종류는 매주 보고). 진행 여부.
3. 이전부터: 페이스북 로그인 갱신(Lee) 후 혜택 공고 우선 수집·연속 통과 3/10→10, #5231 핀·Xanh SM 이름(Lee 지시), demo/brand-industries 미병합 상태 확인.

## 3. 필수 규칙 (이번 지적)
- 승인된 카드 틀·이미지 자리·규격 변경 금지. 업종 사진은 비는 로고 자리 대체용일 뿐(CLAUDE.md "사진 없는 공고의 대표 사진").
- 사진은 공고 내용(가게 종류·나라)에 맞는지 직접 보고 확인. 답변은 한국어로만.
- 특정 공고 번호 전용 코드 금지, 운영 DB 직접 SQL 금지, 보고는 [직접 확인]/[기존 기록]/[추정] 구분.
