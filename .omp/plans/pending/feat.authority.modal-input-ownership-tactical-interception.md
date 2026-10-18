# WBS-098: Modal Input Ownership & Tactical Interception

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-098 · Phase AUTHORITY COVERAGE
- **Nhánh đích:** `feat/authority/modal-input-ownership-tactical-interception`
- **Tham chiếu:** `A88`
- **Phụ thuộc:** Deps: WBS-037, WBS-050, WBS-055, WBS-056, WBS-066, WBS-084
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-098: Modal Input Ownership & Tactical Interception** `A88` *(Deps: WBS-037, WBS-050, WBS-055, WBS-056, WBS-066, WBS-084)*
  - **Mô tả:** Major modal/blocking overlay là input owner cho keyboard/controller/pointer/wheel trong Planning và Combat; routing priority và board-pan legality tuân A88, không cho tactical action xuyên qua Settings/History/Library.
  - **Tiêu chí nghiệm thu:** Closing modal clear mọi pending drag/press/pan state của surface bị che; later pointer release không thể stale buy/move/sell/equip/craft; step-combat/audio toggle/back action đều bị gate đúng modal/phase ownership.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: `src/ui/modalManager.ts` owns single-modal stack, backdrop dismissal and Escape close only. It does not implement A88 Combat/Planning pointer-move/down/wheel priority, phase-gated shortcuts, board-pan start legality, or clearing obscured drag/press/pan state on close. Those are caller-level input/presentation integrations; WBS-098 stays unchecked.
