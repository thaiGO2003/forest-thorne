# WBS-007: Atomic Crafting 3x3 Table & Recipe Pattern Matcher

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-007 · Phase FOUNDATION
- **Nhánh đích:** `feat/foundation/atomic-crafting-3x3-table-recipe-pattern-matcher`
- **Tham chiếu:** `§14.11, §14.12, A7, A40, A86, A106`
- **Phụ thuộc:** Deps: WBS-006
- **Trạng thái WBS:** Hoàn thành (WBS)

## Nội dung
- [x] **WBS-007: Atomic Crafting 3x3 Table & Recipe Pattern Matcher** `§14.11, §14.12, A7, A40, A86, A106` *(Deps: WBS-006)*
  - **Mô tả:** Bàn ghép đồ 3x3 với non-destructive staging. Kích hoạt ô theo craftTableLevel (0..3). Thuật toán trượt pattern (1x1, 2x2, 3x3) so khớp nguyên liệu chính xác, tiêu hao từ túi và sinh item.
  - **Tiêu chí nghiệm thu:** Staging không mất đồ thật trong bag; craft() atomic commit; lưu craftHistory.
  - **Audit Note:** ✓ Verify-foundation audit: Passed. Test suite tests/tech-craft.test.ts pass.
