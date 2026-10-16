## 2026-10-16 — 모바일 홈 구성 1차 (Codex Work 원격 환경)

- 요청: 사용자 제공 5분27초 알바몬 앱 영상에서 확인한 큰 구성 적용. 별도 브랜치·미리보기 검토 후 운영 반영.
- 변경: 모바일 위치/검색/메뉴, 실제 공고 3개 묶음 넘김, 바로가기/가로 필터, 지도·목록, 실제 데이터가 있는 공고 섹션, 하단 4개 기존 라우트. PC 최초 위치 안내. 원래 방향: 큰 한국 Hero→지도 우선; 새 모바일 방향: 작은 Korea 모듈 슬롯→대표 공고→탐색→지도/목록.
- 수정 파일: Home/Layout/main, HomeMapExplorer, HomeDiscovery+CSS, MobileBottomNavigation, KoreaHomeSlot, homeDiscovery helper/test, 브라우저 검사 script+새 workflow. 기존 DB/Auth/승인/제스처·방향 링크 변경 없음. PR #102는 재사용 병합하지 않음.
- [직접 확인] 기준 eb36b53, 원격 Git clone 성공; git push는 인증 없어 실패. 연결된 GitHub API로 브랜치/트리/커밋 보존 예정. tsc/build 통과, npm test 61/61. 자체 Chromium 설치는 CDN 0바이트 zip 오류, UI 검증은 새 CI로 이동.
- commit/push/deploy: 이 항목과 같은 커밋을 feat/mobile-home-composition-20261016에 보존. Preview/CI 대기, master/Production/DB 변경 없음. 완료 아님.

<details><summary>이전 CHATGPT_HANDOFF 원문 보존</summary>
# CHATGPT_HANDOFF — MAP-R1
갱신: 2026-10-15 (Asia/Bangkok)

## 2026-10-16 16:25 — PC 원본 그대로 복원
- 요청: 모바일 변경 직전으로 PC 전체 복원. PR105 항목별 복원 거절.
- 변경: eb36b53의 Home/Layout/지도/provider 소스를 별도 PC 파일로 그대로 사용. import 연결만 변경, 내용 SHA256 비교. 기존 상세/CSS도 원본 일치 검사. 모바일 버전 분리 보존, 신규 스타일 전체 모바일 media로 제한.
- 검증: scripts/test-desktop-baseline.mjs 원본 비교, tsc/build 및 PC/mobile 회귀. 최종 증거는 새 PR.
- commit/push/deploy: fix/exact-desktop-baseline-20261016, 사용자 복원 지시로 운영까지 진행.
- 남은 문제: 원본 자체에 있던 상세 54px 연락 영역을 임의로 재설계하지 않음. 사용자가 요구한 기준 원복 우선.
<details><summary>이전 부분 복원 HANDOFF</summary>

# CHATGPT_HANDOFF — PC 이전 버전 복원
갱신: 2026-10-16 (Asia/Bangkok)

## 1. 현재 상태
- [직접 확인] 사용자: 모바일만 요청했으므로 PC를 마지막 버전으로 복원 지시. 기준은 PR #104 배포 전 master eb36b53, 현재 운영 edfb732.
- [직접 확인] 새 브랜치 fix/restore-desktop-home-20261016, PC 배너 설명 원문·새 위치 안내 숨김·지도 전체 공고 원본·지역 선택 카메라 동작·기존 업직종 가시영역·기존 요약 문구 복원. 760px 이하 모바일은 현재 배너/공고/필터/안내 유지.
- [직접 확인] PC와 모바일 분기를 기존 화면 너비 기준에 명시. 데이터/인증/권한/좌표 승인 변경 없음. 공통 WebGL 실패 시 전체 홈 중단을 막는 예외 처리는 유지.
- [기존 기록] PR #104는 edfb732로 운영 배포 및 운영 검사 통과. 이번 복원 코드와 별개. 복원 최종 커밋·필수 CI·운영 배포 결과는 새 PR 증거 참조.

## 2. 다음 할 일 3개
1. PC 문구/안내/지역/공고 원본 회귀와 기존 모바일 360/390/412px 검사 통과 확인.
2. 사용자 PC 복원 지시에 따라 PR 병합·동일 SHA Production READY·운영 PC/mobile 검사 확인.
3. 실제 앱 링크로 결과 보고. 사용자에게 GitHub 검사 링크로 보내지 않음. 추가 개편 금지.

