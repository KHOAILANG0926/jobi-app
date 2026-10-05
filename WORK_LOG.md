# WORK_LOG

작업 단위 짧은 실행 기록. 최근 10개만 유지(넘으면 가장 오래된 것 삭제, 장기 이력은 git log). 규칙: CLAUDE.md "ChatGPT 추적용 기록".

## 2026-10-05 — VietMap 지도 Preview 소스 복원 + 공동 핀 selectedJob 동기화

- 요청: 검증된 Preview `dpl_5vVjSum6NNQYVyFBf9vif4p8kgYE` source를 master `ade2926` 기반 branch에 복원, `focusAfterOpen:false` 포함, TomTom·진단·깨진 파일 제외.
- 변경: VietMap provider·공동 핀 grouping/팝업 옵션·0.1km 반경·homeMapSearch·CSS·acceptance(Preview+`?mapAcceptance=1` 한정)·테스트, `@vietmap/vietmap-gl-js` 6.0.1.
- 검증: tsc, build, tests 23/23 통과. Production 빌드 acceptance 0건. 새 Preview `jobi-1cre9b7j6` 사용자 승인.
- commit/push: branch `feat/home-map-vietmap-sync` push. master·Production 미반영.
- 남은 문제: Preview `VITE_ZALO_APP_ID` 누락, 휴대폰 GPS 미검증, 200m 버튼 결정 보류.

## 2026-10-05 — 작업 브랜치·Preview·Git 종료 게이트 규칙 추가

- 요청: Preview 승인 후 Git 보존을 강제하는 종료 게이트를 CLAUDE.md에 MANDATORY로 추가.
- 변경: CLAUDE.md "작업 브랜치·Preview·Git 종료 게이트 — MANDATORY" 섹션(10개 규칙 + 근거) 추가. 코드 변경 없음.
- 근거: VietMap 최종 Preview `dpl_5vVjSum6NNQYVyFBf9vif4p8kgYE`가 미커밋 CLI 배포 소스에서 만들어져, master에 소스가 없어 Vercel deployment source를 회수해야 했음.
- 상태: branch `feat/home-map-vietmap-sync`(master `ade2926` 기반) 작업 트리에 지도 복원과 함께 미커밋. commit/push/deploy 없음.

## 2026-10-02 — Google VECTOR 전환 + 기본 반경 UX 검토

- 요청: Google provider를 VECTOR rendering으로 전환하고 건물·POI 표현 및 기본 반경 UX를 검토.
- 변경: `renderingType: VECTOR` 옵션 helper와 테스트, 실제 rendering type 진단값 추가. ROADMAP/HYBRID·기본 스타일·fallback·반경/marker/viewport 계약 유지.
- 검증: tsc/build, 16/16 tests, Google fixture VECTOR/ROADMAP/HYBRID/no-style 및 네 실패 fallback 통과. Production은 key 부재로 Geoapify, 8km·zoom 11.3428·원 지름 0.65·Geoapify 오류 0.
- commit/push/deploy: `90bf841` master push, Vercel `dpl_FSNAYRTi8EfukY48TjHadNXZb77b` READY.
- 남은 문제: 실제 Google raster/VECTOR/HYBRID 비교는 PENDING_NO_KEY. 기본 8km와 빠른 선택 5/10/20 불일치; 5km 기본값 권장, 결정 전 변경하지 않음.

## 2026-10-02 — Google Native provider + Geoapify fallback 검증

- 요청: 승인된 provider 설계대로 Google Maps JavaScript API ROADMAP/HYBRID provider를 추가하되, 현재 Google key가 없는 Production은 기존 Geoapify를 유지하고 radius/viewport UX를 회귀시키지 않기.
- 변경: provider coordinator, Google/Geoapify 캔버스 분리, 12초 timeout·loader/init/auth fallback, 충돌 안전 `gm_authFailure` registry, job-id marker layer, 공통 meter/65% viewport 계산, 브라우저 실패 주입 harness 추가. DB·필터·확정 레이아웃 수치 변경 없음.
- 검증: 1/3/5/10km=1000/3000/5000/10000m, Bắc Ninh 3km 화면 지름 0.65. tsc/build/test 통과. 1366/1440/1920/375 브라우저와 wheel/drag/zoom→radius 유지, 지역/현재 위치 재정렬 통과. abort/timeout/auth/init failure 모두 Geoapify fallback.
- key 상태: Production Geoapify key 있음, Google key 없음. 실제 Google 지도는 Preview 제한 키 준비 전까지 PENDING이며 Production provider는 Geoapify로 유지.
- commit/push/deploy: 코드·검증 기록 `1b71607` master push, Vercel Production Ready. `viecganban.vn`에서 Geoapify, Google 요청 0건, style 성공, 425/440/485px, console/hydration 오류 없음 확인.
- 남은 문제: Google quota/billing 신호는 SDK에서 완전 감지할 수 없어 Cloud quota cap·budget alert·referrer/API 제한 필요.

