## 2026-10-18 — 직업분류 공개 조건 과잉 수정 (PR #120/#121 대체)
요청: 공식 4·5단계 필수 조건 때문에 업무가 명확한 #4828이 비공개. 변경: 공개 게이트·R8·OCR 재공개 조건을 1~5단계 허용으로(근거로 확인 가능한 단계까지). 미분류·근거 누락·원문에 없는 근거·OCR 차단은 유지. 실제 공고 #4824(통과)·#4827(차단)·#4828(통과)을 시험 사례로 등록(supabase/tests/occupation_publication.pglite.test.mjs). 이전 규칙으로 돌리면 #4828 사례에서 실패함을 확인. 수정 파일: migration 20261018090000, OCR 3파일, workflow, AGENTS/CLAUDE 해당 조항, job.ts 주석. 이미 운영 적용된 20261017070517 migration 파일을 master 기록용으로 포함. OCR: 칸 나뉜 포스터 조각 읽기 추가(#4828 급여 누락 원인 = 전체 한 번 읽기 시 칸이 섞임, 색 문제 아님). 실제 포스터 시험 등록. 운영 DB 적용·#4828 공개는 사용자 승인 후.

이전 HANDOFF:
# CHATGPT_HANDOFF — 전체 검사 마지막 좌표 로더 수정
갱신: 2026-10-16 Asia/Bangkok

## 1. 현재 상태
- master5664d1f: 공고3개/중복0/중첩0, 실제 상세위치3/3 통과. PR 위치9종 및 공고6종 회귀 성공.
- 마지막 jobCoords 단독 CI명령만 로더가 없어 ERR_MODULE_NOT_FOUND 발생. 기존 npm test 공식 TS로더 명령으로 통일. 해당명령 로컬14/14 통과.
- 앱/CSS/DB/좌표정책 변경 없음. workflow2파일의2영역만 변경. 사전범위 PR#116 후 구현/최종CI 진행.
- 모든 최종workflow·운영검사가 성공하기 전 전체완료 보고 금지.

## 2. 다음 할 일 3개
1. 사전범위 PR#116 병합 후 정확한2영역 수정 PR검사/병합.
2. Job card integrity workflow 모든 단계와 Production READY/PCmobile smoke 성공 확인.
3. 관리자우회 차단 복구는 사용자 설정 확인 필요. 최종근거는 구현PR 기록.

## 3. 필수 규칙
- 기준 CTY KDA 틀 유지, 지시 범위 밖 UI/데이터 변경 금지.
- 범위표 먼저고정 후 코드변경. 실패검사 생략/성공위조 금지.
- 회사PC 저장 안내·DB/Auth/RLS/STATUS 변경 금지.


## 2026-10-16 — 마지막 좌표 CI 실행 명령 수정
공고3개/위치3개 통과 후 jobCoords 단독명령 ERR_MODULE_NOT_FOUND 발견. 기존 전체 테스트의 extensionless TS 로더를 쓰도록 workflow2영역만 수정. 같은 명령 로컬14/14 통과. 앱/데이터/정책 불변. 사전범위 PR#116, 최종전체CI·운영 대기.

이전 HANDOFF:
# CHATGPT_HANDOFF — 후속 위치 검사 현재 DOM 반영
갱신: 2026-10-16 Asia/Bangkok

## 1. 현재 상태
- master af1a0d1: 공고 목록3개 검증 성공(중복0/중첩링크0), PC/mobile 운영 검사 성공.
- 후속 위치 검사는 같은 일반목록 selector에 추가timeout. 상세 제목과 지도 선택자도 현재 코드와 불일치.
- 검사 스크립트만 추천+일반 목록/h1.jd2-header__title/VietMap marker·container DOM 반영. 현행 규정의 미확인지역 지도는 명시 경고·실제주소·정확사업장 주장 없음 검사. 가짜정확핀·지도와 unknown 동시표시·경고누락 등9종 회귀 통과.
- 앱/CSS/DB/위치 승인정책 불변. 사전 범위표 PR#114 후2파일 구현PR 진행. 최종 전체workflow 성공 전 완료 보고 금지.

## 2. 다음 할 일 3개
1. 범위표 검사/병합 후 정확한 위치검사·workflow2파일만 구현 병합.
2. 실제3개 상세·jobCoords·공고목록·운영 PC/mobile 모두 성공 확인.
3. 관리자우회 차단 복구는 사용자 설정 확인 필요. 실패/skip 남으면 보고에 누락 금지.

