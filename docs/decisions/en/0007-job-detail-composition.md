# Decision 0007 — Job detail page composition (accepted 2026-10-19)

- Status: **Proposed** (becomes "Accepted" when Lee approves)
- Date: 2026-10-19
- Decided by: Lee (2026-10-19: "confirm the current composition and make it the rule")
- Korean original: `docs/decisions/ko/0007-공고상세-구성.md`

## 1. Location & directions
1. Exact routing is handled by **Google Maps directions** (address text is passed). VietMap map is for approximate area only.
2. Ward-level only: one line "**Khu vực phường X** (vị trí gần đúng)". No long explanations or warnings.
3. Red map pin before "Chỉ đường Google Maps"; letters wave (Google letters keep original colors, no line breaks).
4. Short tap on the map opens Google directions (drag and zoom controls excluded).
5. A scooter rides from the directions arrow tip to the map center (stays inside the location box).
6. No rounded/pill border decorations.

## 2. Job description (Mô tả công việc)
1. Sections 01–08 as listed in the Korean original; empty sections hidden.
2. Source text is never rewritten. Only three kinds of lines may be removed: (1) source subheadings, (2) title repeats, (3) workplace address/phone already shown above.
3. **Salary lines are kept even if shown above.**
4. Working environment / benefits lines go to 05.
5. Design (Albamon posting style): pink vertical bar + bold section title, bullet list, whitespace between sections.
6. 08 images: same-size thumbnails in one row; tap to enlarge and swipe. No grey background.

## 3. Changing the look
1. Discuss in words first; Lee decides.
2. Send demo links immediately.
3. Ship to production after Lee checks the demo.

## Enforcement
- Description sectioning: answer-key tests on real posts (#4824, #4828) — mismatch blocks merge (`src/lib/jobDetailSections.test.ts`). Add a case for each new post type.

## Not enforced
- Visual design and the process in section 3 are not machine-enforced yet; design numbers go into the layout drawing (decision 0005) when re-measured.