## 2026-10-01 — 메인 지도 Geoapify 벡터 전환

- 요청: 기존 키로 MapLibre + Geoapify vector 전환을 검토하고, 도로·지역명·산업지역을 더 선명하게 하되 모든 지도 UX·크기·필터·DB 정책을 유지하여 배포.
- 변경: 메인 HomeMapCanvas만 MapLibre `osm-bright/style.json`으로 전환. 도로/라벨/산업지역/POI 표현 조정, Vite worker 별도 번들, 빨간 공고 핀·파란 위치점·반경 원 및 수동 시점 유지. 다른 페이지 Leaflet 유지.
- 수정 파일: `src/components/home/HomeMapCanvas.tsx`, `src/index.css`, `package.json`, `package-lock.json`, `CHATGPT_HANDOFF.md`, `WORK_LOG.md`.
- 검증: tsc/build/기존 테스트 10파일 통과. 개발·Production 빌드 미리보기 Chrome 1366/1440/1920/모바일 375에서 타일·스타일·worker·콘솔·hydration 오류 없음, 높이 425/440/485px 및 정렬 유지. wheel/drag/+→radius 시점 유지, 지역/현재 위치 재정렬, fixture 핀 선택/강조 확인.
- commit/push/deploy: 코드·기록 `315eb91` master push, Vercel Production Ready, viecganban.vn에서 MapLibre·vector style HTTP 200·높이 440px·콘솔 오류 0 확인. 이 문서의 최종 상태 갱신 커밋이 뒤따름.
- 남은 문제: 실제 verified 핀 데이터가 적어 핀 브라우저 검증은 fixture 사용. 메인 지도 lazy 청크는 Leaflet 대비 커짐.

## 2026-10-01 22:03 — 메인 지도 시각 높이·여백 축소 + 수동 시점 유지

- 요청: PC 지도 모듈 높이와 주변 여백 축소, 빈 오른쪽 패널 경량화, 사용자가 휠·드래그·줌 버튼으로 조작한 지도를 radius 변경 시 그대로 유지.
- 변경: PC 높이 425/440/485px, Korea–지도 8px·지도–추천 33px, 빈 패널 간소화. 반경의 `fitBounds` 제거, 수동 조작 기록, 지역/현재 위치 명시 선택 때만 재정렬. 가로·DB·필터 구조·Geoapify·모바일 정책 유지.
- 수정 파일: src/index.css, src/components/home/HomeMapCanvas.tsx, src/components/home/HomeMapExplorer.tsx, CHATGPT_HANDOFF.md, WORK_LOG.md.
- 검증: tsc·build 통과. 로컬 PC 3종+모바일 375에서 배치·스크롤·핀/패널 확인. 수정 전 wheel/drag/+→radius에서 줌 리셋 재현 후 수정 후 줌·중심 유지, 지역·현재 위치·반복 현재 위치 재정렬 확인. Production 세 PC 크기·간격·추천 영역, 1440 wheel+radius 시점 유지 확인.
- commit: `a1560c9`(코드) + 이 문서 커밋 / push: master / deploy: Vercel Production Ready 및 실제 사이트 확인.
- 남은 문제: 이번 변경 신규 문제 없음.

## 2026-10-01 21:33 — 메인 지도 탐색 영역 PC 높이 추가 축소

- 요청: 가로 비율·기능은 유지하고 PC 지도 모듈 높이만 440/470/510px로 축소, 추천 영역 첫 화면 노출 확인 후 배포.
- 변경: `.hme` 높이 `clamp(440px, calc(25vh + 245px), 510px)` 한 줄. 수정 파일: `src/index.css`, `CHATGPT_HANDOFF.md`, `WORK_LOG.md`.
- 검증: tsc·build 통과. 로컬·Production 브라우저 PC 1366×768/1440×900/1920×1080에서 목표 높이·3열 정렬·첫 화면 `Việc làm nổi bật` 노출 확인. 로컬 조건 펼침·내부 스크롤·반경·verified 핀→패널·가로 넘침·페이지 오류 0 확인.
- commit: `4817df2`(UI) + 이 문서 커밋 / push: master / deploy: Vercel Production Ready, viecganban.vn 확인.
- 남은 문제: 이번 작업 신규 문제 없음.

## 2026-10-01 21:21 — 메인 지도 탐색 영역 UI 높이·정렬·타일 스타일 개선

