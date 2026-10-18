# WBS-053: Loading Scene & Interactive Bubble Minigame

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-053 · Phase UI
- **Nhánh đích:** `feat/ui/loading-scene-interactive-bubble-minigame`
- **Tham chiếu:** `§4.1, A55.1, A97`
- **Phụ thuộc:** Deps: WBS-052
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-053: Loading Scene & Interactive Bubble Minigame** `§4.1, A55.1, A97` *(Deps: WBS-052)*
  - **Mô tả:** Màn hình tải game với thanh tiến trình mượt mà, minigame tương tác bắn bong bóng thư giãn trong lúc chờ, xử lý tải lười (lazy load) tài nguyên phụ không chặn trải nghiệm.
  - **Tiêu chí nghiệm thu:** Tải thất bại 1 asset trang trí không làm treo đứng toàn bộ tiến trình nạp game.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: loading progress, bubble minigame and decorative lazy-load failure handling are presentation/asset-loading concerns, not canonical gameplay state.
