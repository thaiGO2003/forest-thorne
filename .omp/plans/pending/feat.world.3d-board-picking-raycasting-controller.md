# WBS-037: 3D Board Picking & Raycasting Controller

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-037 · Phase WORLD
- **Nhánh đích:** `feat/world/3d-board-picking-raycasting-controller`
- **Tham chiếu:** `§13, §14.3, A26, A75`
- **Phụ thuộc:** Deps: WBS-034, WBS-035, WBS-036
- **Trạng thái WBS:** Hoàn thành (WBS)

## Nội dung
- [x] **WBS-037: 3D Board Picking & Raycasting Controller** `§13, §14.3, A26, A75` *(Deps: WBS-034, WBS-035, WBS-036)*
  - **Mô tả:** Trình bắt sự kiện con trỏ/cảm ứng chuột raycasting lên các ô bàn cờ 3D, ánh xạ tọa độ world sang ô logic, hiển thị khung highlight tương tác (ô hợp lệ màu xanh, ô cấm màu đỏ, vùng đánh skill).
  - **Tiêu chí nghiệm thu:** Bắt chính xác ô cờ ngay cả khi camera xoay nghiêng; không bắt nhầm ô sông giữa sân.
  - **Audit Note:** ✅ Logic-only completion 2026-10-05: `src/world/boardPicking.ts` owns Pointer Events → canvas-relative NDC → Three.js raycast → canonical `worldToLogical()`; planning unit picking reuses the same canvas mapping, river geometry resolves to no logical cell, and signed-zero boundary coordinates are normalized. Targeted `board-picking+arena-mapping+planning-unit-manager` 9/9 pass, typecheck pass, and tilted-camera SSR smoke picked logical (9,4) with canvas offset while rejecting river geometry. Highlight colors/VFX/UI chrome remain presentation-only and are not claimed by this headless completion.
