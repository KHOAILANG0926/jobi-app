# Address Search and VietMap Call Tracing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retry only sb-4685 and sb-4721 with a versioned address-cache key, and make each address lookup and shared VietMap server-counter change independently visible without weakening approval rules.

**Architecture:** Keep the existing address parser and approval predicates unchanged. Add a job-aware cache-key version only for the two requested IDs, attach lookup source and request-attempt counts to each outcome, and obtain an explicit non-counting usage snapshot after every run so the UI can compare page attempts with the shared counter. Preserve all existing cache entries and database structures.

**Tech Stack:** TypeScript, React, Vercel Node function, existing assertion-based Node test runner.

**Spec:** User request “KHOAILANG0926/jobi-app 작업 03 — 주소 검색 및 VietMap 호출 추적 수정” (2026-10-10), with current state in `CHATGPT_HANDOFF.md`.

## Global Constraints

- Do not change address, company-name, administrative-area, duplicate, or approval predicates.
- Do not call the paid VietMap API or write Production DB data; tests use local fakes only.
- Keep all cache entries except that sb-4685 and sb-4721 use a new address-cache key version.
- Do not show addresses, phone numbers, API secrets, or raw upstream data in trace UI.
- Preserve the original checkout and its three existing changes.

## Review Focus

- A legacy failed cache entry for sb-4685 or sb-4721 must be bypassed exactly once under the new version, then the new result must cache normally.
- Every other job must continue to reuse its existing cache key without a VietMap request.
- Search and Place attempts, including failures and limit rejection, must be counted per outcome without being presented as shared-server usage.
- The final usage snapshot must distinguish start/end/delta even when all address results came from cache.
- Upstream errors and timeouts after the server reserves usage must retain the server count without exposing upstream bodies or secrets.

---

### Task 1: Targeted address-cache retry and per-job trace data

**Files:**
- Modify: `src/lib/addressLocate.ts`
- Modify: `src/lib/chototAutoLocate.ts`
- Test: `src/lib/addressLocate.test.ts`
- Test: `src/lib/chototAutoLocate.test.ts`

**Interfaces:**
- Produces: job-aware `LocateStrategy.cacheKey(company, address, jobId)`, and `AutoLocateOutcome.lookupSource` / `requestCount`.
- Consumes: existing parser, hit selection, judge, and cache persistence unchanged.

- [ ] Write failing tests proving legacy cache bypass for IDs 4685/4721, cache reuse for other IDs, and cache reuse after the versioned retry.
- [ ] Run the focused tests and confirm failures are caused by the missing job-aware key and trace fields.
- [ ] Add the minimal targeted key version and outcome metadata without changing approval predicates.
- [ ] Run both focused tests and the full suite.
- [ ] Commit the task.

### Task 2: Attempt counts and explicit server-counter boundaries

**Files:**
- Modify: `src/lib/chototAutoLocate.ts`
- Modify: `src/lib/adminVietmapClient.ts`
- Modify: `api/admin-vietmap.js`
- Test: `src/lib/chototAutoLocate.test.ts`
- Test: `api/_admin-vietmap.test.ts`

**Interfaces:**
- Produces: `serverUsedAtStart`, `serverUsedAtEnd`, final `serverCallsDelta`, and a non-counting `readUsage` dependency.
- Consumes: Task 1 outcome request counts and the existing `/api/admin-vietmap` usage action.

- [ ] Write failing tests for cached zero-attempt runs with a shared-counter delta, daily-limit rejection attempts, upstream failure, and timeout after reservation.
- [ ] Run focused tests and verify the expected failures.
- [ ] Make `callsThisRun` represent page attempts, record explicit start/end usage, and include reserved usage metadata in safe API error responses.
- [ ] Run focused tests and the full suite.
- [ ] Commit the task.

### Task 3: Admin trace UI and handoff records

**Files:**
- Modify: `src/components/admin/AdminAutoLocate.tsx`
- Modify: `CHATGPT_HANDOFF.md`
- Modify: `WORK_LOG.md`

**Interfaces:**
- Consumes: Task 1 per-outcome trace fields and Task 2 server-counter boundaries.
- Produces: address-mode results showing job ID, cache/fresh/skipped, failure reason/status, and request attempts; summary showing server start/end/delta separately.

- [ ] Render trace data without address, phone, company, raw POI, or secret values.
- [ ] Explain counter differences as shared/rejected/unobserved possibilities without attributing them to the current run.
- [ ] Update the handoff snapshot and prepend a concise work-log entry.
- [ ] Run `npx tsc --noEmit`, `npm test`, and `npm run build`.
- [ ] Confirm the diff contains no Production DB/DDL/deployment changes, commit, push, and create a PR.

