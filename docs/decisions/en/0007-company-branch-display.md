# Decision 2026-11-01 — Common Company and Branch Display Rules (Approved by Lee in Chat)

## Approved Decisions
1. If the company name is already shown in the job title, do not repeat it on the second line of the top section. If a single branch name is confirmed from the source, show only that branch name on that line.
2. If the posting has no branch name, do not render the entire second line, and do not retain blank height or spacing.
3. If a posting includes multiple branches, do not arbitrarily select a representative branch for the top section. Display each branch in the order in which it appears in the source within the existing ③ Khu vực làm việc section.

## Common Processing Conditions
- Do not process based on a specific job number or company name.
- Treat company names, branch names, and actual addresses as separate concepts, preserving the sources (source_text·ocr_text).
- Display a branch name only when supported by the source; do not turn an address or building name into a branch name without evidence.
- Preserve the approved existing top layout and four detailed sections. Do not create new badges or fields.
- Do not change location data (job_work_locations) or administrator-confirmed coordinates.
- This decision does not mean that UI, parser, DB, or inspection checklist implementation has been completed. Implementation, automated checks, and production verification must be confirmed under separate completion criteria.

## Basis of Approval
Lee's chat decision on 2026-11-01: "Yes" to all previous questions 1, 2, and 3.
