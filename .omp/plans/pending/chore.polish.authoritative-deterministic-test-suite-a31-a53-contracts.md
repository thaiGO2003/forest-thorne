# WBS-090: Authoritative Deterministic Test Suite (A31/A53 Contracts)

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-090 · Phase POLISH
- **Nhánh đích:** `chore/polish/authoritative-deterministic-test-suite-a31-a53-contracts`
- **Tham chiếu:** `§54, §56, A31, A53`
- **Phụ thuộc:** Deps: WBS-004, WBS-019, WBS-033
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-090: Authoritative Deterministic Test Suite (A31/A53 Contracts)** `§54, §56, A31, A53` *(Deps: WBS-004, WBS-019, WBS-033)*
  - **Mô tả:** Bộ kiểm thử tự động toàn diện: đảm bảo 100% các hợp đồng nghiệm thu toán học của A31 (hình học bàn cờ) và A53 (tính toán chiến trận) luôn luôn pass trong CI/CD trước khi xuất bản.
  - **Tiêu chí nghiệm thu:** Suite kiểm thử chạy độc lập, tái lập xác định trên mọi môi trường Node/Vitest.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: deterministic geometry/combat coverage is real (`tests/geometry.test.ts` covers A31 board/ownership primitives and `tests/combat.test.ts` covers repeatable simulation plus authority-backed combat slices), but WBS-090 requires the complete A31/A53 acceptance matrix. A53 explicitly includes co-op signalling/transport/sync, PvP Fortress and mods whose runtime owners are absent, so their deterministic harness coverage cannot exist yet. Fresh focused verification across geometry/persistence/preview/Creative/encounter/combat/Fortress/History passed 8 files / 90 tests; that does not satisfy the missing runtime rows, so WBS-090 stays unchecked.
