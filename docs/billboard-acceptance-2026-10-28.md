# Billboard world-space acceptance — 2026-10-28

Scope: isolated `fix/units/billboard-world-anchor` PR #44 targeting `dev`. This checkpoint verifies Billboard behavior; it does **not** certify all 16 requirements in `docs/Plan.pdf` or approve a merge.

## Production change

- `src/units/boardView.ts`: project the existing Three.js Sprite anchor using `s.v.anchor.getWorldPosition(projected)`, then transform into camera space and apply the existing culling/priority/scale logic. This handles rotated, translated and scaled ancestor transforms without changing canonical board coordinates, Stage ownership or UID-keyed visual roots.
- Original implementation commit: `8aa54cb45ec4d1a7f13568efb6d65b3620c481ea`. Previously published synchronized PR head: `ece2203a0f1fdfb1d08483531db90f2af678bfff`.

## Verified checks

- Two transformed-parent regression cases reproduced incorrect projection before the fix and passed after the change. `pnpm exec vitest run tests/board-view-presentation.test.ts`: **12/12 PASS**. `pnpm typecheck`, `pnpm build` and `git diff --check`: **PASS** after synchronization with `origin/dev`.
- Actual Chromium/WebGL2: desktop projection, offscreen culling, mobile landscape, mobile portrait, and portrait in-frame deployment at board index 14: **PASS**. The 390×844 portrait case observed `sprite.visible === true`, a present texture map and actual Sprite world width `1.3794725702302464` against expected `1.3794725702302462`.
- Dense actual Chromium/SwiftShader WebGL2 fixture at 960×640: 25 allied + 25 enemy units, 50 Three.js Sprite instances, 10 visible accepted labels, 40 hidden. Selected and hovered labels were visible at 252 px; the eight remaining labels were compact at 128 px. Screen-space collision and clipping checks both returned empty arrays. Page errors, console errors and failed requests: **0**.
- Dense fixture was isolated from the production Planning BoardView by hiding 3 pre-existing UID roots. That isolation prevents a second presentation callback from contaminating the fixture; it is not a change to production gameplay.
- Captured probe output confirms `DENSE_50_BILLBOARD_PASS`, `UNTHROTTLED_RAF_PROGRESS_PASS` and `CAMERA_DOLLY_BILLBOARD_PASS`. The source also prints `DENSE_SCREENSHOT_PASS` after writing its PNG, but the final background-job exit code and that marker from the same invocation were not independently captured; the old job handle is no longer available.
- The probe source saves the WebGL canvas to `/tmp/forest-billboard-dense-50-20261028.png` after stopping its throwaway animation loop. That file exists as a 960×640 PNG (320103 bytes, last modified 2026-10-28 15:10:27 +07:00). Separate visual inspection found 10 `Kiến Hộ Vệ` nameplates legible, none visibly clipped, and no clear label-to-label overlap. Health/energy indicators and the selection ring remain visible. The file's exact provenance relative to the last probe invocation remains unverified.

## Camera-distance scaling

The same Chromium/WebGL2 probe moved the camera closer by 1.5 world units and then restored it; the selected Sprite stayed visible throughout. Measurements:

| Property | Before | After dolly | Restored |
| --- | ---: | ---: | ---: |
| Camera-space depth | 13.258528921924404 | 11.758528921924402 | 13.258528921924404 |
| Sprite world width | 4.324841716054403 | 3.8355519455011833 | 4.324841716054403 |
| Formula-derived expected width | 4.324841716054402 | 3.835551945501183 | 4.324841716054402 |

The width tracks camera-space depth while retaining the same screen-space target. No production camera change was needed.

## Limits and remaining gates

- The unthrottled SwiftShader run recorded **25 RAF callbacks over 2003.9 ms** with a **1050 ms maximum gap**. This proves loop progress, **not** stable frame pacing or 60 FPS. The renderer reported 249 draw calls, which is **not** FPS. Representative device/GPU performance remains unverified.
- Captured visual layout and deterministic collision bounds do not guarantee appearance at every viewport, game state, or device. Native mobile touch and cooperative Planning interactions are separate acceptance tasks.
- PR #44 requires a matching **human** merge review (`Head`, `Target: dev`, `Status: APPROVED`) before integration. No agent-generated approval and no direct push to `dev` or `main`.

Temporary diagnostic sources: `/tmp/forest-billboard-dense-raf-probe.mjs` and the PNG above are not production assets.
