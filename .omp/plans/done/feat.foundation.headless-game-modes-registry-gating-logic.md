# WBS-014: Headless Game Modes Registry & Gating Logic

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-014 · Phase FOUNDATION
- **Nhánh đích:** `feat/foundation/headless-game-modes-registry-gating-logic`
- **Tham chiếu:** `§8, §55, A19, A46, A47, A60`
- **Phụ thuộc:** Deps: WBS-004
- **Trạng thái WBS:** Hoàn thành (WBS)

## Nội dung
- [x] **WBS-014: Headless Game Modes Registry & Gating Logic** `§8, §55, A19, A46, A47, A60` *(Deps: WBS-004)*
  - **Mô tả:** Định nghĩa cấu hình headless cho 4 chế độ: Endless PvE Classic, Endless PvE Fortress, PvP 4 Fortress, Creative Sandbox. Khởi tạo tài nguyên ban đầu, hệ thống bật/tắt (availability), và điều kiện thắng/thua (NO_HEARTS vs NO_UNITS).
  - **Tiêu chí nghiệm thu:** Mode config điều khiển trực tiếp logic round mà không hardcode rải rác; chuẩn hóa ID an toàn.
  - **Audit Note:** ✓ Verify-foundation audit: Đã kiểm chứng qua tests/modes-lifecycle.test.ts.