## 3. 필수 규칙
- AGENTS.md/CLAUDE.md 준수. PC와 모바일 영향 구분. 직접 확인·기존 기록·미검증 구분.
- 가짜 공고/임의 급여 환산/DB/Auth/RLS/좌표 승인 변경 금지. 한국 모듈 분리 유지.
- STATUS와 기존 검증 장치 수정 금지. 같은 원인 2회 수정검증 실패 시 중단. 회사 PC 보관 안내 금지.

</details>

## 2026-10-16 13:00 — PC 이전 버전 복원
- 요청: PC를 모바일 작업 전 마지막 버전으로 복원. 모바일 현재 상태 유지.
- 변경: eb36b53의 PC 배너 문구·위치 안내 없음·지도 독립 공고 원본·지역 카메라 이동·업직종 가시영역·요약 복원. 기존 760px 기준으로 모바일 동작 분리.
- 수정: Home.tsx/HomeMapExplorer.tsx/homeDiscovery.css/test-mobile-home.mjs.
- 검증: PC 원문/안내숨김/기존 지역값/독립 공고 원본 검사와 기존 모바일 회귀. tsc/build 및 최종 CI/배포 증거는 복원 PR.
- commit/push/deploy: 새 fix/restore-desktop-home-20261016 브랜치, 검증 후 운영 복원까지 진행.
- 남은 문제: 공통 WebGL crash guard는 유지. 추가 UI 개편은 하지 않음.
<details><summary>이전 HANDOFF</summary>

# CHATGPT_HANDOFF — 상단 한국 배너 복원·배포 요청
갱신: 2026-10-16 (Asia/Bangkok)

## 1. 현재 상태
- [직접 확인] 사용자 첨부 image(20261016-053726).png를 열어 작은 파란 한국 일자리 링크를 확인. 사용자가 상단을 기존대로 복원하고 즉시 배포하도록 명시 지시.
- [직접 확인] 중단된 R2(81020fd)의 추가 개편은 배포에서 제외. 31395bf 기준 시안의 나머지 코드를 유지하고 모바일에서 숨겼던 기존 서울 사진 한국 배너를 다시 표시, 작은 대체 링크 제거. 기존 배너 이미지·문구 구조·한국 라우트 유지.
- [직접 확인] 작업 브랜치 feat/mobile-home-composition-20261016 / PR #104. 운영 DB/Auth/권한/좌표 변경 없음.
- [기존 기록] 31395bf의 타입·build·전체 테스트·4개 CI 성공. 이번 복원 커밋은 모바일에서 원래 한국 이미지 표시/링크 대체 제거 검사 추가 후 최종 CI·Production 배포 확인 대상. 최종 증거는 PR #104 참조.

## 2. 다음 할 일 3개
1. 복원 커밋 타입/build와 필수 PR CI 확인. 같은 원인 2회 수정검증 실패 시 중단.
2. 사용자 즉시 배포 지시에 따라 PR 병합→그 SHA의 Vercel Production READY 확인.
3. 운영 주소 실제 화면·deploy-verify 결과 확인 후 URL과 결과 보고. 취소된 R2 재개 금지.

## 3. 필수 규칙
- AGENTS.md/CLAUDE.md 준수. 직접 확인·기존 기록·미검증 구분. GitHub 소스 보존과 최종 SHA 확인.
- 가짜 공고·임의 급여 환산·운영 데이터/Auth/RLS/위치 승인 변경 금지. 한국 모듈 분리 유지.
- STATUS/status 브랜치/기존 검증 장치 손대지 않음. 승인 재요청 없이 이번 복원 배포 수행.

</details>

