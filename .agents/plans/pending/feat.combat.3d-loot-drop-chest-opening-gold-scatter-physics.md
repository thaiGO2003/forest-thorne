# WBS-031: 3D Loot Drop, Chest Opening & Gold Scatter Physics

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-031 · Phase COMBAT
- **Nhánh đích:** `feat/combat/3d-loot-drop-chest-opening-gold-scatter-physics`
- **Tham chiếu:** `§17, A18`
- **Phụ thuộc:** Deps: WBS-025, WBS-027
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-031: 3D Loot Drop, Chest Opening & Gold Scatter Physics** `§17, A18` *(Deps: WBS-025, WBS-027)*
  - **Mô tả:** Hiệu ứng 3D rơi hòm đồ thưởng: hòm gỗ/bạc/vàng rơi từ trên trời xuống ô địch chết, mở nắp văng nguyên liệu và đồng vàng bay lượn về phía kho tài nguyên người chơi.
  - **Tiêu chí nghiệm thu:** Hiệu ứng diễn ra trong 0.8s, không cản trở luồng bấm nút Vòng tiếp theo.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: reward math/loot ownership is already covered by WBS-025; this task is exclusively 3D chest/gold presentation physics and timing, so no additional non-visual gameplay logic is in scope.
