# WBS-065: Battle History & Structured Event Log Modal

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-065 · Phase UI
- **Nhánh đích:** `feat/ui/battle-history-structured-event-log-modal`
- **Tham chiếu:** `§14.18, §14.19, A64, A107.1, A123`
- **Phụ thuộc:** Deps: WBS-004, WBS-050, WBS-056
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-065: Battle History & Structured Event Log Modal** `§14.18, §14.19, A64, A107.1, A123` *(Deps: WBS-004, WBS-050, WBS-056)*
  - **Mô tả:** History dùng structured entries với filter order `ALL → COMBAT → SHOP → CRAFT → EVENT`, retention 300 entries và compact live preview 6 entries; newest-first, detail rows giàu dữ liệu và malformed category normalize về EVENT.
  - **Tiêu chí nghiệm thu:** Lazy-build tối đa một History surface/in-flight request mỗi scene; success/failure luôn clear load marker; reopen/filter/scroll chỉ refresh presentation, không replay mutation; History có ưu tiên wheel/keyboard/gamepad khi visible và release modal ownership khi đóng.
  - **Audit Note:** ⚠ Logic-only completion split 2026-10-05: `src/core/history.ts` now owns A107.1 structured entries, canonical `ALL → COMBAT → SHOP → CRAFT → EVENT` filters, 300-entry Planning retention, 6-entry compact preview, newest-first filtering, missing-category content inference, malformed explicit category → `EVENT`, rich-detail normalization and 240-entry combat history. Focused History tests pass, typecheck passes, and production-module SSR smoke verified category inference/order/preview/detail flattening. WBS-065 remains unchecked because A123 lazy-build/single-flight surface lifecycle, modal ownership, scrolling and keyboard/gamepad/wheel interception are presentation integration.
