# WBS-003: Core Economy & Shop Odds Mathematical Engine

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-003 · Phase FOUNDATION
- **Nhánh đích:** `feat/foundation/core-economy-shop-odds-mathematical-engine`
- **Tham chiếu:** `§14.2, §14.4, §14.5, §14.7, A2, A3, A4, A5, A69`
- **Phụ thuộc:** Deps: WBS-001
- **Trạng thái WBS:** Hoàn thành (WBS)

## Nội dung
- [x] **WBS-003: Core Economy & Shop Odds Mathematical Engine** `§14.2, §14.4, §14.5, §14.7, A2, A3, A4, A5, A69` *(Deps: WBS-001)*
  - **Mô tả:** Thuật toán kinh tế chuẩn: XP mua 4 gold = 4 XP với carry-over level up (1..25), gold interest + streaks, deploy cap clamp(level+2,3,25), bench capacity, tỷ lệ shop odds 5 bậc chính xác 100%, sell value (1/3/5 x tier).
  - **Tiêu chí nghiệm thu:** 11 tests pass; tổng odds mọi level luôn đúng bằng 1.0; deploy cap đúng công thức.
  - **Audit Note:** ✓ Verify-foundation audit: Passed. 11/11 tests pass, commit a584197.
