# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

`feature/jobdetail-region-map` 브랜치(master 기준)에서 JobDetail의 "Khu vực làm việc" 지도
로직을 다시 다듬었다. **이전 스냅샷(같은 브랜치)에서는 지역명만 매칭되면 marker 없이
지도만 보여줬는데, 이번 요구사항 변경으로 marker는 항상 표시하고 정확도(exact/근사치)만
안내 문구로 구분하는 방식으로 바뀌었다.** JobDetail 다른 섹션/Home/JobCard/리뷰는 건드리지
않았다.

작업 상태:

- `IMPLEMENTED`: 완료
- `VERIFIED`: `npx tsc --noEmit`, `npm run build` 통과. 대표 시나리오 B(Hồ Chí Minh only,
  `sb-3888`)와 C(Bắc Ninh only, `sb-3705`)를 로컬 dev 서버에서 확인. 시나리오 A(실제
  lat/lng)와 D(위치정보 전혀 없음)는 운영 DB에 해당 데이터가 없어 코드 경로 리뷰로 대체.
- `DEPLOYED`: 미완료 — 브랜치 push까지만, Production 배포는 사용자 승인 전.

## 변경 내용

- `src/lib/jobCoords.ts`:
  - 기존 지역명→좌표 매핑(`PLACES`)을 재사용하고 6개 지역(Hưng Yên/Đồng Nai/Long An/
    Quảng Ninh/Thái Nguyên/Bắc Giang)을 추가(총 15개 지역).
  - 새 `resolveMapLocation(job)` 함수 — 우선순위대로 지도 좌표/줌/정확도를 한 번에 계산해
    반환한다: **1) `exact`** (DB `rawLat`/`rawLng`, zoom 15) → **2) `region`**
    (`rawLocation` 텍스트가 `PLACES`와 매칭, zoom 12) → **3) `default`** (매칭 실패 또는
    location 정보 자체가 없음 → 베트남 지리적 중심 `{14.0583, 108.2772}`, zoom 5).
  - `MapCoordinateSource` 타입에 `'exact' | 'address' | 'district' | 'region' |
    'default'` 5개 값을 정의했지만, 이 프로젝트는 `local_jobs`에 구조화된 상세주소/구
    (district) 컬럼이 없고 geocoding API도 없어(`geocod`/`nominatim`/`mapbox` 검색 0건)
    `'address'`/`'district'`는 **현재 코드에서 실제로 반환되지 않는다** — 나중에 상세주소
    필드나 geocoding이 생기면 새 union 값 추가 없이 확장할 수 있도록 타입만 미리 열어둔
    것이며, 없는 정밀도를 있는 것처럼 반환하지 않는다.
  - `findRegionCenter`(이전 스냅샷에서 추가)는 `resolveMapLocation` 내부에서만 쓰인다.
- `src/components/JobLocationMap.tsx`: `zoom` prop(기본 15) 유지. **`showMarker` prop은
  제거** — 이번 요구사항상 marker는 항상 그린다.
- `src/pages/JobDetail.tsx`:
  - `hasRealCoords`/`regionCenter`/`mapCenter` 3개 변수를 `resolveMapLocation(job)` 호출
    하나로 교체.
  - "Khu vực làm việc" 카드를 **location 텍스트 유무와 무관하게 항상 렌더링**한다(이전
    스냅샷은 `locationText &&`로 감쌌었음 — 이번에 제거). 주소 줄(`jd2-map-addr`)은
    `locationText`가 있을 때만 표시.
  - 지도 자체는 여전히 `Xem bản đồ` 토글 뒤에 접힌 채로 시작(기존 UX 유지, 새로 만들지
    않음). 펼치면 `resolveMapLocation`이 계산한 좌표/줌으로 `JobLocationMap`을 그리고,
    marker는 항상 표시되며, 안내문은 `source`에 따라 3갈래:
    - `exact` → "Bản đồ mang tính minh họa, có thể không trùng khớp chính xác địa chỉ
      công ty."(기존 문구 그대로)
    - `region` → "Vị trí hiển thị là vị trí gần đúng theo khu vực tuyển dụng."(신규)
    - `default` → "Chưa có thông tin vị trí cụ thể."(신규)

## 위치 결정 방식 (우선순위)

1. **exact** — DB `local_jobs.lat`/`lng`(=`job.rawLat`/`rawLng`)가 있으면 그대로 사용.
2. **region** — 없으면 `job.rawLocation` 텍스트를 `PLACES`(15개 성/시)와 매칭해 그 지역
   대표 좌표를 사용. 매칭은 기존 `findRegionCenter`/`normalizeViText` 로직 그대로(부분
   문자열 포함 매칭이라 "Bắc Ninh"이 다른 텍스트에 섞여 있어도 잡힘 — `sb-3705`로 확인).
