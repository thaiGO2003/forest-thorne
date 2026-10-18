# WBS-050: Modal Coordination & Layer Stacking Manager (Z-Order Authority)

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-050 · Phase UI
- **Nhánh đích:** `feat/ui/modal-coordination-layer-stacking-manager-z-order-authority`
- **Tham chiếu:** `§40, §52, A93`
- **Phụ thuộc:** Deps: WBS-049
- **Trạng thái WBS:** Hoàn thành (WBS)

## Nội dung
- [x] **WBS-050: Modal Coordination & Layer Stacking Manager (Z-Order Authority)** `§40, §52, A93` *(Deps: WBS-049)*
  - **Mô tả:** Bộ điều phối modal trung tâm: quản lý màn chắn backdrop mờ, bẫy tiêu điểm (focus trap), đóng bằng phím ESC, quản lý phân tầng z-index cố định (Canvas 0, HUD 10, Backdrop 50, Modal 60, Tooltip 100).
  - **Tiêu chí nghiệm thu:** Tại một thời điểm chỉ có tối đa 1 modal chính nhận tương tác chuột/bàn phím; đóng modal an toàn.
  - **Audit Note:** ✓ Verify-ui audit: Passed. Đã tích hợp tại src/ui/modalManager.ts.
