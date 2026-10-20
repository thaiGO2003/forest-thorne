# WBS-009: Synergy Thresholds, Trait Counters & Counter Matrices

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-009 · Phase FOUNDATION
- **Nhánh đích:** `feat/foundation/synergy-thresholds-trait-counters-counter-matrices`
- **Tham chiếu:** `§14.14, §21, A9, A82`
- **Phụ thuộc:** Deps: WBS-002, WBS-004
- **Trạng thái WBS:** Hoàn thành (WBS)

## Nội dung
- [x] **WBS-009: Synergy Thresholds, Trait Counters & Counter Matrices** `§14.14, §21, A9, A82` *(Deps: WBS-002, WBS-004)*
  - **Mô tả:** Tính toán mốc kích hoạt Hệ (Class), Tộc (Faction), Nguyên tố (Element) ở các mốc 2/4/6 trên các quân cờ deploy hợp lệ. Hỗ trợ virtual echo counts từ augments/tech. Tính toán bảng khắc chế nguyên tố và class (+50%).
  - **Tiêu chí nghiệm thu:** Trả về active threshold, next threshold, và bảng bonus stats chuẩn A9.
  - **Audit Note:** ✓ Verify-foundation audit: Tách biệt rõ ràng với augment engine.
