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
- Changed: Items 1–2 ("Lee's approval = decision records only") now also cover **security/CI/approval core files**: `/.github/`, `/scripts/ci/`, `/scripts/status/`, `/scripts/check-*.mjs`, `/scripts/*-gate.mjs`, `/scripts/approved-migrations.mjs`, `/AGENTS.md` — listed in exactly one place (`scripts/ci/protected-paths.mjs`); both the CODEOWNERS check (`scripts/check-approval-scope.mjs`) and the Actions approval gate (`GATE_CODE` in `scripts/decision-approval-gate.mjs`) derive from that list, so their scopes cannot drift apart.
- Unchanged: ordinary files (UI, API, crawler, ops scripts, docs, DB migrations, …) have no owner and merge on automated checks alone (auto-merge stays). No repository-wide "one Lee approval" setting is used. Item 4 (no approval requests for technical steps in conversation) also stays — these are technical files, owned only as an anti-weakening exception.
- Enforcement (amended): CODEOWNERS must match that single list exactly, with the single owner `@KHOAILANG0926`; ordinary folders, `*`, or an empty owner turn the required check `checks` red (`scripts/check-approval-scope.mjs`, test `scripts/check-approval-scope.test.mjs`). Changing the list needs Lee's approval because it sits under the owned paths.

## Amendment (2026-11-17, Lee's decision — fewer rubber-stamp approvals)
- Decided by: Lee (2026-11-17: "Ordinary bug fixes, added tests and runtime-environment fixes auto-merge after required CI and independent review. Keep Lee's approval for important decisions — security, permissions, secrets, approval rules, production DB structure, resuming operations. Judge actual changed content and risk, not just paths. If a change cannot be classified safely, do not auto-merge.")
- Why: since the 11-15 amendment every file under `.github/` waited for Lee regardless of content — e.g. #876's crawl.yml runner/Python version fix and a test step added to a test-only workflow.
- Changed: the Actions approval gate (`scripts/decision-approval-gate.mjs` ⑨ `workflowSafeChange`) no longer raises an **existing** file under `.github/workflows/` as a "check/protection device" when **every** changed line is a safe line: GitHub-hosted ubuntu runner, Python/Node version, timeout, comments in any workflow; and **added** test steps (test commands, known actions, install lines) in test-only workflows (`SAFE_TEST_WORKFLOWS`).
- Unchanged: any other line (job `if`, cron, permissions, secrets, environment, new action, run command, ignoring failures…) still needs Lee. New/renamed/deleted workflows, missing patches, tests added to check/merge/approval workflows, the other protected paths (`/scripts/ci/` …), CODEOWNERS and decision records still need Lee. Independent review, required checks, S4 key isolation and branch protection are untouched. The CODEOWNERS list is unchanged (GitHub's native code-owner review does not block today because required approvals is 0 — if that is raised to 1 this amendment must be realigned).
- Enforcement: `scripts/decision-approval-gate.test.mjs` ⑨ — the real #876 changes pass automatically; 17 risky patterns (resume via `if`, cron, run command, permissions, secrets, self-hosted, unknown action, ignore failure, removing a test, arbitrary command…) and 6 unclassifiable forms still require Lee; the test-only list is checked for secrets/write permissions.