## 3. 필수 규칙
- 기존 틀 보존, 사용자 지시 범위 외 UI/데이터 변경 금지.
- 코드보다 범위표 먼저반영. 검사 실패를 단순생략으로 숨기지 않음.
- DB/Auth/RLS/STATUS 보호, 회사PC 저장 안내 금지.


## 2026-10-16 18:02 Asia/Bangkok
후속 검사: 공고목록 수정은3개/중복0/중첩0통과. 위치검사에 같은 일반목록 selector와 구형 제목/Leaflet 선택자가 남아 추가timeout. 테스트만 현재추천·일반/h1/VietMap 및 경고 있는 미확인지역 상태에 맞춤. 부정상태9종 단위회귀 통과, 앱/DB/정책변경 없음. 범위표 PR#114 후 구현/실제상세/좌표/운영검증 대기.

이전 HANDOFF:
# CHATGPT_HANDOFF — 공고 목록 검사 시간 초과 수정
갱신: 2026-10-16 Asia/Bangkok

## 1. 현재 상태
- 운영 bceb574: 카드 이미지 슬롯 유지와 사전 작업범위 검사 반영. 운영 PC/mobile smoke 성공.
- 별도 Job card integrity 검사만 일반목록 selector 대기30000ms 실패. 앱은 모든 공고가 추천에 있으면 일반목록을 만들지 않음.
- 사용자 재지시로 추천+일반 공고 selector를 함께 검사하도록 수정. 빈 화면·중복·중첩 링크 실패 기준 유지. 페이지 오류도 실패로 보고.
- 브라우저 회귀 fixture6종과 실제목록 검사를 PR app-screen 필수 검사에 추가. 사전 범위표 PR#112. UI/CSS/DB 변경 없음.
- Cloud Browser는 WebGL2 미지원으로 지도 초기화 오류가 발생해 직접 화면 검증에 사용할 수 없음. 실제 검증은 GitHub Playwright 환경의 CI/운영 검사 결과로 구분.

## 2. 다음 할 일 3개
1. 범위표 PR#112 검사 통과·병합 후 정확한2파일 구현 PR 진행.
2. fixture6종·실제 목록·PC/mobile·위치/좌표 회귀까지 최종 SHA 검사 통과 확인.
3. Production READY·운영 검사 성공 후 보고. 관리자우회 차단 복구는 사용자 설정 확인 필요.

## 3. 필수 규칙
- 기존 CTY KDA 틀 유지, 이번 수정은 검사에만 한정. 데이터/디자인 임의 수정 금지.
- 작업범위표는 코드보다 먼저 반영. 실패 검사 남으면 전체 완료 보고 금지.
- 회사 PC 저장 안내·원본 채용사이트 연결·DB/Auth/RLS/STATUS 변경 금지.


## 2026-10-16 17:55 Asia/Bangkok
요청: 남은 공고 목록 검사 시간 초과 해결. 원인: test-jobcard-integrity가 일반목록 selector만 기다림; HomeDesktop은 전부추천일 때 일반목록을 만들지 않음. 수정 범위: 검사 스크립트·PR화면 workflow2파일, UI/DB 불변. 추천/일반 전체 공고 검사 및 추천만·일반만·혼합·중복·빈화면·중첩링크 회귀 추가. 사전 범위 PR#112. 최종CI/운영 증거는 후속PR.

이전 HANDOFF:
# CHATGPT_HANDOFF — 작업 범위 검사로 전체 잠금 교체
갱신: 2026-10-16 Asia/Bangkok

## 1. 현재 상태
- 사용자 지시: 문서 규칙 적용, 기존 틀 유지, 지정 파일·영역만 수정. 전체 파일 동결 방식은 잘못된 해결책이라 교체.
- 작업 범위표를 먼저 별도 문서 PR로 고정. 구현 PR은 기준 브랜치의 범위표·검사기를 사용, 소스와 범위표 동시 확대 거부.
- 이미지 칸 조건 1개 제거하여 왼쪽 신규 공고도 오른쪽 CTY KDA와 동일한 영역 유지. CSS/오른쪽 공고/DB 변경 없음.
- 허용 영역 변경은 통과, 다른 영역·다른 파일·범위표 동시 변경은 실패. 규정 문서의 개정 해시는 확인하되 AI의 이해를 증명한다고 주장하지 않음.
- 기존 전체 해시 잠금이 최초 교체 자체를 거부. 보호 설정 임의 해제/우회 없이 관리자 복구 1회가 필요한 상태. 운영 완료 아님.

