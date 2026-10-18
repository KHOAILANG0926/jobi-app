# Decision 0006 — Delete job posts whose location can never be found

- Status: **Proposed** (becomes "Accepted" when Lee approves)
- Date: 2026-10-18
- Decided by: Lee (2026-10-18 conversation: "the ones we can't find should be deleted", "Ok" to the proposed order)
- Korean original: `docs/decisions/ko/0006-못찾은공고-삭제.md`
- Resolves the conflict between 10-07 "don't publish if the location can't be determined" and 10-13 "the main map must always have a pin"

## Decision
1. **"Unlocated" = only the province centre is known.** Any of: verified coordinate, industrial-park gate, ward centre, or an industrial park named in the address counts as "located".
2. Unlocated posts are **hidden immediately**; while unlocated they stay hidden even if an admin publishes them.
3. Weekly, unlocated posts are grouped by cause and the AI improves the rules; **every day they are re-judged with the current rules**. When located, posts that were public are re-published.
4. **Deleted after 14 days unlocated**, automatically; Lee does not handle posts one by one.
5. Posts with applications, messages or interviews are **never deleted, only kept hidden** (protect user records).
6. No extra VietMap cost (same address reuses stored results; 2 calls per address, 250 per day).

## Enforcement
- Verdict: `src/lib/locationLevel.ts` (tests include real posts #4824 and #4828)
- Hide / re-publish / publish block / daily re-judge / 14-day delete: `supabase/migrations/20261018233000_map_r1_unlocated.sql`
- Deletion log: `map_r1_deleted_log` (id, title, reason only)
- Weekly rule improvement: scheduled task (AI opens a PR)

## Not enforced
- Whether the AI improves rules well (item 3) cannot be guaranteed by machine; only PR checks.
