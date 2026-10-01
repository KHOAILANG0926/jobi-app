# Home Map Google Provider Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Google Maps ROADMAP을 메인 지도의 primary provider로 추가하고, 감지 가능한 실패 시 현재 Geoapify 지도로 상태를 승계해 자동 전환하면서 반경 원과 초기 viewport 표현을 바로잡는다.

**Architecture:** `HomeMapExplorer`의 검색·필터·선택 상태는 유지하고 `HomeMapCanvas`를 provider coordinator로 축소한다. Google과 Geoapify provider는 같은 props·viewport 계약을 구현하며, 공통 지리 계산 모듈이 meter 변환·geodesic 원·초기 zoom을 결정한다. Google SDK와 MapLibre는 provider별 lazy chunk로 분리한다.

**Tech Stack:** React 18, TypeScript 5.6, Vite 8 SSR, MapLibre GL 6, Geoapify vector style, Google Maps JavaScript API, `@googlemaps/js-api-loader`, Playwright/Chrome, Node assertion tests

**Spec:** `docs/superpowers/specs/2026-10-01-home-map-google-provider-fallback-design.md`

## Global Constraints

- 실제 코드 구현 전 `AGENTS.md`, `CLAUDE.md`, 설계 문서와 최신 `CHATGPT_HANDOFF.md`를 읽는다.
- 구현은 `codex/google-map-provider-fallback` 격리 브랜치/작업공간에서 진행하고, 검증 전 master Production에 부분 구현을 올리지 않는다.
- `HomeMapExplorer`의 DB·필터·verified 위치·selected job 계약을 변경하지 않는다.
- Leaflet과 현재 MapLibre/Geoapify 구현을 삭제하지 않는다.
- PC 지도 높이 425/440/485px, 가로 비율, 3열 정렬, 패널 scroll, 주변 여백, 모바일 구조를 변경하지 않는다.
- radius는 실제 거리다. 1/3/5/10km는 정확히 1000/3000/5000/10000m로 표시한다.
- 초기·지역 선택·현재 위치·명시적 recenter에서만 viewport를 자동 설정한다.
- wheel, drag, zoom control 이후 radius 변경은 center/zoom을 절대 변경하지 않는다.
- Google 초기화 timeout은 SDK 로드 시작부터 첫 `idle`까지 12초다.
- Google key가 실제 검증되기 전 Production은 Geoapify fallback 상태를 유지한다.
- API key 실제 값은 코드, Git, 테스트 출력, 문서, 응답에 기록하지 않는다.

## Current Radius Verification Baseline

- `findRegionCenter('Bắc Ninh')`는 `{ lat: 21.1861, lng: 106.0763 }`을 반환한다.
- 현재 Geoapify 원은 `angular = radiusKm / 6371.0088`인 geodesic polygon이다. 이는 km 단위 반경을 지구 반지름(km)으로 나눈 정확한 각거리 표현이다.
- 필터는 `calcDistanceKm()`의 Haversine 공식과 지구 반지름 6371km를 사용한다.
- 현재 공식을 Bắc Ninh 중심에서 네 방위로 재계산한 결과 1/3/5/10km 경계는 각각 1000/3000/5000/10000m이며, 두 지구 반지름 상수 차이로 생기는 최대 오차는 10km에서 약 0.014m다.
- Google Maps JavaScript API의 `Circle.radius` 단위는 지표면 meter다. Google provider는 공통 `radiusKmToMeters()` 결과를 그대로 전달한다.
- 3km가 크게 보이는 원인은 거리 계산이 아니다. 현재 `zoomForRadius(3) = 13`이며 1440×900의 실제 지도 높이 438px에서 원 지름이 약 337px, 즉 높이의 약 77%를 차지한다.
- 목표 지름 비율 0.65를 적용하면 Bắc Ninh 3km 기준 예상 zoom은 1366 화면 12.71, 1440 화면 12.76, 1920 화면 12.90이다.

## Review Focus