## 2. 다음 할 일 3개
1. 사전 범위표 PR #111 검사 통과 후 병합, 구현 PR #110에 기준표 유지.
2. 새 범위 검사와 PC/mobile 검사 통과 확인, 기존 잠금 교체의 관리자 복구 완료.
3. 정확한 SHA Production READY 및 운영 PC/mobile 검사 후에만 완료 보고.

## 3. 필수 규칙
- 기본은 기존 틀 유지, 일반 공고 등록은 화면 파일 수정 불가.
- 코드와 작업 범위표 함께 확대 금지. 규정 버전 바뀌면 다시 확인하고 범위표 갱신.
- DB/Auth/RLS/STATUS 보호 유지. 회사 PC 저장 안내 금지. 검증 안 된 완료 주장 금지.


## 2026-10-16 17:30 Asia/Bangkok
요청: 기존 틀 유지, 지시 범위 밖 임의 변경 차단으로 교체하고 왼쪽 공고 수정. 변경: 사전 범위표 분리, trusted base git diff/정확한 before-after 영역 검사, 문서 개정 해시 연결, 전체 파일 잠금 제거. 검증: 지정 영역 통과·같은 파일 다른 영역/다른 파일/코드와 범위표 동시 확대 실패. 카드 1줄 수정은 앞선 원격360/390/412/1366 검사 통과. 기존 잠금 최초 교체는 관리자 복구 필요, 운영 완료 아님.

이전 HANDOFF:
# CHATGPT_HANDOFF — 신규 공고 카드 이미지 칸 유지 수정
갱신: 2026-10-16 Asia/Bangkok

## 1. 현재 상태
- 사용자 명시 지시: 왼쪽 신규 공고를 기존 오른쪽 CTY KDA 틀로 수정.
- JobCard.tsx 이미지 칸 조건만 제거 1줄. 이미지 없는 경우도 70px 칸 유지. CSS·기존 오른쪽 공고·DB·이미지 데이터 변경 없음.
- 수정 전 이미지 없음 테스트가 poster slot 누락으로 실패. 수정 후 DOM 구조 검사 통과, 로컬 Playwright 브라우저 미설치로 실제 geometry 검사는 원격 app-screen CI에 연결.
- 기존 보호 장치가 사용자 승인된 기준 갱신도 거부하는 설계 결함 있음. 기준표 변경 PR은 trusted base 검사에서 실패하므로 배포 완료 주장 금지. 검사 해제·우회하지 않음.

## 2. 다음 할 일 3개
1. 원격 PC/mobile 이미지 있음·없음·차단 URL geometry 검사 확인.
2. 관리자 권한으로 명시 승인된 수정의 기준 갱신을 처리할 정상 경로 확보.
3. 병합 후 정확한 SHA Production READY·운영 화면 검사 통과 확인.

## 3. 필수 규칙
- 승인된 틀 변경 금지. 이번 1줄 수정은 사용자 명시 지시 범위.
- DB/Auth/RLS/STATUS 변경 금지. 회사 PC 파일 보관 안내 금지.
- GitHub 링크로 사용자 보내지 않음. 미배포 수정은 운영 완료 보고 금지.


## 2026-10-16 17:05 Asia/Bangkok
요청: 왼쪽 신규 2개 공고 수정. 변경: JobCard 이미지 칸 조건 제거 1줄, CSS/오른쪽 틀 변경 없음. 이미지 없음 재현 테스트 실패 확인 후 수정. 승인된 변경에도 기존 trusted 기준 갱신을 거부하는 잠금 설계 결함 발견. 보호 우회/해제 없이 수정 PR과 실제 화면 CI 준비, 병합 차단 여부 확인 필요.

이전 HANDOFF:
# CHATGPT_HANDOFF — 승인된 공고 틀 자동 차단
갱신: 2026-10-16 (Asia/Bangkok)

