# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**생활지도 1차(건물·근무지·생활시설 중심) + 2차(건물/시설 클릭 상세 패널) (2026-10-05).** 상태: IMPLEMENTED / VERIFIED(tsc·tests 26/26·build·로컬 화면) / PREVIEW APPROVED(사용자, Preview `jobi-ifofpmbdx`) / BRANCH PUSHED / **MASTER PUSHED(`106e8e4`, fast-forward) / PRODUCTION DEPLOYED(`jobi-pi2g7lxz1`) / PRODUCTION VERIFIED(2026-10-06)**. 승인 후 코드 수정 없음.

- branch: `feat/life-map-buildings-poi`(master `a01f3c6` 기반, 승인된 Preview 소스 그대로 commit·push). 집 PC `C:\Users\Admin\Desktop\JOBI`.
- 검토용 Preview(1차+2차, 미커밋 소스를 깨끗한 worktree 사본에서 CLI 배포): https://jobi-ifofpmbdx-mshw1895-6089s-projects.vercel.app/?mapAcceptance=1 (1차만: jobi-l5craw8h8)
- 승인된 Preview 소스 = 이 branch commit(종료 게이트 충족).
- 기존 방향에서 바뀐 것: 메인 지도가 "도로 중심 공식 스타일 그대로" → **공식 style JSON을 앱에서 변환**(건물 z14부터·윤곽선, 근무지/생활 POI 우선, 도로 0.8배). 위성은 VietMap 공식 Hybrid(`hm`) 사용. 주변시설은 지도에 로드된 벡터 타일 POI로 계산(별도 API 없음).

## 변경 내용

- `lifeMapStyle.ts`: building minzoom 17→14 + 대비 색 + `home-life-building-outline` 선. company/industrial z13·텍스트 진하게, 생활시설(식당·카페·약국·병원·버스·숙소·마트·ATM) z15, 근무지→생활시설 순으로 도로 라벨 위로 이동(충돌 시 우선), `text-optional`(라벨 숨겨져도 아이콘 유지). 일반↔위성 교체 시 앱 layer/source 이월.
- `vietMapStyle.ts`: `street`(tm) / `satellite`(hm, 2026-10-05 지원 확인).
- `VietMapMapCanvas.tsx`: style JSON fetch→변환→지도 생성, Bản đồ/Vệ tinh 토글(viewport·핀·반경·현재 위치·선택 유지, 위성 style 실패 시 일반으로 복귀), 준비 후 개별 타일 오류는 Geoapify로 내려가지 않음. 선택 공고 시 z16 이동→실제 POI 집계, 300/500m 점선 링 + 종류별 점(공식 아이콘 아래).
- `homeMapClusters.ts`: 공동 핀 + viewport filtering + z<14 화면 격자 cluster(클릭 시 확대), 선택 공고는 항상 단독 핀. 마커 DOM 재사용.
- `nearbyFacilities.ts` + `NearbyLifePanel.tsx`: 300/500m 종류별 수(없으면 "—"), 종류별 가장 가까운 시설, 주변 회사·공장 목록. housing·무분류 POI는 이름(Nhà nghỉ/KTX/Cty…)이 분명할 때만 인정.
- `homeMapGeometry.radiusWithinLoadedTiles`: 반경이 로드된 타일 밖이면 "일부 미집계" 안내.
- 삭제: `vietMapDetail.ts`(+test) — `lifeMapStyle`로 대체.
- 2차 클릭 상세: `mapPlace.ts`(폴리곤 포함 판정·건물명 규칙·주변 공고), `PlaceDetailPanel.tsx`, 캔버스 `queryRenderedFeatures` 클릭(POI 8px → 건물 폴리곤, 핀·팝업·토글 클릭 제외), 강조 `home-picked-*`, 위성용 투명 건물 hit layer, 지도 모드를 상위 상태로(패널의 위성 버튼). 건물명은 폴리곤 안 POI 정확히 1개일 때만, 0개 이름 없음, 2개 이상 목록만. 주소 데이터 없음 → 좌표. 주변 공고는 확인된 근무지 좌표(같은 건물/좌표 우선, 500m). 클릭 시 viewport 유지, 낮은 zoom이면 확대 버튼.

## 테스트 결과

