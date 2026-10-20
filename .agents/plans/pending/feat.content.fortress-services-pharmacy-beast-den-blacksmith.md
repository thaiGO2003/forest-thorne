# WBS-077: Fortress Services (Pharmacy, Beast Den, Blacksmith)

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-077 · Phase CONTENT
- **Nhánh đích:** `feat/content/fortress-services-pharmacy-beast-den-blacksmith`
- **Tham chiếu:** `§28, A117.3`
- **Phụ thuộc:** Deps: WBS-076
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-077: Fortress Services (Pharmacy, Beast Den, Blacksmith)** `§28, A117.3` *(Deps: WBS-076)*
  - **Mô tả:** Các dịch vụ tương tác đặc thù tại các điểm dừng Pháo đài: Dược quán (hồi máu, tăng nộ khởi đầu, mua thuốc kích thích), Hang dã thú (thu phục thú hoang miễn phí), Lò rèn (nâng cấp tier trang bị, rèn đồ hiếm).
  - **Tiêu chí nghiệm thu:** Mỗi dịch vụ chỉ được tương tác 1 lần duy nhất trước khi chuyển sang tầng kế tiếp.
  - **Audit Note:** ⚠ Logic-only re-check 2026-10-05: A117.3-A117.5 Pharmacy/Beast Den/Blacksmith formulas and one-shot core mutations remain implemented. Repository call-graph search still finds the canonical service wrappers only at their definitions under `src/core/run.ts`; no production owner persists service completion then continues Planning. WBS-077 stays unchecked.
