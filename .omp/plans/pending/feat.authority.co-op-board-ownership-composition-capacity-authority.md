# WBS-094: Co-op Board Ownership, Composition & Capacity Authority

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-094 · Phase AUTHORITY COVERAGE
- **Nhánh đích:** `feat/authority/co-op-board-ownership-composition-capacity-authority`
- **Tham chiếu:** `A63`
- **Phụ thuộc:** Deps: WBS-004, WBS-005, WBS-006, WBS-011, WBS-033
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-094: Co-op Board Ownership, Composition & Capacity Authority** `A63` *(Deps: WBS-004, WBS-005, WBS-006, WBS-011, WBS-033)*
  - **Mô tả:** Canonical shared-board composition giữ mỗi player local board 5×5, compose 2P thành 10 rows và 4P thành 20 rows; map shared↔local row theo ownership span, lấy local slot từ session với fallback hợp lệ, và reject mọi remote mutation nếu mode không explicit shared-control.
  - **Tiêu chí nghiệm thu:** Shared/local mapping chỉ round-trip trong owned span; remote move/replace/sell là no-op; bench cap đúng `clamp(8 + benchUpgradeLevel × 6 + benchBonus, 1, 44)`, Creative ordinary bench = resolved cap − 1; inventory base capacity = owned board + bench và over-cap existing items vẫn visible/retrievable.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: added canonical local-row↔shared-row mapping in `src/board/geometry.ts` for 2P/4P ownership spans and hardened persisted co-op `localSlot` fallback in `src/core/save.ts` so invalid 2P/4P slots resolve to an allowed saved slot/P1. Existing bench/inventory capacity rules already satisfy A63. Fresh runtime-owner search still finds no `RTCPeerConnection`/`RTCDataChannel`, shared-control session state or remote move/replace/sell authorization layer under `src/`; therefore no production layer composes all player boards into one shared battlefield. WBS-094 stays unchecked rather than inventing multiplayer architecture.
