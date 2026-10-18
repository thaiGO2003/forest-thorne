# WBS-021: Status Effects, Crowd Control Hierarchy & Shield Mechanics

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-021 · Phase COMBAT
- **Nhánh đích:** `feat/combat/status-effects-crowd-control-hierarchy-shield-mechanics`
- **Tham chiếu:** `§16.8, §16.9, §16.11, A14, A15, A73`
- **Phụ thuộc:** Deps: WBS-019
- **Trạng thái WBS:** Hoàn thành (WBS)

## Nội dung
- [x] **WBS-021: Status Effects, Crowd Control Hierarchy & Shield Mechanics** `§16.8, §16.9, §16.11, A14, A15, A73` *(Deps: WBS-019)*
  - **Mô tả:** Các hiệu ứng trạng thái thời gian thực: DoT (chảy máu, thiêu đốt, nhiễm độc), khống chế theo độ ưu tiên (đóng băng → choáng → ngủ), câm lặng chặn skill, khiêu khích taunt, và trừ giáp/kháng phép.
  - **Tiêu chí nghiệm thu:** Trừ khiên trước rồi mới trừ HP; unit hết máu emit hit trước rồi mới emit death.
  - **Audit Note:** ✓ Verify-combat audit: Passed. Đã fix lỗi thứ tự replay sự kiện gây chết quân.
