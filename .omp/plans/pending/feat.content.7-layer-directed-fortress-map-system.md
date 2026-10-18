# WBS-076: 7-Layer Directed Fortress Map System

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-076 · Phase CONTENT
- **Nhánh đích:** `feat/content/7-layer-directed-fortress-map-system`
- **Tham chiếu:** `§28, A20, A117`
- **Phụ thuộc:** Deps: WBS-004, WBS-014, WBS-050
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-076: 7-Layer Directed Fortress Map System** `§28, A20, A117` *(Deps: WBS-004, WBS-014, WBS-050)*
  - **Mô tả:** Bản đồ đường đi chiến thuật 7 tầng cho chế độ Endless PvE Fortress: các nhánh rẽ lựa chọn giữa Quái thường (battle), Tinh anh (elite), Trùm (boss), Chợ (shop), Dược quán (pharmacy), Hang dã thú (beast_den), Lò rèn (blacksmith).
  - **Tiêu chí nghiệm thu:** Tạo nhánh ngẫu nhiên theo hạt giống; người chơi chỉ có thể tiến lên, không thể lùi lại tầng cũ.
  - **Audit Note:** ⚠ Logic-only re-check 2026-10-05: A20/A117 core graph remains deterministic by seed, preserves the authored 7-layer composition/all-to-next edges, latches one pending node, advances only to `stepIndex + 1`, regenerates after layer 7, and hydrates route progress without backtracking. Repository call-graph search still finds `selectRunFortressNode(...)` / `completeRunFortressNode(...)` only at their definitions under `src/`; persist-before-route and pending-node resume therefore remain unowned in production. WBS-076 stays unchecked.
