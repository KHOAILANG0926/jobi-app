# Decision 0005 — Job screens are held to a numeric drawing

- Status: **Proposed** (becomes "Accepted" when Lee approves)
- Date: 2026-10-18
- Decided by: Lee (2026-10-18 conversation: "whoever works, work from a drawing", "a frame nobody may touch", "no screenshot comparison", "apply it now")
- Korean original: `docs/decisions/ko/0005-공고화면-도면.md`

## Context
For five months the job screen layout drifted with each worker (AI included). There was no numeric reference; judgments were made from screenshots.

## Decision
1. **Drawing**: `docs/decisions/drawings/job-detail-layout.json` records area order, position, width, height, gaps, font size and colour of the job detail screen. Reference job: CTY KDA (#4824), PC and mobile separately.
2. **Checks measure dimensions**: a machine measures each area and compares with the drawing (±1px). No screenshot comparison.
3. **Scope**: reference job + every public job, with images and with images failing, PC and mobile.
4. **Empty values** keep their area; no fake values.
5. **Only Lee changes the drawing**: the drawing, the measurer and the required check that runs it need Lee's approval, whoever the worker is (Claude, GPT, Gemini, local developers).
6. **Incident → test**: every drawing violation is added to the measurer self-test.

## Enforcement
- Required check `app-screen` runs the drawing comparison on every PR; mismatch blocks merge.
- `docs/decisions/` (drawing and measurer) and `.github/workflows/app-screen-check.yml` require Lee's approval via CODEOWNERS. This adds that one check file to the approval scope of decision 0003.
- Self-test: the #4828 empty-company incident (salary pulled up 4px), a missing required section, and a shrunk logo box must be caught every run.
- Not yet: job card (list) drawing — next step, same method.
