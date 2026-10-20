# WBS-039: Five Player-Facing Animation Loops

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-039 · Phase WORLD
- **Nhánh đích:** `feat/world/five-player-facing-animation-loops`
- **Tham chiếu:** `§22.2, A24, A112`
- **Phụ thuộc:** Deps: WBS-038
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-039: Five Player-Facing Animation Loops** `§22.2, A24, A112` *(Deps: WBS-038)*
  - **Mô tả:** Bộ 5 trạng thái diễn hoạt chuẩn: 1. Idle (thở nhịp nhàng), 2. Attack (vung đòn/bắn tia), 3. Skill (tụ năng lượng/tung chiêu), 4. Take Hit (giật lùi/lóe sáng), 5. Move (chạy/lướt theo địa hình).
  - **Tiêu chí nghiệm thu:** Chuyển đổi mượt mà giữa các animation clips; không bị giật khung hình khi reset loop.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: the five authored animation loops are renderer/model playback behavior. Combat semantic actions are covered separately; no additional headless gameplay mutation is owned here.
