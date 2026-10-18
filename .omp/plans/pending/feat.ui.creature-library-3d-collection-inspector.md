# WBS-068: Creature Library & 3D Collection Inspector

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-068 · Phase UI
- **Nhánh đích:** `feat/ui/creature-library-3d-collection-inspector`
- **Tham chiếu:** `§25, A67.2, A107.2, A107.3, A107.4, A109`
- **Phụ thuộc:** Deps: WBS-002, WBS-038, WBS-050
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-068: Creature Library & 3D Collection Inspector** `§25, A67.2, A107.2, A107.3, A107.4, A109` *(Deps: WBS-002, WBS-038, WBS-050)*
  - **Mô tả:** Library có ba tab Units/Recipes/Odds; Units hỗ trợ search + Class/Tribe/Tier filters, canonical sorting, responsive list/detail, star/skin preview độc lập và 3D inspector. Deterministic cosmetic themes là non-gameplay capability tách khỏi equipped skin ownership.
  - **Tiêu chí nghiệm thu:** Open/refresh reload Collection/Achievement profile; switching tab reset scroll/detail đúng contract; pager dùng capacity thật; attack explainer chỉ là presentation và canonical target/skill footprint luôn đến từ live combat/Library preview authority, không tạo targeting algorithm thứ hai.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: Collection/profile/catalog state and canonical combat preview authorities are separate core owners; search/filter/list/detail/3D inspector/skin preview lifecycle in this WBS is presentation-only.
