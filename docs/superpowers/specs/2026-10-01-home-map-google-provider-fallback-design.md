# 메인 지도 Google Primary + Geoapify Fallback 설계

작성일: 2026-10-01
상태: 설계 승인 후 문서화 완료, 구현 전

## 1. 목적

메인 구직 지도는 Google Maps JavaScript API의 기본 ROADMAP을 우선 사용한다. Google API를 사용할 수 없으면 현재 Production에서 검증된 MapLibre GL + Geoapify `osm-bright/style.json` 지도로 자동 전환한다. 지도 provider가 바뀌어도 위치, 검색 반경, verified 공고, 선택 공고, 필터 결과 및 사용자가 조작한 viewport가 가능한 범위에서 유지되어야 한다.

이번 변경은 메인 지도 렌더러의 provider 경계를 만드는 작업이다. `HomeMapExplorer`가 소유하는 검색·필터·선택 상태와 DB 구조는 변경하지 않는다. 다른 화면에서 쓰는 Leaflet과 메인 지도 fallback인 MapLibre/Geoapify도 제거하지 않는다.

## 2. 현재 기준 동작

- `HomeMapExplorer`가 검색 기준 위치, 실제 현재 위치 여부, 반경, 필터, 선택 공고, 명시적 재정렬 번호(`recenterRequest`)를 소유한다.
- `HomeMapCanvas`는 client-only lazy chunk에서 MapLibre를 생성하고 Geoapify vector style을 사용한다.
- 초기 로드와 지역/현재 위치 명시 선택 때만 center/zoom을 설정한다.
- wheel, drag, zoom control 조작 후 radius 변경은 viewport를 움직이지 않고 반경 원과 결과만 갱신한다.
- verified 위치만 공고 핀으로 표시하며 핀 선택은 오른쪽 패널과 연결된다.
- `ResizeObserver`로 캔버스 크기를 갱신하고, SSR 번들에서는 브라우저 지도 SDK를 실행하지 않는다.
- 확정된 PC 높이는 1366×768=425px, 1440×900=440px, 1920×1080=485px다. 모바일 375px에서는 기존 세로 배치를 사용한다.

## 3. 범위와 비범위

### 포함

- Google Maps를 기본 provider로 추가
- 현재 Geoapify 구현을 fallback provider로 분리·보존
- provider 선택 및 실패 전환 상태 관리
- ROADMAP/HYBRID 지도 타입 전환
- 공통 공고 핀, 선택 강조, 현재 위치, 반경 원, viewport 규칙
- 키 없음과 강제 로더 실패를 포함한 fallback 검증
- Google 키가 준비된 환경에서 실제 Google 지도 검증

### 제외

- DB, verified 위치 정책, 13개 필터의 판정 구조 변경
- 서버 기반 clustering 또는 대규모 공간 검색 시스템
- Google Cloud 프로젝트·결제 계정·API key의 임의 생성
- 감지할 수 없는 모든 quota/billing 실패의 완전한 자동 복구 보장
- 메인 지도 외 Leaflet 화면 전환
- 기존 높이·가로 비율·3열·패널 스크롤·주변 여백 변경

## 4. 권장 구조

```text
HomeMapExplorer
  └─ HomeMapCanvas                  provider coordinator
       ├─ GoogleMapCanvas           primary
       │    └─ GoogleJobMarkerLayer custom job overlays
       └─ GeoapifyMapCanvas         fallback, current MapLibre implementation
```

예상 파일 경계:

- `src/components/home/HomeMapCanvas.tsx`: provider 상태 머신, timeout, fallback, viewport 승계
- `src/components/home/map/HomeMapTypes.ts`: 공통 props, viewport, provider/failure 타입
- `src/components/home/map/GoogleMapCanvas.tsx`: Google map, circle, location, map type control
- `src/components/home/map/GoogleJobMarkerLayer.ts`: 공고 DOM overlay와 선택/클릭 처리
- `src/components/home/map/GeoapifyMapCanvas.tsx`: 현재 MapLibre 구현 이전
- `src/components/home/map/googleMapsLoader.ts`: Google SDK singleton loader와 인증 실패 연결

`HomeMapExplorer`는 현재와 같은 props를 `HomeMapCanvas`에 전달한다. provider별 SDK 타입은 이 경계 밖으로 노출하지 않는다.

## 5. 공통 계약

두 provider는 다음 입력을 동일하게 받는다.

