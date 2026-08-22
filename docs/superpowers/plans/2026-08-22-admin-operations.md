# Admin Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure administrator job, user, report, audit, and immediate account-suspension operations without redesigning the Foundation ownership model.

**Architecture:** One idempotent migration adds operating tables, helper functions, narrow admin RPCs, and active-account predicates to existing RLS. A Vercel server endpoint owns service-role Auth ban/unban, while focused client adapters and admin tab components consume the safe database interfaces.

**Tech Stack:** PostgreSQL/Supabase RLS and Storage, Supabase Auth Admin API, Vercel Functions, React 18, TypeScript, Node integration tests.

**Spec:** `docs/superpowers/specs/2026-08-22-admin-operations-design.md`

## Global Constraints

- Foundation baseline `d8b7dff`; retain every existing ownership predicate.
- Never expose or commit service-role credentials.
- No operating data deletion/deactivation and no production frontend deployment.
- Backfill must equal employer 3, crawler 643, legacy 3, admin 0 or abort.

---

### Task 1: Migration contract and operating audit

**Files:** Create `scripts/test-admin-operations.mjs`, `supabase/audits/admin_operations_readonly.sql`, `supabase/audits/admin_operations_remaining_count.sql`, `supabase/migrations/0009_admin_operations.sql`.

**Interfaces:** Produces `is_account_active(uuid)`, `admin_set_job_hidden(bigint,boolean,text)`, `admin_set_account_status(uuid,text,text)`, `admin_handle_report(uuid,text,text)`, `admin_list_users()`, and the new tables/columns.

- [ ] Write executable static contract tests for the exact backfill gate, helper hardening, preserved ownership predicates plus active checks, grants, RPC checks, and append-only audit.
- [ ] Run `node scripts/test-admin-operations.mjs` and confirm failure because `0009` is absent.
- [ ] Implement the minimum idempotent migration and read-only/cleanup audits.
- [ ] Rerun the test and existing P0 migration tests; confirm both pass.
- [ ] Commit the database contract unit.

### Task 2: Server Auth suspension endpoint

**Files:** Create `api/admin-users.js`, `scripts/test-admin-users-api.mjs`.

**Interfaces:** Consumes bearer access JWT and `{userId,status,reason}`; calls Admin API ban/unban and database status RPC, returning no sensitive auth data.

- [ ] Write handler tests for missing token, non-admin, invalid input, ban-first suspension, rollback-safe errors, and active unban.
- [ ] Run the test and confirm failure because the handler is absent.
- [ ] Implement dependency-injectable request handling with server-only environment access.
- [ ] Rerun the API tests and confirm pass.
- [ ] Commit the Auth administration unit.

### Task 3: Admin data adapter and five-tab UI

**Files:** Create `src/lib/adminOperations.ts`, `src/components/admin/AdminJobs.tsx`, `AdminUsers.tsx`, `AdminReports.tsx`, `AdminAuditLogs.tsx`; modify `src/pages/AdminDashboard.tsx`, `src/index.css`.

**Interfaces:** Adapter exposes typed list/filter and RPC functions; components preserve the current Dashboard/manual form and never query auth secrets.

- [ ] Write an adapter contract test exercising query/RPC payload normalization.
- [ ] Run it and confirm failure before the adapter exists.
- [ ] Add the typed adapter and focused tab components, then integrate Dashboard/Jobs/Users/Reports/Audit Logs with manual registration in Jobs.
- [ ] Rerun adapter tests and `npx tsc --noEmit`.
- [ ] Commit the admin UI unit.

### Task 4: Report CTAs

**Files:** Create `src/components/ReportButton.tsx`; modify `src/pages/JobDetail.tsx`, `src/pages/CommunityPostDetail.tsx`, `src/index.css`.

**Interfaces:** `ReportButton` accepts target type/id and snapshot; guests navigate to login and active authenticated users insert their own report.

- [ ] Write a behavior test for guest redirect, authenticated payload, blank reason denial, and failure feedback.
- [ ] Run it and confirm failure before implementation.
- [ ] Implement the compact CTA/modal and place it without restructuring either detail page.
- [ ] Rerun the behavior test and typecheck.
- [ ] Commit the reporting UI unit.

### Task 5: Operating migration and isolated E2E

**Files:** Create `scripts/e2e-admin-operations.mjs`, `.github/workflows/admin-operations.yml`; update the read-only and remaining-count audits if the live catalog requires a non-semantic compatibility adjustment.

**Interfaces:** Workflow consumes existing `SUPABASE_DB_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and project URL secrets without printing values.

- [ ] Build the E2E around pre-suspension tokens, uniquely marked users/jobs/reports, and explicit negative assertions.
- [ ] Push the branch to trigger the read-only 649-row gate and migration.
- [ ] Verify hidden/public/admin visibility, ownership and RPC denial, reports/audit, suspension immediate denial, active regression, unsuspend/fresh-login recovery, and Foundation application/message/interview paths.
- [ ] Run always-cleanup and confirm the remaining count is zero.
- [ ] Commit any evidence-only workflow correction and push.

### Task 6: Final regression and handoff

**Files:** Modify `CHATGPT_HANDOFF.md`; update `VIECGANBAN_STRUCTURE_BASELINE.md` with facts only.

**Interfaces:** Documents distinguish IMPLEMENTED, VERIFIED, OPERATING DB APPLIED, SYNCED, and DEPLOYED.

- [ ] Run all admin/P0 tests, `npx tsc --noEmit`, and `npm run build` from a clean command invocation.
- [ ] Inspect `git diff --check` and ensure user-owned untracked files remain untouched.
- [ ] Update the two state documents with current evidence and limitations.
- [ ] Commit, push `codex/admin-operations`, and verify local HEAD equals remote HEAD.

