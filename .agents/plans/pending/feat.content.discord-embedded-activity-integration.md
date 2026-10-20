# WBS-083: Discord Embedded Activity Integration

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-083 · Phase CONTENT
- **Nhánh đích:** `feat/content/discord-embedded-activity-integration`
- **Tham chiếu:** `§31, A51.2`
- **Phụ thuộc:** Deps: WBS-052
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-083: Discord Embedded Activity Integration** `§31, A51.2` *(Deps: WBS-052)*
  - **Mô tả:** Tích hợp Discord Embedded App SDK: xác thực người dùng qua Discord token, lấy avatar/tên người dùng hiển thị trong game, tự động điều chỉnh khung nhìn iframe và hỗ trợ mời bạn bè cùng phòng.
  - **Tiêu chí nghiệm thu:** Tự động tắt nhẹ nhàng và chạy độc lập bình thường khi chơi ngoài trình duyệt web thông thường.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: Discord authentication/avatar/iframe/invite behavior is platform integration, not non-visual gameplay logic.
