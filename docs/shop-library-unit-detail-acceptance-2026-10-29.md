# Shop, Library and Unit Detail acceptance — 2026-10-29

## Scope

Feature worktree: `/home/thaigo/forest-thorne-shop-unit-detail`, branch `feat/shop/unit-detail`. This report covers the UI implementation in `src/app/screens.ts`, `src/core/i18n.ts`, `src/core/inspection.ts`, `src/ui/{card,library,planning,tooltip,ui.css,unitInventory}.ts` (CSS at `src/ui/ui.css`), `src/units/billboard.ts`, and related tests. The isolated feature branch has **not** been merged into `dev`.

## Chromium / WebGL2 acceptance

Actual desktop, compact-landscape, and portrait Chromium sessions used the running Shop preview at `http://127.0.0.1:5207/`; viewport/device-specific browser checks are distinct from Vitest. Desktop verification followed a browser reload **after** the final desktop width CSS change, then recreated `EndlessPvEClassic/EASY` Planning.

| Viewport | Observed Shop | Cards/page | Observations | Result |
| --- | --- | --- | --- | --- |
| Desktop 1280×800 | Dock [140,536,1000,256], grid [152,592,976,188], card [152,592,117,140] | 8 configured; 5 actual offers in fixture | Document 1280×800 (no overflow); actions at [1208,231,64,338], no HUD overlap; stat numbers visible and no observed clipping; real WebGL2 context present | PASS for observed 5-offer render |
| Compact landscape 844×390 | Four visible cards/page | 4 | Dock/modal and hover tooltip fit. Unit Detail bounds [12,12,820,366]; six action buttons and three star selectors in viewport. Long comparison content scrolls. | PASS |
| Portrait 390×844 | Shop initially hidden by design; toggle opens at [8,535,374,301] | 2 | Grid [16,589,358,239], card [16,589,177,191]; second page reached with next button; document 390×844, no horizontal overflow. | PASS |

Desktop after CSS edit: the dock grew from 820 to 1000 CSS pixels, and first card from 94×113 to 117×140 CSS pixels. The initial five-offer crop showed HP, damage, range and gold-price numbers without evident clipping; the subsequent eight-offer post-merge fixture is documented below. Long-name/device-scale readability remains unverified.

Desktop screenshot: `/tmp/omp-sshots-15b88b20134cc54c.webp`; desktop card crop: `/tmp/omp-sshots-15b88b3476ccc54d.webp`.

Compact landscape screenshot: `/tmp/omp-sshots-15b88819090cc543.webp`; Unit Detail: `/tmp/omp-sshots-15b888571e4cc544.webp`. Portrait screenshots: Shop `/tmp/omp-sshots-15b8889bdf8cc546.webp`, card `/tmp/omp-sshots-15b888d448ccc547.png`, Unit Detail `/tmp/omp-sshots-15b888de650cc548.webp`.

Portrait first-card numbers were visually read as HP 413, damage 43, range 1, and price 1. Tooltip bounds: landscape [208,170,306.67,162.17], portrait [8,417,306.67,162.17]. Portrait Unit Detail bounds [12,12,366,820], with `.lib-detail` scrollHeight 1400 and clientHeight 662. Controls are visible; long content scrolls, rather than being permanently clipped.

## Interactions verified

- Desktop Shop cards: keyboard Enter and Space open the correct Unit Detail; Escape closes it. Tooltip is hidden when keyboard opens the modal.
- Native Chromium touchscreen: short tap opens Unit Detail; long-press shows tooltip without a synthetic click; release hides tooltip. Repeated long-press, long-press followed by a short tap, generated-click suppression, and pointercancel passed.
- Navigation disposal clears pending tooltip timers and removes tooltip presentation. Restoring Planning rebinds visible cards.
- Portrait toggle reports `aria-expanded=true` when open; pagination advances from Kiến Hộ Vệ / Nai Thần Ca to Chim Non Lao / Ong Lửa.
- Library: search, role/faction/tier filtering, pagination, 1★–3★ comparison, tooltip lifecycle, read-only inspection, and native touchscreen star-selection 2★ → 3★ → 1★ were previously verified. The comparison does not mutate canonical gameplay state.

Previous passing input/gesture scenarios were **not** rerun after the desktop-only CSS change because their related source and dependencies did not change. No desktop layout or WebGL rendering failure was observed in the final screenshot.

## Current feature branch checks

Executed in `/home/thaigo/forest-thorne-shop-unit-detail` after the final CSS edit:

```text
pnpm exec vitest run tests/preview.test.ts tests/unit-inventory.test.ts tests/inspection-recommendations.test.ts tests/planning-shortcuts.test.ts tests/billboard-presentation.test.ts
5 test files PASS; 22 tests PASS

pnpm typecheck
PASS (tsc --noEmit)

pnpm build
PASS (tsc --noEmit && vite build; Vite 7.3.6, 95 modules)

git diff --check
PASS (no whitespace errors)
```

Pre-sync checks apply to the current working changes at that time; if an upstream merge changes affected sources, reverify on the merged feature branch.

## Limits / outstanding gates

- Historical pre-sync desktop fixture exposed only five offers; the post-merge eight-offer fixture (below) subsequently verified a fully populated desktop row. Long-name readability on physical screens remains an open gate.
- Device-scale readability on physical screens, native OS mobile/browser behavior, and unthrottled GPU performance remain outside this Chromium session's proof.
- The preview is an isolated feature worktree, not merged `dev` or deployed production.
- Coop, crafting transactions, Planning touch drag/drop, the full sixteen-item `docs/Plan.pdf` audit, public endpoint acceptance, exact-HEAD human merge review, and `dev → main` release are separate gates.

## Post-merge Chromium acceptance (Shop HEAD `bb4067c168d6c91efe33ee94831517889769d4ff`)

The post-conflict build was exercised through Chromium/Playwright against the live `http://127.0.0.1:5207/` preview using an `EndlessPvEClassic/EASY` development fixture with eight populated Shop offers. Source: `/tmp/forest-throne-shop-merged-smoke.mjs`; output: `MERGED_SHOP_ACCEPTANCE_PASS`, with no browser `pageerror` records. The test context enabled touch emulation and `isMobile: true` **for all three viewport sizes**; the 1280×800 run validates a desktop-sized CSS viewport, not an ordinary non-mobile browser profile. Chromium launched with ANGLE SwiftShader, so an actual `WebGL2RenderingContext` was observed but hardware GPU performance was not measured.

