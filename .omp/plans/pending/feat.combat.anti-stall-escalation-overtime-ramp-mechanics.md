# WBS-026: Anti-Stall Escalation & Overtime Ramp Mechanics

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-026 · Phase COMBAT
- **Nhánh đích:** `feat/combat/anti-stall-escalation-overtime-ramp-mechanics`
- **Tham chiếu:** `§16.14, A17`
- **Phụ thuộc:** Deps: WBS-019
- **Trạng thái WBS:** Hoàn thành (WBS)

## Nội dung
- [x] **WBS-026: Anti-Stall Escalation & Overtime Ramp Mechanics** `§16.14, A17` *(Deps: WBS-019)*
  - **Mô tả:** Cơ chế chống câu giờ: sau 100 hành động, mỗi 5 hành động tiếp theo tăng +0.2 hệ số sát thương toàn sân. Kết thúc trận đấu trả về số lượng sống sót, kiểm tra kết quả Hòa khi chạm trần 20 chu kỳ.
  - **Tiêu chí nghiệm thu:** Tăng sát thương lũy tiến, bẻ gãy thế trận cù nhầy; hòa cờ sau 20 chu kỳ.
  - **Audit Note:** ✓ Verify-combat audit: Passed. Tích hợp trực tiếp trong simulate() combat.ts.