- React Strict Mode의 mount→cleanup→remount에서도 `gm_authFailure` subscriber가 중복 호출되지 않고 원래 handler가 마지막 cleanup에 복원되어야 한다(Task 2 tests).
- Google provider가 ready된 뒤 외부 코드가 `window.gm_authFailure`를 교체해도 cleanup이 그 새 handler를 덮어쓰지 않아야 한다(Task 2 tests).
- 0×0 또는 아직 배치되지 않은 지도 컨테이너에서도 initial zoom이 `NaN`/`Infinity`가 되지 않고 안전한 기본 viewport로 계산되어야 한다(Task 1 tests).
- Google 실패가 `onReady`와 거의 동시에 도착해도 reducer가 한 provider만 활성화하고 늦은 event를 무시해야 한다(Task 5 tests).
- 같은 좌표의 여러 공고가 marker map에서 좌표 기준으로 합쳐지지 않고 각 job id identity를 유지해야 한다(Task 4 browser fixture).

---

### Task 1: Shared Map Contracts, Radius Geometry, and Initial Viewport

**Files:**
- Create: `src/components/home/map/HomeMapTypes.ts`
- Create: `src/components/home/map/homeMapGeometry.ts`
- Create: `src/components/home/map/homeMapGeometry.test.ts`
- Modify: `src/lib/homeMapFilters.test.ts`

**Interfaces:**
- Produces: `HomeMapMarker`, `HomeMapViewport`, `HomeMapFailureReason`, `HomeMapProviderProps`
- Produces: `radiusKmToMeters(radiusKm: number): number`
- Produces: `createRadiusPolygon(origin: MapPoint, radiusKm: number, segments?: number): GeoJSONFeature`
- Produces: `calculateInitialZoom(originLat: number, radiusKm: number, viewport: MapViewportSize, targetDiameterRatio?: number): number`
- Produces: `HOME_MAP_TARGET_DIAMETER_RATIO = 0.65`

- [ ] **Step 1: Write failing radius and viewport tests**

Add assertions with these exact cases:

```ts
for (const [km, meters] of [[1, 1000], [3, 3000], [5, 5000], [10, 10000]]) {
  assert(radiusKmToMeters(km) === meters, `${km}km converts exactly to meters`)
  // Four cardinal polygon points must be within 0.05m of km using calcDistanceKm().
}

assertDeepEqual(findRegionCenter('Bắc Ninh'), { lat: 21.1861, lng: 106.0763 })
```

For `radiusKm=3`, `lat=21.1861`, and map sizes `{693,423}`, `{718,438}`, `{718,483}`, assert calculated zoom is within 0.02 of `12.7075`, `12.7578`, `12.8989`. Re-project the diameter in the test and assert its ratio is between `0.64` and `0.66`. Add zero-width/height and invalid-radius cases that return a finite, clamped zoom rather than `NaN`/`Infinity`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --experimental-strip-types --import ./scripts/ts-extensionless-register.mjs src/components/home/map/homeMapGeometry.test.ts`

Expected: FAIL because the geometry module does not exist.

- [ ] **Step 3: Add shared types and pure geometry helpers**

Use `EARTH_RADIUS_KM = 6371.0088`, Web Mercator base resolution `156543.03392804097`, target ratio `0.65`, and zoom clamp `[3, 18]`. `calculateInitialZoom` uses the smaller CSS dimension and the formula:

```text
targetDiameterPx = min(width, height) × 0.65
metersPerPixel = radiusMeters × 2 / targetDiameterPx
zoom = log2(156543.03392804097 × cos(latitude) / metersPerPixel)
```

For an unmeasured container, use the safe reference viewport `{width: 718, height: 440}`. Do not change radius or filter distance to make the visual smaller.

- [ ] **Step 4: Run geometry and filter tests**

Run: `npm test`

Expected: all test files pass; output includes the four exact meter cases and existing verified-location filter tests.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/components/home/map/HomeMapTypes.ts src/components/home/map/homeMapGeometry.ts src/components/home/map/homeMapGeometry.test.ts src/lib/homeMapFilters.test.ts
git commit -m "test: define home map radius and viewport rules"
```

### Task 2: Google Loader and Collision-Safe Authentication Failure Registry

**Files:**
- Create: `src/components/home/map/googleAuthFailure.ts`
- Create: `src/components/home/map/googleAuthFailure.test.ts`
- Create: `src/components/home/map/googleMapsLoader.ts`
- Create: `src/components/home/map/googleMapsLoader.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.env.example`

**Interfaces:**
- Produces: `subscribeGoogleAuthFailure(host: GoogleAuthFailureHost, listener: () => void): () => void`
- Produces: `createGoogleMapsLoader(deps: GoogleMapsLoaderDeps): GoogleMapsLoader`
- Produces: singleton `loadGoogleMaps(apiKey: string): Promise<google.maps.MapsLibrary>`
- Consumes: `HomeMapFailureReason` from Task 1