| Viewport | Visible cards | Observed Shop box (x, y, width, height) | Detail dialog | Result |
| --- | ---: | --- | --- | --- |
| 1280×800 | 8 | (140, 535.91, 1000, 256.09) | Not exercised in this pass | PASS: full populated row, no horizontal document overflow, WebGL2 |
| 844×390 landscape | 4 | (8, 123.61, 754, 258.39) | (12, 12, 820, 366) | PASS: card pagination footprint, short tap opens modal, Escape closes, dialog within viewport, WebGL2 |
| 390×844 portrait | 2 | (8, 534.84, 374, 301.16) after opening toggle | (12, 12, 366, 820) | PASS: dock initially hidden, toggle opens, short tap and Escape, modal within viewport, WebGL2 |

Desktop purchase via a real Shop DOM click: `ant_guard` (authored tier price 1) reduced gold **24 → 23**, created exactly one bench unit `u1`, and cleared purchased Shop slot 0. Clicking the disabled slot did not change gold or bench. Replacing slot 0 with `deer_song` updated the accessible purchase label and reenabled purchase. At zero gold, the control became disabled; a click left canonical gold, bench and offers unchanged. This is transaction evidence, not a simulated `bridge.buy()` call. No duplicate touch-purchase transaction was exercised in this run.

Post-merge browser screenshots: `/tmp/forest-throne-shop-merged-acceptance/{desktop,landscape,portrait}.png` and `{landscape,portrait}-detail.png`. Visual inspection confirms eight desktop cards, four landscape cards and two portrait cards with artwork, stat indicators and purchase controls. Small decorative labels are difficult to read; two battlefield Kỳ Đà nameplates visibly overlap on desktop. A white playfield label is partly obscured by the right-side toolbar in portrait. These are **unresolved visual acceptance findings**, not proof of purchase or WebGL breakage.

Post-conflict code checks previously recorded: 6 targeted Vitest files, 32/32 tests PASS; `pnpm typecheck` PASS; `pnpm build` PASS; `git diff --cached --check` PASS. No production-source change was made for the Playwright visibility mismatch: ancestor checks showed positive layout and computed visibility for desktop/landscape offers; portrait Shop is intentionally hidden until toggled. The post-merge harness did not validate physical touchscreen behavior, all long-press/pointercancel cases, framebuffer pixels, representative Billboard GPU lifecycle, or performance on physical devices. Those remain release gates alongside human exact-HEAD merge approval, integration and multiplayer/crafting acceptance.

## End-to-end gameplay acceptance — 2026-10-31

All transactions in this section used the isolated feature preview and normal game controls; observations of saved state were read-only. They are not synthetic mutations of `localStorage`.

### Planning transactions and persistence

| Scenario | Evidence | Result |
| --- | --- | --- |
| Purchase / Sell | Bought `ram_charge` as `u2`: 10→9 gold; sold `u2`: 9→10 gold and bench emptied; reload preserved the sale | PASS |
| Purchase three combatants | Bought `deer_song` (`u3`, 2 gold), `falcon_dive` (`u4`, 3 gold), `cat_goldbow` (`u5`, 4 gold): 10→1 gold | PASS |
| Native deployment | Dragged `u3/u4/u5` to canonical board indices 10/11/12; board occupancy survived combat and reload | PASS |
| Round 1 | Planning→Combat→Victory→Planning; enemy HP 72→0, rage 0→1 and burn visible; rewards +13 gold, +2 EXP, zero hearts lost, loot bark/claw/feather; gold 1→14, round 1→2, HP 3 | PASS |
| Round 2 | Combat finished naturally without Finish Fast; Victory awarded +16 gold, +2 EXP, zero hearts lost; gold 9→25 and round 2→3 | PASS |
| Result/augment | Native Next Round opened augment choices; selected `interest_cap_3` (+1 interest cap); phase AUGMENT→PLANNING, round 3, 25 gold, 3 HP | PASS |
| Round 3 | Combat finished naturally without Finish Fast; Defeat awarded +12 gold, +0 EXP, -1 HP, claw ×1 and crystal ×1; gold 21→33, HP 2→1; native Next Round advanced to round-4 Planning | PASS |
| Round 4 XP and deployment | Native Buy XP spent 4 gold (33→29) and reached level 3 with 2 XP; native bench-to-board drags placed `ant_guard` at board slot 17 and `dove_peace` at slot 16, raising deployed count from 3/5 to 5/5 | PASS |
| Round 4 Shop capacity | Five native one-gold purchases (`firefly_heal`, `spider_venom` ×2, `scorpion_shadow`, `salamander_flame`) reduced gold 29→24, increased bench from 2 to 7 and inventory capacity 7→12; carried items remained five | PASS |
| Round 4 natural result | Native Start entered combat with HP 1→0 and `heartEscrow=1`; playback finished naturally without Finish Fast. Victory awarded +17 gold, +2 EXP, 0 HP lost and 7 loot (claw ×1, bark ×1, crystal ×2, feather ×1, `eq_blue_buff` ×1, tear ×1). Gold 24→41, HP 0→1, escrow 1→0, XP 2→4 and round 4→5 | PASS |
| Round 5 augment | Native Next Round opened augment; selected `team_def_4` (+11% team DEF), persisting `[interest_cap_3, team_def_4]` and entering round-5 Planning at HP 1 | PASS |
| Round 5 natural result | Native Start moved PLANNING→COMBAT (HP 1→0, `heartEscrow=1`, gold 38). Combat finished naturally without Finish Fast. Victory modal showed +21 gold, +2 EXP, 0 HP lost; canonical gold 38→59, HP 0→1, escrow 1→0, round 5→6, level 4 and XP 0. Native `Vòng tiếp` dismissed Result into round-6 PLANNING | PASS |
| Saved run | Reload and Continue resumed canonical round-2 Planning with persistent units and loot | PASS |

### Crafting and inventory