## 2026-10-16 12:38 — 한국 배너 원상 복원 및 즉시 배포 지시
- 요청: 첨부 화면의 상단 한국 영역을 기존대로 복원하고 바로 배포.
- 변경: R2 추가 개편은 중단·제외, R1 31395bf 기준으로 원래 서울 사진 한국 hero의 모바일 숨김 제거. 작은 파란 대체 링크 제거. 기존 이미지·라우트 재사용.
- 검증: tsc/build, 모바일 이미지·노출·대체링크 제거 검사 및 기존 PR CI. 최종 배포 SHA와 운영 검사 결과는 PR #104.
- commit/push/deploy: PR #104에서 GitHub 보존 후 master/Production까지 사용자 명시 승인됨.
- 남은 문제: 배포·운영검사 최종 결과 대기. 영상 동일 재현 작업 재개하지 않음.
<details><summary>이전 HANDOFF 및 중단한 R2 상태</summary>

# CHATGPT_HANDOFF — 모바일 홈 구성 1차
갱신: 2026-10-16 (Asia/Bangkok)

## 1. 현재 상태
- [직접 확인] 기준 origin/master eb36b53, 별도 branch feat/mobile-home-composition-20261016. 기존 모바일 PR #102 및 검사 PR #101/#103 조회; 다른 방향/제스처 변경이 섞여 있어 병합하지 않음.
- [직접 확인] 영상 기준 모바일 상단 위치/검색/메뉴, 공고 3개 묶음 좌우 넘김, 5개 바로가기, 가로 필터, 지도/목록 전환, 데이터 기반 공고 영역과 하단 4개 실제 라우트 구현. 기존 지도 제스처/좌표 승인/연락/상세 정책 유지.
- [직접 확인] PC/mobile 첫 방문 위치 선택 안내. GPS는 명시 클릭 뒤 기존 함수만 호출; 거부 시 지역 직접 선택. sessionStorage에는 안내 닫힘 여부만 추가(좌표 아님). 홈 카드/목록은 같은 지도 필터 결과 사용. 지역 선택 시 실제 지역 매칭; 미확인 좌표는 반경 결과에서 제외.
- [직접 확인] 타입/클라이언트+SSR 빌드, npm test 61/61 성공. 그룹 0/1/2/3/4/7건·중복 제거 검사. 로컬 Chromium 설치 실패 후 GitHub 원격 CI에서 360/390/412/1366px 실공개 캡처·격리 fixture 검사가 9384c26 기준 성공. 390px 홈/필터 및 PC 캡처 직접 확인.
- [기존 기록] STATUS 생성 2026-10-16 08:42 VN: master/Production eb36b53 success, 공개 공고 3건. 운영 DB 직접 조회/변경 없음.
- [직접 확인] PR #104, Preview READY 확인 및 공유 URL로 접속. 클라우드 브라우저 WebGL2 미지원으로 지도 생성자가 throw하여 홈 전체가 사라지는 기존 오류 발견, 좁은 예외 처리와 WebGL 미지원 회귀 검사 추가. 급여 협의 공고 누락·최초 Hà Nội 선택도 수정. 최종 source CI/Preview 재검증 및 사용자 검토 대기, APPROVED/DEPLOYED 아님. 상세 docs/MOBILE-HOME-R1-report.md.

## 2. 다음 할 일 3개
1. 마지막 source commit의 CI/Preview 확인(이전 커밋 성공과 구분), 같은 원인 2회 실패 시 반복 중단.
2. 실제 캡처·Preview URL·검증 결과를 사용자에게 제시하고 수정사항 반영.
3. 사용자 미리보기 검토 전 master 병합/Production 배포 금지. 운영 DB/Auth/권한/좌표 정책 변경 금지.

## 3. 필수 규칙
- AGENTS.md/CLAUDE.md, 직접 확인·기존 기록·미검증 분리. GitHub에 소스 보존 전 완료 처리 금지.
- 가짜 공고/급여 환산/미확인 조건 생성 금지. 한국 슬롯은 Korea 전용 API/컴포넌트.
- STATUS/status 브랜치/검증 장치 기존 파일 수정 금지. 새 모바일 화면 workflow는 읽기 전용, secret 없음.

# CHATGPT_HANDOFF — 모바일 홈 영상 배치 수정 (R2)
갱신: 2026-10-16 (Asia/Bangkok)

