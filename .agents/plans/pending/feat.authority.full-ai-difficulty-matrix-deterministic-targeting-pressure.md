# WBS-100: Full AI Difficulty Matrix & Deterministic Targeting Pressure

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-100 · Phase AUTHORITY COVERAGE
- **Nhánh đích:** `feat/authority/full-ai-difficulty-matrix-deterministic-targeting-pressure`
- **Tham chiếu:** `A102`
- **Phụ thuộc:** Deps: WBS-024, WBS-029
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-100: Full AI Difficulty Matrix & Deterministic Targeting Pressure** `A102` *(Deps: WBS-024, WBS-029)*
  - **Mô tả:** Freeze toàn bộ A102 numeric knobs cho solo/co-op/Creative/Tutorial: HP/ATK/MATK/rage, random-target chance, team growth cadence/cap, budget/level/max-tier pressure, max-star/guaranteed-star/chance bonuses và equipment cadence/cap/tier.
  - **Tiêu chí nghiệm thu:** Unknown difficulty normalize MEDIUM trừ setup flow explicit khác; AI action order `stunned→SKIP; target; no target→SKIP; full rage skill; disarmed→SKIP; ATTACK`; taunt precedence và melee/ranged/Assassin target ordering side-aware deterministic với injected RNG.
  - **Audit Note:** ⚠ Logic-only re-verification 2026-10-09: A102 difficulty normalization, authored encounter budget/team/tier/star pressure, RIGHT taunt/melee/ranged/Assassin targeting order, random-target pressure and action ordering remain verified. A102.2 freezes equipment start/base/growth/cap/max-tier and eligibility/slot/no-duplicate/injected-RNG constraints, but neither authority nor current data defines a canonical deterministic candidate-selection/picker algorithm. `generateEncounter(...)` therefore still deliberately leaves equipment assignment blocked; `EQUIPMENT_BY_TIER` is a sparse catalog, not selection policy. WBS-100 stays unchecked rather than inventing mechanics.
