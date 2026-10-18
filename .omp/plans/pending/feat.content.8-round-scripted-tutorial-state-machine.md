# WBS-074: 8-Round Scripted Tutorial State Machine

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-074 · Phase CONTENT
- **Nhánh đích:** `feat/content/8-round-scripted-tutorial-state-machine`
- **Tham chiếu:** `§15, A94, A108`
- **Phụ thuộc:** Deps: WBS-004, WBS-056, WBS-066
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-074: 8-Round Scripted Tutorial State Machine** `§15, A94, A108` *(Deps: WBS-004, WBS-056, WBS-066)*
  - **Mô tả:** Cỗ máy trạng thái hướng dẫn tân thủ 8 vòng đấu theo kịch bản chuẩn: Vòng 1 Mua & Đặt cờ, Vòng 2 Reroll & Kinh tế, Vòng 3 Bán cờ & Nhật ký, Vòng 4 Soi cờ & Tooltip, Vòng 5 Gắn Giáp Máu, Vòng 6 Ghép Bùa Xanh, Vòng 7 Chọn Lõi, Vòng 8 Đánh Boss & Tốt nghiệp.
  - **Tiêu chí nghiệm thu:** Khóa cứng các hành động nằm ngoài kịch bản; có nút Bỏ qua hướng dẫn (Skip) giải phóng hoàn toàn.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-04: A94/A108 core state machine, canonical action gates, skip release, and tutorial persistence pass targeted coverage. Master HUD/Combat Scene integration plus UI-originated events (`open_history`, `close_history`, `open_settings`, `close_settings`, `show_attack_preview`) remain presentation integration work, so WBS-074 stays unchecked.