## 1. 현재 상태
- [직접 확인] 사용자 R1 시안 거절: 영상과 다름. 같은 PR #104/feat/mobile-home-composition-20261016의 31395bf에서 이어서 기존 구성의 모바일 표현만 수정. master/운영 미반영.
- [직접 확인] 영상 00:10 홈을 다시 확인. 원본은 작은 안내→세로 3공고 카드→점 표시→아이콘 5개→필터→가로 공고→하단 5메뉴. R1의 큰 안내/한국 배너/지도 선배치/4메뉴가 불일치 원인.
- [직접 확인] 위치 안내를 작은 pill로, 3공고를 한 줄 제목·단순 급여·옆 카드가 비치는 폭으로 수정. 가로 공고를 지도 앞으로 이동. 한국 전용 슬롯은 지도 뒤에 유지. 하단 홈/커뮤니티/지도/메시지/MY 5칸은 기존 라우트 사용, 메시지만 기존 프로필 메시지 탭 연결.
- [직접 확인] 원본의 광고·AI·HOT 주장은 복제하지 않음. 실제 공고/급여만 사용, 없는 영역 숨김·Korea 분리·PC 지도·GPS/필터·좌표 정책 유지.
- [기존 기록] R1 최종 31395bf의 CI 4개와 360/390/412/1366px 검사 통과. 사용자 시각 승인 아님. R2 실제 캡처/최종 CI·Preview는 PR 최종 증거 참조.

## 2. 다음 할 일 3개
1. R2 360/390/412px 첫 화면 위치 검사와 캡처를 영상과 비교, PC·필터/GPS 회귀 검사 확인.
2. 최종 커밋 CI와 일치하는 Preview/비교 캡처를 사용자에게 제시. 시각적으로 동일하다고 과장하지 않음.
3. 사용자 검토 전 master 병합·Production 배포 금지. 수정 요청 시 같은 브랜치에서 진행.

## 3. 필수 규칙
- AGENTS.md/CLAUDE.md 준수. 직접 확인·기존 기록·미검증 분리. GitHub 보존 전 완료 처리 금지.
- 가짜 공고·임의 급여 환산·원본 채용사이트 링크·운영 DB/Auth/권한/좌표 정책 변경 금지.
- STATUS/status 브랜치/기존 검증 장치 수정 금지. 같은 원인 2회 수정검증 실패 시 반복 중단.

</details>

## 1. 현재 상태
- [직접 확인] 기존 Draft PR #99, branch feat/map-r1-auto-location-20261015. 검증 시작 SHA 9475d0c. 이번 수정은 동일 브랜치에서만 보존한다.
- [직접 확인] 9475d0c 원격 CI 3개 성공, 로그 60/60·타입·빌드·화면 검사 통과. 원격 CI checkout은 GitHub 테스트 병합 ea9211c이며 실제 master 병합이 아니다.
- [직접 확인] 관리자 검토가 SELECT FOR UPDATE 후 UPDATE 전일 때 자동 승인이 끼어드는 결함 재현·수정(EXCLUSIVE 잠금). 수정 SQL+실제 후보/RPC·캐시/quota·R4/R1-R7/R8 트리거 격리 검사, 주소 이력·거부/철회 회귀, before/after 경합 통과. 수정 소스 tsc/build·resolver/API 모의 검사 통과.
- [직접 확인] npm audit는 기존 취약점 4건(high 2)으로 실패. package/lock은 master 대비 변경 없음. 실제 악용/운영 영향 미검증.
- [미검증] 운영 schema/GRANT drift·키 등록·VietMap 실연동/계정 과금 상한·Yên Phong 1단지 입구. 이번 수정은 [skip ci]로 제출: 화면 CI가 운영 공개 API를 읽기 때문에 최종 수정 SHA 원격 CI 미검증.
- [직접 확인] 이번 세션 운영 DB/API·자동화 설정·master/운영 배포 변경 없음. 운영 활성화 상태는 이번에 직접 조회하지 않음.
- 상세: docs/MAP-R1-preflight.md (PASS/FAIL/미검증, 적용·롤백). 이전 검증: docs/MAP-R1-report.md. 이전 HANDOFF는 WORK_LOG.md에 보존.