```ts
interface HomeMapProviderProps {
  origin: { lat: number; lng: number }
  originIsUser: boolean
  radiusKm: number
  recenterRequest: number
  markers: HomeMapMarker[]
  selectedId: string | null
  initialViewport?: { center: { lat: number; lng: number }; zoom: number }
  onSelect: (id: string) => void
  onViewportChange: (viewport: HomeMapViewport) => void
  onReady: () => void
  onFailure: (reason: HomeMapFailureReason) => void
}
```

`onViewportChange`는 provider 내부의 이동이 끝난 시점에 최신 center/zoom을 coordinator에 전달한다. `initialViewport`가 있으면 fallback provider가 이를 우선 사용한다. `recenterRequest`가 변경된 경우에만 origin과 반경에 따른 기본 zoom으로 명시적 재정렬한다.

## 6. Provider 선택 상태 머신

상태는 `geoapify`, `google-loading`, `google-ready`, `google-failed` 네 가지로 둔다.

1. `VITE_GOOGLE_MAPS_API_KEY`가 비어 있으면 처음부터 `geoapify`를 렌더링한다.
2. 키가 있으면 `google-loading`으로 시작하고 Google component를 client에서만 동적 로딩한다.
3. Google map이 생성되고 첫 `idle` 이벤트가 오면 `google-ready`로 확정한다.
4. 로더 reject, 초기화 예외, 인증 실패 callback, 초기화 timeout이면 최신 viewport를 보존하고 `google-failed`를 거쳐 `geoapify`로 전환한다.
5. 한 세션에서 fallback한 뒤 자동으로 Google을 반복 재시도하지 않는다. 재시도 루프와 중복 과금을 피하고 안정적인 지도를 유지한다.

사용자에게 기술 오류를 먼저 노출하지 않는다. Google 로딩 중에는 기존 지도 로딩 UI를 사용하고 실패하면 Geoapify가 이를 대체한다. Geoapify까지 실패한 경우에만 현재의 지도 배경 오류 안내를 보여준다.

## 7. Google SDK 로딩과 timeout

- 공식 `@googlemaps/js-api-loader`의 `setOptions()`와 `importLibrary('maps')`를 사용한다.
- loader는 module singleton으로 한 번만 구성해 React 재렌더링이나 Strict Mode에서도 script를 중복 삽입하지 않는다.
- 옵션은 `key`, 안정적인 API version, `language: 'vi'`, `region: 'VN'`으로 제한한다. Places 등 사용하지 않는 library는 요청하지 않는다.
- Google 초기화 timeout은 SDK 로드 시작부터 첫 map `idle`까지 12초로 정한다. timeout은 fallback을 시작하기 위한 제품 기준이며 Google 요청 자체를 강제로 취소할 수 있다고 가정하지 않는다.
- timeout·실패 뒤 늦게 완료된 Promise나 event는 generation token과 unmount flag로 무시한다.
- Google map이 ready가 된 후에도 `gm_authFailure`가 호출되면 fallback한다. 전역 handler는 기존 값을 보존한 채 Google provider의 전체 수명 동안 유지하고, fallback 또는 unmount 때 기존 값으로 복원한다.

12초는 정상 모바일 네트워크에 불필요하게 빠른 오탐을 만들지 않으면서 빈 지도 대기 시간을 제한하는 절충값이다. 실제 Google 검증에서 정상 로딩이 이 기준에 근접하면 배포 전에 조정한다.

## 8. 실패 감지 범위와 quota 한계

자동 fallback 대상으로 삼는 신호:

- Google key 없음
- script/network loader reject
- `importLibrary` reject
- map 생성 중 예외
- `gm_authFailure`
- 첫 `idle` 이전 12초 timeout

Google Maps 기본 지도는 모든 quota·billing·tile 실패를 일관된 JavaScript event로 제공하지 않는다. 따라서 console 문구를 가로채거나 DOM 텍스트를 분석해 실패를 추정하지 않는다. 인증 callback이나 Promise reject로 노출되지 않는 billing/quota 문제까지 완벽히 감지한다고 문서나 UI에서 주장하지 않는다. 운영 안정성은 코드 fallback과 별도로 Google Cloud quota, budget alert, key 제한으로 보완한다.

## 9. Viewport와 상태 승계

Coordinator는 마지막으로 보고된 `{center, zoom}`을 ref로 보관한다. Google에서 Geoapify로 전환할 때 fallback은 이 값을 초기 viewport로 받는다. Google이 ready 전에 실패하여 viewport 보고가 없으면 현재 `origin`과 `zoomForRadius(radiusKm)`를 사용한다.