## 1. 현재 상태
- 사용자 요청은 문서 규칙과 자동 차단 장치. AGENTS.md·CLAUDE.md 규칙 PR #107 master 병합 9577c100.
- 앱 코드·DB·Auth·좌표 변경 없음. 기존 왼쪽 2개 공고의 이미지 유무에 따른 배치 차이는 이번 작업에서 수정하지 않음.
- 카드/상세/관련 CSS 및 보호 workflow 8파일 해시 고정. 기준 브랜치 검사기와 기준표로 PR 소스·기준표·검사기 변경 차단. 기존 필수 checks 연결.
- 검사기 자기 변경으로 우회하지 못하도록 pull_request_target에서 read-only로 실행, 후보 코드는 실행하지 않음.
- 원격 CI·위반 PR의 병합 거부·운영 결과는 이번 PR 기록으로 확인. 완료 전에는 강제 검증 완료 주장 금지.

## 2. 다음 할 일 3개
1. 최종 CI 통과 후 병합, 보호 workflow 운영 확인.
2. 임시 위반 PR에서 자동 실패와 병합 거부 확인 후 닫기.
3. 이번 작업은 왼쪽 공고 수정/전체 롤백이 아님. 추가 UI 변경은 사용자 지시에 따름.

## 3. 필수 규칙
- 승인된 틀 임의 변경 금지. 소스 해시 검사를 픽셀 비교로 보고하지 않음.
- 회사 PC에 키/데이터/작업파일 저장 안내 금지. DB/Auth/RLS/STATUS 보호 유지.
- 사용자에게 GitHub 이동 링크 금지. 성공 SHA 반복 검증 금지.


## 2026-10-16 16:58 Asia/Bangkok
요청: 공고 틀 임의 변경 자동 차단. 변경: 소스 해시 잠금·trusted base 검사·필수 checks 연결. 앱/DB 변경 없음. 검증: 수정·삭제·기준표·검사기 변조 차단, tsc/build, 전체 테스트와 원격 CI 추적. 최종 commit/배포 증거는 PR 기록.

이전 HANDOFF:
# CHATGPT_HANDOFF — PC 모바일 변경 직전 소스 그대로 복원
갱신: 2026-10-16 (Asia/Bangkok)

## 1. 현재 상태
- [직접 확인] 사용자 재지시: 항목별 수정이 아니라 모바일 변경 직전 PC로 복원. 이전 PR #105 부분 복원은 완료 조건 미달. 기준 eb36b53443e1a9a3a2077d18447c490921baa5bb.
- [직접 확인] HomeDesktop/LayoutDesktop/DesktopHomeMapExplorer/DesktopHomeMapCanvas/DesktopGeoapifyMapCanvas는 기준 원본을 사용, 분리 파일로 연결하는 import 경로만 변경. 원본 SHA256 대조 검사 5개 및 기존 JobDetail/index.css/apply.css 3개 추가.
- [직접 확인] Home/Layout은 기존 760px 기준으로 PC 원본 또는 현재 모바일 버전을 선택. 모바일 전용 스타일 전체를 media 블록에 제한해 PC 적용 차단. 모바일 데이터/배너/필터 유지.
- [직접 확인] 상세페이지와 기존 CSS는 원본 그대로, 새로운 디자인·부분 수정·임의 버전 선택 없음. DB/Auth/RLS/좌표/데이터 변경 없음.
- [기존 기록] 운영 b2bfe48는 이전 부분 복원. 이번 exact 복원은 새 브랜치 fix/exact-desktop-baseline-20261016, 최종 CI/운영 증거는 새 PR 기록 참조.

## 2. 다음 할 일 3개
1. 원본 8파일 일치·tsc/build·PC/mobile 기존 회귀와 캡처 검증.
2. 사용자 복원 지시에 따라 PR 병합, 같은 SHA Production READY 및 운영 PC/mobile 검사 확인.
3. 실제 앱 링크와 확인 결과만 보고. 새 디자인 변경·사용자 GitHub 링크 이동 금지.

## 3. 필수 규칙
- AGENTS.md/CLAUDE.md 준수. PC 부분 복원을 전체 원복으로 보고하지 않음. 원본 내용 비교 증거 필수.
- 모바일 보존, 운영 DB/Auth/보안/좌표 승인 변경 금지. 회사 PC 보관·현장 확인 안내 금지.
- STATUS와 기존 검증 장치 보호. 동일 성공 SHA 재검사 금지, 같은 원인 수정검증 2회 실패 시 중단.


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

