# WBS-055: Settings Panel & Keybinding Manager UI

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-055 · Phase UI
- **Nhánh đích:** `feat/ui/settings-panel-keybinding-manager-ui`
- **Tham chiếu:** `§6, A35, A44, A110`
- **Phụ thuộc:** Deps: WBS-012, WBS-050, WBS-051
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-055: Settings Panel & Keybinding Manager UI** `§6, A35, A44, A110` *(Deps: WBS-012, WBS-050, WBS-051)*
  - **Mô tả:** Giao diện bảng cài đặt trực quan: tab Âm thanh (âm lượng, mute), Hiển thị (độ phân giải, chất lượng), Lối chơi (tốc độ game), Bàn phím (gán lại phím nóng), và Quản lý dữ liệu lưu.
  - **Tiêu chí nghiệm thu:** Thay đổi cài đặt áp dụng tức thì qua cơ chế preview; có nút khôi phục mặc định.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: canonical settings/keybinding state is already owned by the settings store; this WBS is the panel/preview/control surface and therefore presentation-facing.
