# 0005 — Industrial-park factory ads with unspecified duties (Lee, 2026-10-27)

- Accept intermediary recruitment; display `Tuyển qua nhà thầu` and retain the actual workplace company. Original ads requiring candidate fees remain private for admin review. Document assistance or negated fees are not fee demands.
- Joining bonuses are separate salary/allowance lines, never added to total pay. Do not invent payout conditions.
- For a confirmed factory ad in KCN/VSIP or another industrial park, unspecified duties alone do not prevent publication. Use only the highest supported existing official occupation_master code. Ads outside industrial parks or with unknown factory status retain the existing unclassified/private rule. A park name alone does not confirm a factory.
- Show `Công việc cụ thể: chưa ghi trong tin gốc` in duties. This is an approved disclosure, not original-source evidence.
- For Lee-confirmed FUSHAN, use official top-level `9 — Lao động giản đơn`, retaining `Làm ngồi, phòng thường` and `VSIP` as source evidence. The contiguous original substring includes the intervening newline and `Địa chỉ:`. Do not infer assembly or machine operation.
- Dormitory and room-finding assistance use benefit codes. Room-finding assistance is not cash rent allowance.
- Reuse confirmed company+park location memory when available, otherwise use the verified industrial-park entrance and show its precision. Preserve the existing canonical location writer.

## Delivery status

The branch fixes eight unclassified source lines, adds regression coverage, preserves the explicit missing-duty notice on rebuild, adds contractor disclosure for supported recruitment evidence, and adds a distinct room-finding benefit code. The DB rule SQL remains in `supabase/pending/fushan-20261027/` with its production check; it has not been applied. Registration, candidate-fee enforcement, location verification and production checklist/streak updates remain downstream work. Lee's latest instruction: push a new branch only; Claude creates the PR. No PR, production write or deployment by this task.
