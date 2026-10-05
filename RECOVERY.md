# GUI/runtime recovery audit

## Evidence and base

- Restoration branch: `codex/recover-deleted-runtime`, based on main `2d35774`.
- `4afd54f` changes exactly four WBS/plan documents. It does not change application code.
- `f7b6bce` merged old main using the `ours` strategy; its tree matches `4afd54f`.
- PR #1 merge `0026422` has that same tree. Compared with its main parent `a5cf72e`, it deletes 118 files, adds 23 and modifies 15. The merge therefore removed GUI/runtime work despite its docs-oriented title.
- Historical main supplies missing assets/runtime (`a5cf72e`). `c4211f0` supplies later library, localization and portrait improvements.
- The other agent's `codex/wbs-nonvisual-runtime` tip `4957850` supplies newer audio, co-op/PvP transport, mod and service-worker modules. Import these modules rather than rolling current gameplay core back to that branch.
- Existing WBS files, changelog and all gameplay core rules remain unchanged. Locale keys are additive; current values win.

## Integration decisions

- Keep the newer menu/loading/planning/settings/craft/inventory/tech/synergy screens and all-catalog procedural models. Restore a single application router and bridge to mount them from `src/main.ts`.
- Keep one simulator/save schema and one modal manager. Recovered library/history/result views delegate to that manager. Planning mutations persist through the bridge checkpoint; combat resolves once and presentation only replays its event stream.
- Reconnect the current HUD frame hook, saved enemy preview, pointer placement, keyboard bindings, tutorial event handoffs and render settings. Imports/clears discard stale in-memory runs before returning to the menu.
- Recovered combat uses current combat staging and speed rules, including delayed melee impact and reflect events. Result publication is guarded against duplicate/stale sessions; interrupted combat is replayed from its saved encounter.
- Dispose canvases, observers, tooltips, portraits, frame hooks and audio with their screens. Non-dismissible result/augment dialogs remain blocking on Escape.

## Limits kept explicit

- Current mode availability gates remain unchanged. Restored network/mod/platform APIs do not by themselves expose multiplayer, Discord or mod selection in the GUI.
- Neither source snapshot supplies the referenced music files. The mounted music director uses an empty playlist until real assets exist; synthesized semantic SFX are connected.
- Authored two-species rigs are recovered as source/reference. Live screens keep the newer procedural factory. A small adapter supplies combat stance/death/revival and preview callbacks, rather than a second active model catalog.
- The current tutorial core remains authoritative. A basic guide, dismissal/skip and input events are connected; complete authored hover/target highlighting, persistent craft-staging guidance and all eight rounds of guided play are not claimed as verified. The guide can be skipped.
- Gamepad, haptics, speech, profiler and Discord modules are recovered APIs; optional GUI wiring and hardware checks remain separate work.
- Combat cycle/queue/strength readouts are presentation summaries; no extra combat-turn semantics or simulation rules are invented.

## Verification

- `corepack pnpm build`: passed. `corepack pnpm test`: 41 files / 267 tests passed.
- `node scripts/recovery-smoke.mjs` with Vite running: passed desktop/mobile menu, pointer deployment, reload/Continue persistence, modal input blocking, settings Escape, clear/import save, combat playback/result idempotence, library portrait and horizontal overflow. Also asserts shop chrome stays bounded to the shop.
- `node scripts/recovery-production-smoke.mjs` against Vite preview: passed production menu/planning, worker version match and offline reload.
- Restored unit tests plus new bridge/playback/preview regression cases. `git diff --check`: passed.

## Every deleted path

118 original deleted paths accounted for: 14 adapted, 4 archived source, 11 newer agent, 11 replaced, 78 restored.

