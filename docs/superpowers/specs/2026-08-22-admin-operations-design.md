# Admin Operations Design

## Status and boundary

- Approved 2026-08-22. Foundation baseline is `d8b7dff` and remains unchanged except for adding the shared active-account predicate to existing ownership policies.
- No production frontend deployment is part of this work.
- Operating data is never deleted or automatically deactivated.

## Jobs

`local_jobs.origin` is constrained to `crawler`, `employer`, `admin`, or `legacy`. The operating backfill gate must observe exactly 649 jobs split as employer 3 (`employer_id is not null`), crawler 643 (`description` contains `[source:vieclam24h]`), legacy 3, and admin 0. A mismatch aborts the migration. Only the admin creation RPC writes `origin = 'admin'`.

`admin_hidden` is independent of `active`. Anonymous and ordinary authenticated reads require `admin_hidden = false`; admins can read hidden rows. Existing employer ownership predicates remain, with `is_account_active(auth.uid())` added. The authenticated role receives no column privilege for `admin_hidden` or `origin`; hide/unhide uses an admin-only RPC and creates an audit row.

## Account suspension

`account_statuses` contains one row per auth user and is backfilled `active`. `is_account_active(uuid)` is a fixed-search-path SECURITY DEFINER function owned by the migration owner; clients may execute it but cannot mutate its result or the backing table. Missing rows fail closed for authenticated users after the complete backfill.

Suspension uses two layers: a Vercel server endpoint verifies the caller with their JWT and rechecks `app_metadata.role = admin`, then uses the service-role Admin API to ban/unban; the database RPC changes `account_statuses` and appends an audit row. Every sensitive Foundation policy keeps its ownership predicate and adds the common active-account predicate. Existing access tokens therefore lose DB access immediately. Ban blocks new/renewed authentication; unsuspension requires a fresh login. Supabase does not expose a documented user-id API that invalidates every already-issued access JWT, so the DB layer is the immediate enforcement boundary.

Public `local_jobs` and `korea_jobs` remain readable. Sensitive reads and writes are blocked for suspended users on applications, message threads/messages, interviews, profiles/CVs, private CV photos, and report creation.

## Reports and audit

`reports` supports targets `job`, `user`, and `community_post`, statuses `pending`, `reviewing`, `resolved`, and `rejected`, and an informational JSONB snapshot. A user inserts and reads only their own reports while active. Admins read all reports and process them through a SECURITY DEFINER RPC, which records an audit entry.

`admin_audit_logs` is append-only to clients: only admins may select, and no anon/authenticated INSERT/UPDATE/DELETE grants exist. Admin SECURITY DEFINER RPCs explicitly require `auth.uid()`, recheck JWT `app_metadata.role`, fix `search_path`, use no dynamic SQL, perform one narrowly scoped action, and append the log.

## Admin UI

`/admin` retains the current dashboard and manual registration form and adds five top-level operating tabs: Dashboard, Jobs, Users, Reports, Audit Logs. Manual registration becomes part of Jobs and uses the admin RPC so new rows have `origin = 'admin'`. Job operations provide search and origin/active/hidden filters plus hide/unhide. User operations expose role, status, join date, and minimal job/application counts without secrets. Report and audit views expose only operational fields.

`JobDetail` and `CommunityPostDetail` receive a small report CTA without restructuring either page. Guests are sent to login; signed-in users submit through the reports RLS path.

## Verification gates

- Static migration contract and API authorization tests run red/green before implementation.
- The operating workflow runs a read-only count/policy audit, aborts on any backfill mismatch, applies `0009_admin_operations.sql`, and creates only uniquely marked synthetic users/data.
- E2E covers hidden visibility, employer ownership/column denial, direct non-admin RPC denial, report isolation and handling, append-only audit, pre-suspension-token immediate denial for employer and seeker, public reads, unsuspend plus fresh login, and Foundation application/message/interview regression.
- Cleanup removes only synthetic marker data and users, then verifies zero rows remain.