Level-1 `craft_t` was researched through the Technology Tree UI for 5 gold (14→9); center cell 5 became available. Staging bark in cell 5 did not match the authored `tear → eq_blue_buff` recipe, so Craft stayed disabled and the canonical bag/history stayed unchanged. **Unlock and rejected-craft atomicity PASS.** Round-4 Victory subsequently delivered one legitimate tear and one `eq_blue_buff`. In round-5 Planning, native Crafting controls staged that tear in center cell 5; preview identified `eq_blue_buff` and enabled Craft. Native submission reported `Đã chế tạo Bùa Xanh!`: tear 1→0, Blue Charm 1→2 and `craftHistory []→[blue_buff]`. Staging did not consume the ingredient before submission; post-submit staging cleared. Reload confirmed both charms and history persisted. **Successful crafting transaction and persistence PASS.**

At the start of round 3, board occupancy 3 + bench 0 + inventory bonus 0 yielded an inventory capacity of 3, exactly equal to three carried materials. Four legitimate Shop purchases (`fox_flame`, `dove_peace`, `ant_guard`, `crane_blessing`, one gold each) reduced gold 25→21 and increased bench occupancy 0→4 and inventory capacity 3→7; the item bag was unchanged. **Inventory capacity expansion PASS.**

At round-4 combat start, the five-item bag was `[bark, claw, feather, claw, crystal]`, with twelve slots (five board + seven bench). After natural Victory, accepted loot included the tear candidate from the TIDE encounter; the canonical bag and ensuing crafting transaction were observed directly, without JavaScript state mutation.

Native Three.js unit hover at battlefield pixel (329,193), followed by pointer click, opened Owned Inventory for bench `firefly_heal` (`u10`); it was not a Shop/Library card. The modal showed two empty equipment slots, two earned `eq_blue_buff` items and enabled Equip. Native Equip moved one charm bag 2→1 and `u10.equips []→[eq_blue_buff]`, without gold expenditure. The other identical charm was disabled as `Đã mang trang bị cùng loại` (duplicate restriction). Reload/Continue preserved `u10.equips` and bag count. Native individual Unequip charged 2 gold (41→39), restored bag 1→2 and cleared `u10.equips`; re-equip, then Unequip All charged 2 gold (39→37) and restored the item exactly once. Native equip on two different units then left `u10` and `scorpion_shadow` (`u12`) with one charm each. Selling `u12` via native confirmation returned its charm to the bag without Unequip fee and granted 1 gold (37→38); `u12` disappeared, `u10` remained equipped, bag contained one charm. **Equip, duplicate restriction, reload persistence, individual Unequip, Unequip All, Sell recovery PASS for observed tier-1 cases.** The authored `eq_blue_buff` has empty bonuses, so no equipment-derived stat delta is expected; this does not establish stat-bonus rendering for future items. Tier-2 restriction, full-slot capacity, insufficient-gold and Crafting combat locking remain unverified in the live game. Friendly Owned Inventory combat mutation controls were disabled in observed board and bench cases; bypassing disabled controls was not attempted.

Native friendly-board hover at (260,355) showed `deer_song` (Nai Thần Ca) HP 286/286, ATK 26, DEF 17, MATK 68, MDEF 27 and rage 1/1; native click opened `unit-inventory` for the deployed friendly unit. Native combat click on the same unit opened Owned Inventory readonly, with Equip, Sell and Unequip All disabled. Native combat click on bench `u10` opened its equipped Blue Charm; Unequip (2 gold), Equip, Unequip All (2 gold), and Sell were disabled. The canonical phase stayed COMBAT, gold 38, `u10.equips=[eq_blue_buff]` and Blue Charm bag count 1. **Combat mutation controls are disabled for the inspected friendly board and bench units; no mutation was attempted or observed.**

### Reactive combat and UI lifecycle

During round-2 combat, an enemy-detail modal displayed the correct readonly label `Phe địch · Trên sân` and live `triceratops_charge` HP 88/210→33/210, ATK 77→90 and rage 2/2→0/2→1/2, plus sourced burn status (2 turns). Shield remained zero; DEF remained 31. **HP/ATK/rage/status/readonly PASS for observed frames; shield transitions, DEF transitions, impact-time visual synchronization, status expiry and enemy-death modal lifecycle UNVERIFIED.**

During round-4 combat, the `octopus_mind` Enemy Detail displayed `Phe địch · Trên sân`, skill detail, base/boosted/live stat sections and readonly equipment placeholders without mutation buttons. Initial readings: base HP 292/292, boosted HP 245/245, live HP 245/245; live ATK 17, MATK 71, DEF 4, MDEF 19, rage 0/3 and shield 0. Closing the detail by native `Thu gọn` left combat running, without a visible dialog. Matching boosted and live HP at this instant does **not** establish that reactive updates failed; more impact transitions remain unverified.

Round-5 Combat Information → Đội hình → enemy Cua Giáp's native Xem chi tiết opened `enemy-unit-detail` successfully (the Hai phe tab contains comparison metrics, not roster detail buttons). The readonly modal showed live HP 0/364, ATK 39, DEF 56 (+22), MDEF 41 (+14), rage 3/3, shield 0, burn/poison (2 turns), DEF +22 and MDEF +14 (2 turns). Enemy Cú Đêm was also opened natively: live HP 44/220, ATK 56, DEF 13, rage 1/2, shield 0, followed later by HP 0/220 and rage 2/2 while the detail remained open. This verifies reactive diagnostics across sampled combat frames, not exact visual-impact synchronization or effect expiry. Native `Thu gọn` closed Cú Đêm's detail, returning Canvas count to the combat baseline of 49. Round 5 subsequently ended in a natural Victory; the Result modal appeared after combat teardown and the canonical state advanced to round-6 Planning. Enemy death while detail remained open did not remove the modal, but end-of-combat replacement/disposal and 3D/GPU lifecycle measurements require additional evidence.

Crafting modal: Canvas count 70 while open, 40 on close, stable through three cycles. Owned Detail: Canvas count 80 while open, 40 on close, stable through three cycles. Planning baseline: 40 Canvas; combat without modal: 49; result modal displayed 48. **No accumulating DOM Canvas observed in the tested open/close cases; GPU allocations, event listeners and RAF disposal UNVERIFIED.**

