# Occupied-tile hover acceptance — 2026-10-29

## Scope and source

- Feature branch: `feat/ui/occupied-tile-hover`; isolated worktree `/home/thaigo/forest-thorne-dev`.
- Base commit at time of browser acceptance: `4f1c6c29f196eb07cd8a22c22a1100bf2eb00bff`, plus uncommitted changes to `src/app/planningDrag.ts`, `src/world/arena.ts`, and `tests/planning-drag.test.ts`. The probes exercise the running local preview of this worktree, not the base commit by itself.
- Presentation-only behavior: raycast visible unit roots first; if no unit is picked, resolve an occupied tactical tile. Allied occupancy reads `run.board`, enemy occupancy uses the current rendered `BoardView`. Highlight canonical slots. Enemy uses semantic `enemy` role (color `0xe66c65`), allied `hover` uses `0xb9e978`.
- No changes to drag-source selection, canonical board geometry, movement transactions, or production renderer instrumentation.

## Runtime

Headless real Chromium with ANGLE SwiftShader and WebGL2, `EndlessPvEClassic/EASY`, phase `PLANNING`, two purchased units assigned to board indices 12 and 13 (`u1`, `u2`). Browser probes use external, test-only animation throttling and renderer settings; they do not modify production code.

- Hover and overlap: viewport 800×520, device scale 1; render scale 0.5 for overlap.
- Full-scene mouse hover: actual Playwright pointer movement, native Three.js raycasting, live canvas and BoardView; renderer drew 57 allied and 47 enemy calls in observed full-scene samples.
- GPU: synchronous `gl.readPixels` after actual WebGL2 render, isolated sampling of the real tactical `InstancedMesh`, lighting and camera; one draw call per isolated sample.
- External scripts: `/tmp/forest-hover-probe.mjs`, `/tmp/forest-gpu-pixels.mjs`, `/tmp/forest-hover-overlap.mjs`, `/tmp/forest-throne-drag-probe.mjs`. Scripts remain outside the repository.

## Acceptance matrix

| Scenario | Observation | Result |
| --- | --- | --- |
| Allied direct model | Correct UID, canonical slot, allied hover, matching tooltip | PASS |
| Allied occupied tile fallback | Tile raycast resolves same allied UID when model is missed | PASS |
| Adjacent occupied tile | Correct neighboring UID and canonical location | PASS |
| Empty tactical cell | Tile highlights without unit tooltip/selection | PASS |
| River interior | Not treated as occupiable tactical tile | PASS |
| Pointerleave | Clears hover, unit highlight and preview | PASS |
| Idle pointercancel | Clears hover presentation without a drag | PASS |
| Enemy direct model | Rendered enemy UID, semantic red role | PASS |
| Enemy occupied tile | Rendered enemy slot resolves through BoardView | PASS |

CPU-side hover acceptance: **9/9 scenarios PASS**. Live run board placements remained unchanged; `bridge.move()` calls **0**; tooltip and hover cleanup PASS.

### Direct-model-overlap priority

The 2026-10-29 Chromium probe temporarily moved the Three.js visual root for `u1` over `u2`'s occupied tile, hiding `u2`'s visual root while preserving both canonical slots. Screen pointer (307,248) hit the direct model. Model and tile were deliberately distinct UIDs:

- Visible direct model `u1`: hovered canonical (col=2,row=2), tooltip for Kiến Hộ Vệ, `moves=0`.
- With `u1` visual root hidden at the same pointer: fallback occupied tile `u2`, canonical (col=3,row=2), `moves=0`.
- All visual root positions and visibilities restored. Canonical board `board[12]=u1`, `board[13]=u2` unchanged.
- **9/9 overlap assertions PASS**, final marker `DIRECT_MODEL_OVERLAP_PASS`. On the post-sync run, `pageErrors=[]`, `consoleErrors=[]`, `EXPECTED_MENU_AUDIO_ABORTS=[menu_leaf_01.mp3: net::ERR_ABORTED]`, `UNEXPECTED_REQUEST_FAILURES=[]`; the raw `requestFailures` array retains that expected cancellation.

