# WBS-081: Creative Sandbox Testing Environment

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-081 · Phase CONTENT
- **Nhánh đích:** `feat/content/creative-sandbox-testing-environment`
- **Tham chiếu:** `§14.20, A19`
- **Phụ thuộc:** Deps: WBS-004, WBS-014, WBS-050
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-081: Creative Sandbox Testing Environment** `§14.20, A19` *(Deps: WBS-004, WBS-014, WBS-050)*
  - **Mô tả:** Chế độ Sáng tạo không giới hạn tài nguyên: tự do cộng vàng/máu, triệu hồi bất kỳ quân cờ nào từ danh mục 120 tướng, tự xếp đội hình địch để thử nghiệm sát thương và combo tộc hệ.
  - **Tiêu chí nghiệm thu:** Công cụ đắc lực cho người chơi tự do sáng tạo và kiểm thử meta chiến thuật.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: A46 core Creative semantics are implemented: infinite-economy routing, persisted sandbox cloning/moving/removal, same-side 3-copy cascade merge, sale value, hydration normalization, and canonical RIGHT-side enemy override/preview. Repository call-graph search still finds no production combat-start owner that consumes `creativeEnemyOverride(...)` / persisted `enemyPreview(...)` as the RIGHT argument to `simulate(...)`; exact manual enemy formation is therefore not end-to-end owned and WBS-081 stays unchecked.
