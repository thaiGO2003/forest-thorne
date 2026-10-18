# WBS-005: Board & Bench Formation Mutation & 3-to-1 Star Merge

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-005 · Phase FOUNDATION
- **Nhánh đích:** `feat/foundation/board-bench-formation-mutation-3-to-1-star-merge`
- **Tham chiếu:** `§11, §14.2, §14.4, §14.8, A2, A4, A43, A75, A81`
- **Phụ thuộc:** Deps: WBS-004
- **Trạng thái WBS:** Hoàn thành (WBS)

## Nội dung
- [x] **WBS-005: Board & Bench Formation Mutation & 3-to-1 Star Merge** `§11, §14.2, §14.4, §14.8, A2, A4, A43, A75, A81` *(Deps: WBS-004)*
  - **Mô tả:** Quản lý 25 ô bàn đồng minh (5x5) và hàng chờ bench compact. Kiểm tra trùng species, hoán đổi swap ô, gộp sao 3-to-1 tự động giữ lại equipment không trùng và trả overflow về bag.
  - **Tiêu chí nghiệm thu:** Merge scan deterministic, trang bị thừa trả về túi đồ, bench không bị lỗ trống phân mảnh.
  - **Audit Note:** ✓ Verify-foundation audit: Đã kiểm chứng qua 9 tests trong tests/run.test.ts.
