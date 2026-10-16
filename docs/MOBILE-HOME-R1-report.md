# Mobile home R1 — review evidence

## Scope and reference
- User-provided recording: 327.504 seconds, 1080×2340. Reviewed through interval frames and focused views; not a full Albamon feature audit.
- Approved composition: first-visit location, compact header, 3 stacked real jobs per swipe page, shortcuts, horizontal filter entry, existing map/list, extensible data-backed sections, existing destination bottom navigation. PC map layout kept.
- Canonical base: eb36b53443e1a9a3a2077d18447c490921baa5bb; branch feat/mobile-home-composition-20261016. Open PR #102 read, not merged; its map gestures/directions/six-card grid differ from this request.

## Implementation
- HomeMapExplorer owns the existing GPS/radius/filter/search result state. Home render slots consume that same result. No duplicate GPS or salary conversion logic.
- Manual province selection uses jobMatchesRegion; unverified text locations remain browseable and filterable, but do not gain exact pins or distance claims.
- KoreaHomeSlot owns its API and hides when no Korea public records are returned. No Vietnam helpers imported by that module.
- Empty sections hidden; 1/2-record carousel pages never padded/repeated; no public fixtures. Query errors remain distinct from zero results.
- Native SDK map gestures unchanged; the mobile map height is 280px and list mode hides it. Existing desktop controls stay inline, mobile controls open a keyboard-dismissible sheet.
- No operational data/auth/schema/provider settings changes. Session storage adds only location-notice dismissal, not GPS values.

## Direct verification
- `node --experimental-strip-types src/lib/homeDiscovery.test.ts`: passed grouping at 0/1/2/3/4/7 records, duplicates and immutable inputs. First red run failed because the module did not yet exist.
- `npx tsc --noEmit`: passed after avoiding node-only type imports in the src test.
- `npm run build`: client and SSR passed; existing large-chunk notices remain.
- `npm test`: 61/61 files passed (Node 24.19.0).
- Dev server on explicit 127.0.0.1 works. Binding all interfaces fails with runtime uv_interface_addresses; no app config changed for that environment issue.
- Chromium download failed with invalid/truncated 0-byte zip. No local screen verification claimed. `.github/workflows/mobile-home-preview.yml` executes the same production build at 360/390/412/1366px on GitHub and uploads public guest screenshots, with separate browser-only fixtures for sparse/empty data, carousel/filter/region/reset and GPS allow/deny.

## Pending
- Remote CI results and visual inspection of its screenshots.
- Vercel exact-commit Preview verification and user review.
- Native OS permission dialog appearance is not validated by simulated allow/deny tests.
- Not APPROVED, DEPLOYED or Production-complete. No master merge before user review.
