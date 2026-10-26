# CHATGPT_HANDOFF — PC 헤더 A안 데모 (2026-10-26)

## 1. 현재 상태 (코드·배포·DB)
- Lee 결정: PC LayoutDesktop/CSS만 A안, demo/** Preview 확인 후 “적용” 전에는 PR·병합·운영 배포 금지.
- branch demo/desktop-header-a-20261026, base 운영6affdc2(#273). 운영은 dpl_7jEQveAGfhLxy6tHKBc8W6qv4wiJ READY, 이전 헤더정리 실제배포1회. 이번 A안 운영 배포0회.
- 로고/오른쪽 버튼 사이 네모 검색창, 기존 /viec-lam/tim-kiem?q= 키워드검색 재사용. Home와 같은 filterAndSortJobs 사용, 새 검색엔진 없음. 현재 PC Home에 별도 키워드입력창 없음.
- layout--desktop scopedCSS: 기업 버튼 var(--color-primary), 메뉴행 하단2px·선택 글자/밑줄 빨강. 기존 버튼 크기/오른쪽위치/모서리 유지. 새 아이콘·그라데이션·장식 없음. LayoutMobile·모바일 CSS 변경 없음.
- Chromium PC1440 비로그인/기업,1024/1366 넘침없음/Enter 기존검색, 모바일390 기존헤더 초록 확인. 로그인 기업은 브라우저 전용 격리 auth/API fixture이며 실제 인증과 구분. 로컬 PC2캡처 직접 열람.
- tsc/build·npm test79/79 성공. 검색결과 PC 현재메뉴 유지 및 최종 빌드 브라우저 검사 성공. 최종 로컬 PC2캡처 직접 열람, 리뷰 중요 문제 없음. DB·Auth·RLS·Secrets·STATUS·공고틀 변경 없음.
- 로컬환경은 운영/Preview도메인 접속 정책403. Preview READY·도메인SHA는 Vercel 도구로 확인, 캡처는 동일소스 로컬브라우저로 제공. 이미지를 로그로 유출하는 우회 금지.

## 2. 다음 할 일 3개
1. 최종 빌드 브라우저검사 및 리뷰 후 demo branch commit/push, 기존 Vercel Preview workflow/고정alias 확인.
2. demo 고정링크와 PC 비로그인/기업 로컬동일소스 캡처 보고. 현재 고정alias는 jobi-demo-mshw1895-6089s-projects.vercel.app.
3. Lee “적용” 이후에만 PR→필수검사→봇 병합→운영 배포1회. Preview만으로 운영반영 주장 금지.

## 3. 필수 규칙
- PC만. 버튼크기/위치 유지. 새 아이콘/둥근테두리/그라데이션/장식 금지. 검색필터 로직 복제 금지.
- DB/Auth/RLS/Secrets/STATUS·승인 공고틀 보호. Secret 출력·저장 금지. 직접확인/추정 구분.
- 이번 완료조건은 데모링크/PC캡처. 운영승인은 아직 없음. 이전 공통지도검사 실패는 별도 후속이며 이번 A안에 붙여 범위확대하지 않음.
