# Decision 0004 — Poster checks use a qualified, independent reader

- Status: **Proposed** (becomes "Accepted" when Lee approves)
- Date: 2026-10-18
- Decided by: Lee (2026-10-18 conversation: "if the OCR can't do the job, do we need it at all?", "let's proceed")
- Korean original: `docs/decisions/ko/0004-독립판독자.md`

## Context
The previous OCR (Tesseract, added 10-13) was used for decisions without testing on real posters. It could not read boxed layouts or white text and blocked a valid job (#4828).

## Decision
1. Remove Tesseract from decisions.
2. Instead, **a second AI reads the poster alone, without seeing the entered values** (double-entry verification). Match → pass; mismatch → hold.
3. A reader may decide only after **passing a calibration test on real posters with known answers**. Any poster it misses is added to that test.
4. Any new checking tool follows the same rule: no decisions before passing real-case tests.

## Enforcement
- Every reading run first runs the calibration test (`scripts/ocr/ai-reader.test.mjs`); if it fails, nothing is judged.
- The same calibration test runs in PR checks.
- The reader is never given the entered values (fixed in code).