## 2. 다음 할 일 3개
1. PR #99의 잠금 수정·격리 검증을 검토하고 기존 의존성 경고를 별도 보안 패치 범위로 판단.
2. 운영 조회 허용 후 최종 SHA 필수 CI 및 실제 schema/GRANT·키/공급자 비용 제한 확인. 기존 성공 검사를 이유 없이 반복하지 않음.
3. 별도 사용자 승인 이후에만 문서 순서대로 DB 적용·실연동·병합/배포·활성화. 롤백 시 flag=false만으로 기존 승인 핀이 제거되지 않음에 주의.

## 3. 필수 규칙
- AGENTS.md/CLAUDE.md 준수. 직접 확인·기존 기록·미검증 구분, secret 값 출력 금지.
- 이번 지시: 운영 DB 변경·실제 API 호출·자동화 활성화·master 병합·운영 배포 금지. 사용자 금지가 일반 배포 규칙보다 우선.
- 추정 좌표 추가·기존 수동 승인 덮어쓰기·공개 상태 변경·주소 이력/일일 카운터 초기화 금지. pending 폴더 일괄 적용 금지.

</details>

## 2026-10-15 22:32 — PR #99 최종 사전 검증 (Codex)

- 요청: 9475d0c의 CI/기존 SQL/승인·주소 이력/환경·비용/적용·롤백 검증. 운영 DB·실제 API·활성화·병합·운영 배포 금지.
- [직접 확인] 관리자 SELECT FOR UPDATE 이후 UPDATE 전 경합에서 자동 승인과 관리자 거부 공존을 재현. pending SQL EXCLUSIVE 잠금으로 수정. 새 Python before_update 검사는 기존 SQL에서 실패, 수정 SQL에서 before/after 모두 성공.
- [직접 확인] 실제 후보/RPC·캐시/quota·R4/R1-R7/R8 트리거를 네이티브 격리 PostgreSQL 17.10에 로드. 기본/주소·검토/preflight SQL 검사 및 두 단계 동시성 검사 성공. 인증·기반 테이블은 합성 fixture, 운영 drift 미검증.
- [직접 확인] 수정 소스 tsc/build·resolver/API 모의 검사 성공. 기존 SHA 원격 CI 3개 성공(원본 로그 60/60). npm audit 기존 취약점 4건(high 2) 실패, 실제 악용은 미검증. package/lock 변경 없음.
- 수정 파일: pending MAP-R1 SQL, fixture·동시성·preflight assertion, docs/MAP-R1-preflight.md, report/HANDOFF/WORK_LOG. 운영 적용·롤백은 문서만 작성.
- commit/push: 이 항목과 동일 커밋을 기존 feature 브랜치/PR #99로 보존. [skip ci]로 운영 공개 API를 읽는 화면 CI의 재실행을 차단하므로 최종 SHA 원격 CI는 미검증. 운영 deploy 없음.
- 상세 근거·미검증·환경변수·비용 경계·운영 적용/롤백: docs/MAP-R1-preflight.md.

<details><summary>이전 CHATGPT_HANDOFF 원문 보존</summary>
# CHATGPT_HANDOFF — MAP-R1
갱신: 2026-10-15
PR: https://github.com/KHOAILANG0926/jobi-app/pull/99 (draft, 미병합)

- [직접 확인] 브랜치 feat/map-r1-auto-location-20261015, 기반 origin/master 1abb6a4. 최신 fetch 후 master 추가 변경 없음. 사용자 지시: PR까지만, 병합·운영 배포·운영 DB 변경 금지.
- [직접 확인] 지도 viewport/거리 원점 분리, 기본 무제한, GPS/한 번 탭, 정확·대표 핀, 화면 ID별 수, 선택 근무지 보존, 상세 휠 확대 구현.
- [직접 확인] 관리자/Actions 공통 resolver, 공고·주소 집합별 최대 2회 외부 검색(이전 주소 복귀 시 사용량 유지), 캐시, 공유 일일 250회 예약, 임대·멱등 저장. 공개 상태·기존 정확 좌표 변경 안 함.
- [직접 확인] npm test 60/60, 타입·빌드, PC/모바일 Chromium 및 로컬 PostgreSQL 검사 통과. 실제 운영 위치 처리/API 호출 0회.
- [직접 확인] pending SQL만 작성·격리 DB 검증. 운영 적용 없음. MAP_R1_ENABLED는 GitHub 변수와 서버 환경에 각각 필요하며 현재 활성화하지 않음.
- [직접 확인] Yên Phong 1단지 누락 확인. Overpass CONNECT 403으로 입구·OSM ID 미검증, 좌표 추가 없음.
- 다음: PR 검토 → 사용자 승인 후 pending SQL 적용/활성화 및 운영 데이터 검증. 지도 타일 과금의 공급자 측 상한은 이번 작업으로 검증되지 않음.
- 상세 결과/재현 명령: docs/MAP-R1-report.md. 이전 기록은 WORK_LOG.md.

