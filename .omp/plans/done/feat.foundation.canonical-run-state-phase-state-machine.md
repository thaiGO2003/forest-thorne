# WBS-004: Canonical Run State & Phase State Machine

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-004 · Phase FOUNDATION
- **Nhánh đích:** `feat/foundation/canonical-run-state-phase-state-machine`
- **Tham chiếu:** `§3, §8, §9, A1, A19, A62, A103, A114`
- **Phụ thuộc:** Deps: WBS-001, WBS-002, WBS-003
- **Trạng thái WBS:** Hoàn thành (WBS)

## Nội dung
- [x] **WBS-004: Canonical Run State & Phase State Machine** `§3, §8, §9, A1, A19, A62, A103, A114` *(Deps: WBS-001, WBS-002, WBS-003)*
  - **Mô tả:** State máy chủ thuần dữ liệu serializable (RunState) với vòng đời 4 pha: PLANNING → AUGMENT → COMBAT → GAME_OVER. Các hàm mutation nguyên tử (mua, bán, reroll, lock, addXp).
  - **Tiêu chí nghiệm thu:** Trạng thái không chứa UI/ThreeJS; mutate rollback khi không đủ tiền hoặc vi phạm điều kiện.
  - **Audit Note:** ✓ Verify-foundation audit: Dependency WBS-002/003 đã được cập nhật chính xác.