| Original path | Decision | Source / replacement |
|---|---|---|
| `art/drafts/1790422524234_2088405255220937659_6074456564390673420_b16aa6c9af7193c67e7451e76a34c5ff.jxl` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `art/drafts/1790422572337_2088405255220937659_6074456564390673420_4d1508ada7ade43d2d6ab1d2123aaa51.jxl` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `art/drafts/source/1790422524234_2088405255220937659_6074456564390673420_b16aa6c9af7193c67e7451e76a34c5ff.jpg` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `art/drafts/source/1790422572337_2088405255220937659_6074456564390673420_4d1508ada7ade43d2d6ab1d2123aaa51.jpg` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/bar_trough.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/btn_blue_disabled.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/btn_blue_hover.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/btn_blue_normal.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/btn_blue_pressed.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/btn_blue_selected.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/btn_close_hover.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/btn_close_normal.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/btn_close_pressed.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/btn_green_disabled.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/btn_green_hover.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/btn_green_normal.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/btn_green_pressed.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/btn_green_selected.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/btn_icon_disabled.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/btn_icon_hover.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/btn_icon_normal.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/btn_icon_pressed.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/btn_icon_selected.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/btn_plum_disabled.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/btn_plum_hover.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/btn_plum_normal.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/btn_plum_pressed.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/btn_plum_selected.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/btn_red_disabled.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/btn_red_hover.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/btn_red_normal.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/btn_red_pressed.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/btn_red_selected.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/btn_wood_disabled.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/btn_wood_hover.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/btn_wood_normal.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/btn_wood_pressed.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/btn_wood_selected.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/bubble.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/card_t1.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/card_t2.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/card_t3.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/card_t4.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/card_t5.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/card_t6.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/frame_bar.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/frame_rage_cell.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/joy_base.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/joy_knob.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/manifest.json` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/panel_parchment.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/panel_tooltip.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/panel_wood.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/ribbon.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/shade.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/shell_billboard.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/slot_well.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/star.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/assets/ui/generated/tile_status.png` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `public/mods/index.json` | Newer agent | 4957850; current core contracts retained. |
| `scripts/gen-ui-kit.mjs` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `src/app/Haptics.ts` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `src/app/PerformanceProfiler.ts` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `src/app/app.ts` | Adapted | Historical view/API adapted to current screens, model factory and core. |
| `src/app/bootWatchdog.ts` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `src/app/bridge.ts` | Adapted | Historical view/API adapted to current screens, model factory and core. |
| `src/app/screens.ts` | Replaced | src/app/app.ts owns routes; current src/ui/screens remain the screen implementations. |
| `src/audio/MusicDirector.ts` | Newer agent | 4957850; current core contracts retained. |
| `src/audio/SoundEffects.ts` | Newer agent | 4957850; current core contracts retained. |
| `src/core/appMeta.ts` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `src/core/browserSpeech.ts` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `src/core/combatSpeech.ts` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `src/data/musicPlaylists.ts` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `src/data/unitSfxProfiles.ts` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `src/env.d.ts` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `src/mods/ModRegistry.ts` | Newer agent | 4957850; current core contracts retained. |
| `src/network/coopCombatSync.ts` | Newer agent | 4957850; current core contracts retained. |
| `src/network/coopConfig.ts` | Newer agent | 4957850; current core contracts retained. |
| `src/network/coopSession.ts` | Newer agent | 4957850; current core contracts retained. |
| `src/network/pvpFortress.ts` | Newer agent | 4957850; current core contracts retained. |
| `src/platform/discordActivity.ts` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `src/platform/serviceWorkerClient.ts` | Replaced | src/platform/serviceWorker.ts from 4957850 |
| `src/platform/serviceWorkerPolicy.ts` | Replaced | public/sw.js + tests/service-worker.test.ts from 4957850 |
| `src/round/GamepadController.ts` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `src/sw.ts` | Replaced | public/sw.js from 4957850 (single worker) |
| `src/ui/card.ts` | Adapted | Historical view/API adapted to current screens, model factory and core. |
| `src/ui/combat.ts` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `src/ui/history.ts` | Adapted | Historical view/API adapted to current screens, model factory and core. |
| `src/ui/kit.ts` | Adapted | Historical view/API adapted to current screens, model factory and core. |
| `src/ui/library.ts` | Adapted | Historical view/API adapted to current screens, model factory and core. |
| `src/ui/loading.ts` | Replaced | src/ui/screens/loadingView.ts |
| `src/ui/menu.ts` | Replaced | src/ui/screens/mainMenu.ts |
| `src/ui/modal.ts` | Adapted | Historical view/API adapted to current screens, model factory and core. |
| `src/ui/planning.ts` | Replaced | src/ui/screens/planningHud.ts + src/world/unitManager.ts |
| `src/ui/settings.ts` | Replaced | src/ui/screens/settingsModal.ts |
| `src/ui/techTree.ts` | Replaced | src/ui/screens/techModal.ts |
| `src/ui/tooltip.ts` | Adapted | Historical view/API adapted to current screens, model factory and core. |
| `src/ui/ui.css` | Adapted | Historical view/API adapted to current screens, model factory and core. |
| `src/units/billboard.ts` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `src/units/boardView.ts` | Adapted | Historical view/API adapted to current screens, model factory and core. |
| `src/units/combatPlayer.ts` | Adapted | Historical view/API adapted to current screens, model factory and core. |
| `src/units/fx.ts` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `src/units/kit.ts` | Archived source | Restored authored rig source; production uses src/world/units/factory.ts. |
| `src/units/portraits.ts` | Adapted | Historical view/API adapted to current screens, model factory and core. |
| `src/units/registry.ts` | Adapted | Historical view/API adapted to current screens, model factory and core. |
| `src/units/rig.ts` | Archived source | Restored authored rig source; production uses src/world/units/factory.ts. |
| `src/units/roster/jaguarHunt.ts` | Archived source | Restored authored rig source; production uses src/world/units/factory.ts. |
| `src/units/roster/toadPoison.ts` | Archived source | Restored authored rig source; production uses src/world/units/factory.ts. |
| `tests/audio-speech-events.test.ts` | Replaced | Audio cases are replaced by tests/audio-music.test.ts, tests/audio-sfx.test.ts and tests/audio-continuity.test.ts; speech-specific event/rate-limit cases remain a follow-up. |
| `tests/coop-network.test.ts` | Newer agent | 4957850; current core contracts retained. |
| `tests/gamepad-controller.test.ts` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `tests/haptics-speech.test.ts` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `tests/mod-registry.test.ts` | Newer agent | 4957850; current core contracts retained. |
| `tests/music-director.test.ts` | Replaced | tests/audio-music.test.ts + tests/audio-continuity.test.ts use the newer audio API. |
| `tests/performance-profiler.test.ts` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `tests/platform-bootstrap.test.ts` | Restored | a5cf72e source/assets; API recovery does not imply all optional integrations are enabled. |
| `tests/pvp-fortress.test.ts` | Newer agent | 4957850; current core contracts retained. |
| `tests/unit-visuals.test.ts` | Adapted | Historical view/API adapted to current screens, model factory and core. |