- [직접 확인] PR #99 후속 수정: 주소별 검색 이력 보존, 기존 승인/거부/철회·대기 후보 보호, 다른 공고 근무지 ID 차단. 실제 기존 승인 SQL/RPC 격리 검사 및 동시 관리자 거부 검사 통과. 수정 후 전체 60/60·타입·빌드 통과. 운영 변경 없음.

</details>

## 2026-10-15 — PR #99 운영 전 검토 수정 (Codex)

- [직접 확인] 주소 A 2회 뒤 B에도 2회가 남는 문제를 격리 SQL로 재현하고 주소 집합별 history로 수정. A→B→A, 회사명/공백/대소문자/근무지 ID/순서 변경 시 한도 보존 검사 통과.
- [직접 확인] 근처 pending 후보 직접 승인 제거. 실제 승인 테이블·review RPC로 기존 승인/거부/철회 및 대기 후보 보존, 검증 좌표 신규 저장, 교차 공고 근무지 ID 차단 검사 통과. 실제 두 세션 동시 거부와 자동 승인 경합 검사 통과.
- [직접 확인] 수정 후 npm test 60/60, tsc, build 통과. 기존 PR #99에만 반영. 운영 DB/master/운영 배포 변경 없음.
- 이전 HANDOFF의 공고 평생 2회 정책은 이번 사용자 지시로 주소별 2회(복귀 시 기존 이력 유지)로 변경됨. 상세 docs/MAP-R1-report.md.

## 2026-10-15 — MAP-R1 (Codex, 운영 미반영)

- [직접 확인] origin/master 1abb6a4에서 feat/map-r1-auto-location-20261015. 최종 fetch 후 추가 master 커밋 없음(Claude 자동검사 포함).
- [직접 확인] Hanoi 카메라·브라우저 복원, 기본 무제한/명시적 GPS·지도 지점, 정확/대표 구분·viewport ID 수, 공통 자동 위치 판정·Actions·pending SQL 구현. 상세 휠 확대와 다중 근무지 선택 수정.
- [직접 확인] npm test 60/60, tsc, build, 로컬 Chromium PC/모바일, 격리 PostgreSQL 17 검사 통과. 운영 DB/API 위치 처리 실행 안 함.
- [직접 확인] Overpass CONNECT 403. Yên Phong 1단지 입구/윤곽 미확인, 좌표 추가 없음. 신규 자동화와 SQL은 승인 전 비활성.
- 상세: docs/MAP-R1-report.md. 운영 병합·배포 금지 유지.

<details><summary>이전 CHATGPT_HANDOFF 본문 (2026-10-15 보관)</summary>

# CHATGPT_HANDOFF — 공식 직업분류(34/2020) + R8
갱신: 2026-10-15

## 1. 현재 상태
- [직접 확인] master 51e4ee8: PR #87 병합. 운영 DB에 occupation_master 1505 / occupation_descriptions 603 / occupation_aliases 21 적용(run 38671967420 점검 통과). 화면 변화 없음.
- PR #88(feat/occupation-r8): 사용자 승인(2026-10-15) → R8 SQL `supabase/migrations/20261015120000_local_jobs_occupation_r8.sql`, 병합 시 `occupation-r8-apply.yml`이 적용·기존 공고 자동 분류·공개 상태 전후 비교·점검.
- 사용자 결정: 신규 직업은 A안(매주 미분류 보고 → 규칙 추가 PR)으로 시작, 미분류가 많아지면 규칙에 안 걸린 공고만 AI 분류(B안) 추가.
- 사용자 결정(2026-10-15): 직업군은 코드 기준(명칭 차이 무시), 구직자 화면은 공식 Cấp2 48개 기본.
- Codex 작업 환경은 외부·GitHub 접속 불가 → 다운로드는 Actions, 작업은 Claude.

