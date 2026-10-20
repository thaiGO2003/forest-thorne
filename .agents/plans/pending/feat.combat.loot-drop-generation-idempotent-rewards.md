# WBS-025: Loot Drop Generation & Idempotent Rewards

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-025 · Phase COMBAT
- **Nhánh đích:** `feat/combat/loot-drop-generation-idempotent-rewards`
- **Tham chiếu:** `§17, A18, A40`
- **Phụ thuộc:** Deps: WBS-019
- **Trạng thái WBS:** Hoàn thành (WBS)

## Nội dung
- [x] **WBS-025: Loot Drop Generation & Idempotent Rewards** `§17, A18, A40` *(Deps: WBS-019)*
  - **Mô tả:** Quy tắc rơi nguyên liệu theo loài (loài chim → lông, bò sát → vỏ,...) và trang bị theo sao địch. Tính toán vàng thắng trận, tiền thưởng sát thủ, và trả thưởng nguyên tử chống trùng lặp.
  - **Tiêu chí nghiệm thu:** Túi đầy thì không nhận thêm; phát thưởng nhiều lần không bị nhân đôi quà.
  - **Audit Note:** ✓ Verify-combat audit: Passed. Đã kiểm chứng qua tests/loot.test.ts.
