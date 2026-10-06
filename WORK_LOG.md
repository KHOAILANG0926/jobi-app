# WORK_LOG

작업 단위 짧은 실행 기록. 최근 10개만 유지(넘으면 가장 오래된 것 삭제, 장기 이력은 git log). 규칙: CLAUDE.md "ChatGPT 추적용 기록".

## 2026-10-06 — 지도 제스처 재정비 + 모바일 bottom sheet Production 반영 + AI 전략 문서

- 요청: 승인 Preview(`jobi-6msh3jqki`) 소스를 master 반영·Production 배포, AI_DISCOVERY_STRATEGY.md 추가.
- 변경: master `35b7cce` → `cccd767` fast-forward(코드 변경 없음). 문서: AI_DISCOVERY_STRATEGY.md(사용자 원문 그대로), CLAUDE.md에 "참고용 배경 문서, 임의 구현 금지" 한 줄, HANDOFF 전략 참고 한 줄.
- 검증: tsc, tests 30/30, build. Production `jobi-cx74ww02v` Ready(viecganban.vn). 자동 검증: VietMap 로드·Geoapify 0·콘솔 오류 0, 데스크톱 휠 줌·드래그 설정, 모바일 터치 설정·sheet 코드.
- commit/push/deploy: master `cccd767` push → Vercel Production 자동 배포 Ready.
- 사용자 확인: 2026-10-06 실제 PC 마우스·Android 최종 확인 완료 → PRODUCTION VERIFIED(사용자).
- 남은 문제: VietMap 키 제한 권한 대기.

## 2026-10-06 — 지도 제스처 재정비 + 모바일 생활지도 bottom sheet — PREVIEW APPROVED, BRANCH PUSHED

- 요청: 6d02be6 cooperativeGestures 방식이 실제 마우스·Android에서 실패 → 데스크톱 휠=지도 줌, 모바일 지도 조작 우선 + 상세 하단 sheet.
- 변경: cooperativeGestures 폐기(SDK 기본 제스처), 터치 기기 회전·기울기만 끔, POI 탭 판정 정밀화, 데스크톱 좌우 패널 끝 휠→페이지(pageScrollChain), 모바일(≤760px) 상세 bottom sheet(접힘 38%/펼침 85%, 손잡이 드래그, 내부 스크롤).
- 이유: Android Chrome은 pan-y 계열 touch-action에서 첫 손가락 이동 후 두 번째 손가락을 앱에 전달하지 않음(실기기 로그). 직접 제스처·지도 조작 모드도 거쳐 SDK 기본 + sheet로 확정.
- 검증: tsc, tests 30/30, build. 사용자 실제 Android 승인(Preview `jobi-6msh3jqki`). 실패 Preview: mxku84k2y, 2c0mhtph5, fycayo97n, f5g8m0ji5, hdwhiwnd7 등.
- commit/push: `520031f` → `origin/fix/map-wheel-page-scroll`. master·Production 미반영.
- 남은 문제: master merge·Production 배포 결정, 데스크톱 실제 마우스 1회 확인 권장, VietMap 키 제한 권한 대기.

## 2026-10-06 — 스크롤 수정 + 예비 지도 오전환 수정 Production 반영

- 요청: 승인된 `6d02be6`(Preview `jobi-jkuypvkg8`)를 master·Production 반영 후 검증.
- merge/push: master `f84a02a` → `6d02be6` fast-forward(merge commit 없음), branch·master 양쪽 tsc·tests 28/28·build 통과. Vercel Production `jobi-oo9vd5ibp` Ready.
- Production 검증: 일반 휠 페이지 스크롤(+312px, zoom 불변), Ctrl+휠 확대(합성 이벤트, 11.28→12.28), 숨겨진 탭 25초 → vietmap 유지·활성화 후 준비·Geoapify 0, 클릭 A~E·G 통과, 위성 전환 유지, 콘솔 오류 0.
- 미검증(실기기): 모바일 1손가락 페이지 스크롤(touch-action `pan-x pan-y`만 확인), 실제 위치 권한 현재 위치. 공고 핀 관련은 Production 확인 좌표 공고 0건이라 미검증(기존).

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
