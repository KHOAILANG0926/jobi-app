# Decision 0001 — Base framework

- Status: **Accepted** (approved by Lee 2026-10-18, PR #127)
- Date: 2026-10-18
- Decided by: Lee (directly, in the 2026-10-18 conversation)
- Korean original: `docs/decisions/ko/0001-기본틀.md` (Lee's copy; same content)

## 1. Who does what

| Role | Scope | Enforcement |
|---|---|---|
| **Lee only** | Changing rules (this folder) · publication criteria · approved screen layout · deleting data | Rule/guard files cannot merge without Lee's account approval (CODEOWNERS; tested 2026-10-18, PR #125) |
| **Machine blocks** | Automated checks before code lands · DB checks before a job is published | Required GitHub checks (checks, guard, app-screen) · DB triggers |
| **AI on its own** | Code changes · PRs · merge and deploy when checks pass · verifying results | AI uses only its own account (viecganban-bot), which has no settings permissions |

Do not turn technical steps Lee cannot judge (e.g. pressing merge) into Lee-approval steps.

## 2. Document control
- One decision per record, numbered (0001, 0002, ...).
- Accepted decisions are never edited. To change one, add a new record and mark the old one "Superseded by 00XX".
- Every decision states **Decided by** and **Enforcement**. If there is no enforcement, write "none".
- Korean and English versions must have the same numbers and count.

## 3. Incidents
Add the case as a test first, then fix the rule or code. Never end with only a new line in a document.

## 4. Reporting
Any claim without attached evidence (command output or source) is not a fact.

## 5. Relation to existing rules
Existing `CLAUDE.md` / `AGENTS.md` rules stay in force until they are reorganised. If they conflict, **this record wins**.

## 6. Open (needs Lee's decision)
- ~~Automatic production DB apply~~ → decided in 0002
