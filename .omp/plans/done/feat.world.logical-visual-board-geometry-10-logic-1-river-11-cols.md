# WBS-033: Logical & Visual Board Geometry (10 Logic + 1 River = 11 Cols)

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-033 · Phase WORLD
- **Nhánh đích:** `feat/world/logical-visual-board-geometry-10-logic-1-river-11-cols`
- **Tham chiếu:** `§11.1, §11.2, §11.3, §11.4, A31`
- **Phụ thuộc:** Deps: WBS-001
- **Trạng thái WBS:** Hoàn thành (WBS)

## Nội dung
- [x] **WBS-033: Logical & Visual Board Geometry (10 Logic + 1 River = 11 Cols)** `§11.1, §11.2, §11.3, §11.4, A31` *(Deps: WBS-001)*
  - **Mô tả:** Mô hình hình học bàn cờ 3D: 10 cột logic + 1 cột sông phân cách = 11 cột hiển thị, 5 hàng, 50 ô chiến trường, 36 ô vành đai gỗ nâu bao quanh, và 44 ô hàng chờ bench ngoài cùng. Hàm toLogical/toVisual/cellToWorld.
  - **Tiêu chí nghiệm thu:** Hàng sông nằm ở giữa (x=5) không làm lệch index logic; ánh xạ tọa độ 2 chiều hoàn hảo.
  - **Audit Note:** ✓ Verify-world audit: Passed. Đã kiểm chứng qua tests/geometry.test.ts và tests/arena-mapping.test.ts.

## Xác minh ngày 2026-10-19
- Mọi ô logic của solo (50), coop2 (100), coop4 (200) round-trip qua toVisual/toLogical, tách riêng cột sông x=5.
- Ring nâu đúng 36 ô, bench đúng 44 ô; các trường hợp tọa độ biên, phân số và ngoài bàn bị từ chối.
- Targeted Vitest: `tests/geometry.test.ts` và `tests/arena-mapping.test.ts` — 12/12 pass; `corepack pnpm typecheck` — pass.
- `createArena` Three.js và ánh xạ world được kiểm tra trong test; browser WebGL trực tiếp chưa xác minh được vì môi trường browser thiếu WebGL.
