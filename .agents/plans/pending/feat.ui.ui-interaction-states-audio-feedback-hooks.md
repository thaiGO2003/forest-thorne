# WBS-072: UI Interaction States & Audio Feedback Hooks

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-072 · Phase UI
- **Nhánh đích:** `feat/ui/ui-interaction-states-audio-feedback-hooks`
- **Tham chiếu:** `§51, A45`
- **Phụ thuộc:** Deps: WBS-049
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-072: UI Interaction States & Audio Feedback Hooks** `§51, A45` *(Deps: WBS-049)*
  - **Mô tả:** Quy chuẩn tương tác UI cao cấp: hiệu ứng hover nhẹ, nút bấm thụt 1px khi nhấn (active press), âm thanh click phản hồi nhẹ nhàng, và âm báo cấm khi thao tác sai quy định.
  - **Tiêu chí nghiệm thu:** Mọi nút bấm trong game đều có phản hồi xúc giác/thị giác/âm thanh đồng điệu.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: hover/press/audio/haptic feedback is presentation feedback and must never alter action legality or gameplay outcome.
