# Decision 0008 — Fill missing lines instead of blocking / never auto-delete unlocated jobs; report them every evening

- Status: **Proposed** (becomes "Accepted" when Lee approves)
- Date: 2026-10-20
- Decided by: Lee (2026-10-20 conversation)
- Korean original: `docs/decisions/ko/0008-빠진줄-채우기-못찾은공고.md`

## 1. Missing lines in the detail description
- Lines present in the source (post text, AI poster transcription) but missing from the job description are **not a reason to block publishing**; they are added automatically, character-for-character, into the matching section.
- Lines of a kind no rule covers go to "Other" (07) and are reported daily at 08:52 (Asia/Ho_Chi_Minh); Lee picks a section and it becomes a rule (KIND_RULES). Changing the rules re-sorts every job automatically.
- Vague promotional lines (benefit slogans, closing calls to action, "TUYỂN FULL") go to "Other" without asking.

## 2. Jobs whose location cannot be found
- Located (verified point, industrial-park gate, ward center, or industrial-park name) → stays public.
- Source has no location at all → deleted immediately (if applications/messages/interviews exist: hidden and listed instead).
- Source has an address but we failed to locate it → hidden, **never auto-deleted**. A list (address, reason, proposed fix) is sent to Lee every evening at 20:00, and jobs are re-judged every day at 03:00 with the fixed code.
- The earlier plan (auto-delete after 14 days, draft decision 0006) is dropped.

## Enforcement
- Missing lines: `src/lib/jobDetailFill.ts` (KIND_RULES) + real-job answer-sheet test `jobDetailFill.test.ts`; runner `scripts/ocr/detail-fill.mjs` right after poster reading.
- Unlocated jobs: `src/lib/locationLevel.ts` + tests; DB `map_r1_unlocated`, `map_r1_delete_no_info`, `map_r1_unlocated_report`; production check asserts no auto-delete schedule exists.
- Notifications: two scheduled tasks (08:52 new line kinds, 20:00 unlocated jobs).