Combat-speed HUD showed `Tốc độ x1`; clicking it opened Technology Tree rather than changing speed. `RunState.speedLevel` remains the canonical authority. Whether navigation via this readonly HUD control meets the A56/WBS-066 contract is **UNRESOLVED**, not automatically a regression.

### Responsive Shop regression — 2026-10-31

After the collapsible landscape Shop patch, the existing Chromium gameplay session was reloaded, resumed using native pointer input and exercised at 844×390 and 700×390. In both viewports, the Shop starts hidden, the toggle is fully inside the viewport and has `aria-expanded=false`; native clicks open the four-offer Shop (`aria-expanded=true`) and close it again. Once closed, battlefield Canvas receives hit testing. No buy/restock transaction occurred: canonical round 6, gold 59 and HP 1 remained unchanged. A 700×390 screenshot (`/tmp/omp-sshots-15bb043aea0c177e.png`) still shows substantial overlapping 3D unit nameplates obscuring battlefield tiles and names; this is a separate unresolved visual defect, not a passing battlefield interaction test.

Native Shop open/close and label checks across viewport transitions verified: 844×390 Buy width 178px / Restock 140px, 390×844 177px / 56px, 700×390 146px / 56px, 1280×800 117px / 140px. Wide buttons display `MUA 2 🪙` and `Đổi thú (2 🪙)`; the narrow Restock button displays `2 🪙` without clipped text. Accessible Buy labels retain unit name and price (e.g. `MUA Chồn Nhanh (2 🪙)`). Viewport transitions restore desktop-visible Shop and compact-viewport collapsible Shop. **Requirement 08 PASS** for the requested width-dependent labels. Native landscape drag/drop, tooltip lifecycle after toggling and physical-device readability remain separate gates.

Following the responsive source edits, `pnpm exec vitest --run tests/unit-inventory.test.ts` passed 10/10 tests, `pnpm typecheck` passed, `pnpm build` passed (Vite 7.3.6, 95 modules) and `git diff --check` passed on 2026-10-31. These checks do not supersede native gameplay or visual acceptance.

### Billboard solver verification — 2026-10-31

The compact-landscape beam search now sizes reusable model-coverage buffers by the projected model count (not the label count), reuses a synchronous HUD-collision rectangle, and copies only live search-state entries during ordered insertion. This addresses stale capacity and unnecessary allocation/copying without changing the UI contract. Targeted `tests/camera.test.ts`, `tests/board-view-presentation.test.ts`, `tests/billboard-presentation.test.ts`, `pnpm typecheck`, `pnpm build`, and `git diff --check` passed after these code edits.

Retained Round 6 Planning Chromium session remained responsive at 390×844 and 960×600. Screenshots: `/tmp/omp-sshots-15bb5eeede5ad21c.png` (portrait) and `/tmp/omp-sshots-15bb5f40aedad21d.png` (landscape). Labels were legible with no substantial mutual collision, but small HP/rage details remained difficult to read and the model silhouettes could not be reliably distinguished behind nearby nameplates. A separate 700×390 screenshot (`/tmp/omp-sshots-15bb5ae866f23563.png`) has the same model-visibility limitation. The source registry confirms bespoke rigs only for `jaguar_hunt` and `toad_poison`; other roster entries intentionally use `pendingArt()` signposts. Missing animal bodies cannot be attributed solely to label overlap. `1280×800` screen capture repeatedly timed out even though DOM reads succeeded; capture infrastructure remains unverified, not an established renderer defect. **Billboard model readability remains PARTIAL; none of these observations establish full WBS-059 acceptance.**

Live mesh-only projection check at 700×390 (excluding billboard/speech sprites) found Jaguar `e3` at x357–432/y104–144 CSS px (20 visible meshes) and Toad `e4` at x513–563/y162–208 (12 visible meshes). Opaque `MeshStandardMaterial` settings were normal (`opacity=1`, `depthTest=true`, `depthWrite=true`). Actual billboard-to-mesh rectangle intersection was ~2% for Jaguar and 0% for Toad. The correctly DPR-scaled 875×488 screenshot `/tmp/omp-sshots-15bb6372559ad21f.png` shows both small animal bodies (Jaguar physical crop x445–540/y130–180; Toad x641–704/y203–260). Thus the visual-recognition limitation cannot be fixed by shifting those two labels; silhouette size/contrast and remaining `pendingArt()` signposts need separate production asset acceptance. `modelBoundsFor()` caches mesh bounds in the root's **local** coordinates (`inverseRoot * mesh.matrixWorld`), so taking bounds before setting the root's eventual board position is intentional; `projectModel()` transforms cached corners by the current root world matrix.

Native Chromium mouse motion over Jaguar at (390,125) and Toad at (542,188) showed matching live previews and raised the respective billboard `renderOrder` from 10 to 20. Moving to an empty tile lowered both to 10, and tooltip `data-open=false`/computed `visibility=hidden` confirmed cleanup. Clicking the enemy at (540,188) showed its preview without opening a modal; no action was claimed from this. Native viewport transitions 390×844 → 844×390 → 960×600 → 1280×800 → 700×390 preserved 18 scene unit roots, zero visible dialogs, no document overflow, renderer canvas matching CSS viewport dimensions and the canonical saved Round 6 Planning state. These are browser viewport checks, **not** physical touchscreen evidence. Screenshot `/tmp/omp-sshots-15bb66cead9373f6.png` shows the compact layout without obvious HUD clipping; fine creature readability remains PARTIAL.

### Native Planning drag/drop acceptance — 2026-10-31

All actions below used native Chromium mouse input on the live 700×390 Planning canvas, not direct run-state mutation. Starting canonical state was round 6 `PLANNING`, with `u3` at board index 10, `u4` at 11 and `u6` at bench index 0.

