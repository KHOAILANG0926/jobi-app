# WORK_LOG

작업 단위 짧은 실행 기록. 최근 10개만 유지(넘으면 가장 오래된 것 삭제, 장기 이력은 git log). 규칙: CLAUDE.md "ChatGPT 추적용 기록".

## 2026-10-06 — 생활지도 회귀(POI 클릭 안 됨·POI 밀도 감소) 수정 — PREVIEW APPROVED, BRANCH PUSHED

- 원인: 메인 지도가 VietMap 대신 Geoapify 예비 지도로 전환된 상태(장소 클릭 패널·생활지도 스타일·위성 없음). 전환 경로 ① 숨겨진 탭에서 로드 시 SDK rAF 정지로 준비 안 됨 → 12초 timeout(숨겨진 동안에도 흐름) → 탭을 열어도 예비 지도 유지(로컬 재현) ② VietMap style.json 간헐 지연(Production 실측 12.3초, 평소 46~274ms).
- 변경: `visibleTimeout.ts`(+test) 보이는 시간만 세는 초기화 timeout, `fetchVietMapStyle`(5초 제한 후 1회 재시도, HTTP 오류는 즉시 실패, +test). 스타일·클릭 로직 변경 없음.
- 검증: tsc, tests 28/28, build. 숨겨진 탭 20초 후에도 vietmap, 탭 표시 후 준비 완료. 실제 마우스 A 카페 아이콘·B 라벨·C 회사·D 생활시설·E 이름 없는 건물·F 공고 핀(공고 패널)·G 빈 곳 닫힘 통과.
- 밀도(같은 좌표·줌·463x419): Production VietMap = 로컬 동일(예 BN 중심 z15 POI 27/회사 13/식음 5), Production 예비 지도는 같은 지점 z16 POI 4·회사 0·식음 0 vs VietMap 8·3·2.
- commit/push: 통합 Preview `jobi-jkuypvkg8` 승인 후 소스 그대로 branch `fix/page-scroll-map` commit·push. master·Production 안 함.

## 2026-10-06 — 지도 위 페이지 스크롤 막힘 수정 — PREVIEW APPROVED, BRANCH PUSHED

- 원인: VietMap/MapLibre 기본 제스처(휠=지도 확대·preventDefault, 한 손가락 드래그=지도 이동, 캔버스 `touch-action: none`). Production 실측: 지도 위 휠 시 scrollY 변화 0·지도 zoom 11.28→10.88.
- 변경: `homeMapGestures.ts`(+test) `cooperativeGestures: true` + 베트남어 안내, VietMap·Geoapify 지도 옵션에 적용. 레이아웃/CSS 변경 없음.
- 검증: tsc, tests 27/27, build. 로컬: 지도 위 휠 → 페이지 +300px·zoom 불변, Ctrl+휠 확대, 마우스 드래그 이동, 최상단→하단(1939px) 연속, 위성·상세패널 열린 상태 동일, 375px 캔버스 `touch-action: pan-x pan-y`·핀 탭 선택·가로 넘침 0.
- commit/push: 회귀 수정과 함께 통합 Preview `jobi-jkuypvkg8`로 승인, branch `fix/page-scroll-map` commit·push(master `f84a02a` 기반). 실기기 1손가락 스크롤 미검증.

## 2026-10-06 — 생활지도 1차+2차 Production 반영

- 요청: 승인된 `106e8e4`(Preview `jobi-ifofpmbdx`)를 master merge·Production 배포·검증.
- 확인: 코드 파일 최종 수정(10-05 21:28) < Preview 생성(21:32), 승인 후 변경은 문서뿐. branch·master에서 tsc, tests 26/26, build 통과.
- merge/push: master `a01f3c6` → `106e8e4` fast-forward(merge commit 없음), push 완료. Vercel Production `jobi-pi2g7lxz1` Ready.
- Production 검증: VietMap·Geoapify 0·콘솔 오류 0, 건물/회사/생활시설 클릭 패널·강조, 위성 전환 유지, 375px 넘침 0.
- 남은 문제: Production 확인된 근무지 좌표 공고 0건 → 공동 핀·선택 공고 동기화·공고 연결은 Production 실데이터 미검증. VietMap key 권한 문제(기존).

