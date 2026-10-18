# WBS-060: Inventory Tray & Equipment Socketing UI

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-060 · Phase UI
- **Nhánh đích:** `feat/ui/inventory-tray-equipment-socketing-ui`
- **Tham chiếu:** `§14.9, §14.10, A6, A80, A85, A86`
- **Phụ thuộc:** Deps: WBS-006, WBS-051, WBS-056
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-060: Inventory Tray & Equipment Socketing UI** `§14.9, §14.10, A6, A80, A85, A86` *(Deps: WBS-006, WBS-051, WBS-056)*
  - **Mô tả:** Khay túi đồ hiển thị danh sách nguyên liệu và trang bị. Kéo trang bị gắn vào quân cờ (tối đa 3 slot), kiểm tra trùng loại, tính toán phí tháo đồ và nút Tháo toàn bộ trang bị.
  - **Tiêu chí nghiệm thu:** Hiển thị chính xác chi phí tháo đồ; trang bị gắn vào phản ánh ngay lên stats.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: equip/remove legality, slot limits and fees are core-owned; this WBS is inventory/socketing UI and immediate stat presentation.
