# Decision 0005 — Job screens are held to a numeric drawing

- Status: **Proposed** (becomes "Accepted" when Lee approves)
- Date: 2026-10-18
- Decided by: Lee (2026-10-18 conversation: "whoever works, work from a drawing", "a frame nobody may touch", "no screenshot comparison", "apply it now")
- Korean original: `docs/decisions/ko/0005-공고화면-도면.md`

## Context
For five months the job screen layout drifted with each worker (AI included). There was no numeric reference; judgments were made from screenshots.

## Decision
1. **Drawing**: `docs/decisions/drawings/job-layout.json` records area order, position, width, height, gaps, font size and colour. Reference job: CTY KDA (#4824). Scope: detail PC/mobile, list card PC/mobile.
2. **Checks measure dimensions** (±1px). No screenshot comparison.
3. **Areas not in the drawing fail** (new sections or rows).
4. **Empty values** keep their area; no fake values.
5. **Publishing requires passing the drawing**: every public job is measured on production right after registration/OCR publishing and every 30 minutes. A mismatching job is hidden automatically and an issue is filed. If the reference job (#4824) also mismatches, it is a code problem: no job is hidden, only a warning (prevents emptying the site).
6. **Only Lee changes the drawing**, the measurer and the files that run the drawing checks, whoever the worker is.
7. **Incident → test**: every violation is added to the measurer self-test.

## Enforcement
- Code: required check `app-screen` compares against the drawing on every PR; mismatch blocks merge.
- After deploy: deploy-verify compares production with the drawing; failure turns red + issue.
- Jobs: `layout-gate.yml` measures all public jobs after registration/OCR and every 30 minutes; mismatches are hidden.
- Locked (CODEOWNERS, Lee approval): `docs/decisions/` (drawing, measurer), `app-screen-check.yml`, `layout-gate.yml`, `deploy-verify.yml`. Adds these three check files to the approval scope of decision 0003.
- Self-test every run: the #4828 empty-company incidents (detail salary pulled up 4px, mobile card row vanished), missing required section, shrunk logo box, extra row/section, shrunk card image box.
- Rehearsal: every PR changing the gate or measurer injects a fault into one job, confirms it is caught and that real DB triggers hide it, then rolls back (no production data change).

## Known limits (no enforcement)
- A newly published job is public for a few minutes until the gate measures it (hidden jobs cannot be rendered, so they cannot be measured before publishing).
- Details the drawing does not measure (icon shapes, text content) are not caught.
