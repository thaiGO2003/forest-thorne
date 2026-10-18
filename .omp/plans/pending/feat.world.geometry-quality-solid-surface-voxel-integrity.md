# WBS-041: Geometry Quality & Solid Surface Voxel Integrity

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-041 · Phase WORLD
- **Nhánh đích:** `feat/world/geometry-quality-solid-surface-voxel-integrity`
- **Tham chiếu:** `§22.4, A24, A90`
- **Phụ thuộc:** Deps: WBS-038
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-041: Geometry Quality & Solid Surface Voxel Integrity** `§22.4, A24, A90` *(Deps: WBS-038)*
  - **Mô tả:** Kiểm tra tính liền mạch giải phẫu của mô hình: không có đầu cổ đứt rời, không có tay chân trôi nổi lơ lửng, loại bỏ các mặt khuất bên trong (internal face culling), vật liệu đặc solid không bị nhìn xuyên thấu.
  - **Tiêu chí nghiệm thu:** Mô hình liền khối, bề mặt kín, nhìn rõ góc cạnh và đặc điểm nhận dạng ở khoảng cách bàn cờ.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: geometry integrity/internal-face culling is asset/render quality work, not a gameplay-state contract.
