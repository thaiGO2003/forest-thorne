# WBS-011: Save Persistence, Schema Migration & Co-op Slots (Envelope v4)

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-011 · Phase FOUNDATION
- **Nhánh đích:** `feat/foundation/save-persistence-schema-migration-co-op-slots-envelope-v4`
- **Tham chiếu:** `§10, A27, A37, A57, A104, A113`
- **Phụ thuộc:** Deps: WBS-004
- **Trạng thái WBS:** Hoàn thành (WBS)

## Nội dung
- [x] **WBS-011: Save Persistence, Schema Migration & Co-op Slots (Envelope v4)** `§10, A27, A37, A57, A104, A113` *(Deps: WBS-004)*
  - **Mô tả:** Format lưu trữ Envelope v4 với trình di chuyển schema (migration), kiểm định tính toàn vẹn (sanitize unit ids, clamp values), import/export chuỗi an toàn, xóa theo phạm vi và quản lý 4 slot lưu Co-op.
  - **Tiêu chí nghiệm thu:** Dữ liệu bẩn không làm crash game; swap slot máy chủ Co-op giữ nguyên quân cờ; unit rác bị loại bỏ.
  - **Audit Note:** ✓ Verify-foundation audit: Passed. 9/9 tests pass tests/persistence.test.ts.
