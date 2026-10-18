# WBS-012: UI Settings Store & Shortcut Keybindings

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-012 · Phase FOUNDATION
- **Nhánh đích:** `feat/foundation/ui-settings-store-shortcut-keybindings`
- **Tham chiếu:** `§6, §34, A35, A44, A45, A66, A110`
- **Phụ thuộc:** Deps: WBS-001
- **Trạng thái WBS:** Hoàn thành (WBS)

## Nội dung
- [x] **WBS-012: UI Settings Store & Shortcut Keybindings** `§6, §34, A35, A44, A45, A66, A110` *(Deps: WBS-001)*
  - **Mô tả:** Lưu trữ cài đặt độc lập với run state (audio, display, gameplay, keyboard bindings). Hỗ trợ xem trước (preview debounce 200ms), đổi phím nóng theo ngữ cảnh (planning, combat, modal) không trùng lặp.
  - **Tiêu chí nghiệm thu:** Tách biệt hoàn toàn khỏi run state; reset phím theo context; không drift phím tắt.
  - **Audit Note:** ✓ Verify-foundation audit: Passed. Đã kiểm chứng write-version counter tránh leak timer.
