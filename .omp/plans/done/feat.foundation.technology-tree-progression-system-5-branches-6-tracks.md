# WBS-008: Technology Tree Progression System (5 Branches + 6 Tracks)

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-008 · Phase FOUNDATION
- **Nhánh đích:** `feat/foundation/technology-tree-progression-system-5-branches-6-tracks`
- **Tham chiếu:** `§14.13, A8, A111`
- **Phụ thuộc:** Deps: WBS-004
- **Trạng thái WBS:** Hoàn thành (WBS)

## Nội dung
- [x] **WBS-008: Technology Tree Progression System (5 Branches + 6 Tracks)** `§14.13, A8, A111` *(Deps: WBS-004)*
  - **Mô tả:** 25 node cốt lõi thuộc 5 chuỗi (VET, EXPLORE, ECON, MIL, CRAFT) + 6 tracks mở rộng 4 stage + capstones điều kiện kép. Kiểm tra tiền đề prerequisite, tính giá infinite node, cộng delta vào run state.
  - **Tiêu chí nghiệm thu:** canResearch(), research() atomic, techModifiers() trả % buff chuẩn xác cho combat.
  - **Audit Note:** ✓ Verify-foundation audit: Passed. Đầy đủ dữ liệu node costs và requirements theo A8.
