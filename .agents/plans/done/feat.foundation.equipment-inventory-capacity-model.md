# WBS-006: Equipment & Inventory Capacity Model

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-006 · Phase FOUNDATION
- **Nhánh đích:** `feat/foundation/equipment-inventory-capacity-model`
- **Tham chiếu:** `§14.9, §14.10, A6, A40, A80, A85`
- **Phụ thuộc:** Deps: WBS-004
- **Trạng thái WBS:** Hoàn thành (WBS)

## Nội dung
- [x] **WBS-006: Equipment & Inventory Capacity Model** `§14.9, §14.10, A6, A40, A80, A85` *(Deps: WBS-004)*
  - **Mô tả:** Túi đồ (item bag) sức chứa cơ bản = boardUnitCount + benchUnitCount + bonus. Giới hạn slot trang bị theo rage/skill cost (A14.10). Chi phí gỡ trang bị theo tier (T1=2, T2=7, T3=15) trừ unequipDiscount.
  - **Tiêu chí nghiệm thu:** Gỡ đồ atomic, trả đồ về bag, deduplicate key trang bị theo rule.
  - **Audit Note:** ✓ Verify-foundation audit: Được bổ sung từ phản hồi audit.