- tsc 통과, `npm test` 26/26(신규: lifeMapStyle, homeMapClusters, nearbyFacilities, mapPlace, 타일 커버리지), build 통과.
- 2차 검증(로컬): 이름 있는 회사 건물(Cty In Báo Hà Nội Mới, 폴리곤 안 POI 1개) / 이름 없는 건물(Bắc Ninh) / 생활시설(Coffee And Tea Cây Bàng, NgH VietinBank 실제 마우스) / 공고 근처 POI(Terminal 공동 핀 3건 90m, 클릭 시 공고 선택) / 위성↔일반 전환 후 선택·강조·viewport 유지 / 위성에서 건물 클릭 / 빈 곳 클릭 시 닫힘 / 핀 실제 클릭은 공고 선택. Bắc Ninh에는 회사 POI가 들어 있는 건물 폴리곤이 없어 이름 있는 건물 사례는 Hà Nội로 확인.
- 로컬(Production DB + acceptance 5건): Senna 선택 → z16, 500m 생활시설 87(식당 10·편의 16·카페 5·약국 20·병원 27·숙소 4·ATM 5, 버스·마트 0), 회사 31. 위성 전환 전후 zoom·중심·선택 핀·현재 위치·패널 동일. 5,000건 핀 계획 <200ms, ≤100 DOM. 지도 애니메이션 ~75fps. 375px 가로 넘침 없음.
- VietMap 데이터 실측: 생활 POI는 z16 타일에만 온전(300m 안 z15 7개 → z16 89개). building은 class/height 없음, landuse에 industrial 없음, 공단 건물 데이터 희소(Yên Phong z15 10개) → 위성으로 보완.

## 발견된 문제

- VietMap 데이터 한계: 공단 공장 건물 폴리곤 누락 다수, 버스정류장 POI 적음, company는 z15 타일부터만 존재(z13 표시 설정해도 데이터 없음).
- 비용: 위성 raster 타일과 z16 이동으로 VietMap 요청 증가 가능(Transaction 단가 미확인). Places/Search API는 사용하지 않음.
- Preview 환경에 `VITE_ZALO_APP_ID`, 휴대폰 GPS 실기기 검증, 반경 200m/300m 결정 — 이전과 동일.

## 다음 결정사항

- **Production 검증(2026-10-06, viecganban.vn, 실제 마우스)**: VietMap 로드·Geoapify 요청 0·콘솔 오류 0, 건물 z16 윤곽·회사 POI(Cty TV XD Thiên Phúc)·생활시설 표시, 이름 없는 건물 클릭→강조+패널(500m 시설 83), 회사·식당(NH Lộc Vừng) 클릭→패널, Bản đồ↔Vệ tinh 전환 후 선택·viewport·반경 8km·현재 위치 표시 유지, 위성에서 건물 클릭, 375px 가로 넘침 0.
- **Production 미검증(데이터 없음)**: 공동 핀·선택 공고 상세 동기화·JOBI 공고 연결 — Production에 확인된 근무지 좌표 공고 0건(loaded 1, verified 0). 승인 Preview(acceptance 5건)에서만 확인됨. 좌표 승인된 공고가 생기면 재확인.

- **VietMap 키 제한 — 권한 부족으로 보류(2026-10-05 확인, 사용자 결정: 배포는 막지 않음).**
  - 계정 `viecganban` Console에서 Consumer 생성(화면은 성공 표시, 서버 목록 미반영), API key 생성, 기존 key(`…18ea45`, consumer `public tile`) Referers 수정, consumer 일/월 한도 수정 모두 API 응답 `UN_AUTHORIZED`. 실제 변경 0건.
  - 기존 key 유지(삭제·재생성 금지). 현재 Referers·한도 없음 → 임의 도메인에서도 사용 가능. Tilemap key는 브라우저 공개용이고 사용량 낮음(2026-10-05 기준 월 20 Transaction).
  - **VietMap에 요청할 권한**: Consumer/API key 수정, Referers 설정, 일/월 usage limit 설정.
  - **권한이 생기면 즉시**: Referers `viecganban.vn; www.viecganban.vn`(+ 필요 시 Preview branch alias `jobi-git-feat-home-map-vietmap-sync-mshw1895-6089s-projects.vercel.app`), usage limit 설정(합의안 Production 일 500/월 10,000, Preview 일 100/월 2,000 — 분리 불가 시 공용 600/12,000), 가능하면 Production/Preview key 분리 후 Vercel env 교체.
- **Production 배포 후 모니터링**: VietMap Console → Daily Report에서 일 Transaction 확인. 급증(일 100 이상 등) 시 사용자 보고.
- Vercel env 정리 완료(2026-10-05): `VITE_VIETMAP_TILEMAP_KEY` Production 추가(Preview와 동일 값, Config), `VITE_ZALO_APP_ID` Preview 추가(Production과 동일 값). 둘 다 다음 배포부터 반영.
- `D:\Codex\JOBI`(`feat/korea-home-p1`, master에 이미 병합된 오래된 branch)의 미커밋 4개 처리 — 별도 작업. 이 branch에서 건드리지 않음.

## 최근 완료 작업 로그

- 생활지도 1차+2차(건물·근무지·생활시설 지도, 위성, 클릭 상세 패널) — 2026-10-06 — MASTER PUSHED(`106e8e4`) / PRODUCTION DEPLOYED·VERIFIED
- VietMap 메인 지도 + 공동 핀 동기화 — 2026-10-05 — MASTER PUSHED(`8f0498f`) / PRODUCTION DEPLOYED·VERIFIED. VietMap key 제한은 권한 부족으로 보류
- Google 지도 VECTOR 전환 + 기본 반경 UX 검토 — 2026-10-02 — MASTER PUSHED / PRODUCTION DEPLOYED (`90bf841`)
