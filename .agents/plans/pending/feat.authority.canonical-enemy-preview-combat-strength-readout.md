# WBS-095: Canonical Enemy Preview & Combat-Strength Readout

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-095 · Phase AUTHORITY COVERAGE
- **Nhánh đích:** `feat/authority/canonical-enemy-preview-combat-strength-readout`
- **Tham chiếu:** `A68`
- **Phụ thuộc:** Deps: WBS-004, WBS-024, WBS-056, WBS-078
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-095: Canonical Enemy Preview & Combat-Strength Readout** `A68` *(Deps: WBS-004, WBS-024, WBS-056, WBS-078)*
  - **Mô tả:** Planning preview dùng chính encounter data của current round: reuse persisted same-round preview, Creative manual RIGHT units override procedural generation, co-op host là generator duy nhất, guest không tự reroll; Fortress budget multiplier theo node normal/blacksmith/elite/boss.
  - **Tiêu chí nghiệm thu:** Persist preview units+round+budget; combat power đúng công thức A68 và dead current power = 0; team HP/power status tính riêng LEFT/RIGHT; metric chỉ informational, tuyệt đối không đổi targeting/damage/matchmaking/outcome.
  - **Audit Note:** ⚠ Logic-only reconciliation 2026-10-10: production `src/app/screens.ts` now calls `bridge.prepareEnemyPreview()` during Planning, while `src/app/bridge.ts` persists generated previews and `startCombat()` reuses `enemyPreview(s)` same-round units for `simulate(...)`; the prior "no production combat-start owner" finding is obsolete. Core Creative override and Fortress budget paths remain canonical. However, no production caller passes `EnemyPreviewOptions.isHost/sharedPreview/sharedPreviewRound/sharedEnemyBudget/players`, so co-op host-only generation and guest no-reroll are still unowned end-to-end. WBS-095 stays unchecked.
