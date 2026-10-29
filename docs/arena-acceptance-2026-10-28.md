# Arena verification checkpoint — 2026-10-28

This record covers the isolated `fix/world/woodless-arena` branch only. It does not certify the 16-item `docs/Plan.pdf` acceptance matrix.

## Verified changes

- Exterior `scenery-path-meanders` overlay removal was committed separately as `820c3ec`. The tactical grid, brown ring, bench perimeter, river and lamps remain in the source and structural test fixtures; the exact exterior-cell visual target has **not** received image-level approval.
- Overlapping tactical highlights use an explicit priority (`direct > area > invalid > valid > source > hover`) rather than the previous last-write-wins behavior. Each new batch resets prior instance priorities; clearing restores original checker colors.
- `tests/arena-mapping.test.ts` exercises direct/area/hover and invalid/valid/source in both input orders across `solo`, `coop2` and `coop4`, as well as a lower-priority subsequent batch, invalid coordinates, color restoration and instance-color dirty signals.
- `pnpm exec vitest run tests/arena-mapping.test.ts tests/scenery-presentation.test.ts`: **2 files / 12 tests PASS**.
- `pnpm typecheck`: **PASS**. `pnpm build`: **PASS** (Vite 95 modules).
- Independent headless Chromium/SwiftShader WebGL2 render of `createArena()`, `solo`, pixel center of tactical cell (2,1): checker RGBA `[35,55,4,255]`, direct-over-hover RGBA `[202,5,2,255]`, clear RGBA `[35,55,4,255]`. Real GPU draw calls: 34. This verifies visible highlight mutation and exact pixel restoration at one sampled cell, not all devices or camera angles.
- Independent headless Chromium/SwiftShader WebGL2 render of `createArena()`, `coop2`, tactical cell (2,1): checker `[36,57,4,255]`, direct-over-hover `[202,7,2,255]`, restored `[36,57,4,255]`; 31 GPU draw calls.
- Independent headless Chromium/SwiftShader WebGL2 render of `createArena()`, `coop4`, tactical cell (2,1): checker `[34,55,4,255]`, direct-over-hover `[200,5,2,255]`, restored `[34,55,4,255]`; 28 GPU draw calls. All three profiles showed actual rendered pixel mutation and exact restoration, but these isolated Arena renderers do not prove live multiplayer Planning or drag behavior.
- BrowserPanel remained accessible at the isolated preview; an earlier purchase of Kiến Hộ Vệ changed gold from 10 to 9. Its screenshot payload is not available for visual inspection.
- Chromium/SwiftShader Planning at 960×640 completed **10/10** actual mouse-pointer scenarios under test-only throttled `requestAnimationFrame`. `EndlessPvEClassic`/`EASY` reached `PLANNING`; two real shop purchases succeeded (gold 10 → 7), creating canonical `u1` and `u2`.
- Seven accepted gestures made **exactly one** `bridge.move` call each; three invalid/cancelled gestures made **zero** calls. Every scenario retained both canonical UIDs, reused the moved unit's existing Three.js visual-root UUID and left canonical placement untouched throughout its drag preview.
- Real Playwright mouse events targeted canvas coordinates projected from the live Three.js camera; the cancellation case injected a synthetic DOM `pointercancel` after real mouse movement. The probe recorded no page errors, failed requests or console errors.
- Exterior investigation using instance transforms, raycasts, WebGL pixel readback and visibility isolation identified the suspicious brown/orange patches as legitimate `bench-perimeter` instance 19 at world (7, 0.08, 1) and `brown-ring` instance 19 at world (5, 0.06, 3); production geometry was unchanged.

## Chromium Planning drag/drop — pointer acceptance

Headless Chromium/ANGLE SwiftShader, viewport 960×640, device scale 1, real WebGL scene, `EndlessPvEClassic` / `EASY`, phase `PLANNING`. The external diagnostic script `/tmp/forest-throne-drag-probe.mjs` delayed 9 of 10 RAF callbacks by 35 ms as **test-only instrumentation**; no production renderer changes were made. It bought two units, then used real Playwright mouse down/move/up over projected source and target locations.

| Scenario | Observed canonical placement after gesture | `bridge.move` calls (before → after) | Result |
| --- | --- | ---: | --- |
| Bench `u1` → board cell 12 | Board 12=`u1`; bench [`u2`] | 0 → 1 | PASS |
| Board 12 → board 13 | Board 13=`u1`; bench [`u2`] | 1 → 2 | PASS |
| Board 13 → bench slot 1 | Board empty; bench [`u2`, `u1`] | 2 → 3 | PASS |
| Occupied bench swap, slot 0 → 1 | Board empty; bench [`u1`, `u2`] | 3 → 4 | PASS |
| Bench `u1` → board 12 again | Board 12=`u1`; bench [`u2`] | 4 → 5 | PASS |
| Bench `u2` → board 13 | Board 12=`u1`, 13=`u2`; bench empty | 5 → 6 | PASS |
| Occupied board swap, cell 12 → 13 | Board 12=`u2`, 13=`u1`; bench empty | 6 → 7 | PASS |
| Invalid drop onto same cell 13 | Board 12=`u2`, 13=`u1`; unchanged | 7 → 7 | PASS |
| Drag onto river visual column 5 | Board 12=`u2`, 13=`u1`; unchanged | 7 → 7 | PASS |
| Pointer cancellation during drag | Board 12=`u2`, 13=`u1`; unchanged | 7 → 7 | PASS |

Every case checked canonical placement, movement count, UIDs and Three.js root reuse. In-progress preview snapshots matched canonical pre-drag placement; final UIDs remained `u1` and `u2`, with no duplication or loss. Occupied bench and board drops are intentionally **valid swaps**, not rejected drops. The final canonical board had cell 12=`u2` and cell 13=`u1`, bench empty, and exactly seven successful movement transactions. Probe summary: `PROBE_PASS` 10 cases, page errors 0, failed requests 0, console errors 0.

The cancellation probe used a synthetic DOM `pointercancel` event **after** moving the physical mouse through Playwright. It does not establish native browser/OS pointer cancellation behavior.


## Not yet verified

- The intended exterior visual appearance across profiles still needs design-level image approval; identified perimeter patches are legitimate world geometry, not decorative paths, but aesthetics remain unapproved.
- Unthrottled headless RAF responsiveness, mobile/touch Planning gestures, native browser/OS pointer cancellation, interactive live drag-highlight pixel feedback, and end-to-end cooperative Planning remain unverified.
- Human review for the **final** feature-branch HEAD; PR #42 targets `dev` and must not merge until a matching human `APPROVED` review exists.

The older `docs/worktree-status-2026-10-21.md` remains a separate historical snapshot.