- 요청: 메인 지도 UI만 축소·3열 정렬·패널 내부 스크롤·밝은 지도 타일로 변경하고 브라우저 검증 후 배포.
- 변경: PC 높이 clamp(500px, 60vh, 580px), 단일 grid 행과 Leaflet 부모 높이 정합, 좌·우·모바일 필터 내부 스크롤, 기존 Geoapify 키의 osm-bright 타일과 필수 출처 표시.
- 수정 파일: src/index.css, src/components/home/HomeMapCanvas.tsx, CHATGPT_HANDOFF.md, WORK_LOG.md.
- 검증: tsc·build 통과. 1366×768/1440×900/1920×1080/375×812 브라우저에서 높이·정렬·스크롤·반경·verified 핀→패널·타일 URL·가로 넘침 없음 확인. 로컬 키 부재로 로컬 타일 색상 확인 제한; Production 1440×900에서 밝은 타일 256px 로딩·540px·3열 정렬·오류 0 확인.
- commit: `3b69325`(UI) + 이 문서 커밋 / push: master / deploy: Vercel Production Ready 및 실제 사이트 확인.
- 남은 문제: 로컬 환경에는 Geoapify 키가 없음(Production에는 기존 키 설정됨).

## 2026-10-01 (회사 PC) — 공고 근무조건 + 게시자 지도 핀

- 요청: 메인 지도 필터가 실제 데이터로 동작하도록 공고 데이터 구조 확장(조사→migration→등록/수정 UI→타입/API→필터→검증→배포)
- 변경: migration 20261001100601(근무조건 7칸 + verification_method + 소유 확인 RPC 3개), JobConditionsFields·LocationPinPicker·jobConditions 신규, PostJob·ManageGuestJob·JobsContext·jobRows·fetchJobsData·types·homeMapFilters·HomeMapExplorer 연결
- 설계 이유: NULL=정보 미확인(추정 금지). 좌표는 job_work_locations 한 곳, 게시자 핀은 verified poster_pin. 게스트는 테이블 직접 쓰기 권한이 없어 소유 확인 SECURITY DEFINER RPC만 허용.
- 수정 파일: supabase/migrations/20261001100601_local_jobs_work_conditions_and_pins.sql, supabase/tests/job_conditions_pins.pglite.test.mjs, src/components/job-form/*, src/lib/jobConditions.ts, src/lib/homeMapFilters.ts(+test), src/components/home/HomeMapExplorer.tsx, src/pages/PostJob.tsx, src/pages/ManageGuestJob.tsx, src/context/JobsContext.tsx, src/lib/jobRows.ts, src/lib/fetchJobsData.ts, src/types/job.ts, src/index.css
- 검증: PGlite 20/20, tsc·build, npm test 10/10, 로컬 E2E(등록 PC/모바일·관리·메인), Production schema 재조회 + 롤백 트랜잭션 생성/수정/조회·권한 거부 확인(잔여 데이터 0)
- commit: 이 커밋 / push: master / deploy: Vercel 자동
- 남은 문제: 고용주 전체 수정 화면 없음, 실제 핀 데이터 0, test-home-composition.mjs 구식

## 2026-10-01 (회사 PC) — PC 메인 중간 영역 지도 탐색 개편

- 요청: 한국 입구 아래 ~ Việc làm nổi bật 위 중간 영역을 "내 주변 일자리 지도 + 선택 공고 패널"로 교체(조사→구현→검증→문서→배포)
- 변경: HomeMapExplorer·HomeMapCanvas·homeMapFilters 신규, Home.tsx 중간 블록 교체·전용 코드 정리, index.css `.hme*` 추가
- 설계 이유: 지도·거리는 확인된 근무지만(기존 원칙). 데이터 없는 조건은 가짜 판정 없이 비활성, `match`만 채우면 활성화되는 구조. 직접채용은 employer_id로 단정하지 않음.
- 수정 파일: src/components/home/HomeMapExplorer.tsx, src/components/home/HomeMapCanvas.tsx, src/lib/homeMapFilters.ts, src/pages/Home.tsx, src/index.css, CHATGPT_HANDOFF.md, WORK_LOG.md
- 검증: tsc·build 통과, npm test 9/9, vite preview + 응답 가로채기로 PC 1366/1920·모바일 375 동작 확인(반경·원·급여·업종·조건·핀↔패널·위치 허용/거부·빈 상태·넘침 0·콘솔 오류 없음)
- commit: 이 커밋 / push: master / deploy: Vercel 자동(Production 확인은 HANDOFF·채팅 보고)
- 남은 문제: test-home-composition.mjs 구식, 실제 데이터 핀 0(등록 양식·위치 확인 필요), 하단 목록 연동 미구현