- [ ] **Step 1: Write failing `gm_authFailure` lifecycle tests**

Use a fake host object and assert all of the following:

1. the first subscriber preserves an existing handler and the dispatcher invokes both it and the subscriber;
2. two simultaneous subscribers each receive one callback;
3. cleaning one subscriber leaves the other active;
4. cleanup is idempotent;
5. the last cleanup restores the exact original handler;
6. Strict Mode sequence subscribe→cleanup→subscribe does not duplicate callbacks;
7. if another feature replaces `host.gm_authFailure` after subscription, cleanup does not overwrite that newer handler.

- [ ] **Step 2: Run the auth registry test to verify it fails**

Run: `node --experimental-strip-types --import ./scripts/ts-extensionless-register.mjs src/components/home/map/googleAuthFailure.test.ts`

Expected: FAIL because the registry does not exist.

- [ ] **Step 3: Implement the subscription registry**

Keep one module-level dispatcher and a `Set` of subscribers. Preserve the handler present at first subscription. The dispatcher calls the preserved handler and every current subscriber without allowing one thrown callback to suppress the others. Restore the original only after the last subscriber leaves and only if the global property still points to this module's dispatcher.

- [ ] **Step 4: Write failing singleton loader tests**

Inject fake `setOptions` and `importLibrary` functions. Assert same-key concurrent calls share one Promise and configure once; an empty key rejects without calling dependencies; a conflicting second key rejects instead of silently reconfiguring the global loader.

- [ ] **Step 5: Install Google loader dependencies and implement the loader**

Run: `npm install @googlemaps/js-api-loader`
Run: `npm install --save-dev @types/google.maps`

Configure only `key`, stable version, `language: 'vi'`, and `region: 'VN'`. Do not request Places or marker libraries. Add an empty `VITE_GOOGLE_MAPS_API_KEY=` entry to `.env.example` without any real value.

- [ ] **Step 6: Run loader/auth tests and typecheck**

Run: `npm test`
Run: `npx tsc --noEmit`

Expected: all tests and typecheck pass.

- [ ] **Step 7: Commit Task 2**

```bash
git add package.json package-lock.json .env.example src/components/home/map/googleAuthFailure.ts src/components/home/map/googleAuthFailure.test.ts src/components/home/map/googleMapsLoader.ts src/components/home/map/googleMapsLoader.test.ts
git commit -m "feat: add safe Google Maps loader lifecycle"
```

### Task 3: Extract and Harden the Geoapify Provider

**Files:**
- Create: `src/components/home/map/GeoapifyMapCanvas.tsx`
- Modify: `src/components/home/HomeMapCanvas.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `HomeMapProviderProps`, `createRadiusPolygon`, `calculateInitialZoom`, `radiusKmToMeters` from Task 1
- Produces: Geoapify provider implementation with `onReady`, `onFailure`, `onViewportChange`

- [ ] **Step 1: Move the current MapLibre implementation without behavior changes**

Move style tuning, MapLibre worker setup, origin marker, job markers, circle source, resize handling, and accessibility behavior into `GeoapifyMapCanvas.tsx`. Keep Geoapify `osm-bright/style.json`, current attribution, colors, POI reductions, and existing error behavior.

- [ ] **Step 2: Replace local geometry and fixed zoom buckets**

Delete the provider-local `radiusGeoJSON()` and `zoomForRadius()`. Use `createRadiusPolygon()` for the source and `calculateInitialZoom()` for initial load and explicit recenter. Read the current canvas CSS width/height at those moments. Radius-only updates call only `GeoJSONSource.setData()` and marker refresh; they must not call `jumpTo`, `fitBounds`, `setCenter`, or any camera method.

- [ ] **Step 3: Add viewport and lifecycle callbacks**

Report `{center, zoom}` on MapLibre `moveend`. If `initialViewport` is supplied during fallback, use it for construction and do not overwrite it with the radius-derived zoom. Call `onReady` after style and overlays are ready. Convert load/style/worker failures into `onFailure` while retaining the visible notice only when this provider itself cannot render.

- [ ] **Step 4: Keep `HomeMapCanvas` as a temporary Geoapify-only wrapper**

Render the extracted provider through the existing lazy boundary so the application remains usable before coordinator and Google tasks land. Pass shared props without changing `HomeMapExplorer`.

- [ ] **Step 5: Verify Geoapify behavior**

Run: `npx tsc --noEmit`
Run: `npm run build`
Run: `npm test`

Browser assertions at 1366×768, 1440×900, 1920×1080, and 375px:

- heights remain 425/440/485px and mobile structure remains vertical;
- Bắc Ninh 3km circle occupies 60–70% of the map's smaller dimension after initial load;
- wheel→3km→5km, drag→radius, zoom control→radius preserve viewport;
- region change recomputes zoom from 0.65 target and recenters.

- [ ] **Step 6: Commit Task 3**

```bash
git add src/components/home/HomeMapCanvas.tsx src/components/home/map/GeoapifyMapCanvas.tsx src/index.css
git commit -m "refactor: isolate Geoapify home map provider"
```

### Task 4: Google Job Overlay Boundary and Google Provider

**Files:**
- Create: `src/components/home/map/GoogleJobMarkerLayer.ts`
- Create: `src/components/home/map/GoogleMapCanvas.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Produces: `createGoogleJobMarkerLayer(OverlayViewCtor, map, options): GoogleJobMarkerLayer`
- `GoogleJobMarkerLayer` methods: `setMarkers(markers: HomeMapMarker[], selectedId: string | null, onSelect: (id: string) => void): void`, `destroy(): void`
- Consumes: `HomeMapProviderProps`, common geometry helpers, `loadGoogleMaps`, `subscribeGoogleAuthFailure`