| Action | Observed state change or invariant | Result |
| --- | --- | --- |
| Drag `u3` from board index 10 (165,192) into empty index 0 (180,137) | Board index 10 cleared; index 0 became `u3`; `canvas.hasPointerCapture(1)` was true while dragging | PASS |
| Drag `u3` from board index 0 into occupied index 11 (202,192) | Board index 0 became `u4`; index 11 became `u3` (intentional occupied-cell swap) | PASS |
| Drag `u3` at board index 11 into invalid location (350,350) | Board and bench arrays were identical before/after; pointer capture was true while dragging | PASS |
| Drag bench `u6` (fox_flame) from (130,90) to occupied board index 11 | Board index 11 became `u6`; bench index 0 became `u3` (intentional swap) | PASS |
| Drag board unit from (202,192) outside the canvas (-8,192) | Board/bench unchanged; canvas pointer capture was released and no tooltip was visible | PASS for observed pointer-exit path |

Native inverse drags restored the exact original formation: board indices `10=u3`, `11=u4`, `12=u5`, `16=u7`, `17=u8`; bench indices `0=u6`, `1=u9`, `2=u10`, `3=u11`, `4=u13`, `5=u14`. Final saved state remained round 6 `PLANNING`. The pointer-exit case **does not** establish `pointercancel` behavior, and mouse-driven viewport testing does not establish physical touchscreen behavior; both remain separate checks.

### Browser-level touch cancellation — 2026-10-31

Chromium CDP `Input.dispatchTouchEvent` (`touchStart` at 165,192; `touchMove` at 180,164; `touchCancel`) produced native `pointercancel` followed by `lostpointercapture` for pointer ID 2. Pointer capture was present before cancellation and absent afterward; no tooltip remained. Canonical board/bench entries were unchanged and the `u3` scene root finished at its home position `[-5, 0.12, 0]`. **PASS** for cancellation-event handling, capture release, no canonical move and final transform. Active-displacement transform/highlight restoration was **not** measured during the drag, and CDP touch emulation is **not** physical touchscreen evidence.

Follow-up active-displacement CDP check used one Chromium session for `touchStart` → `touchMove` → `touchCancel` at (165,192) → (180,140), with a 300 ms mid-drag observation. Before drag, `u3` was at `[-5,0.12,0]`; during drag its root moved to `[-4.98096466,0.12,-1.87916047]` and six tile-color buffer components changed. After native `pointercancel` (pointer ID 3) and `lostpointercapture`, root returned exactly to `[-5,0.12,0]`, tile-color array matched the baseline (zero changed components), bench highlight count was zero, and the saved board/bench UID arrays were identical. **PASS** for observed displaced-root restoration, tile-highlight reset and canonical move conservation. Mid-drag `hasPointerCapture` was not independently observed (`null` due to the event recorder); prior capture-release evidence stands separately. A prior attempt to cancel from a different CDP session failed (`Must send a TouchStart first`); a synthetic `blur` recovered the original scene root before the successful native repeat, and that recovery is **not** counted as native acceptance. Physical touchscreen interaction is still **UNVERIFIED**.

### Native Crafting staging, selection and modal cleanup — 2026-10-31

On the retained round-6 `PLANNING` game at 700×390, native clicks opened `craft` (table level 1/3, only center cell 5 unlocked; 11 canonical bag items). Native selection of Vỏ Cây (Bark) set `aria-pressed=true` and announced the selection. Placing Bark into center cell 5 changed its accessible label to occupied, lowered *UI-available* Bark from 2 to 1, and enabled Dọn bàn, while Xếp nhanh and Chế tạo stayed disabled for the unmatched recipe. The persisted bag (11 items) and `craftHistory=["blue_buff"]` were unchanged. Native Dọn bàn emptied cell 5, restored the UI-available Bark count 1→2 and disabled itself; canonical bag/history were still unchanged. **PASS** for staging/clear resource conservation and button-state transitions.

Ingredient selection remained `aria-pressed=true` after Dọn bàn. Native switching to Thư viện công thức showed the authored `tear → eq_blue_buff` recipe; switching back to Chế tạo reset the ingredient selection and left center cell empty. These are observed selection semantics rather than a diagnosed defect. Xếp nhanh remained disabled because the legitimately accumulated round-6 bag contains no `tear`; successful native auto-fill is **UNVERIFIED** in this canonical state. Native Thu gọn disposed the crafting modal (`active() === null`), returned DOM Canvas elements to baseline 40, and preserved the round-6 board/bench, selected `u4` ring and bag/history. This proves observed DOM cleanup, not GPU allocation or listener disposal.

### Repeated Owned Inventory and Shop tooltip lifecycle — 2026-10-31

Native Chromium interaction on the retained 700×390 Round 6 Planning session opened and closed `unit-inventory` three times without altering the board, bench or inventory. Open states each had 82 DOM Canvas elements and one visible dialog; corresponding closed states had 40 Canvas elements, zero dialogs and `app.modals.active() === null`. At all six measured states, `stage.renderer.info.memory.geometries` stayed at 77 and textures at 16. **PASS** for repeated modal DOM cleanup and stability of these two measured WebGL resource counters; JS listener/heap ownership, RAF cleanup and comprehensive leak freedom remain **UNVERIFIED**.

Native Shop toggle, card hover and pointer-exit check: hovering the first offer opened the tooltip with `Chồn Nhanh`; collapsing the Shop removed `.pl-shop` from view while the tooltip content became `Cửa hàng thú` because the pointer was over the toggle. Reopening and rehovering the same offer restored the `Chồn Nhanh` tooltip; pointer exit set `data-open=false` and computed `visibility=hidden`. DOM Canvas count remained 40 throughout. **PASS** for Shop-card tooltip reactivation and pointer-exit cleanup; toggle tooltip is not a stale card tooltip. Computed `.tooltip` CSS background was transparent, but the tooltip has a `<canvas class="kit-canvas">` asset layer. **Black-background rendered-pixel styling remains UNVERIFIED**, not a CSS-only failure.

### Owned Inventory heap retention investigation — 2026-10-31

Forced-GC baseline before renderer material isolation showed repeatable growth of approximately 153 CDP DOM nodes, five JavaScript event listeners and 100 KiB JS heap per native Owned Inventory open/close. A CDP heap snapshot linked a detached `canvas.portrait-canvas` and its five pointer/wheel handlers to the detached `.ui-inventory` subtree; the retaining chain traversed a battlefield-shared `MeshStandardMaterial` dispose-listener array and renderer-specific `onMaterialDispose` closure. Removing the modal from the live DOM alone was insufficient.

