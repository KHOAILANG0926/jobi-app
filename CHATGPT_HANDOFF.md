# CHATGPT_HANDOFF — 모바일 홈 구성 1차
갱신: 2026-10-16 (Asia/Bangkok)

## 1. 현재 상태
- [직접 확인] 기준 origin/master eb36b53, 별도 branch feat/mobile-home-composition-20261016. 기존 모바일 PR #102 및 검사 PR #101/#103 조회; 다른 방향/제스처 변경이 섞여 있어 병합하지 않음.
- [직접 확인] 영상 기준 모바일 상단 위치/검색/메뉴, 공고 3개 묶음 좌우 넘김, 5개 바로가기, 가로 필터, 지도/목록 전환, 데이터 기반 공고 영역과 하단 4개 실제 라우트 구현. 기존 지도 제스처/좌표 승인/연락/상세 정책 유지.
- [직접 확인] PC/mobile 첫 방문 위치 선택 안내. GPS는 명시 클릭 뒤 기존 함수만 호출; 거부 시 지역 직접 선택. sessionStorage에는 안내 닫힘 여부만 추가(좌표 아님). 홈 카드/목록은 같은 지도 필터 결과 사용. 지역 선택 시 실제 지역 매칭; 미확인 좌표는 반경 결과에서 제외.
- [직접 확인] 타입/클라이언트+SSR 빌드, npm test 61/61 성공. 그룹 0/1/2/3/4/7건·중복 제거 검사. 브라우저 설치 CDN 다운로드가 0바이트 zip으로 실패해 원격 환경 실제 화면 미검증. 새 PR CI에서 360/390/412/1366px 실공개 캡처 및 격리 브라우저 fixture 동작 검사를 실행할 예정.
- [기존 기록] STATUS 생성 2026-10-16 08:42 VN: master/Production eb36b53 success, 공개 공고 3건. 운영 DB 직접 조회/변경 없음.
- [미검증] 새 브랜치 Vercel Preview·원격 화면 검사. IMPLEMENTED이며 VERIFIED/APPROVED/DEPLOYED 아님. 상세 docs/MOBILE-HOME-R1-report.md.

## 2. 다음 할 일 3개
1. 원격 화면 CI와 Vercel Preview에서 캡처/동작 확인, 같은 원인 2회 실패 시 반복 중단.
2. 실제 캡처·Preview URL·검증 결과를 사용자에게 제시하고 수정사항 반영.
3. 사용자 미리보기 검토 전 master 병합/Production 배포 금지. 운영 DB/Auth/권한/좌표 정책 변경 금지.

## 3. 필수 규칙
- AGENTS.md/CLAUDE.md, 직접 확인·기존 기록·미검증 분리. GitHub에 소스 보존 전 완료 처리 금지.
- 가짜 공고/급여 환산/미확인 조건 생성 금지. 한국 슬롯은 Korea 전용 API/컴포넌트.
- STATUS/status 브랜치/검증 장치 기존 파일 수정 금지. 새 모바일 화면 workflow는 읽기 전용, secret 없음.
