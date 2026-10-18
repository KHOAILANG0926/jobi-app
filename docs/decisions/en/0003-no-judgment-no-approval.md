# Decision 0003 — If there is nothing for Lee to judge, there is no Lee approval

- Status: **Proposed** (becomes "Accepted" when Lee approves)
- Date: 2026-10-18
- Decided by: Lee (2026-10-18 conversation: "why do you need my approval if I'm only stamping it", "rules matter, but speed matters too")
- Korean original: `docs/decisions/ko/0003-판단할것없으면-승인없음.md`

## Decision
1. Lee's approval applies only to things Lee can read and judge. Currently that is **only decision records (this folder)** — to confirm the AI recorded Lee's words correctly.
2. Technical files (CI config, code, DB changes, scope orders) are protected by **automated checks**, not Lee's approval.
3. The two-step scope flow (scope PR → implementation PR) is retired. One PR per task.
4. In conversation, the AI does not ask Lee to "approve" technical steps he cannot judge.

## Enforcement
- The list of files GitHub requires Lee to approve (CODEOWNERS) may contain only decision records and itself. Any other entry turns the required check `checks` red (`scripts/check-approval-scope.mjs`).
- Changing that list also needs Lee's approval, so the AI cannot expand approvals alone.
- Item 4 (conversation) cannot be enforced by machine: none.
