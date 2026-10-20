# WBS-097: Battle-Start Unit Materialization Order & Single-Apply Guard

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-097 · Phase AUTHORITY COVERAGE
- **Nhánh đích:** `feat/authority/battle-start-unit-materialization-order-single-apply-guard`
- **Tham chiếu:** `A77`
- **Phụ thuộc:** Deps: WBS-004, WBS-005, WBS-009, WBS-017, WBS-019, WBS-023
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-097: Battle-Start Unit Materialization Order & Single-Apply Guard** `A77` *(Deps: WBS-004, WBS-005, WBS-009, WBS-017, WBS-019, WBS-023)*
  - **Mô tả:** Materialize fresh combat records exactly once từ owned state theo order authority: catalog/star/base → enemy AI/mode scaling → player aug/tech → empty transient status/mod payload → equipment → variant traits → environment → final formation/synergies → remaining opening rage/shield → authoritative combat record.
  - **Tiêu chí nghiệm thu:** Persistent owned state không bị mutate bởi temporary combat initialization; reconnect/presentation refresh không reapply bất kỳ modifier nào; order-sensitive modifiers có deterministic regression coverage.
  - **Audit Note:** ⚠ Logic-only reconciliation 2026-10-10: production `src/app/bridge.ts` now owns Planning→Combat→result application and applies player/AI bonuses, environment, equipment and variant inputs through `makeFighter(...)`/`simulate(...)`; the prior "no production orchestration caller" finding is obsolete. A77 single-apply is still not satisfied: the bridge first materializes a presentation `roster` with `makeFighter(...)`, then `simulate(...)` independently calls `makeFighter(...)` again for a second fighter set, so one authoritative combat record is not reused across simulation/presentation. WBS-097 stays unchecked until materialization is exactly-once and reused.
