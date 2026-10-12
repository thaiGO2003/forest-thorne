# Forest Throne — 2026-10-10 backlog execution plan

## Goal
Implement the requested Forest Throne fixes/features using current production code as authority and `old_src/` only as a reference. Preserve asset-first UI rules, pnpm-only commands, targeted verification, and the existing generated `.omp/plans/custom/html/agent-index.html`.

## Imported reference
- `old_src/` copied from `DevGOVietnam/homeserver-forest-throne-classic`.
- The temporary clone is removed after the copy.
- Never overwrite current production code wholesale from `old_src`; port only behavior/data that still matches current authority.

## Non-goals / hard constraints
- Do not draw the requested loot SVG icons; only prepare stable icon identifiers/render hooks for the later art agent.
- Do not add CSS decorative chrome/colors where asset-first UI applies.
- Avoid full test suite; use targeted tests plus headed browser smokes for touched surfaces.
- Keep unrelated generated plan HTML changes out of commits.

## Wave 1 — Foundations
### Member A — terminology, i18n, data, persistence foundations
1. Replace player-facing “tướng” terminology with “thú” in Vietnamese and equivalent English terminology; rename production identifiers/callers cleanly rather than adding aliases.
2. Fix graphics-quality i18n so HIGH renders “Cao”; audit adaptive/summary strings.
3. Normalize animal database so every animal has exactly one tribe/race plus one element; remove duplicate tribe-as-element data.
4. Add version formatter `0.1.xxxx-dd/mm` using main commit count (4 digits) + commit date.
5. Fix post-loss main-screen state so Continue is unavailable; only New Game remains.
6. Add start-round anti-F5 heart escrow: Start shows/charges -1 heart; refund only on round victory; persist safely across reload.
7. Add progress JSON download/backup and confirm-delete-current-run -> return main menu.
8. Key changes: D no longer switch-animal; R does. Right Shift starts new run.
9. Add 100-achievement completion unlock path for the existing main-screen skin entry.

### Member B — old_src/current-source reconnaissance, no edits
Map exact current and `old_src` owners for:
1. combat animation timing and damage-number emission;
2. burn/DoT cycle timing;
3. tile sweep/hover/skill/rainbow/hit/AoE previews;
4. enemy equipment drops, loot summary, crafting recipes/inventory merge;
5. day/night loop + environment effects;
6. idle animation cooldown and low-cortisol motion;
7. in-combat information modal, resonance, weather forecast, power/HP bars, animal lists/inventory drilldown;
8. library wiki relationship content;
9. headed-smoke invariants for board/log/info animal counts.
Deliver file/line map, authority differences, and a no-conflict implementation order.

## Wave 2 — UI/settings/menu package
After Wave 1 foundation lands:
1. Dialog/tooltip/modal text: black + “Vietnamese Lost” font; explanatory/caption text italic where appropriate. Buttons: font only, preserve button color.
2. Card HP left alignment.
3. Selected filter/toggle/button corners: green rather than white/yellow across matching controls.
4. Library idle-animation controls: random cooldown, explicit adjacent control, terminology cleanup.
5. “Trang phục & tiến hoá”: replace selector text with actual buttons.
6. Fullscreen mod manager redesigned as extension-package manager.
7. “Vinh danh” and “Cộng đồng”: show “chưa được phát triển” tooltip instead of broken/unfinished navigation.
8. Donate entry visible. Donate modal: responsive no-scroll QR, TPBank account as provided by user, preset amounts 10k–500k, random addInfo messages, compact sizing.
9. Settings combat modal: add Home icon beside close/minimize with confirmation before returning to main.
10. Merge Device tab into Display.
11. Replace Battery Saver with FPS limit control.
12. Replace render-scale UI/logic with GUI-size control.
13. Audio tab: move narration/subtitle control here and rename to “Thuyết minh”; language priority = selected text language -> OS language -> English, multi-language capable.
14. Audio tab: add online royalty-free music source, previous/next navigation, selectable tracks, and separate music-volume slider.
15. Swap Shop modal Buy/Library controls so Buy is on the right.
16. Swap Lock and Low Cortisol positions; Low Cortisol keeps base animation and adds rocking/bobbing.
17. Move shop roll control into Shop modal.
18. Remove balloon-shooting loading minigame.
19. History rows show timestamps on right.
20. Tech tree nodes get equal invisible spacing and may not overlap.
21. Main/in-game info modal: resonance becomes one tab; add next-round weather, next-next forecast, HP/power comparison, friendly/enemy animal lists, animal detail/inventory drilldown, plus creative supporting tabs.

## Wave 3 — Gameplay/data/combat package
1. Animal tooltips rebuilt from `docs/opus-5.5-forest-throne-rebuild-mega-prompt.md`.
2. Clicking an animal opens inventory/stat bars/equipment detail; allow select/sell equipment.
3. Fix enemy equipment drops; finish crafting; merge warehouse into crafting; port compatible recipes from `old_src`/mega prompt.
4. Combat choreography: move to role-appropriate adjacent cell center, then attack; emit damage number at the animation-authored hit frame/callback.
5. Burn/periodic damage resolves at start of new cycle.
6. Tactical cell visuals: sweep purple on cells (not animals), skill caster rainbow, direct hit red, AoE yellow, hover brightening; preview uses same canonical plan.
7. Victory loot summary shows total, then per-item quantity × icon. Use future SVG icon hooks only; do not draw icons.
8. Combat speed requires unlock/purchase. Add Finish Fast for fixed 10 gold; tech tree can reduce cost.
9. Outside-bench animals face board center and honor Low Cortisol animation.
10. Outdoor board lamps get emissive/light visual.
11. Day/night alternates per round and influences animals/environment using compatible old_src behavior.

## Wave 4 — Visual/graphics package
1. Warm sun-ray shader + shadows, with Settings controls.
2. Validate selected-control green corner treatment and lighting against asset-first rules.
3. Headed screenshots/browser verification for modal sizing, typography, QR, card HP, filters, board highlights, night/day, lamps.

Wave 4 verification evidence (2026-10-12):
- `Settings.quality` drives the existing Three.js shadow pass and warm sun-ray shader through `Stage.setShadowQuality(...)`; low disables both, medium uses a 1024 shadow map with reduced ray gain, high uses 2048 with full ray gain.
- `Arena.update(dt)` advances the shader time in the existing render loop; the primary shadow camera projection is refreshed after bounds changes so the `coop4` board remains inside the frustum.
- Targeted command `NODE_OPTIONS='--localstorage-file=.vitest-ls.json' pnpm exec vitest --run tests/arena-mapping.test.ts` passed 1 file / 6 tests after the projection-matrix fix.
- Headed/browser screenshot verification is blocked in the current OMP runtime: the shared browser daemon cannot launch (`omp.browser.headed` failed, headless exited), so no browser PASS is claimed.

## Wave 5 — Integration and verification
1. Headed smoke repeatedly verify deployed animal count == combat log count == information-modal count across planning/combat/results.
2. Targeted regressions for loss->main no Continue, heart escrow/reload, equipment drops/crafting, day/night, burn cycle timing, idle cooldown, shortcuts, settings/persistence.
3. `pnpm typecheck` and `pnpm build` only after implementation integration.
4. Commit by coherent workstream with required multi-line bodies; push `dev`.
