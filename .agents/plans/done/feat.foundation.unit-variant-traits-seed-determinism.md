# WBS-017: Unit Variant Traits & Seed Determinism

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-017 · Phase FOUNDATION
- **Nhánh đích:** `feat/foundation/unit-variant-traits-seed-determinism`
- **Tham chiếu:** `§47, A79, A101`
- **Phụ thuộc:** Deps: WBS-002, WBS-004
- **Trạng thái WBS:** Hoàn thành (WBS)

## Nội dung
- [x] **WBS-017: Unit Variant Traits & Seed Determinism** `§47, A79, A101` *(Deps: WBS-002, WBS-004)*
  - **Mô tả:** Hệ thống biến thể chỉ số ngẫu nhiên có hạt giống cho từng unit sở hữu (Swift, Sturdy, Fierce, Mystical,...), bảo toàn qua save/load, đồng nhất giữa Planning, Combat và Thư viện.
  - **Tiêu chí nghiệm thu:** Variant seed không bị biến đổi sau chu kỳ combat hoặc đóng mở game.
  - **Audit Note:** ✓ Verify-foundation audit: Đã kiểm chứng qua tests/variants-equipment.test.ts.