provider 전환으로 유지되는 상태:

- origin 및 실제 현재 위치 여부
- 현재 radius와 반경 원
- filtered verified markers
- selected job id와 선택 핀 강조
- 가장 최근 center/zoom
- 같은 `recenterRequest` 값

반경 변경 effect는 두 provider에서 circle geometry와 marker input만 갱신한다. `setCenter`, `setZoom`, `fitBounds`, `panTo`를 호출하지 않는다. 지역 선택·현재 위치 버튼처럼 `recenterRequest`가 증가한 경우에만 center/zoom을 재설정한다.

Google은 `idle`에서, Geoapify는 `moveend`에서 viewport를 보고한다. resize는 Google `trigger(map, 'resize')` 또는 provider 권장 resize 처리와 MapLibre `map.resize()`를 사용하되 center/zoom을 재설정하지 않는다.

## 10. Google 지도 표현

- 초기 map type은 `ROADMAP`이다.
- 작은 기본 map type control에는 `ROADMAP`과 `HYBRID`만 표시한다.
- 위성 화면은 도로명과 POI 맥락을 유지하는 `HYBRID`를 사용한다. 순수 `SATELLITE`는 라벨이 없어 이번 목표와 맞지 않는다.
- Google 기본 POI와 도로 스타일은 숨기거나 별도 스타일링하지 않는다.
- fullscreen, Street View 등 이번 탐색 흐름에 불필요한 control은 비활성화하고 zoom과 map type control은 유지한다.
- cooperative gesture 설정은 기존 wheel/touch 동작을 실제 브라우저에서 비교한 후, 데스크톱 wheel 및 모바일 pan/pinch 요구를 충족하는 값으로 고정한다.

## 11. 공고 overlay

검색 반경은 Google `Circle`, 현재 위치는 파란 DOM overlay, 공고는 빨간 DOM overlay로 표시한다. DOM overlay는 `google.maps.OverlayView`를 사용해 별도 Map ID 없이 동작하게 한다. 핀 DOM/CSS는 provider 공통 시각 규칙을 재사용해 Google과 Geoapify에서 같은 우선순위를 유지한다.

`GoogleJobMarkerLayer`는 지도 SDK 생성·삭제와 React props 갱신을 격리한다. marker는 반드시 job id로 관리하며 좌표를 identity로 사용하지 않는다. 따라서 같은 좌표의 복수 공고가 데이터 단계에서 합쳐지지 않는다. 이번 구현은 현재와 같은 개별 핀 렌더링을 유지하되, marker placement 내부를 향후 cluster/spiderfy 구현으로 교체할 수 있게 한다. clustering backend나 공간 인덱스는 이번 범위에 포함하지 않는다.

선택 핀은 크기와 z-index를 올리고 click/Enter/Space가 `onSelect(id)`를 호출한다. provider 전환 시 React의 `selectedId`가 그대로 전달되므로 오른쪽 패널도 유지된다.

## 12. SSR, client-only, 번들 전략

- `HomeMapExplorer`의 기존 `React.lazy(() => import('./HomeMapCanvas'))` 경계를 유지한다.
- `HomeMapCanvas`는 provider component도 동적으로 import한다. Google key가 없으면 Google SDK/renderer를 실행하지 않고 Geoapify chunk만 불러온다.
- Google provider 파일 외부에서 `window`, `document`, `google`을 참조하지 않는다. 실제 loader 호출과 map 생성은 mount effect 안에서만 실행한다.
- Geoapify provider는 MapLibre CSS와 worker import를 자체 chunk 안에 유지한다.
- SSR 출력은 현재처럼 지도 loading fallback을 렌더링하고 hydration 후 동일 위치에 provider canvas를 붙인다.
- 지도는 메인 핵심 영역이고 PC 첫 viewport에 이미 걸쳐 있으므로 별도 click-to-load나 IntersectionObserver는 적용하지 않는다. 기존 lazy component와 Google library on-demand import까지만 사용해 복잡성과 시각 지연을 제한한다.

## 13. 환경변수와 key 정책

새 환경변수:

```env
VITE_GOOGLE_MAPS_API_KEY=
```

기존 환경변수:

```env
VITE_GEOAPIFY_API_KEY=
```

두 값 모두 코드·문서·로그에 실제 값을 기록하지 않는다. Vite의 `VITE_` 값은 브라우저에 전달되는 공개 클라이언트 key이므로 비밀 저장만으로 보호되지 않는다. Google Cloud에서 사용처와 API를 제한하는 것이 필수다.

