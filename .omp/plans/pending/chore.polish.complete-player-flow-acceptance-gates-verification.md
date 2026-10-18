# WBS-092: Complete Player-Flow Acceptance Gates Verification

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-092 · Phase POLISH
- **Nhánh đích:** `chore/polish/complete-player-flow-acceptance-gates-verification`
- **Tham chiếu:** `§54, §56`
- **Phụ thuộc:** Deps: WBS-054, WBS-056, WBS-066, WBS-067, WBS-074
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-092: Complete Player-Flow Acceptance Gates Verification** `§54, §56` *(Deps: WBS-054, WBS-056, WBS-066, WBS-067, WBS-074)*
  - **Mô tả:** Kiểm thử tự động chuỗi trải nghiệm người chơi: 1. Khởi động → Menu → New Game → Planning → Combat → Result → Next Round; 2. Save & Continue; 3. Lựa chọn chế độ; 4. Thư viện 3D; 5. Bàn chế tạo; 6. Cây công nghệ; 7. Hoàn tất Hướng dẫn.
  - **Tiêu chí nghiệm thu:** Không có điểm nghẽn, không có ngõ cụt, không có trạng thái kẹt nút trong toàn bộ hành trình.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: no Playwright/e2e/player-flow suite exists in the live tree. Core state machines cover several non-visual transitions, but WBS-092 requires full browser-facing Menu → Planning → Combat → Result, Continue, Library, Crafting, Tech and Tutorial journeys with no dead-end UI state. That acceptance surface is presentation/browser integration outside this logic-only pass, so WBS-092 stays unchecked.
