# 0006 — Lee-confirmed sources and multiple roles (2026-10-28)

Lee explicitly authorized these decisions in this chat. The earlier relative-publication-time calculation is cancelled.

- Do not calculate, store or display an estimated publication time. Do not spend work on publication time, account type or AI-content labels that do not inform application decisions. created_at is registration history; Bomunttl explicitly sets posted_at to null instead of using its default.
- Accept `Lee 확인(원문 Facebook, 작성자 Ngọc Mai)` as provenance for a source brought by Lee. Record `Lee 제공 포스터에서 옮김` for the transcribed poster. Image storage is optional; do not ask again. R3 still requires original source_text. Apps/service_role cannot mint/change confirmation or its confirmed original text.
- Keep one announcement with role-specific salary, hours and conditions, including after automatic rebuilding. The salary summary is `Theo vị trí — xem chi tiết`; do not invent a combined numeric range. Display role labels are annotations; original lines remain unchanged.
- Preserve `10h - 10h` and fail the administrator-review checklist item. Do not silently repair it. This checklist is distinct from publication enforcement.
- No fabricated coordinates for Ngô Tất Tố - TP. Bắc Ninh. Use the canonical writer to create an unresolved address in the existing administrator queue. Once verified, show the accuracy of the company/street point.
- Official descriptions were compared: dishwasher → 9402 Người phụ bếp (explicitly includes rửa bát), waiter → 5131 Bồi bàn. The single stored representative code is 9402 for the first role, not a claim that both roles share that code. Both belong to am_thuc_do_uong.
- Two meals apply only to dishwashing; do not promise meals to the waiter through a global benefit flag.

Operational path: both migrations and their production check in one PR → required CI → bot merge → migrations-apply. If api.github.com is blocked, Codex pushes a branch and reports its SHA; Claude creates the PR. Local tests are not operational registration, checklist or streak evidence.
