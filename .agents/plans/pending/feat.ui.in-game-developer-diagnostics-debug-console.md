# WBS-073: In-Game Developer Diagnostics & Debug Console

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-073 · Phase UI
- **Nhánh đích:** `feat/ui/in-game-developer-diagnostics-debug-console`
- **Tham chiếu:** `§42, A30, A105`
- **Phụ thuộc:** Deps: WBS-050
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-073: In-Game Developer Diagnostics & Debug Console** `§42, A30, A105` *(Deps: WBS-050)*
  - **Mô tả:** Debug surface từ menu với structured diagnostics cho phase, mode, round, board profile, selected unit, queue/action, network state và presentation health; hỗ trợ inspect live state, wireframe/resource/debug views.
  - **Tiêu chí nghiệm thu:** Debug inspect không mutate normal progression trừ explicit cheat/debug action; production thường không expose destructive debug controls; diagnostics phản ánh state hiện hành thay vì snapshot stale.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: diagnostics/debug surfaces inspect existing state but are developer tooling rather than gameplay logic. No new runtime mechanic should be invented to satisfy this WBS.
