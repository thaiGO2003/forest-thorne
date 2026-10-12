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

## 2026-10-12 backlog additions

Verified before adding new work: terminal heart loss already transitions the run to `GAME_OVER`, saved `GAME_OVER` runs are non-resumable, and the existing Wave 1 item already requires loss -> main menu with no Continue. Do not create a duplicate implementation task for that request.

### Wave 6 — UI, menu, settings, mod, donate, and import
1. Library animation controls: add an adjacent explicit “Thủ thế” control next to “Rảnh rỗi”; stop using the wrong “Đứng nghỉ” wording/replay behavior, and keep stance/idle terminology consistent across Library controls.
2. Unit/card stat layout: HP is left-aligned and damage is right-aligned; surface magic damage where applicable according to the unit’s role/type instead of forcing every card through one damage presentation.
3. Make “Xác nhận” and “Bắt đầu” buttons content-fit so their chrome is not narrower than the rendered label.
4. Portrait-mobile planning composition: merge the Start panel with the five-stat/round/gold information panel and reduce text size. Keep those panels separated on non-portrait layouts.
5. Full-screen Mod Manager becomes a complete expansion-package management hub comparable to a contemporary mod selector. Research current mod-management UX references before implementation, then adapt the result to Forest Throne rather than cloning another product.
6. Remove the “Phiên bản” button.
7. Restore/show Donate. Modal must remain responsive and no-scroll, render VietQR for TPBank account `60394352614`, account name `LUONG QUOC THAI`, offer preset amounts from 10,000 through 500,000, and choose `addInfo` randomly from the user-supplied `DONATE_QR_ADD_INFO_MESSAGES`. Do not use the conflicting sample-account number embedded in the pasted URL.
   - Preserve the exact random memo pool: `Game hay toi donate cho ban ne`; `Tien cafe de phat trien game tiep`; `Ung ho team lam game vui hon`; `Cam on ban da choi game nay`; `Moi ban ly tra sua nha dev`; `Donate tinh nguyen cho team nhe`; `Game vui qua ung ho them nhe`; `Mua ca phe dong vien team dev`; `Thanks for playing donate nhe`; `Tien nuoc ung ho lam game tiep`; `Game ngon ung ho mot ly cafe`; `Thich game thi moi ban mua tra sua`; `Ho tro dev lam them mode moi`; `Cam on ban da ung ho tinh nguyen`; `Mot ly cafe cho team phat trien`.
8. Add “Tải phiên chơi có sẵn (json)” to the mode-selection modal. Import saved-session JSON only through the existing bridge/persistence authority; UI code must not access save storage directly.
9. Change applicable Settings increment/decrement controls from `+`/`-` to previous/next angle controls `<`/`>`.
10. Swap Shop “Mua” and “Thư viện” controls so Buy is on the right.
11. Reduce excessive spacing around “Nâng cấp” so its layout compactness matches the Start control.
12. Combat controls must content-fit their labels: combat-speed and “Kết thúc nhanh” buttons must not be fixed wider than needed, and the right-side combat modal must be content-fit on portrait mobile and on wide screens.

### Wave 7 — Animal interaction, inventory, crafting, and motion
1. Randomize idle-animal animation cooldowns so idle clips do not loop continuously; stance/idle names and Library replay controls must use the same terminology and behavior.
2. Prevent animal/character models from sinking below the grass/ground plane; placement and animation offsets must preserve the canonical ground contact.
3. Dragging an animal from one board cell to another must animate the move rather than teleporting the rendered model.
4. Merge inventory/warehouse and crafting into one coherent flow. Use compatible `old_src` 3×3 crafting behavior and recipes as reference, but preserve current production ownership and data contracts.
5. Clicking a friendly animal opens a detailed inventory/inspection surface showing: base stats; equipment/environment-derived stats; current live stats after HP loss, buffs, and debuffs; equipped items; detailed active buff/debuff descriptions and effects; and select/sell-animal controls. Enemy animals expose the same diagnostic information but remain readonly.
6. Route all non-equipment emoji through the shared external emoji API/helper so rendering is consistent across devices and browsers. Equipment art remains custom and must not be replaced by emoji.

### Wave 8 — Combat semantics, progression, blessings, and board interaction
1. Direct basic/skill hit cells remain red; AoE/affected cells remain yellow. Preview and live combat must consume the same canonical highlight semantics, and animals themselves are never tinted for these tile states.
2. Combat speed requires unlock/purchase. Keep/add fixed 10-gold “Kết thúc nhanh”; technology-tree upgrades may reduce that cost.
3. Odd rounds are day and even rounds are night. Only authored animals/effects that should react to day/night may change behavior or appearance; avoid a blanket global stat/visual mutation.
4. Add more “Hồi tim” blessings.
5. Add player-orderable weather blessings. Trigger exactly one ordered weather blessing per cycle, once at the start of that cycle, so later-cycle survivors receive the subsequent blessing instead of all queued weather blessings firing in cycle 1.
6. Hover highlighting must illuminate any hovered canonical cell, including grass cells, water cells, and reserve/bench cells.

### Wave 9 — World lighting, environment, loading, victory, and terrain shape
1. Make sun rays global rather than board-only and raise the ray volume to roughly twice its current height, while preserving the existing quality/shadow settings contract.
2. Main-menu/F5 loading screen: add a real progress bar, rotating gameplay tips, and an animated Forest Throne title.
3. Redesign the four lamp columns as richer lantern structures with multiple bulbs/branches and moss at their bases; keep production UI/world art asset-first rather than CSS-drawn.
4. Add environmental detail around the arena: visible mountain ore, moss, mushrooms on trees, and tiny fruit.
5. Victory fireworks: fire one colored firework for each reserve/bench animal, using a distinct color per animal.
6. Make the outside path/river meander organically while preserving the five in-arena cells as a straight canonical gameplay strip.
