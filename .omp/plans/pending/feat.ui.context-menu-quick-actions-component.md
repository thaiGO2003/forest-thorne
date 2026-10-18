# WBS-064: Context Menu Quick Actions Component

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-064 · Phase UI
- **Nhánh đích:** `feat/ui/context-menu-quick-actions-component`
- **Tham chiếu:** `§14.17, A85`
- **Phụ thuộc:** Deps: WBS-005, WBS-050, WBS-056
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-064: Context Menu Quick Actions Component** `§14.17, A85` *(Deps: WBS-005, WBS-050, WBS-056)*
  - **Mô tả:** Trình đơn ngữ cảnh mở nhanh khi nhấp chuột phải hoặc giữ ngón tay trên quân cờ: Bán, Tháo đồ, Đổi chỗ, Xem chi tiết. Tự động đóng menu cũ khi mở menu mới.
  - **Tiêu chí nghiệm thu:** Chỉ tồn tại duy nhất một context menu tại một thời điểm.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: sell/equipment/swap legality is owned by canonical core actions; right-click/long-press menu lifetime and single-surface ownership are presentation/input work.
