# Decision 0002 — Production DB changes are applied automatically

- Status: **Proposed** (becomes "Accepted" when Lee approves)
- Date: 2026-10-18
- Decided by: Lee (2026-10-18 conversation: "apply automatically; too much to do one by one")
- Korean original: `docs/decisions/ko/0002-운영DB-자동적용.md`
- Resolves the open item in 0001

## Decision
Production DB changes (migrations) merged to master after passing required checks are **applied automatically, without asking Lee**.

## Enforcement
- Only the GitHub workflow `migrations-apply.yml` applies them (the AI account cannot write to the production DB; its DB connector is read-only).
- Required checks must pass before merge. Each file runs in one transaction; on failure that file is fully rolled back and the run turns red.
- Production check SQL runs automatically after applying.

## Exceptions (still Lee's decision)
- Deleting data, changing publication criteria, hard-to-reverse changes → decided by Lee per 0001.
