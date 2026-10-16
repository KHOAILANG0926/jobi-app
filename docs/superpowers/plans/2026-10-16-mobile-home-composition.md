# Mobile home composition — implementation plan

**Goal:** Apply the user's approved recording-based mobile home layout using existing public jobs, filters, location and detail flows.
**Scope:** NORMAL frontend work; canonical origin/master eb36b53, isolated branch feat/mobile-home-composition-20261016. Preview review before any merge/Production release. No DB/auth/provider/gesture/STATUS changes.
**Design approved in conversation:** compact location/search/menu header; first-visit location choice on PC/mobile; three real jobs per swipe page; five shortcuts; horizontal filters; existing map/list comparison; data-backed job sections; four bottom destinations (home/map/saved/profile). Preserve desktop map layout. Korea content remains in a Korea-only component/API. Hide empty sections, never fabricate jobs or facts.

- [ ] Test page grouping for 0/1/2/3/4/7 jobs, duplicates, and input immutability; implement pure grouping helper.
- [ ] Add focused mobile discovery components and Korea module slot. Reuse HomeMapExplorer's result/filter/location state through a render prop, so carousel, job sections and map use the same conditions. Existing public jobs and direction policy remain authoritative.
- [ ] Add responsive header/menu, shortcuts, horizontal filter entry, map/list switch and first-visit location notice. The notice never calls GPS until tapped. Session dismissal contains no coordinates. Escape/close restore focus.
- [ ] Keep desktop controls inline; mobile controls use a dismissible sheet. Native map gestures remain unchanged. Add bottom navigation to existing routes with safe-area spacing.
- [ ] Verify tsc, build, relevant pure tests and browser behavior at 360/390/412 and 1366px; inspect screenshots, overflow, carousel controls/swipe, geolocation allow/deny, region/manual choice, filter/reset, details, menu and empty states. Public data read-only; browser synthetic fixtures are test-only.
- [ ] Record exact evidence and remaining gaps in HANDOFF/WORK_LOG; commit/push, create draft PR, verify CI and Vercel preview. Do not call this Production-complete.

**Stop conditions:** required checks fail after two corrections for the same cause; security/data risk; unapproved operational change; approved acceptance cannot be demonstrated. Existing PR #102 reviewed, not merged: it includes unrelated direction UI/gesture changes and a different six-card layout.