- [ ] **Step 1: Implement the replaceable marker renderer boundary**

Create the `OverlayView` subclass inside the factory after Google has loaded; do not extend `google.maps.OverlayView` at module evaluation time. Mount DOM pins in `overlayMouseTarget`, key the internal element map only by `job.id`, preserve click/Enter/Space behavior, and give the selected pin larger size and higher z-index.

Do not group or deduplicate by coordinates. Two jobs at the same lat/lng remain two job-id records even if their DOM positions overlap. Keep all marker-specific DOM creation and projection inside this module so a future cluster/spiderfy/canvas renderer can replace it without changing `HomeMapExplorer`, `HomeMapCanvas`, or `GoogleMapCanvas` props. Do not implement clustering in this task.

- [ ] **Step 2: Implement `GoogleMapCanvas` initialization**

Load only the `maps` library in a mount effect. Create a map with ROADMAP, `isFractionalZoomEnabled: true`, zoom control, and a compact map type control containing ROADMAP and HYBRID. Disable Street View and fullscreen controls. HYBRID is the satellite option because it retains roads and labels.

Use `initialViewport` when supplied; otherwise calculate zoom from the measured canvas and radius. Install the auth-failure subscriber before starting the loader and release it on fallback/unmount. Use a mount generation token so Strict Mode cleanup makes every late loader/event callback inert.

- [ ] **Step 3: Add Google overlays and update effects**

Create Google `Circle` with `radius: radiusKmToMeters(radiusKm)`, blue location overlay, and `GoogleJobMarkerLayer`. Radius changes call only `circle.setRadius()` and overlay data updates. Explicit `recenterRequest` changes call `setCenter()` and `setZoom(calculateInitialZoom(...))`. No radius effect may call `fitBounds`, `setCenter`, `setZoom`, `panTo`, or `moveCamera`.

- [ ] **Step 4: Add user interaction and viewport reporting**

Record wheel, dragstart, zoom-control click, and touch gestures as user interaction. Report center/zoom on `idle`, throttle redundant fractional zoom reports, and call `onReady` only on the first valid `idle`. Resize processing must not reset center or zoom.

- [ ] **Step 5: Add browser fixtures for marker behavior**

With a controlled Google loader fixture, assert two same-coordinate jobs remain two job-id entries, selecting either id calls `onSelect`, the selected pin receives selected styling, and rerendering removes stale job ids without recreating unchanged ids.

- [ ] **Step 6: Run component checks**

Run: `npx tsc --noEmit`
Run: `npm test`
Run: `npm run build`

Expected: client and SSR builds pass with no server-side `window`, `document`, or `google` error.

- [ ] **Step 7: Commit Task 4**

