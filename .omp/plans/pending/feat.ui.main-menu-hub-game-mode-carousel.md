# WBS-054: Main Menu Hub & Game Mode Carousel

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-054 · Phase UI
- **Nhánh đích:** `feat/ui/main-menu-hub-game-mode-carousel`
- **Tham chiếu:** `§5.1, §5.2, A98, A116`
- **Phụ thuộc:** Deps: WBS-052, WBS-053
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-054: Main Menu Hub & Game Mode Carousel** `§5.1, §5.2, A98, A116` *(Deps: WBS-052, WBS-053)*
  - **Mô tả:** Giao diện Menu chính gồm các nút: Tiếp tục (kèm tóm tắt run cũ), Chơi mới, Cài đặt, Bộ sưu tập, Cây công nghệ, Pháo đài, Đấu trường, Bảng vinh danh, và liên kết mạng xã hội.
  - **Tiêu chí nghiệm thu:** Chỉ hiển thị nút Tiếp tục khi có bản lưu hợp lệ; chuyển mode mượt mà.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: menu/continue/mode carousel is player-flow presentation. Mode/run legality remains owned by core state; this WBS stays unchecked until the surface is integrated.