3. **default** — location 텍스트가 아예 없거나 어떤 지역명과도 매칭되지 않으면 베트남
   전체를 보여주는 기본 중심점.
4. 상세주소/구(district) 단계는 이 앱에 그 데이터 자체가 없어(자유 텍스트 `location`
   컬럼 하나뿐, geocoding 없음) 이번 구현에 포함하지 않았다 — 타입에는 자리를 남겨뒀다
   (`MapCoordinateSource`의 `'address'`/`'district'`).

## exact/approximate 구분

- **exact**(실제 DB 좌표)일 때만 marker가 "정확한 위치"를 나타낸다고 암묵적으로 취급하고,
  근사치 안내문을 표시하지 않는다.
- **region/default**(지역 대표 좌표 또는 베트남 중심)일 때는 marker를 표시하되 **항상**
  그 아래에 근사치/미제공 안내문을 함께 표시해 실제 회사 위치처럼 보이지 않게 한다.
- region/default 좌표는 `resolveMapLocation`이 렌더링 시점에 계산해 반환하는 값일 뿐이며,
  `job.lat`/`job.lng`나 DB 어디에도 저장되지 않는다(코드 전체에서 이 값을 쓰는 곳은
  `JobLocationMap`에 넘기는 것뿐).

## 검증

- `npx tsc --noEmit`, `npm run build`: 각 1회 통과.
- **시나리오 B**(`sb-3888`, location="Hồ Chí Minh", lat/lng=null): `Xem bản đồ` 클릭 후
  주소 줄 "Hồ Chí Minh", 안내문 "Vị trí hiển thị là vị trí gần đúng theo khu vực tuyển
  dụng." 정확히 확인.
- **시나리오 C**(`sb-3705`, location 텍스트 안에 "Bắc Ninh" 포함): 동일한 `region` 안내문
  확인 — 부분 문자열 매칭이 정상 동작함을 함께 검증.
- **시나리오 A**(실제 lat/lng): 운영 DB에 좌표 있는 행이 0건이라 DB를 임의로 만들지 않고
  코드 경로만 리뷰(`resolveMapLocation`의 첫 분기, `exact` 문구 분기) — 로직상 이전
  스냅샷의 CASE A와 동일하게 동작.
- **시나리오 D**(위치정보 전혀 없음): 운영 DB에 location이 빈 행이 0건이라 마찬가지로
  코드 경로만 리뷰(`rawLocation`이 falsy면 지역 매칭을 건너뛰고 바로 `default` 분기로
  감을 확인).
- **지도 tile/marker 깨짐**: 이 로컬 샌드박스는 OpenStreetMap tile 서버로의 외부 네트워크
  요청이 막혀 있어(`net::ERR_FAILED` 다수, 이전 작업들의 스크린샷/scroll 이벤트 제약과
  같은 환경 한계) tile을 시각적으로 확인하지 못했지만, 기존 tileerror 안전장치
  ("Không thể tải bản đồ")가 정상적으로 떠서 깨진 지도가 노출되지는 않음을 확인했다.
  marker 자체는 `L.marker(...)` 호출이 조건 없이 항상 실행되도록 코드가 바뀌었음을 리뷰로
  확인(이전엔 `showMarker` 조건부였음).

## 발견된 문제

- 로컬 dev 서버(브라우저 자동화 샌드박스)에서 OpenStreetMap tile 서버 접근이 막혀 있어
  tile 렌더링 자체는 로컬에서 확인 불가 — Production(Vercel, 실제 브라우저)에는 해당 안
  될 것으로 보이는 환경 제약. 배포 후 실사이트에서 재확인 필요.
- **별개 항목**: `fix/scroll-restore-lazy-race`(커밋 `0c11f0a`, 라우트 전환 스크롤 복원이
  lazy-load Suspense 순간에 clamp되던 버그 수정)가 아직 master에 merge되지 않은 상태 —
  merge 시도가 세션 권한 분류기에 막혔다. 이번 지도 작업과는 무관하지만 다음에 master를
  만질 때 함께 처리 필요.

## 다음 결정사항

1. 사용자 승인 후 PR → master merge → Production 배포, 배포 후 viecganban.vn에서 tile
   렌더링 + marker 실제 노출 확인(시나리오 B/C).
2. `fix/scroll-restore-lazy-race`(커밋 `0c11f0a`) master merge를 별도로 승인/진행할지 결정.
3. 상세주소/구(district) 데이터나 geocoding이 실제로 필요해지면 `MapCoordinateSource`의
   `'address'`/`'district'`를 실제로 채우는 작업을 별도로 진행.
