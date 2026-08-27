# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

`feature/jobdetail-region-map` 브랜치(master 기준)에서 JobDetail의 "Khu vực làm việc"(구
Địa điểm làm việc) 섹션을 수정했다 — DB에 정확한 lat/lng가 없다는 이유만으로 근무지역
섹션 전체를 숨기던 것을, location 텍스트가 있으면 섹션은 항상 보여주고 지도는 데이터
정확도에 따라 3단계로 나눠 처리하도록 바꿨다. JobDetail 다른 섹션/Home/JobCard/리뷰는
건드리지 않았다.

작업 상태:

- `IMPLEMENTED`: 완료
- `VERIFIED`: `npx tsc --noEmit`, `npm run build` 통과. 대표 시나리오 A(location만 있고
  lat/lng 없음, 실제 AQUACO `sb-3888`)를 로컬 dev 서버에서 확인. 시나리오 B(실제 lat/lng
  있는 공고)는 운영 DB에 해당 데이터가 0건이라 DB를 임의로 만들지 않고 코드 경로 리뷰로
  대체(아래 참고).
- `DEPLOYED`: 미완료 — 브랜치 push까지만, Production 배포는 사용자 승인 전.

## 변경 내용

- `src/lib/jobCoords.ts`: 기존에 있던 지역명→좌표 매핑(`PLACES`, 9개 지역)을 그대로
  재사용하고 새 지역 6개(Hưng Yên/Đồng Nai/Long An/Quảng Ninh/Thái Nguyên/Bắc Giang)를
  추가했다. 새 함수 `findRegionCenter(location)`을 추가 — 기존 `guessCoordinatesFromLocation`
  과 달리 매칭되는 지역이 없으면 Đà Nẵng 같은 기본값으로 떨어지지 않고 `null`을 반환한다
  (지도를 아예 숨겨야 하는 경우와 지역 근사치를 보여줘도 되는 경우를 호출부가 구분할 수
  있도록). 반환값은 지도 뷰포트 중심 전용이며 실제 근무지 좌표가 아니라는 점을 주석으로
  명시했다.
- `src/components/JobLocationMap.tsx`: `zoom`(기본 15)과 `showMarker`(기본 true) prop을
  추가. 지역 중심 지도를 보여줄 때는 `showMarker={false}`로 회사 marker를 아예 그리지
  않는다.
- `src/pages/JobDetail.tsx`:
  - `hasRealCoords`(기존, `rawLat`/`rawLng`)가 없을 때 `locationText`가 있으면
    `findRegionCenter`로 지역 중심 좌표를 구해 `mapCenter`로 쓴다(있으면 CASE C, 없으면
    지도 없음).
  - 섹션 표시 조건을 `hasRealCoords` → `locationText`(주소/지역 데이터가 하나라도 있으면)
    로 바꿔, "Khu vực làm việc" 자체는 좌표 유무와 무관하게 노출한다.
  - CASE A(실제 좌표): 기존과 동일 — zoom 15, marker 있음, 안내문 "Bản đồ mang tính minh
    họa...".
  - CASE C(지역명만 매칭): zoom 12(도시 단위), marker 없음, 안내문 "Vị trí chính xác chưa
    được nhà tuyển dụng cung cấp." 지역 중심 좌표를 `job.lat`/`job.lng`나 DB에 저장하는
    코드는 전혀 추가하지 않았다 — 렌더링 시점에만 계산해서 쓰고 버린다.
  - CASE B(상세주소는 있으나 좌표 없음, geocoding 필요): 프로젝트 내 기존 geocoding
    API/로직을 검색했으나 없었고(`geocod`/`nominatim`/`mapbox` 등 매치 0건), 이번 작업
    범위에서 새 외부 geocoding을 도입하지 않기로 한 지시에 따라 별도 처리를 만들지 않았다
    — 주소 텍스트가 알려진 지역명과 매칭되면 자동으로 CASE C로, 매칭되는 지역이 전혀 없으면
    지도 없이 주소 텍스트만 표시된다(임의 좌표 생성 없음).
  - 매칭되는 지역/좌표가 전혀 없으면(예: location 텍스트가 완전히 다른 형식이거나 알 수
    없는 지명) 주소 줄만 보여주고 지도/토글 버튼 자체를 렌더링하지 않는다.
  - 기존 Leaflet 마커 아이콘 깨짐 수정, 지도 접힘(`Xem bản đồ` 토글) UX, tile 로드 실패 시
    안내 문구로 대체하는 기존 안전장치는 그대로 재사용했다(수정하지 않음).

