# WBS-030: Canonical Game Speed Controller (1x, 1.5x, 2x)

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-030 · Phase COMBAT
- **Nhánh đích:** `feat/combat/canonical-game-speed-controller-1x-1-5x-2x`
- **Tham chiếu:** `§45, A56`
- **Phụ thuộc:** Deps: WBS-012, WBS-019
- **Trạng thái WBS:** Hoàn thành (WBS)

## Nội dung
- [x] **WBS-030: Canonical Game Speed Controller (1x, 1.5x, 2x)** `§45, A56` *(Deps: WBS-012, WBS-019)*
  - **Mô tả:** Bộ điều tốc trò chơi chính thống: đồng bộ tốc độ diễn hoạt Three.js, bước nhảy thời gian combat simulator và thời lượng hạt VFX theo 1 nguồn duy nhất (1x, 1.5x, 2x).
  - **Tiêu chí nghiệm thu:** Tăng tốc game không làm sai lệch kết quả sát thương hoặc làm đứt gãy sự kiện âm thanh.
  - **Audit Note:** ✓ Verify-combat audit: Passed. Tích hợp trong settings store.
