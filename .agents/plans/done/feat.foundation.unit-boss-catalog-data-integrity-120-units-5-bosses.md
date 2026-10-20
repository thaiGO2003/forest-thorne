# WBS-002: Unit & Boss Catalog Data Integrity (120 Units + 5 Bosses)

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-002 · Phase FOUNDATION
- **Nhánh đích:** `feat/foundation/unit-boss-catalog-data-integrity-120-units-5-bosses`
- **Tham chiếu:** `§20, §21, A41, A42, A83, A84, A90`
- **Phụ thuộc:** Deps: WBS-001
- **Trạng thái WBS:** Hoàn thành (WBS)

## Nội dung
- [x] **WBS-002: Unit & Boss Catalog Data Integrity (120 Units + 5 Bosses)** `§20, §21, A41, A42, A83, A84, A90` *(Deps: WBS-001)*
  - **Mô tả:** Trích xuất tự động từ manifest A83/A84: 120 normal units + 5 bosses. Gồm đầy đủ stats 1★, skill prose tiếng Việt, rage costs, roles, factions, elements và cosmetic metadata.
  - **Tiêu chí nghiệm thu:** units.json (245KB) + catalog.ts type-safe lookup. UNIT_BY_ID chứa đủ 125 entries duy nhất.
  - **Audit Note:** ✓ Verify-foundation audit: Passed. Đã đối chiếu 120 unit + 5 boss khớp danh sách A42.
