# WBS-034: 3D Voxel Arena & Terrain Meshes (InstancedMesh)

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-034 · Phase WORLD
- **Nhánh đích:** `feat/world/3d-voxel-arena-terrain-meshes-instancedmesh`
- **Tham chiếu:** `§11.5, §11.6, §11.7, A25, A91.2, A91.3`
- **Phụ thuộc:** Deps: WBS-033
- **Trạng thái WBS:** Hoàn thành (WBS)

## Nội dung
- [x] **WBS-034: 3D Voxel Arena & Terrain Meshes (InstancedMesh)** `§11.5, §11.6, §11.7, A25, A91.2, A91.3` *(Deps: WBS-033)*
  - **Mô tả:** Dựng sân đấu Three.js hoàn chỉnh bằng InstancedMesh tối ưu: gạch cỏ/đất, dòng sông hoạt họa uốn lượn, vòng gỗ nâu, thềm bench, hệ thống chiếu sáng 3 pha (menu, planning, combat) và bầu trời mây procedural.
  - **Tiêu chí nghiệm thu:** Hiển thị đầy đủ 50 ô cờ + sông + vành đai; hiệu năng cao nhờ gom draw call qua instancing.
  - **Audit Note:** ✓ Verify-world audit: Passed. Đã kiểm chứng render pixel thật qua tests/three/.