```bash
git add src/components/home/map/GoogleJobMarkerLayer.ts src/components/home/map/GoogleMapCanvas.tsx src/index.css
git commit -m "feat: add Google home map provider"
```

### Task 5: Provider Coordinator, Timeout, and State Handoff

**Files:**
- Create: `src/components/home/map/homeMapProviderState.ts`
- Create: `src/components/home/map/homeMapProviderState.test.ts`
- Modify: `src/components/home/HomeMapCanvas.tsx`

**Interfaces:**
- Produces: `homeMapProviderReducer(state, event): HomeMapProviderState`
- Produces: `GOOGLE_MAP_INIT_TIMEOUT_MS = 12_000`
- Consumes: Google and Geoapify providers from Tasks 3–4
- Preserves: existing `HomeMapCanvas` props consumed by `HomeMapExplorer`

- [ ] **Step 1: Write failing provider state tests**

Cover exact transitions:

- no key → `geoapify` without a Google import attempt;
- key → `google-loading`;
- `google-ready` before timeout → `google-ready`;
- loader/init/auth/timeout failure → `geoapify` exactly once;
- late ready event after failure is ignored;
- duplicate failure is idempotent;
- saved viewport survives the fallback transition;
- selected id, origin, radius, markers, and recenter request are not copied into reducer state and remain React props, preventing stale duplication.

Use explicit events `GOOGLE_READY`, `GOOGLE_FAILED`, `GOOGLE_TIMEOUT`, `VIEWPORT_CHANGED`, and `RESET_GENERATION`. State holds only `{ provider, generation, lastViewport, failureReason }`.

- [ ] **Step 2: Run the state test to verify it fails**

Run: `node --experimental-strip-types --import ./scripts/ts-extensionless-register.mjs src/components/home/map/homeMapProviderState.test.ts`

Expected: FAIL because the state module does not exist.

- [ ] **Step 3: Implement the reducer and lazy coordinator**

Read `VITE_GOOGLE_MAPS_API_KEY` once for initial provider choice. Lazy import `GoogleMapCanvas` only when a key exists and lazy import `GeoapifyMapCanvas` only for immediate/fallback use. Keep the latest viewport in a ref updated by either provider. Do not change `HomeMapExplorer`'s public usage.

- [ ] **Step 4: Add the 12-second initialization guard**

Start the timer when Google loading begins and clear it on ready, failure, fallback, or unmount. Associate callbacks with a generation id so timeout, `onReady`, `onFailure`, and Strict Mode remount cannot activate two providers. On fallback pass the last viewport as `initialViewport`; if none exists, let Geoapify compute the 0.65 initial viewport.

- [ ] **Step 5: Run state and full tests**

Run: `npm test`
Run: `npx tsc --noEmit`
Run: `npm run build`

Expected: all tests and both builds pass.

- [ ] **Step 6: Commit Task 5**

```bash
git add src/components/home/HomeMapCanvas.tsx src/components/home/map/homeMapProviderState.ts src/components/home/map/homeMapProviderState.test.ts
git commit -m "feat: fall back from Google Maps to Geoapify"
```

### Task 6: Browser Regression and Failure Injection

**Files:**
- Create: `scripts/test-home-map-providers.mjs`
- Modify only if a verified defect is found: files owned by Tasks 1–5

**Interfaces:**
- Consumes: built application and provider network endpoints
- Produces: repeatable browser report with secrets redacted

- [ ] **Step 1: Add a browser harness without embedding keys**

The harness accepts keys only through process environment, redacts `key`/`apiKey` query values from output, starts a local production build/preview, records page errors, console errors, failed provider requests, layout metrics, and provider identity. It must refuse to print environment values.

- [ ] **Step 2: Verify key-absent fallback**

Build without `VITE_GOOGLE_MAPS_API_KEY`. Assert no Google Maps script request occurs, Geoapify renders, style request succeeds, and there is no technical error notice when Geoapify is healthy.

- [ ] **Step 3: Force loader, timeout, auth, and init failures locally**

Use a fake Google key only in the test process and Playwright routing/fixtures to test:

- aborted Google script request;
- stalled loader for at least 12 seconds;
- fixture invocation of `gm_authFailure`;
- thrown map-construction fixture.

Each case must end with one Geoapify canvas, no Google canvas, preserved radius/selection, and no hydration error. Do not change or invalidate the Production Google key to run these cases.