The diagnostic explicitly reports raw `requestFailures`, `EXPECTED_MENU_AUDIO_ABORTS` and `UNEXPECTED_REQUEST_FAILURES`. Only local menu-audio URLs cancelled with `net::ERR_ABORTED` on navigation are classified expected. All unrelated failures remain failures. An earlier run recorded a cancelled `menu_leaf_01.mp3` and passed all eight behavior/restoration assertions but failed the old blanket browser-error check; the corrected diagnostic and full scenario subsequently passed. No production change was made to hide this cancellation.

## Instance-color and framebuffer evidence

Three.js CPU `tiles.instanceColor.array` uses linear-color channel values. Observed RGB:

| Cell / state | Linear RGB |
| --- | --- |
| Allied baseline | [0.1144353747, 0.4232676625, 0.0481718257] |
| Allied hover | [0.4851499498, 0.8148465753, 0.1878207773] |
| Adjacent baseline and allied hover | [0.1589608341, 0.5209955573, 0.0684781671] |
| Enemy baseline | [0.1589608341, 0.5209955573, 0.0684781671] |
| Enemy hover | [0.7912979126, 0.1499597877, 0.1301364750] |

Real isolated WebGL2 framebuffer RGBA:

| Pixel sample | Baseline | Allied hover | Restored | Enemy hover |
| --- | --- | --- | --- | --- |
| Allied | [88,116,28,255] | [167,157,57,255] | [88,116,28,255] | [88,116,28,255] |
| Adjacent | [102,128,34,255] | [102,128,34,255] | [102,128,34,255] | [102,128,34,255] |
| Enemy | [101,128,33,255] | [101,128,33,255] | [101,128,33,255] | [207,72,47,255] |

GPU probe: **10/10 assertions PASS**, marker `GPU_PROBE_PASS`; allied changes/restores, neighbor unchanged, enemy red, no gameplay mutations, no unexpected browser errors. Framebuffer RGB is lighting/tone-mapped output and is not identical to CPU instance-color RGB.

A previous non-isolated adjacent pixel appeared to change because a DOM parchment overlay covered the screenshot sampling location. The isolated live framebuffer verification showed the adjacent tactical tile unchanged. The overlay-covered screenshot is **not** accepted as evidence of tactical-tile color correctness.

## Drag/drop and repository verification

Chromium Planning mouse drag/drop probe: **10/10 scenarios PASS**, marker `PROBE_PASS`: bench→board, board→board, board→bench, occupied-bench swap, two further bench→board placements, occupied-board swap, invalid same-cell drop, river exclusion, and synthetic pointer cancellation. Exactly **7 successful movement transactions**; invalid/cancelled gestures caused none. Canonical placements, unit UIDs and Three.js visual-root reuse were verified after each gesture.

Previously executed on the occupied-tile worktree, with no intervening production-code changes before the overlap diagnostic correction:

```sh
pnpm exec vitest run tests/board-picking.test.ts tests/planning-drag.test.ts
# 2 files passed; 6 tests passed
pnpm typecheck
# PASS
pnpm build
# PASS (Vite 7.3.6, 95 modules)
git diff --check
# PASS
```

Post-sync on merged feature HEAD `a78f343b47b88eb5090097af4af97721fc3e97a5` (includes `origin/dev` at `7239c12f8019134ed729b08af243f48d00303ad7`): targeted Vitest **2 files / 6 tests PASS**, `pnpm typecheck` **PASS**, `pnpm build` **PASS**, `git diff --check` **PASS**. The Chromium direct-model-overlap probe reran and **9/9 PASS** with real WebGL2, unchanged canonical board and no movement calls. A separate attempt to rerun the 10-case mouse drag script reached PLANNING with two purchased units, then timed out in its CDP state evaluation before the first drag; the timeout does not establish a gameplay regression or a post-sync 10/10 PASS. The recorded drag 10/10 above belongs to the pre-sync source state.

## Limits and remaining gates

- Mouse-driven headless Chromium with software WebGL2 is verified, **not** native touchscreen/OS pointer cancellation, multi-device GPU fidelity, or unthrottled visual responsiveness.
- Native mobile Planning drag/drop and touch camera interactions remain to be accepted.
- This report does not certify Shop/Library, crafting transactions, Cooperative 2P/4P gameplay, all 16 `docs/Plan.pdf` requirements, Cloudflare deployment, or production release.
- Feature branch has synchronized with `origin/dev` and includes `origin/main` at the recorded post-sync HEAD. Human merge review matching the final exact HEAD and `Target: dev` remains mandatory. Agents cannot self-approve. No production release is authorized by this report.
