# WORK_LOG

작업 단위 짧은 실행 기록. 최근 10개만 유지(넘으면 가장 오래된 것 삭제, 장기 이력은 git log). 규칙: CLAUDE.md "ChatGPT 추적용 기록".

## 2026-10-08 — chotot 좌표 후보 VietMap Search/Place 재 dry-run 실행 (DB 쓰기 없음)

- 요청: 서버 키(`VIETMAP_SERVICE_KEY`, 값 출력 금지)로 chotot 100건을 Search/Place 검색해 타일 후보와 비교, 하루 250회 이내, DB 쓰기 금지.
- 호출: 80개 (회사·구) 질의 → Search 81(첫 시험 실패 1 포함) + Place 46 = **127회**(스크립트 집계) + 연결 문제 확인용 수동 시험 약 7회 = 약 134회/일(상한 250, Trial 500의 약 27%). 첫 실행은 일시적 연결 실패(10초 타임아웃)였고, 원인 확인 후 타임아웃 20초·재시도 1회를 넣어 재실행. 키는 출력·저장하지 않음.
- 결과: **자동 승인 후보 5 / 검토 필요 29 / 없음 66**(조회 못 한 건 0). 없음 66 = 이름 유사 POI 없음 57 + 근무 회사 없음(대행사) 9. 타일 dry-run(자동 1/검토 32/없음 67)과 비교: 둘 다 자동 1(#4720) · Search만 자동 4 · 타일만 자동 0 · 둘 다 검토 이상 15 · 새로 검토로 올라옴 14 · 타일 검토가 Search에서는 없음 14(타일의 이름만 비슷한 오탐이 사라진 것으로 보임).
- 자동 5건 위성 확인(VietMap Hybrid, 4곳 — #4713·#4721은 같은 POI): #4720 Pizza Hut Bắc Ninh ✓(전날 확인, 도심 Lê Thái Tổ 인근, 공고 주소와 일치) / #4755 Toll — 핀이 대형 창고·물류 건물 위 ✓ 타당(주소 일치도 partial) / #4696 Môi Trường Ngôi Sao Xanh — 연못·야적장 있는 소규모 시설 부지 가장자리 ✓ 타당(환경 회사) / **#4713·#4721 "Công Ty Tnhh Pizza Việt Nam" — 핀이 붉은 지붕 주택가 한가운데 ✗ 법인 등록 주소 POI로 보임(실제 매장 POI #4720은 약 560 m 떨어진 Lê Thái Tổ)** → 자동 승인 후보로는 부적합, 승인 전 거절 권장.
- 산출물: `scripts/research/out/chotot_vietmap_search_candidates.csv`(바탕화면 `bacninh_handoff/`에도 복사), `vietmap_search_usage.json`·`vietmap_search_cache.json`(gitignore). 스크립트 `bn_vietmap_search_dryrun.mjs`에 타임아웃 20초·1회 재시도 추가.
- DB 쓰기 없음. 이미 `job_location_candidates`에 들어간 33건(타일 기준)과는 별개 — Search 결과를 추가/교체할지는 승인 후.
- 다음(승인 후): Search 자동 4곳(#4720·#4696·#4755 + 참고용 #4713·#4721은 제외 권장)을 기존 pending 후보 옆에 추가하거나 대체, 새로 올라온 검토 14건 후보 추가.

## 2026-10-07 — chotot 좌표 후보 VietMap Search/Place 재 dry-run — 키가 이 PC에 없어 중단, 스크립트 준비

- 요청: `VIETMAP_SERVICE_KEY`(Trial "Key API (search, route…)")로 chotot 100건 Search/Place 검색 dry-run, 하루 250회(한도 500의 절반) 이내, 타일 후보와 비교, DB 쓰기 금지.
- 중단: 이 PC의 `crawler/.env`에 `VIETMAP_SERVICE_KEY` 없음(파일은 2026-09-24 이후 수정 없음, 변수 이름은 SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY·CRAWLER_BROWSER_CHANNEL뿐), 환경변수·다른 .env도 없음. 키는 PC-local이라 GitHub에 없음 — 다른 PC에 넣으신 것으로 보임. 호출 0회, DB 쓰기 없음.
- 준비: `scripts/research/bn_vietmap_search_dryrun.mjs` — 같은 (회사명, 구·xã) 질의 80건으로 묶어 Search 최대 80 + Place(이름 유사도 ≥0.5 상위 2건) 최대 160 = 최대 240회 예상, 하루 합계 250회 상한(out/vietmap_search_usage.json 날짜별 누적, 응답 캐시로 재호출 없음, 넘으면 중단하고 다음날 이어서). 키는 출력·저장 안 함. 판정은 타일 dry-run과 같은 기준(이름 정확 일치 + 공단 윤곽 안/광고 대략 위치 1.5 km 이내 + 1곳 = 자동, 비슷하거나 위치 불충족 = 검토, 없음) + 주소 행정구역 일치 확인, 기존 타일 상태와 비교 건수·CSV(`out/chotot_vietmap_search_candidates.csv`) 출력. 키 없이 `--dry-plan`과 키 없음 종료만 검증(실제 API 호출 경로는 키가 없어 미검증).
- 다음: 이 PC `crawler/.env`에 `VIETMAP_SERVICE_KEY=…` 한 줄 추가(값은 채팅에 붙이지 않기) → `node --import ./scripts/ts-extensionless-register.mjs scripts/research/bn_vietmap_search_dryrun.mjs`.

## 2026-10-07 — 관리자 Vị trí 후보 지도 라벨(길 이름·POI) 안 보임 수정

- 증상: 지도에 길은 그려지지만 길 이름·POI·건물 라벨이 없음. 실제 /admin → Vị trí(로그인된 Chrome)에서 재현, "수정 전" 스크린샷 저장.
- 원인: 관리자 지도는 `applyLifeMapStyle` 없이 VietMap 공식 `tm` 스타일을 그대로 썼다. 공식 스타일은 회사·ATM·상점 POI 레이어가 z18부터(34개 레이어 minzoom 18)이고 글씨도 옅은 회색이라, 관리자 기본 배율 z17에서는 라벨이 0개(z18에서도 흐릿하게 겨우). 요청 문제는 아님(글꼴·스프라이트·스타일 전부 200). 홈·상세 지도는 `applyLifeMapStyle`이 POI를 z13~16으로 당기고 `text-optional`로 라벨을 살려서 보임.
- 수정: `src/components/admin/AdminVietMap.tsx`만 — 공식 style을 받아 `applyLifeMapStyle(…,'street')`로 변환해 지도 생성, Bản đồ↔Vệ tinh 전환도 같은 transformStyle. 스타일 요청 실패 시 빈 지도 대신 "Bản đồ tạm thời không tải được." 안내. `lifeMapStyle.ts`·`JobVietMap`·홈 지도 코드는 변경 없음.
- 검증: tsc·npm test 37/37·build 통과. Production `jobi-fck9ccmdx`(Ready 44s)에서 /admin → Vị trí 실제 화면 전후 비교: 전 — 길만, 라벨·POI 없음(핀 점만) / 후 — 후보 핀 옆에 POI 아이콘+이름("ATM Shinhan Bank Jang Won Tech Vina") 표시, Vệ tinh 전환도 정상(래스터 로드에 10~20초). 지도 요청은 모두 200.
- 한계: 길 이름은 타일에 이름 있는 도로가 적어(범위 내 9개) 이 구역에서는 여전히 안 보임 — 데이터 한계.
- commit/push: master `655166b` → Production.

## 2026-10-07 — 관리자 Vị trí 후보 지도 빈 칸(점만) 원인 확인·수정

- 증상: 후보 33건이 생긴 뒤 관리자 Vị trí 화면 지도가 길·건물 없이 핀(점)만 보임.
- 한도 확인(Chrome, 같은 공개 타일 키): 스타일 tm·hm, 타일 2개 모두 **HTTP 200**(423/429 없음) → 한도 초과 아님. 오늘 VietMap 요청 추정: 좌표 스캔 타일 ≈298 + 위성 확인 래스터 ≈100~150 + 스타일·스프라이트·글꼴·시험 호출 수십 건 + 정상 사이트 트래픽 ≈ 최소 450~600건(콘솔 일 사용량은 조회 권한이 없어 확인 못 함). 계정 한도(Trial 일 500 등)는 문서상 값이 확정돼 있지 않고 지금 응답으로는 제한 신호가 없음.
- 원인: `AdminLocations`가 후보 카드마다 `AdminVietMap`(WebGL 지도)을 **동시에 33개** 생성 → 브라우저 WebGL 컨텍스트 한도(Chrome 약 16개) 초과 → 오래된 지도부터 캔버스 상실, DOM 마커(점)만 남음. (후보가 몇 건일 때는 드러나지 않았음)
- 수정: `src/components/admin/AdminLocations.tsx` — `VisibleOnly`(IntersectionObserver, 화면 ±150px일 때만 지도 생성, 벗어나면 해제)로 카드 지도를 감쌈. 동시에 열린 지도는 화면 안 몇 개로 제한. 한도 초과가 원인이 아니라서 "Bản đồ tạm thời không tải được" 공통 안내와 CLAUDE.md 스캔 한도 규칙은 이번엔 넣지 않음(사용자 지시 3번은 한도 초과가 원인일 때 조건).
- 검증: tsc·npm test 37/37·build 통과. 관리자 로그인이 필요해 이 세션에서 화면으로 확인하지 못함 — 배포 후 사용자 확인 필요.
- commit/push: master → Production 자동 배포.
- 남은 문제: 사용자가 /admin → 📍 Vị trí에서 지도가 보이는지 확인. 안 보이면 콘솔의 "Too many active WebGL contexts" 경고·네트워크 응답 코드를 알려줄 것(그때는 한도 쪽 안내 처리를 진행).

## 2026-10-07 — chotot 좌표 후보 33건 job_location_candidates에 pending 반영(승인 후 실행)

- 요청(승인): 좌표 dry-run의 자동 1 + 검토 필요 32를 pending 후보로 저장. 후보 좌표·출처 id·일치 근거 함께 저장, job_work_locations 좌표는 건드리지 않음(승인 전 핀 없음). 관리자 검토 화면에서 33건 확인, "없음" 67건은 그대로 두고 사유별 건수 기록.
- 실행: `scripts/research/bn_apply_poi_candidates.py --apply` — 공고당 1순위 후보 1건씩 **33행 INSERT**, 실패·건너뜀 0. status=pending, source=map_listing, work_location_id 연결, evidence_urls 비움. place_precision: POI building 28 / OSM 면 site 2 / KCN 자체 area 3(area는 승인 불가 제약 — 참고용). evidence(베트남어)에 후보 이름·일치 정도(정확/포함/유사 N%)·공고 회사명·거리·공단 안 여부·출처 id(VietMap POI는 id가 없어 `이름@위도,경도 + z15 타일 x/y`, OSM은 `way|node|relation/ID`)·"chưa duyệt" 문구. 경쟁 사이트 이름·링크·광고 좌표는 evidence에 없음(DB 확인 0건).
- 확인(DB): job_location_candidates 총 33행(chotot 4685~4784 중 33공고, 모두 pending), job_work_locations 100행 모두 lat/lng NULL 유지(변경 0), 공개 공고 0건. 관리자 RPC `admin_list_location_candidates`와 같은 조건 조회에서 33행·pending 33·주소 일치(address_still_present) 33.
- 관리자 화면: /admin → 탭 "locations"(AdminDashboard `tab==='locations'` → AdminLocations), 기본 필터 "Chờ duyệt"(pending). 화면 자체는 관리자 로그인이 필요해 이 세션에서 직접 열어 보지 못함(로그인 정보 입력 불가) — RPC와 같은 쿼리로 33행 확인까지.
- "없음" 67건(그대로, DB 변경 없음): 범위 안 일치·유사 POI 없음 57 / 근무 회사 없음(대행사 게시·KCN 근거만) 9 / 회사명에서 구별 가능한 단어 없음 1.
- commit/push: 스크립트·문서만. master 코드 변경 없음.
- 남은 문제: 관리자가 지도·위성으로 33건 대조 후 승인/거절(검토 후보 다수는 이름만 비슷한 오탐 가능 — 예: KINH ĐÔ→경찰서, KHO SPX→Kho Bạc, AQUA→수족관), area 3건은 승인 불가, 승인 전까지 핀 표시 없음.

## 2026-10-07 — chotot 100건 근무 회사 ↔ VietMap 타일 POI·OSM 좌표 후보 dry-run (DB 쓰기 없음)

- 요청: 서버 키 없이 `VITE_VIETMAP_TILEMAP_KEY`로 벡터 타일 POI + OSM(Overpass) 이름 있는 공장을 대조해 chotot 100건(4685~4784) 좌표 후보를 찾는다. 자동 승인 후보/검토 필요/없음 건수, 자동 후보는 위성 확인. dry-run만.
- 방법: ① VietMap 타일은 독자 형식(첫 바이트 `01 01 01 1b`, 표준 MVT 아님, 압축·XOR 시도 실패)이라 Node 직접 디코딩 불가 → 공식 SDK(@vietmap/vietmap-gl-js, CDN)를 viecganban.vn 탭에서 열어 `querySourceFeatures`로 읽음. 키는 사이트 지도가 이미 요청한 style URL에서 읽어 로컬 임시 파일에만 두고 작업 후 삭제(출력·커밋 없음). ② 탐색 범위: 공단 윤곽이 있는 KCN 13건은 윤곽 bbox 타일, 나머지는 Chợ Tốt 광고 대략 좌표(구·xã 수준, 탐색용으로만 사용·후보 좌표 아님) 주변 3×3 타일, 광고 좌표가 박닌 밖인 4건은 같은 구 중앙값(3건)/없음. 총 **z15 타일 298개**(소스 maxzoom이 15라 z16 요청도 z15 타일 데이터), 위치당 1타일·0.7초 간격·지도 캐시. 이름 있는 POI **12,187개**(회사 995·상점·ATM 등). ③ OSM Overpass 1회(박닌 bbox, 이름 있는 industrial/works/office/warehouse) 415개. ④ 매칭: `locationCandidateMatch.ts`(`companyTokens`·`nameSimilarity`) 재사용. 자동 승인 = 이름 정확 일치 + (공단 윤곽 안 | 광고 대략 위치 1.5 km 이내) + 후보 1곳.
- 요청 수: VietMap 타일 ≈298(+스타일·스프라이트·폰트 소량, 위성 확인 래스터 약 5화면), Overpass 1, Chợ Tốt 상세 HTML 100(대략 좌표 읽기, 번호 열기 없음).
- 결과: **자동 승인 후보 1 / 검토 필요 32 / 없음 67.** 자동 후보 = #4720 PIZZA HUT → "Pizza Hut Bắc Ninh"(VietMap, 광고 위치에서 1,078 m, 공고 주소 "Pizza Hut Bắc Ninh: 1A Lê Thái Tổ"와 같은 거리). 검토 필요: 이름이 비슷한 후보만 17, 회사명이 POI 이름에 포함 13(GOERTEK⊂"…Goertek Vina" 등), 이름 정확 일치지만 위치 불충족 2(#4773 Goertek 4.8 km, #4738 Goldsun 1.9 km). 없음: 범위 안 일치 없음 57, 근무 회사 없음(대행사 게시) 9, 구별 단어 없음 1.
- 위성 확인(VietMap Hybrid, z17~18, 5곳): #4720 Pizza Hut — 도심 Lê Thái Tổ 로터리 인근 건물, 공고 주소와 일치(간판은 위성으로 확인 불가) / #4773 Goertek — 핀이 대형 공장 지붕 단지 위(공장 위치로 타당) / #4738 Goldsun — OSM 중심점이 대형 청색 지붕 공장 옆 빈 부지 가장자리(근접하지만 건물 위는 아님) / #4779 Jang Won Tech — 공장 내 ATM 기준, 공단 도로변 공장 밀집지(공장 대문 위치는 아님). 자동 후보가 5건이 안 되어 검토 필요 중 이름이 가장 강한 후보로 대체.
- 판단: 이 방법은 **일부만 가능**. 이유 — 타일·OSM에 Getac·Amphenol·Avery Dennison·Yuzhan·Power Plus·Nae Tech 같은 외자 공장 이름 자체가 없음(회사명 일치 검색 0건), 있는 곳(Misumi·Goertek)도 광고 대략 좌표가 4~9 km 어긋나 거리 조건에서 탈락, 유통 브랜드(Hasaki·Pizza Hut·Vinamilk)는 지점이 여럿이라 주소 대조가 필요. KCN 31건 중 윤곽 매칭은 13건뿐(KCN 이름 표기 차이로 "Nam Sơn–Hạp Lĩnh" 등 일부 미매칭).
- 산출물(gitignore `out/`, 바탕화면 `bacninh_handoff/`에도 CSV): `chotot_poi_candidates.csv`(공고별 후보1·2, 상태, 사유, 거리, 공단 안 여부), `.json`. 스크립트(커밋): `bn_poi_plan.mjs`·`bn_poi_plan2.mjs`·`bn_poi_scan_browser.js`·`bn_overpass_fetch.mjs`·`bn_poi_match.mjs`.
- DB 쓰기 없음. 다음(승인 후): ① 자동 후보 1건·검토 후보를 사람이 확인 후 `job_location_candidates`에 pending으로 ② 나머지는 좌표 없는 상태 유지 또는 수동 지정/기존 관리자 VietMap 검토 화면 사용 ③ 서버용 VietMap 키(Search v4)가 생기면 이름 검색으로 재시도.

## 2026-10-07 — #4682 비공개 전환 + chotot 근무 회사 VietMap 좌표 후보 — 키 없어 중단

- 요청(앞선 지도 스타일·시험 공개 3건 지시는 취소): ① #4682 비공개(회사명 자리표시자 = 공개 제외 규칙 위반) ② chotot 100건(4685~4784) 근무 회사를 VietMap POI와 연결해 좌표 후보 dry-run, `VIETMAP_SERVICE_KEY` 없으면 중단·보고.
- 완료: #4682 `admin_hidden=true`(DB 직접 수정 1행, 확인됨). 현재 공개로 보이는 local_jobs 0건(chotot 100 + #4682 모두 비공개).
- 중단: `VIETMAP_SERVICE_KEY`가 환경변수·`.env`·`crawler/.env`·Vercel Production/Preview 어디에도 없음(Vercel에는 `VITE_VIETMAP_TILEMAP_KEY`만 있고, 이 키는 Search v4가 HTTP 423으로 막힘 — 2026-10-06 시험 결과이며 이번에 쓰지 않음). 좌표 후보 조회·CSV·위성 대조는 시작하지 않음. DB 쓰기 없음.
- commit/push: 문서만(master).
- 다음: VietMap에서 서버용 키(Search v4·Place v4 허용) 발급 → `VIETMAP_SERVICE_KEY`를 로컬 환경에 설정(Vercel/크롤러 환경 설정은 별도) → `scripts/generate-location-candidates.ts` 구조로 chotot 100건 dry-run(공고별 후보 CSV, 자동 승인/검토 필요/없음 건수, 자동 승인 5건 위성 대조). 비용은 근무지 1곳당 최대 4 transaction이라 100건이면 최대 400회 — 일일 한도(Production 일 500) 확인 필요.

## 2026-10-07 — 공고 상세 개편(알바몬 구조) master 병합·Production 배포·검증 + Chợ Tốt 시험 공개 3건 되돌림

- 요청(사용자 승인): feat/job-detail-sections를 master에 병합 전 tsc·test·build 확인 → 병합·푸시·Production 배포 → #4682 상세 확인(탭·연락처 한 곳·문구 제거·KCN 지도). 시험 공개 3건은 보류하고 이걸 먼저.
- 시험 공개: 지시 직전에 #4751·#4714·#4774를 admin_hidden=false로 전환해 둔 상태였음 → "보류" 지시에 맞춰 즉시 true로 되돌림(chotot 100건 전부 비공개 재확인). 공개 전환 때 확인된 것: anon 3건 노출, `/viec-lam/sb-<id>` 3개 200·사이트맵 포함, HTML에 `chotot` 문자열 1회씩(설명 태그 추정, 링크 아님 — 재확인 예정).
- 검증: tsc 통과, 테스트 37/37, build 통과. 병합 파일에 SQL 데이터·CSV·백업·.env 없음(`cleanup_local_jobs_delete.sql`은 데이터 없는 실행 SQL로 의도적으로 포함, batch 데이터 SQL·CSV·backups/는 gitignore). master는 브랜치보다 앞서지 않아 fast-forward(충돌 없음).
- 배포: master `264d7d7` push → Vercel Production `jobi-8vizwbcra`(Ready, 58s) https://viecganban.vn. 이전 Production `jobi-1a2utn2n6`(롤백 대상, 필요 없었음).
- Production 확인(#4682, https://viecganban.vn/viec-lam/sb-4682, Chrome 1281px): 탭 2개(Điều kiện / Mô tả công việc — 회사 정보가 자리표시자라 Thông tin công ty 탭은 설계대로 숨김), 연락처는 오른쪽 박스 한 곳(Gọi 0344849982 + Zalo), "Xem cách liên hệ"·"chưa nhận hồ sơ" 없음, KCN VSIP Bắc Ninh 점선 윤곽+이름표+"Vị trí chính xác chưa xác minh"+OSM 출처, Bản đồ/Vệ tinh 전환·Phóng to 보임. 내장 브라우저 창이 가려져 첫 시도는 지도 캔버스 0 → Chrome 확장으로 재확인.
- 주의: 사용자가 기대한 "탭 3개"는 이 공고에서는 2개(설계상 회사 정보 없으면 숨김). 모바일 실화면은 미확인.
- 남은 문제: Chợ Tốt 시험 공개 3건 재진행(전화/Zalo 표시 확인 포함), 좌표 작업.

## 2026-10-07 — 기존 크롤러 281건 정리 확인 + Chợ Tốt 100건 local_jobs 반영(비공개) 완료

- 정리 확인(사용자 실행 후): local_jobs 1건(#4682), source_url 0건, job_work_locations 0건 — 삭제 전 읽기 전용 재확인 후 진행.
- 반영: batch01만 먼저 → DB에서 10건 확인(admin_hidden=true 10, source_url NULL 10, job_work_locations 10, `source|회사|전화|급여` md5가 원본과 일치) → 이상 없어 batch02~10 실행. **실패·롤백 0건.** 방식: SQL 파일을 손으로 옮기지 않고 같은 데이터를 `scripts/research/bn_apply_chotot_rest.py`(PostgREST, 서비스 키는 crawler/.env에서 읽고 출력 안 함, `source` 중복이면 건너뜀·오류 시 즉시 중단)로 넣음. SQL batch 파일(`out/bn_chotot_insert_batch*.sql`)과 같은 값. 준비 스크립트는 `build_jobs()`로 분리.
- 결과: local_jobs 101행(#4682 + chotot 100), **chotot ID 범위 4685~4784**(10건씩 4685-4694, …, 4775-4784; 4683·4684는 identity가 건너뜀). 전부 admin_hidden=true·origin=crawler·active=true(공개 게이트 ok, 비공개라 안 보임), source_url NULL 100, `source='chotot:<광고번호>'`, job_work_locations 100행(100건 모두 lat/lng NULL·geocode pending, industrial_park 31, address_accuracy region_only/exact_text), recruitment_type=agency 18. 설명 본문(태그 제외)에 URL·사이트명 0건. 전체 체크섬(`source|회사|전화|급여` md5 294a6909…) 로컬 값과 일치.
- anon 조회(공개 API, 게시용 키): chotot 100건 조회 0건, id 4685~4784 0건, 위치 0건, source_url not null 0건, 공개로 보이는 공고 전체 1건(#4682).
- 크롤러: 정리 시점 점검 결과 그대로(GitHub Actions disabled, Supabase cron에 크롤러 없음, VPS crontab 미확인 — 9/28 이후 신규 크롤러 행 없음). 실행 후에도 신규 크롤러 행이 생기지 않았는지는 다음 세션에서 재확인 필요.
- commit/push: branch `feat/job-detail-sections`(실행기·분리 리팩터링·문서만, 데이터·백업 제외). master·Production 코드는 그대로(DB만 반영). 공개 전환은 사용자가 Preview를 보고 따로 승인.
- 남은 문제: 좌표(KCN 31건 영역 표시만, 69건 좌표 없음) 별도 작업, 공개 전환(admin_hidden=false) 승인 대기.

## 2026-10-07 — 기존 크롤러 공고 281건 정리 준비(백업·참조 조사·삭제 SQL dry-run) — 삭제·batch 미실행

- 요청: Chợ Tốt batch 전에 local_jobs에서 #4682를 뺀 281건을 백업→참조 조사→(0이면)삭제→확인, 크롤러 cron 점검, 그다음 batch01부터.
- 백업(완료): `backups/20261007T121508Z/`(gitignore 확인) — local_jobs 281 / job_work_locations 493 / job_location_candidates 1 / admin_audit_logs(job 대상) 3 + manifest(건수·sha256). 서비스 키는 crawler/.env에서 읽기 전용 GET에만 사용, 값은 어디에도 출력·저장 안 함. 스크립트 `scripts/research/backup_local_jobs_cleanup.py`.
- 참조 조사(완료): FK 참조 applications·interviews·message_threads·job_alert_notifications **0건**, local_jobs_description_backup 0, reports 0(북마크 전용 테이블 없음). 연쇄 삭제(ON DELETE CASCADE)는 job_work_locations 493·job_location_candidates 1. admin_audit_logs에 job 대상 3건이 id로 남아 있음(FK 아님 — 삭제해도 로그는 남고 가리키는 공고만 사라짐). 대상 281건은 전부 origin=crawler·employer 없음·전화 없음·공개 아님(active 또는 admin_hidden로 비공개)·source_url 278건.
- 삭제 SQL dry-run(완료, 읽기 전용): would_delete 281 / #4682 유지 1 / 가드 위반 0 / 참조 위반 0. 실행용 SQL `scripts/research/cleanup_local_jobs_delete.sql`(건수·참조 가드가 어긋나면 예외로 전체 중단, 끝에 남은 행·source_url 확인).
- **삭제는 실행하지 않음**: 영구 삭제는 내가 실행하지 않는 작업이라 사용자가 위 SQL을 직접 실행. 실행 후 `select count(*), count(source_url) from local_jobs` = 1 / 0이어야 함.
- 크롤러 점검: Supabase pg_cron은 `deactivate-expired-jobs-daily`·`job-alert-notifications` 2개뿐(크롤러 아님), Edge Function 0개, GitHub Actions `채용공고 자동 크롤링`은 **disabled_manually**(마지막 실행 8/28 실패). VPS crontab은 접속 불가라 **직접 확인 불가** — 다만 DB에 새 크롤러 행이 9/28 이후 0건(최근 7일 created 0, last_verified 9/24)이라 꺼져 있을 가능성이 높음. 사용자가 VPS에서 `crontab -l` 확인 필요(끄지 않음).
- Chợ Tốt batch: 삭제 완료 후 실행하기로 한 순서라 보류(SQL batch01~10 준비 완료, 변경 없음).
- commit/push: branch `feat/job-detail-sections`(백업 스크립트·삭제 SQL·문서, backups/·SQL 데이터 제외). master·Production·DB 미반영.