- [ ] **Step 4: Verify radius and viewport on Geoapify**

At Bắc Ninh `{21.1861,106.0763}`, assert circle boundary Haversine distances for 1/3/5/10km equal 1000/3000/5000/10000m within 0.05m. At 3km, capture the circle's projected bounding box and assert its diameter is 60–70% of the smaller map dimension.

Run the interaction sequence:

1. wheel zoom;
2. radius 3→5km, assert center/zoom unchanged;
3. drag, change radius, assert center unchanged;
4. zoom control, change radius, assert zoom unchanged;
5. select a new region, assert center and calculated initial zoom reset;
6. use current location, assert explicit recenter occurs.

- [ ] **Step 5: Verify layout and unrelated home features**

At 1366×768, 1440×900, 1920×1080 and mobile 375px assert:

- exact PC heights 425/440/485px;
- three-column top/bottom alignment and panel scroll;
- mobile touch area and vertical structure;
- FeaturedJobs and Korea entrance present;
- verified pin click updates the right panel;
- no horizontal overflow, console error, hydration error, style/tile error.

- [ ] **Step 6: Verify actual Google provider only when a restricted key exists**

In a Preview environment with `VITE_GOOGLE_MAPS_API_KEY` configured, repeat radius, viewport, pin, selection, location, ROADMAP/HYBRID, desktop and mobile interaction checks. Confirm nearby roads/buildings/POIs render and Google loader/network/auth errors are absent. If no key exists, record this check as pending and do not claim Google primary is Production-verified.

- [ ] **Step 7: Run the full verification suite**

Run: `npx tsc --noEmit`
Run: `npm run build`
Run: `npm test`
Run: `node scripts/test-home-map-providers.mjs`

Expected: all static tests pass; key-absent and injected-failure fallback scenarios pass; actual Google result is PASS only when a valid restricted key is supplied.

- [ ] **Step 8: Commit Task 6**

```bash
git add scripts/test-home-map-providers.mjs
git add <only verified fixes from Tasks 1-5, if any>
git commit -m "test: verify home map providers and fallback"
```

### Task 7: Documentation, Integration, and Deployment Gates

**Files:**
- Modify: `CHATGPT_HANDOFF.md`
- Modify: `WORK_LOG.md`
- Review: all files changed in Tasks 1–6

**Interfaces:**
- Consumes: verified branch state and browser report
- Produces: final master commit/push and accurately labeled Production provider state

- [ ] **Step 1: Review scope and run final checks**

Confirm the diff contains no DB, filter logic, layout dimension, unrelated refactor, real key, temporary screenshot, or local env file. Run `git diff --check`, `npx tsc --noEmit`, `npm run build`, `npm test`, and the provider browser harness.

- [ ] **Step 2: Update project records**

Record provider structure, radius proof, 0.65 viewport rule, `gm_authFailure` lifecycle, key/env status, fallback results, actual Google test status, tests, and known quota detection limit. Keep `CHATGPT_HANDOFF.md` as the latest five-section snapshot and `WORK_LOG.md` within ten entries.

- [ ] **Step 3: Commit documentation**

```bash
git add CHATGPT_HANDOFF.md WORK_LOG.md
git commit -m "docs: record home map provider verification"
```

- [ ] **Step 4: Integrate only after complete branch verification**

Merge the verified branch to master, push once, and let Vercel build Production. Do not merge if key-absent fallback is broken. A missing Google key is not a merge blocker because the specified Production behavior is Geoapify fallback.

- [ ] **Step 5: Verify Production state**

Without a Google env, verify viecganban.vn renders Geoapify with exact layout and no Google request. With a valid Google env, deploy first to Preview, complete actual Google checks, then add/redeploy Production and verify Google ROADMAP/HYBRID plus forced-failure behavior in a safe test environment.

- [ ] **Step 6: Report the exact outcome**

Report Google provider implementation, Geoapify fallback, key/env presence, ROADMAP/HYBRID status, fallback tests, typecheck/build/test/browser results, code and record commit hashes, Production provider, and these Google Cloud actions:

- website restrictions for `https://viecganban.vn/*` and `https://www.viecganban.vn/*`;
- API restriction to Maps JavaScript API;
- daily quota cap and budget alert;
- separate restricted Preview key or exact stable Preview alias, avoiding a broad `*.vercel.app` Production-key allowance.
