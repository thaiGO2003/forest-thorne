# WBS-066: Combat Phase HUD, Turn Tracker & Speed Controls

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-066 · Phase UI
- **Nhánh đích:** `feat/ui/combat-phase-hud-turn-tracker-speed-controls`
- **Tham chiếu:** `§16.16, §16.19, A56, A95, A119`
- **Phụ thuộc:** Deps: WBS-019, WBS-030, WBS-051
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-066: Combat Phase HUD, Turn Tracker & Speed Controls** `§16.16, §16.19, A56, A95, A119` *(Deps: WBS-019, WBS-030, WBS-051)*
  - **Mô tả:** Giao diện thời gian thực trong giao tranh: thanh tổng lực chiến 2 phe, hàng đợi lượt đánh kế tiếp, bảng thông báo sát thương thời gian thực và nút chuyển đổi tốc độ (1x, 1.5x, 2x).
  - **Tiêu chí nghiệm thu:** Tăng tốc độ game chỉ thay đổi thời gian diễn hoạt, không đổi kết quả tính toán.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: deterministic combat and canonical speed/staging contracts are already core-owned; turn tracker, real-time log and speed-control HUD are presentation surfaces.
