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

## Amendment (2026-11-15, Lee's decision — S4 #808)
- Decided by: Lee (2026-11-15: "Approve expanding CODEOWNERS, limited to security/CI/approval core files; amend Decision 0003 (ko/en) and check-approval-scope.mjs together; keep auto-merge for ordinary PRs")
- Why: A PR that weakens the checks or approval gate still leaves an Actions processing-delay window right after Lee dismisses an approval. GitHub's native code-owner approval applies at merge time and a dismissal takes effect immediately.
- Changed: Items 1–2 ("Lee's approval = decision records only") now also cover **security/CI/approval core files**: `/.github/`, `/scripts/ci/`, `/scripts/status/`, `/scripts/check-*.mjs`, `/scripts/*-gate.mjs`, `/scripts/approved-migrations.mjs`, `/AGENTS.md` — the same scope as the check-gate list (`GATE_CODE` in `scripts/decision-approval-gate.mjs`).
- Unchanged: ordinary files (UI, API, crawler, ops scripts, docs, DB migrations, …) have no owner and merge on automated checks alone (auto-merge stays). No repository-wide "one Lee approval" setting is used. Item 4 (no approval requests for technical steps in conversation) also stays — these are technical files, owned only as an anti-weakening exception.
- Enforcement (amended): CODEOWNERS may contain only the list above with the single owner `@KHOAILANG0926`; ordinary folders, `*`, or an empty owner turn the required check `checks` red (`scripts/check-approval-scope.mjs`, test `scripts/check-approval-scope.test.mjs`). Changing the list needs Lee's approval because it sits under the owned paths.