## 2026-10-05 — 생활지도 2차: 건물/시설 클릭 상세 패널 — PREVIEW APPROVED, BRANCH PUSHED

- 요청: 건물·회사·생활시설 클릭 → 강조 + 우측 상세(이름·종류·좌표·거리·300/500m 시설·주변 회사·근처 공고·위성 전환), 가짜 데이터 금지.
- 변경: `mapPlace.ts`(+test), `PlaceDetailPanel.tsx`, `VietMapMapCanvas`(클릭/hover/강조/재집계), `lifeMapStyle`(위성 투명 건물 hit layer), `HomeMapExplorer`(장소 상태·지도 모드), `NearbyLifePanel`(요약 뷰 재사용), CSS.
- 규칙: 건물명은 폴리곤 안 POI 1개일 때만, 주소 없음 → 좌표, 근처 바깥 POI 이름을 건물에 붙이지 않음.
- 검증: tsc, tests 26/26, build, 로컬 5개 시나리오 + 실제 마우스 클릭.
- commit/push: 사용자 승인(Preview `jobi-ifofpmbdx`) 후 승인 소스 그대로 branch `feat/life-map-buildings-poi` commit·push. master merge·Production deploy 안 함(별도 승인 대기).

## 2026-10-05 — 생활지도 고도화(건물·근무지·생활시설) — PREVIEW APPROVED, BRANCH PUSHED

- 요청: VietMap 유지, 건물·회사·생활시설 중심 지도, 선택 공고 주변 300/500m 생활환경 패널, 위성 토글, 대량 공고 대비 구조.
- 변경: `lifeMapStyle`(style 변환), `vietMapStyle`(hm 위성), `VietMapMapCanvas`(fetch→변환, 토글, 주변 POI 집계·링·점), `homeMapClusters`(viewport/cluster), `nearbyFacilities`+`NearbyLifePanel`, `homeMapGeometry.radiusWithinLoadedTiles`, CSS. `vietMapDetail` 삭제(대체).
- 이유: VietMap 원본은 건물 z17·POI 대부분 z18부터라 동네 단위에서 도로만 보였음. 생활 POI는 z16 타일에만 온전 → 선택 시 z16 기준 집계.
- 검증: tsc, tests 25/25, build, 로컬 화면(데스크톱·375px·위성 전환 유지·87개 시설 집계).
- commit/push: 2차와 함께 승인(Preview `jobi-ifofpmbdx`) 후 branch `feat/life-map-buildings-poi` commit·push. 1차 단독 Preview `jobi-l5craw8h8`. master·Production 안 함.
- 남은 문제: 공단 건물 데이터 희소, 위성/z16 사용량 증가 가능, VietMap key 권한 문제(기존).
## 2026-10-05 — VietMap 키 제한 시도: 권한 부족(UN_AUTHORIZED)

- 요청: Production/Preview Consumer·key 분리, 도메인 제한, 일/월 한도 설정. 안 되면 기존 key에 적용.
- 결과: Consumer 생성·key 생성·기존 key Referers 수정·consumer 한도 수정 모두 `UN_AUTHORIZED`(HTTP 200 본문). 변경 0건, 기존 key `…18ea45` 유지.
- 결정(사용자): 이 문제로 Production 배포를 막지 않음. VietMap에 Consumer/key 수정·Referers·usage limit 권한 요청, 권한 생기면 즉시 도메인 제한·한도·key 분리. 배포 후 Daily Report 사용량 모니터링.
- 수정 파일: CHATGPT_HANDOFF.md, WORK_LOG.md(문서만).
- 배포: `feat/home-map-vietmap-sync`를 master에 fast-forward(`8f0498f`) push → Vercel Production `jobi-c29zpgkiq` Ready. viecganban.vn에서 VietMap style·tile 정상(실패 0), Geoapify 0, 콘솔 오류 0. 검증: tsc, tests 23/23, build.

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

