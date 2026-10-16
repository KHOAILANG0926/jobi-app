## 2026-10-16 09:25 ICT — 미리보기 검사 차단
2026-10-16 09:25 ICT: f5dee9c 미리보기 빌드는 READY(기존 직접 조회). 화면 검사 run 38839718283은 failure, artifact 12021256282. 360/390/412/1366 × prompt/granted/denied 12건 모두 Vercel 로그인 화면에 도달해 .hme 대기 30초 시간초과. Vercel 인증 API 403 및 인증 화면의 Sentry429는 앱 오류로 분류하지 않음. 390-prompt-failure.jpg를 직접 열어 Log in to Vercel 확인. 앱 화면·위치·지역·지도·메뉴는 전부 미검증. 인증된 MCP HTML 조회200은 GitHub Actions 브라우저 접근 허용을 의미하지 않음. 앱 수정·배포·병합·DB 변경 없음. 다음 조치: 서버 자동 검사에 승인된 Vercel 인증 접근을 설정한 뒤 검사 재개. 보호 설정을 임의로 변경하거나 토큰을 소스/로그에 저장하지 않음.

### 이전 HANDOFF 보존
# CHATGPT_HANDOFF — MAP-R1
갱신: 2026-10-15 (Asia/Bangkok)

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