Production key 권장 제한:

- Website restriction: `https://viecganban.vn/*`, `https://www.viecganban.vn/*`
- API restriction: Maps JavaScript API만 허용
- 일일 quota 한도 설정
- budget alert 설정
- Preview가 필요하면 Production key에 광범위한 `*.vercel.app`을 추가하지 않고 별도 Preview key 또는 고정 Preview alias를 사용

현재 Vercel에는 Google key가 없으므로 첫 배포는 Geoapify로 동작한다. 사용자가 Google Cloud에서 제한된 key를 만든 뒤 Vercel Production/Preview에 추가하고 재배포해야 Google primary 검증을 진행할 수 있다.

## 14. 테스트 전략

### 정적·기존 회귀

- `npx tsc --noEmit`
- `npm run build`의 client 및 SSR build
- `npm test` 전체
- sitemap 및 주요 SSR 응답 smoke check
- 기존 공고 등록/위치 핀/필터/FeaturedJobs/Korea entrance 영향 파일 diff 확인

### Provider 선택과 fallback

- key 없음: Google network 요청 없이 Geoapify가 즉시 표시
- fake key + Google script route abort: 로더 실패 후 Geoapify 표시
- Google loader가 resolve하지 않는 fixture: 12초 timeout 후 Geoapify 표시
- 인증 실패 fixture: `gm_authFailure` 후 Geoapify 표시
- 초기화 예외 fixture: 사용자 오류 화면 없이 Geoapify 표시
- fallback 후 origin, radius, markers, selectedId 유지
- fallback 직전 viewport를 보고받은 fixture에서는 Geoapify center/zoom 승계

Production key나 실제 Google 설정을 깨뜨려 fallback을 시험하지 않는다. 네트워크 차단과 loader fixture는 로컬/테스트 환경에서만 사용한다.

### 실제 Google provider

Google key가 준비된 Preview에서 Bắc Ninh을 기준으로 다음을 확인한다.

1. 주변 건물·업체·시설·도로명과 산업지역 맥락
2. ROADMAP/HYBRID 전환
3. verified 공고 핀과 선택 강조, 오른쪽 패널 연결
4. 현재 위치점과 반경 원
5. wheel→radius에서 center/zoom 유지
6. drag→radius에서 center 유지
7. zoom control→radius에서 zoom 유지
8. 새 지역 선택과 현재 위치 버튼의 명시적 재정렬
9. 1366×768, 1440×900, 1920×1080의 425/440/485px 및 3열 정렬
10. 모바일 375px touch pan, pinch zoom, pin click, 위치, radius
11. browser console, hydration, Google loader/network 오류 없음

### 실제 Geoapify fallback

동일한 네 화면 크기와 핵심 UX를 key 없음 및 강제 Google 실패 조건에서 반복한다. 기존 Geoapify style/network 오류가 없어야 하며 현재 Production과 같은 시각 결과를 유지해야 한다.

## 15. 배포 기준

1. Google key가 없는 상태에서도 구현·정적 검사·fallback 브라우저 검증을 완료하고 master에 배포할 수 있다. 이때 Production provider는 Geoapify다.
2. Google primary로 운영한다고 보고하거나 상태를 바꾸는 것은 제한된 Production/Preview key가 준비되고 실제 Google provider 검증이 모두 통과한 뒤에만 가능하다.
3. Google 검증 실패 시 Production Google env를 추가하지 않거나 제거하여 Geoapify를 유지한다. 코드에 임의 key를 넣거나 새 유료 서비스를 가입하지 않는다.
4. 완료 시 `CHATGPT_HANDOFF.md`와 `WORK_LOG.md`에 provider 상태, env 준비 여부, fallback 검증, 테스트, commit/push/deploy 상태를 기록한다.

## 16. 수용 기준

- Google key가 있으면 Google ROADMAP이 기본으로 열리고 HYBRID 전환이 된다.
- Google key가 없거나 감지 가능한 초기화 실패가 발생하면 기술 오류 대신 Geoapify가 열린다.
- provider 전환 후 검색 위치, radius, filtered markers, selected job, 최신 viewport가 유지된다.
- radius 변경은 어느 provider에서도 viewport를 변경하지 않는다.
- 기존 레이아웃·모바일·필터·verified 정책·오른쪽 패널·SSR이 회귀하지 않는다.
- Google의 감지 불가능한 quota/billing 오류를 완전 자동 복구한다고 주장하지 않는다.
- 실제 key가 검증되기 전 Production은 Geoapify provider 상태를 유지한다.
