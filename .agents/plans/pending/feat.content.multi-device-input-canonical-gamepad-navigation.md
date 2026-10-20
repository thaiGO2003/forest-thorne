# WBS-084: Multi-Device Input & Canonical Gamepad Navigation

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-084 · Phase CONTENT
- **Nhánh đích:** `feat/content/multi-device-input-canonical-gamepad-navigation`
- **Tham chiếu:** `§34, A65`
- **Phụ thuộc:** Deps: WBS-012, WBS-052
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-084: Multi-Device Input & Canonical Gamepad Navigation** `§34, A65` *(Deps: WBS-012, WBS-052)*
  - **Mô tả:** Mouse/keyboard/touch/gamepad cùng dùng canonical actions. Gamepad baseline: D-pad/left stick (dead-zone 0.55), A confirm, B cancel, X Shop, Y Board, LB Bench, RB Shop, Back Settings, Start combat khi legal; directional repeat 170ms rồi 120ms.
  - **Tiêu chí nghiệm thu:** Focus chuyển spatial giữa Shop/Bench/local Board bằng capacity/row ownership thật; major modal suspend board/shop/bench navigation; disconnect clears controller cursor, reconnect resume không restart scene.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: A65 defines controller mapping, dead-zone/repeat timing, spatial focus, modal suspension and disconnect/reconnect state, but the live tree has no canonical gamepad/controller state owner. Fresh searches found no `navigator.getGamepads`, `gamepadconnected`/`gamepaddisconnected`, axis/button polling or controller-state module; existing pointer/UI handlers do not constitute that runtime navigation contract. WBS-084 stays unchecked as input/presentation ownership work.