The implemented ownership fix keeps long-lived rig materials for battlefield units and allocates separate material sets for snapshot and interactive portrait renderers; their respective teardown paths dispose only the temporary sets. With that isolation in place but before explicit canvas input-listener removal, native repeated open/close still retained one detached portrait canvas and one detached inventory root per cycle: post-GC retained roots 1→2→3→4→5; CDP listener count 670→675→681→686→690; CDP nodes 607→771→924→1077→1230. Thus material isolation alone was **not** a demonstrated leak fix.

The interactive portrait viewer now detaches its `pointerdown`, `pointermove`, `pointerup`, `pointercancel` and `wheel` listeners and clears pointer state before renderer-owned material and renderer teardown. `pnpm typecheck`, 18 targeted unit visual/inventory tests, `pnpm build` and `git diff --check` passed. Native Chromium resumed Round 6 Planning and performed five native-pointer Owned Inventory open/close cycles. All five closed-modal samples had **40 live canvases, zero dialogs and zero detached `.ui-inventory` roots**. Post-GC CDP listener counts were **673→674→673→673→673**, and CDP node counts **463→464→465→466→467**, eliminating the previously observed per-cycle accumulation of ~5 listeners and ~153 nodes. The Inspector still reported detached portrait canvases **1→2→3→4→5**; a fresh heap snapshot identified a retaining path through `blink::InspectorDOMAgent` and `blink::DevToolsSession` C++ persistent roots rather than the former battlefield material/renderer listener chain. Battlefield renderer counters remained `geometries=74`, `textures=15` when the modal was opened. **Previously measured inventory subtree and JavaScript listener retention no longer reproduced; comprehensive leak freedom remains UNVERIFIED**: Inspector instrumentation may retain canvases, and `performance.memory.usedJSHeapSize` increased from 18,649,772 to 19,118,456 bytes across these samples. More controlled post-GC measurements without persistent DOM Inspector tracking are required before concluding long-run heap stability.

A follow-up experiment ran **eight more native-pointer Owned Inventory open/close cycles** without calling `DOM.enable`, `DOM.getDetachedDomNodes` or `DOM.resolveNode` in the new measurement loop. Each sample created a temporary CDP session, ran `HeapProfiler.collectGarbage` twice, detached the session, then read `performance.memory.usedJSHeapSize` and live DOM state. The forced-GC baseline was **18,873,615 bytes**; cycle samples were **18,934,775 → 18,986,467 → 18,956,927 → 19,035,359 → 19,449,195 → 19,502,839 → 19,544,195 → 19,582,179 bytes**. All eight modal-close assertions passed, with **40 live canvases, zero live portrait canvases and no active modal** after every close.

The baseline-to-final JS heap difference was **+708,564 bytes (~692 KiB)**. Heap was not strictly monotonic (cycle 3 decreased), but its total growth means **long-run heap stability is still UNVERIFIED**. The existing browser target was previously instrumented by DOM Inspector and heap-snapshot tooling, so these new samples do not rule out persistent Inspector retention, runtime warm-up or an additional application-owned retaining path. The successful native lifecycle assertions demonstrate modal teardown, not complete leak freedom.

### Portrait WebGL context retention and renderer pooling — 2026-10-31

Fresh-browser baseline after 60 native Owned Inventory open/close cycles, before `forceContextLoss()` and renderer pooling: forced-GC JS heap **17,201,063 → 19,840,025 bytes (+2,638,962)**. A CDP snapshot found **63** `WebGL2RenderingContext` objects, **319** WebGL textures, **74** WebGL programs and **61** detached `portrait-canvas` elements. A second 60-cycle experiment with `forceContextLoss()` but without pooling measured **17,130,978 → 19,742,935 bytes (+2,611,957)** and retained **62** contexts, **314** textures, **73** programs and **60** portrait canvases. Context loss alone did not remove retained JS references.

The retaining-path investigation found renderer-specific `onTextureDispose` closures registered on the module-level Three.js r186 DFG LUT `DataTexture` singleton. Those closures reach previously created renderer contexts; material-specific isolation and canvas-listener cleanup remain required. Instead of modifying Three.js internals or disposing the shared LUT, `createPortraits()` now reuses at most one idle interactive viewer `WebGLRenderer`. Viewer teardown stops animation and timers, removes all five canvas input listeners, clears pointer state, disposes viewer-owned units/materials, clears renderer render lists, and either pools the idle renderer or disposes and loses the surplus context. Provider teardown disposes and loses the idle context.

After pooling, **60 native Owned Inventory open/close cycles completed with zero lifecycle failures**: each closed state had **40 live canvases, zero live portrait canvases and no active modal**. Reopened Owned Inventory reused the same instrumented `HTMLCanvasElement`; Library Detail subsequently reused it again and resized it from 228×212 to 396×352. Native Library actions for `Đánh`, `★★`, pointer drag and wheel left the modal and portrait canvas active; full visual correctness of each animation/rotation/zoom is not proven by those DOM assertions. Separately, an isolated public-API smoke created two concurrent viewers with distinct canvases and WebGL contexts: disposing the first pooled its live context, disposing the second lost its surplus context, a new viewer borrowed the first canvas, and provider disposal lost the pooled context. All temporary test hosts were removed. An isolated snapshot-provider smoke verified an initial cache miss, 192×192 raster production on the next frame, stable cache hit, one readiness notification and `get() === null` after disposal.

Forced-GC JS heap after 60 pooled native cycles: **17,222,701 → 18,151,290 bytes (+928,589)**; samples at cycles 10/20/30/40/50/60 were **17,754,689 / 17,796,664 / 17,914,274 / 17,961,322 / 18,067,790 / 18,151,290**. This is lower observed growth than the two earlier experiments, but the experiments had different profiling histories and the heap still increased. After the 60-cycle run, a fresh CDP snapshot taken with Library closed counted **3 WebGL2 contexts, 19 WebGL textures, 14 WebGL programs and one detached `portrait-canvas`** (the intentionally idle pooled renderer). Earlier `heapGroups()` output omitted these categories because its class filter required **size ≥12,000 bytes or count ≥20**; the missing rows never showed that all contexts had been collected. A resource-targeted snapshot classifier without that threshold resolved the omission. Baseline snapshot counts and follow-up counts came from separate samples and are not strict before/after native-allocation deltas. **PASS** for bounded observed WebGL context/canvas retention over the 60-cycle experiment, serial viewer reuse, concurrent surplus release and provider disposal; **UNVERIFIED** for long-run heap stability and comprehensive leak freedom.


