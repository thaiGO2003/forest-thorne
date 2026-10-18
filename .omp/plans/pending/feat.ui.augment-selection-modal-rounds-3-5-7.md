# WBS-063: Augment Selection Modal (Rounds 3, 5, 7)

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-063 · Phase UI
- **Nhánh đích:** `feat/ui/augment-selection-modal-rounds-3-5-7`
- **Tham chiếu:** `§14.15, A10`
- **Phụ thuộc:** Deps: WBS-010, WBS-050, WBS-056
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-063: Augment Selection Modal (Rounds 3, 5, 7)** `§14.15, A10` *(Deps: WBS-010, WBS-050, WBS-056)*
  - **Mô tả:** Hộp thoại chọn 1 trong 3 lõi nâng cấp: hiển thị biểu tượng, tên, mô tả chi tiết, xếp hạng độ hiếm (Tactical, Strong, Rare, Epic), và khóa toàn bộ tương tác cờ cho tới khi chọn xong.
  - **Tiêu chí nghiệm thu:** Không thể bấm bỏ qua; chọn xong áp dụng ngay hiệu ứng và tiếp tục ván đấu.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: augment offer/apply logic and phase gating are core-owned; modal lockout/card selection presentation remains UI integration.
