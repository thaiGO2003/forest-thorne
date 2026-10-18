# WBS-067: Combat Result Modal & Loot Tally Overlay

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-067 · Phase UI
- **Nhánh đích:** `feat/ui/combat-result-modal-loot-tally-overlay`
- **Tham chiếu:** `§16.17, A18, A87, A121`
- **Phụ thuộc:** Deps: WBS-025, WBS-032, WBS-050
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-067: Combat Result Modal & Loot Tally Overlay** `§16.17, A18, A87, A121` *(Deps: WBS-025, WBS-032, WBS-050)*
  - **Mô tả:** Màn hình kết thúc trận đánh: Chiến thắng / Thất bại / Hòa, chi tiết vàng thưởng nhận được, vàng chuỗi thắng/thua, sát thủ bounty, hiển thị các hòm đồ nguyên liệu rơi ra và nút Vòng tiếp theo.
  - **Tiêu chí nghiệm thu:** Nhận thưởng idempotent: đóng/mở lại modal không được cấp quà lần 2.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: result/reward idempotency belongs to the core result handoff; this WBS is the modal/loot tally presentation and depends on unresolved WBS-032 per-unit tally semantics.