## 지도 데이터 처리 방식 — 지역 중심 좌표 vs 실제 회사 좌표

- **실제 회사 좌표**: `job.rawLat`/`job.rawLng`(=DB `local_jobs.lat`/`lng`)만 해당. 이
  값이 있을 때만 marker를 그리고 "Bản đồ mang tính minh họa..." 문구를 쓴다.
- **지역 중심 좌표**(`findRegionCenter`의 반환값): `jobCoords.ts`의 `PLACES` 테이블에서
  가져온, 그 지역(성/시)의 대표 좌표일 뿐이다. **DB에 저장하지 않고, `job.lat`/`job.lng`에
  대입하지 않으며, `JobLocationMap`에 `showMarker={false}`로 넘겨 marker 자체를 그리지
  않는다.** 화면에는 "Vị trí chính xác chưa được nhà tuyển dụng cung cấp." 문구로 정확한
  위치가 아님을 항상 함께 표시한다. 렌더링이 끝나면 버려지는 값이며 어디에도 영속화되지
  않는다.

## 검증

- `npx tsc --noEmit`, `npm run build`: 각 1회 통과.
- **시나리오 A**(location="Hồ Chí Minh", lat/lng=null, 실제 `sb-3888`): 로컬 dev 서버에서
  "Khu vực làm việc" 섹션과 "Hồ Chí Minh" 주소 표시, `Xem bản đồ` 클릭 시
  `.leaflet-marker-icon` 개수 0(marker 없음), 안내문
  "Vị trí chính xác chưa được nhà tuyển dụng cung cấp." 정확히 표시 확인. (참고: 이 로컬
  샌드박스 브라우저 환경은 외부 OpenStreetMap tile 서버 접근이 막혀 있어 — 이전 작업들에서도
  스크린샷/scroll 이벤트가 동작하지 않던 것과 같은 환경 제약 — tile 자체는 못 불러오고 기존
  tileerror 안전장치("Không thể tải bản đồ")가 정상적으로 대신 떴다. marker 억제/섹션 노출/
  안내문 로직은 DOM에서 직접 확인했으므로 이 tile 네트워크 제약과 무관하게 유효하다.)
- **시나리오 B**(실제 lat/lng 있는 공고): 운영 `local_jobs`에 좌표가 채워진 행이 없어(이전
  작업에서 확인한 상태 그대로) Production DB를 임의로 만들지 않고, 위 "변경 내용"에 적은
  코드 경로를 직접 리뷰해 CASE A 로직이 기존과 동일하게 동작함을 확인했다.

## 발견된 문제

- 로컬 dev 서버(브라우저 자동화 샌드박스)에서 OpenStreetMap tile 서버로의 외부 네트워크
  요청이 막혀 있어 지도 타일 자체는 로컬에서 시각적으로 확인할 수 없다 — Production
  (Vercel, 실제 사용자 브라우저)에는 해당되지 않는 이 환경만의 제약으로 보이며, 배포 후
  실사이트에서 재확인이 필요하다.
- **별개 항목**: 이전 세션에서 발견한 "라우트 전환 시 스크롤이 lazy-load Suspense
  fallback 순간에 clamp되던" 버그 수정(`fix/scroll-restore-lazy-race` 브랜치, 커밋
  `0c11f0a`)이 아직 master에 merge되지 않았다 — merge 시도가 세션 권한 분류기에 막혔다.
  이번 region-map 작업과는 무관하지만, 다음에 master를 만질 때 함께 처리 필요.

## 다음 결정사항

1. 사용자 승인 후 PR → master merge → Production 배포, 배포 후 viecganban.vn에서 실제
   tile 렌더링(시나리오 A) 확인.
2. `fix/scroll-restore-lazy-race`(커밋 `0c11f0a`)를 master에 merge하는 것을 별도로 승인/
   진행할지 결정.
3. 실제 lat/lng가 채워진 공고가 생기면 시나리오 B(marker 있음, 안내문 없음)를 실데이터로
   재확인.