### Crafting Bridge contracts and portrait interaction — 2026-10-31

`pnpm exec vitest --run tests/craft-contracts.test.ts tests/equipment-guards.test.ts` passed **27/27 tests**. Core coverage includes crafting resource conservation and equipment slot, tier, duplicate, missing-item, combat-phase, and insufficient-gold guards; this does **not** prove the corresponding native UI cases. New Bridge-level coverage in `tests/recovered-bridge.test.ts` passed **30/30 tests**: rejected staging preserves bag, history, RNG, current grid and save; legitimate research unlocks 1×1, 2×2 and 3×3 grids; failed crafting preserves in-memory staging but does not serialize it; full-bag crafting with the authored `tear → eq_blue_buff` recipe consumes one tear, produces one item, updates history/achievement, clears successful staging and survives save/reload. These tests use isolated run fixtures, not modifications to canonical browser LocalStorage.

On the clean `localhost:5207` Chromium Planning session, native Library Detail for `ant_guard` rendered a nonblank portrait canvas. Native 2-star selection set `aria-pressed=true`; pointer drag visibly changed the signpost from near-front to three-quarter orientation and wheel input changed apparent model framing. Screenshots: pre-drag `/tmp/omp-sshots-15bba38ac0e8436d.png`, drag `/tmp/omp-sshots-15bba39b63e8436e.png`, wheel `/tmp/omp-sshots-15bba3abaaa8436f.png`, action click `/tmp/omp-sshots-15bba3b708e84370.png`. These are qualitative observations rather than controlled pixel-difference measurements; the action button was clicked natively, but its animation/completion is **UNVERIFIED**. All but `jaguar_hunt` and `toad_poison` intentionally resolve through `pendingArt()` to a wooden signpost: this is **incomplete creature-art content**, not evidence of portrait renderer failure. Battlefield remained rendered after renderer pooling. Two enemy HP/rage billboards appeared close together in one frame, but a collision was **not** measured or reproduced; do not change the solver on that basis.

**Remaining UI gates:** native full-slot/tier/duplicate/insufficient-gold equipment denial; combat read-only transitions; selection invalidation on legitimate unit removal; Crafting autofill and post-success cleanup with a legitimately acquired `tear`; Enemy Detail live status/death/impact timing; visually rendered tooltip backgrounds, legacy asset comparison and missing creature rigs. Physical touchscreen behavior remains unverified.

### Native Enemy Detail keyboard and compact-layout acceptance — 2026-10-31

At the clean `localhost:5207` Planning screen (844×390, DPR 1.25), native mouse hover at `(460,155)` displayed the `Lửng Đá ★1` tooltip; native click at the same confirmed pickable location opened the readonly `enemy-unit-detail` dialog. Earlier guessed coordinates failed to open it; the cause of those misses was not established. Production `.ui-inventory-content` had `tabIndex=0`, created by `src/ui/unitInventory.ts`, without temporary DOM mutation. Initial focus was the modal frame. One native `Tab` moved focus to the scroll container; native `PageDown` scrolled to `213/327`, and native `End` reached `327/327`. `Shift+Tab` moved focus outside the container to the existing Shop toggle (the modal does not trap focus); native `Escape` removed the modal, inventory content and portrait canvas from the live DOM. **PASS** for observed native click, keyboard focus/scroll and Escape DOM cleanup. This does not prove JS listener unsubscribe, GPU leak freedom or physical touchscreen behavior.

Previously verified native wheel scrolling reached the bottom at 900×600 (`102/102`), portrait 390×844 (`724/724`) and landscape 844×390 (`327/327`); final Buff/Debuff content was visible and compact viewports had no document-level horizontal overflow. No DOM-injected `tabindex` or programmatic `.focus()` was used for the production keyboard acceptance. After the source edit, `pnpm typecheck`, `pnpm exec vitest --run tests/planning-drag.test.ts` (**3/3**), `pnpm build` and `git diff --check` all passed. Enemy live combat impact/status/death transitions, focus behavior in other modal variants, and full readonly lifecycle cleanup remain unverified.

### Native friendly bench/board selection and deployment — 2026-10-31

In the clean `localhost:5207` Chromium session (1280×800, DPR 1), the round-1 Planning run initially contained `u1 ant_guard` at bench index 0 with an empty board. Native mouse hover at `(200,171)` displayed `Kiến Hộ Vệ ★1`; native click opened Owned Inventory with `Phe ta · Trên ghế`. Native Escape dismissed the modal.

A native pointer sequence `mouseDown(200,171) → mouseMove(400,400) → mouseUp(400,400)` deployed the same `u1` from `bench[0]` to `board[12]`. Persisted gameplay state then showed `board[12] = u1 ant_guard` and an empty bench. Native mouse hover and click at `(410,360)` on the deployed unit displayed `Kiến Hộ Vệ ★1` and opened Owned Inventory with `Phe ta · Trên sân`. Native Escape closed it; final DOM state had zero dialogs, no inventory and zero inventory canvases. **PASS** for native friendly bench selection, legitimate bench-to-board deployment, deployed-board selection and observed modal DOM cleanup.

An earlier click at the drag destination `(400,400)` did not open inventory although the hover tooltip appeared; the successful pick at `(410,360)` demonstrates a valid hit target, not complete click coverage at every point under the visible label. At this earlier checkpoint, selection invalidation after unit removal was **UNVERIFIED**; the subsequent native sale and live Three.js ring inspection below supply bounded evidence. Other input-device coverage, long-run event/GPU lifecycle and full WBS-059 acceptance remain **UNVERIFIED**.

### Native selection, sale and selection-ring invalidation — 2026-10-31

