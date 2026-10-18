# WBS-088: Responsive Layout Engine (Desktop & Mobile Safe Areas)

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-088 · Phase POLISH
- **Nhánh đích:** `chore/polish/responsive-layout-engine-desktop-mobile-safe-areas`
- **Tham chiếu:** `§53, A58`
- **Phụ thuộc:** Deps: WBS-052, WBS-056
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-088: Responsive Layout Engine (Desktop & Mobile Safe Areas)** `§53, A58` *(Deps: WBS-052, WBS-056)*
  - **Mô tả:** Tối ưu hóa hiển thị responsive: tự động phát hiện màn hình dọc (portrait), màn hình ngang (landscape), tính toán vùng an toàn safe-area-inset cho iPhone tai thỏ/nốt ruồi, và tự sắp xếp lại các thanh HUD.
  - **Tiêu chí nghiệm thu:** Mọi nút bấm và quân cờ đều bấm được bằng một tay trên điện thoại mà không bị che khuất.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: safe-area and responsive HUD arrangement are presentation/layout concerns, not canonical gameplay-state rules.
