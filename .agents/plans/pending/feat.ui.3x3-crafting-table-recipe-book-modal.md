# WBS-061: 3x3 Crafting Table & Recipe Book Modal

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-061 · Phase UI
- **Nhánh đích:** `feat/ui/3x3-crafting-table-recipe-book-modal`
- **Tham chiếu:** `§14.11, §14.12, A7, A86, A106, A107.6`
- **Phụ thuộc:** Deps: WBS-007, WBS-051, WBS-060
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-061: 3x3 Crafting Table & Recipe Book Modal** `§14.11, §14.12, A7, A86, A106, A107.6` *(Deps: WBS-007, WBS-051, WBS-060)*
  - **Mô tả:** Crafting UI 3×3 + Recipe Library: staged ingredients, output preview, craft history, dependency diagram và detail panel có icon/name/tier/category/bonus/description/pattern, independent scrolling và prerequisite navigation.
  - **Tiêu chí nghiệm thu:** Locked cells đúng craftTableLevel; 2×2/3×3 pattern giữ exact row-major positions kể cả ô trống; ingredient multiplicity đúng; browse recipe tuyệt đối không mutate inventory/spend material.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: recipe/crafting mutations are core-owned; A107.6 recipe browsing, dependency/detail panels and independent scrolling are presentation integration and must not mutate inventory while browsing.