In the same clean `localhost:5207` Planning session, native Chromium interactions selected `u1 ant_guard` through Owned Inventory (`Chọn`), reopened its detail, clicked `Bán thú · +1 vàng`, and confirmed the dialog stating the unit would be sold for one gold with zero equipment returned. After the confirmation, read-only progress inspection showed `board = []` and `bench = []`, with zero dialogs and the inventory modal closed. No direct Bridge mutation or LocalStorage write was used. This is a **PASS** for the native sale/removal and observed modal dismissal; the sale changed the clean save legitimately.

Read-only inspection of the live `window.__stage.scene` after removal found the selected-unit `RingGeometry` mesh (inner radius `0.55`, outer radius `0.66`, color `ffd36b`) with `visible = false`; only enemy preview UIDs `e0` and `e1` remained in the scene. Production `sync()` invalidates `selectedUid` when `findOwnedUnit()` no longer finds it, and `boardView` displays the ring only if the selected UID has a live slot. **PASS** for the observed absence of the Three.js selection highlight after legitimate unit removal. Closure-local `selectedUid` and the exact callback execution were not introspected, so they are supported by source rather than directly observed. Other invalidation cases and extended lifecycle remain unverified.

### Native Enemy Detail close and observable teardown — 2026-10-31

At the same clean 1280×800 Planning viewport, native mouse hover at `(709,338)` showed the `Lửng Đá ★1` enemy tooltip and native click opened `enemy-unit-detail`. Once the modal settled, `app.presentation.refreshEnemyDetail` was a function, one `[role=dialog]` was present, and the document had 75 canvases. Native `Escape` dismissed the dialog; settled read-only inspection found `app.modals.active() === null`, `app.presentation.refreshEnemyDetail === null`, zero dialog nodes, zero `.ui-inventory canvas` descendants, and the baseline 40 canvases. **PASS** for observable native open/close, registration/clearing of the refresh callback, and DOM canvas removal.

Source inspection traces `openPanelModal`'s change listener to `view.dispose()`, then the Enemy Detail disposer to Bridge `off()`, callback clearing and `mountReadonlyUnitInventory.dispose()`, then `createInventoryView.dispose()` to `viewer.dispose()`. Unsubscribe and renderer cleanup follow this path in source, but exact listener counts and GPU resource release were **not directly measured** in this observation. Full teardown stress/lifetime and reactive combat-status/death transitions remain unverified.


### Plan.pdf — sixteen requirement acceptance matrix

The statuses describe actual evidence; `PARTIAL` is not acceptance.

| ID | Requirement | Status | Evidence / outstanding check |
| --- | --- | --- | --- |
| 01 | Loading rainbow title and menu persistence | UNVERIFIED | Source evidence; complete loading/menu runtime check outstanding |
| 02 | Discord alignment and tooltip styling | UNVERIFIED | Visual comparison outstanding |
| 03 | Predominantly black text | UNVERIFIED | Source evidence; representative runtime views outstanding |
| 04 | Normal-Bonestay button typography | UNVERIFIED | Source evidence; computed-font/runtime comparison outstanding |
| 05 | Black tooltip background | UNVERIFIED | Runtime/legacy comparison outstanding |
| 06 | Synergy in Information (no direct Planning overlay) | PASS | Plan.pdf explicitly requests moving Synergy into Information; native landscape Planning `Thông tin` → `Cộng hưởng` rendered 9 role/element/faction rows. No `.pl-synergy` HUD exists, by design. |
| 07 | Chips, quantity and emoji | UNVERIFIED | Visual/a11y survey outstanding |
| 08 | Responsive Buy/Restock | PASS | Actual native Shop UI at 844×390, 390×844, 700×390 and 1280×800 verified width-dependent full/compact labels; native collapse/reopen and Buy ARIA labels retain names and prices. Landscape nameplate overlap is tracked separately. |
| 09 | Shop/Library cards, statistics, gold and padding | PARTIAL | Shared cards and key interactions passed; full visual parity outstanding |
| 10 | Tooltips vs `old_src` | UNVERIFIED | Legacy asset/behavior comparison outstanding |
| 11 | Billboard HP/rage always visible | PARTIAL | Live 700×390 native-hover priority/cleanup and 12 battlefield labels inspected; Jaguar/Toad mesh projection and screenshot prove presence, but small HP/rage text, silhouette readability, physical-device presentation and signpost asset coverage remain incomplete |
| 12 | Owned/Enemy Inventory Detail | PARTIAL | Native Three.js Owned bench/board selection, bench-to-board deployment, Equip/Unequip/Unequip All, duplicate guard, equipment persistence, Sell recovery and post-sale selection-ring disappearance passed; Enemy readonly and reactive HP/ATK/rage observed; friendly board/bench Owned Inventory mutation controls disabled during Combat (PASS for inspected cases). Native Escape removed the Enemy Detail modal and inventory canvases, and settled refresh callback cleared to null. Full-slot/tier/affordability, Crafting combat locking, canonical bypass rejection, impact-sync and comprehensive disposal remain outstanding |
| 13 | Item/equipment legacy assets | UNVERIFIED | `old_src` asset comparison outstanding |
| 14 | Friendly-unit hover tooltip beyond bench | PARTIAL | Native hover/click on bench `u1 ant_guard`, deployment to board index 12, then hover/click on deployed `u1` opened correct Owned Inventory; deployed `deer_song` also displayed name, HP, attack/defense, range and rage. Other placements, input devices and tooltip lifecycle still outstanding |
| 15 | External Emoji API | UNVERIFIED | Fallback and live coverage outstanding; do not expose API key |
| 16 | Enhanced crafting modal | PARTIAL | Unlock, staging, rejected recipe, successful tear→Blue Charm transaction, single ingredient consumption, cleared staging, history and reload persistence passed. Final visual parity, input edges and accessibility outstanding |

### Remaining release gates

Native pointer invalid/occupied drop, pointercancel and Synergy hit-testing; small creature silhouettes and detail readability at compact widths (not significant nameplate obstruction of Jaguar/Toad in the measured 700×390 frame); tooltip lifecycle after Shop collapse/reopen; equipment tier/full-slot/insufficient-gold guards and combat locking; impact-synchronous full diagnostics; WebGL/RAF/listener cleanup; final visual proof; complete Plan.pdf resolution; WBS-059 acceptance; final feature-branch push; upstream reconciliation; human merge review on exact final HEAD. No merge to `dev` is authorized without that approval.
