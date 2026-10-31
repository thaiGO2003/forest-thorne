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
| 11 | Billboard HP/rage always visible | PARTIAL | Source updated and targeted test passed; representative visual runtime check outstanding |
| 12 | Owned/Enemy Inventory Detail | PARTIAL | Native Three.js Owned selection, Equip/Unequip/Unequip All, duplicate guard, equipment persistence and Sell recovery passed; Enemy readonly and reactive HP/ATK/rage observed; friendly board/bench Owned Inventory mutation controls disabled during Combat (PASS for inspected cases). Full-slot/tier/affordability, Crafting combat locking, canonical bypass rejection, impact-sync and disposal remain outstanding |
| 13 | Item/equipment legacy assets | UNVERIFIED | `old_src` asset comparison outstanding |
| 14 | Friendly-unit hover tooltip beyond bench | PARTIAL | Native hover on friendly deployed `deer_song` displayed name, HP, attack/defense, range and rage; native click opened correct Owned Inventory. Other placements, input devices and tooltip lifecycle still outstanding |
| 15 | External Emoji API | UNVERIFIED | Fallback and live coverage outstanding; do not expose API key |
| 16 | Enhanced crafting modal | PARTIAL | Unlock, staging, rejected recipe, successful tear→Blue Charm transaction, single ingredient consumption, cleared staging, history and reload persistence passed. Final visual parity, input edges and accessibility outstanding |

### Remaining release gates

Native pointer invalid/occupied drop, pointercancel/leave and Synergy hit-testing; overlapping 3D battlefield nameplates at 700×390; tooltip lifecycle after Shop collapse/reopen; equipment tier/full-slot/insufficient-gold guards and combat locking; impact-synchronous full diagnostics; WebGL/RAF/listener cleanup; final visual proof; complete Plan.pdf resolution; WBS-059 acceptance; final feature-branch commit and push; upstream reconciliation; human merge review on exact final HEAD. No merge to `dev` is authorized without that approval.
