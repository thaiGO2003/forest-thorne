# WBS-019: Combat Queue & Deterministic Interleaving Engine

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-019 · Phase COMBAT
- **Nhánh đích:** `feat/combat/combat-queue-deterministic-interleaving-engine`
- **Tham chiếu:** `§16.1, §16.14, A11`
- **Phụ thuộc:** Deps: WBS-004, WBS-005
- **Trạng thái WBS:** Chưa hoàn tất nghiệm thu (Issue #10 đang mở; đã có code và một phần test WBS-019).

## Nội dung
- [ ] **WBS-019: Combat Queue & Deterministic Interleaving Engine** `§16.1, §16.14, A11` *(Deps: WBS-004, WBS-005)*
  - **Mô tả:** Hàng đợi lượt đánh xác định: giới hạn cứng 20 chu kỳ. Quét phe TRÁI (cột 4→0, hàng 0→cuối) và phe PHẢI (cột 5→9, hàng 0→cuối). Chia chunk gồm ô trống và unit kế tiếp để đan xen L/R chuẩn xác.
  - **Tiêu chí nghiệm thu:** Ô trống tham gia định thời presentation nhưng không làm trôi thứ tự hành động thật.
  - **Audit Note (2026-11-01, Issue #17):** Test `tests/combat.test.ts` trước đây xác nhận một phần deterministic interleaving, nhưng chưa đủ để đóng WBS. Issue #10 vẫn mở: `turnOrder` và `turnTimeline` phân kỳ, `turnChunks` có thể làm mất lượt unit trùng ô, thiếu test death giữa cycle, golden quá brittle và bằng chứng Bun chưa tái lập được. Giữ plan ở `pending/` cho đến khi hoàn tất acceptance Issue #10; sau đó dùng `/plan-done` (không chuyển tay sang `done/`).
