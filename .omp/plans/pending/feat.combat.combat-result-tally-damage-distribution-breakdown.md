# WBS-032: Combat Result Tally & Damage Distribution Breakdown

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-032 · Phase COMBAT
- **Nhánh đích:** `feat/combat/combat-result-tally-damage-distribution-breakdown`
- **Tham chiếu:** `§16.17, A18, A87, A121`
- **Phụ thuộc:** Deps: WBS-019, WBS-025
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-032: Combat Result Tally & Damage Distribution Breakdown** `§16.17, A18, A87, A121` *(Deps: WBS-019, WBS-025)*
  - **Mô tả:** Bảng thống kê kết quả trận đấu: tổng sát thương gây ra của từng quân cờ, lượng sát thương gánh chịu, lượng máu hồi phục, chi tiết vàng thưởng nhận được (thắng/chuỗi/bounty).
  - **Tiêu chí nghiệm thu:** Số liệu khớp 100% với event log combat simulation; phân định rõ MVP của trận.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-04: §16.17/A18/A87/A121 author round outcome, survivor counts, mode damage, reward decomposition, loot and idempotent result handoff, but do **not** define per-unit damage/heal tally semantics, MVP scoring, or tie-breaks. Current `CombatEvent` direct hits/heals have `src`, while DoT/environment damage events are `{ t: "dot", dst, kind, dmg }` with no source ownership; therefore the stated “100% event-log” per-unit attribution and MVP acceptance cannot be implemented truthfully without a new authored contract. Keep unchecked; do not invent formulas or DoT ownership.