## 2. 다음 할 일 3개
1. [직접 확인] R8 운영 적용 완료(#4824 = 82022). 크롤러 분류 연결·주간 미분류 보고·매달 관보 확인: PR feat/occupation-crawler.
2. 주간 보고 첫 실행 결과 확인(ANTHROPIC_API_KEY 없으면 보고만).
3. 화면(PR feat/occupation-ui): 지도 탐색 'Ngành nghề' = 공식 Cấp2 그룹(공고 있는 것만), 상세 = 공식 직업명. Preview 확인 후 Production.

## 3. 필수 규칙
- AGENTS.md/CLAUDE.md 준수. 직접 확인·기존 기록·추정 구분. 원본에 없는 직업코드·명칭 생성 금지.
- 회사명·공단명으로 직업군 추정 금지. 미분류에 other 기본값 금지.
- 운영 DB 변경·Production 배포는 사용자 승인 전 금지. #4824 공개 상태 변경 금지.

</details>

## 2026-10-15 13:40 — 배포 강제 규칙 DR1~DR7 시스템 적용 (Claude)

- 요청: "작업 완료 = 운영 배포 + 실제 화면 검증"을 GitHub·Vercel 검사로 강제(사용자). 계기: 10/14 PR #84·#85·#86 미병합으로 반영 누락.
- 변경: `scripts/ops/app-smoke.mjs`(Playwright PC·모바일 메인·상세), `.github/workflows/app-screen-check.yml`(PR), `deploy-verify.yml`(master→Production READY·sha 확인→운영 화면 검사→실패 시 이슈), `unmerged-work-alert.yml`(매일·master 변경 시 미병합 목록 이슈). CLAUDE.md·AGENTS.md·.cursor 규칙에 DR1~DR7.
- 검증: YAML·스크립트 문법 확인. 브라우저 검사는 이 작업 환경에서 실행 불가(Chromium 다운로드 차단) → 첫 실행 결과는 PR/master Actions로 확인.
- STATUS 장치(scripts/status, status-*.yml)는 건드리지 않음(잠금 규칙).

## 2026-10-15 11:40 — 메인 지도: 화면에 보일 때만 로딩 (Claude)

- 요청: 지도 비용 절감 1단계(사용자·GPT 합의: 절감책이며 상한 보장 아님).
- 변경: `src/lib/inViewOnce.ts`(+test), `HomeMapExplorer.tsx` — 지도 영역이 화면 200px 안에 처음 들어올 때만 지도·타일 로딩.
- 검증: [직접 확인] tsc, npm test 56/56, build.
- 남은 일: VietMap 과금 기준(타일 25요청=1건, 요금표 확인)·사이트 전체 상한 방식(키가 브라우저에 노출 — 계정 쪽 한도·도메인 제한 여부 미확인)·OpenFreeMap 호환성. 상세 페이지 지도(JobVietMap)는 이번 범위 밖.

## 2026-10-15 11:50 — 화면: 'Ngành nghề' 필터를 공식 직업분류 2단계 그룹으로 (Claude)

- 요청: 직업분류 계속 진행(사용자 결정: 공식 Cấp2 기본, 공고 있는 그룹만).
- 변경: `src/lib/occupationGroups.ts`(+test), `src/lib/occupations.ts`(occupation_master 이름 조회), `homeMapFilters.ts`(occupationGroups), `HomeMapExplorer.tsx`(업종 칩 → 공식 그룹 칩·공고 수), `JobDetail.tsx`(Ngành nghề = 공식 직업명, 미분류면 기존 업종), `jobRows.ts`·`fetchJobsData.ts` select에 occupation_code/evidence, `index.css`.
- 검증: [직접 확인] tsc 0, npm test 55/55, build 성공. 운영 DB: anon이 occupation_code·evidence·occupation_master 읽기 가능, #4824 = "Thợ lắp ráp thiết bị điện tử/linh kiện điện tử" / 그룹 "Thợ lắp ráp".
- 수정(사용자 지적): 칩 숫자를 전체 공고가 아니라 반경 안·확인된 근무지 공고로 셈(#4824는 위치 미확인이라 0). 고른 그룹은 0건이어도 칩 유지.
- 한계: 미분류 공고는 그룹을 고르면 목록에서 빠진다(선택 없으면 전체 표시). 기존 13개 업종(category)은 카드 이미지·추천 등 다른 곳에 그대로 남음.

## 2026-10-15 11:20 — 크롤러 직업 분류 연결 + 주간 미분류 보고 + 매달 관보 확인 (Claude)

- 요청: R8 적용 후 계속 진행(사용자). [직접 확인] R8 run 38673944719 성공, #4824 = 82022 "làm linh kiện tai nghe", active=true/admin_hidden=false 유지.
- 변경: `crawler/crawl_facebook.py`(parse_post + 저장 칸 목록), `crawler/crawl_topcv.py`(TopCV·VietnamWorks 공고 생성 2곳)에 `occupation_fields()`. `.github/workflows/occupation-weekly-unclassified.yml`(매주 월, A안), `occupation-gazette-monthly-check.yml`(매달 1일).
- 검증: [직접 확인] 분류기 unittest 11/11(Facebook parse_post #4824 원문 → 82022 포함). 크롤러 pytest 전후 동일(170 통과 / 11 실패는 변경 전부터 — 이 환경에 없는 모듈·도구).
- 한계: ANTHROPIC_API_KEY 등록 여부는 이 환경에서 조회 불가 → 없으면 주간 작업은 보고만. 관보 확인 파서는 병합 후 수동 실행으로 확인 예정.

## 2026-10-15 10:40 — R8 직업군 규칙 SQL + 자동 분류기 (미적용) (Claude)

- 요청: 직업분류 계속 진행(사용자). 운영 적용 결과: [직접 확인] occupation-master-apply run 38671967420 성공, 운영 DB 1505/603/21.
- 변경: `supabase/pending/20261015120000_local_jobs_occupation_r8.sql`(+rollback), `supabase/tests/local_jobs_occupation_r8.pglite.test.mjs`, `crawler/occupation_classifier.py`(+test).
- 검증: [직접 확인] PGlite 통과(없는 코드·1~3단계·근거 없음·원문에 없는 근거 거부, 글 수정 시 미분류 복귀, 공개 상태 불변, 롤백). 분류기 unittest 9/9, #4824 → 82022 근거 "làm linh kiện tai nghe".
- 한계: PGlite에는 운영의 기존 트리거 2개가 없음 → R8 트리거 이름을 trg_zzz_로 해 기존 규칙 뒤에 실행. 크롤러 연결·화면은 DB 적용 후(칸이 없으면 저장 실패하므로).
- 이후 사용자 승인: SQL을 migrations로, `occupation-r8-apply.yml`(적용 + `scripts/occupations/backfill_occupations.py` 기존 공고 분류 + 공개 상태 전후 비교 + `local_jobs_occupation_r8_check.sql`).

## 2026-10-15 10:00 — 직업분류 마스터 DDL·입력 SQL (미적용) (Claude)

- 요청: 2단계 진행 — 공식 코드 테이블. 운영 적용은 승인 후.
- 변경: `supabase/pending/20261015100000_occupation_master.sql`(occupation_master·occupation_descriptions·occupation_aliases, RLS 공개 읽기만), `_rollback.sql`, `20261015100100_occupation_master_seed.sql`(자동 생성), `scripts/occupations/build_seed_sql.py`, `supabase/tests/occupation_master.pglite.test.mjs`.
- 검증: [직접 확인] PGlite 2회 실행(멱등) — master 1505(10/48/152/509/786), 설명 603, 동의어 21, 부모 누락 0, 잘못된 코드·계층·anon 쓰기 거부, 롤백 확인.
- 이후 사용자 승인: SQL을 migrations로 이동, 적용 워크플로 `occupation-master-apply.yml` + 점검 `supabase/tests/occupation_master_check.sql` 추가. 직업군 화면은 Cấp2 48개 기본으로 결정.

<!-- R1 review addendum: remote CI 9384c26 passed all four workflows; inspected mobile/PC captures. Fixed negotiable-salary map exclusion, initial region selection, and synchronous WebGL constructor crash. Final source CI and user preview review remain required. -->
