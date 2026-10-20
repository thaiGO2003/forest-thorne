# WBS-057: Shop Tray & Bench Strip Interface

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-057 · Phase UI
- **Nhánh đích:** `feat/ui/shop-tray-bench-strip-interface`
- **Tham chiếu:** `§14.4, §14.5, §14.7, A2, A3, A75, A107.4`
- **Phụ thuộc:** Deps: WBS-003, WBS-005, WBS-051, WBS-056
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-057: Shop Tray & Bench Strip Interface** `§14.4, §14.5, §14.7, A2, A3, A75, A107.4` *(Deps: WBS-003, WBS-005, WBS-051, WBS-056)*
  - **Mô tả:** Khay shop 5 offer baseline, lock/reroll, bench compact, vùng Sell và shared pager semantics cho các surface shop/bench có capacity động.
  - **Tiêu chí nghiệm thu:** Giá mua/bán và affordability đúng; Previous enabled iff `page > 0`, Next iff `page < maxPage`; `maxPage` dẫn xuất từ capacity owner thay vì hardcode và teardown hủy cả hai control.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: shop/bench economy and capacity mutations are core-owned; this WBS is tray/strip/pager presentation and interaction wiring, including A107.4 surface pagination.
