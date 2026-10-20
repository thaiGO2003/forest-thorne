# WBS-010: Augment Deck, Scoring & Selection Engine

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-010 · Phase FOUNDATION
- **Nhánh đích:** `feat/foundation/augment-deck-scoring-selection-engine`
- **Tham chiếu:** `§14.15, A10`
- **Phụ thuộc:** Deps: WBS-004
- **Trạng thái WBS:** Hoàn thành (WBS)

## Nội dung
- [x] **WBS-010: Augment Deck, Scoring & Selection Engine** `§14.15, A10` *(Deps: WBS-004)*
  - **Mô tả:** Kho lõi nâng cấp với công thức tính điểm (base + valueUnit*weight), phân hạng Tier (Tactical/Strong/Rare/Epic). Rút 3 lõi ngẫu nhiên ở vòng 3, 5, 7. Áp dụng hiệu ứng tức thời (vàng/XP) và tích lũy modifier.
  - **Tiêu chí nghiệm thu:** Không trùng augment đã chọn; score bands chuẩn xác 100% theo bảng trọng số A10.
  - **Audit Note:** ✓ Verify-foundation audit: Passed. Đã kiểm chứng qua tests/synergy-augments.test.ts.
