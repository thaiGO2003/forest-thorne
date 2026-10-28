# Arena verification checkpoint — 2026-10-28

This record covers the isolated `fix/world/woodless-arena` branch only. It does not certify the 16-item `docs/Plan.pdf` acceptance matrix.

## Verified changes

- Exterior `scenery-path-meanders` overlay removal was committed separately as `820c3ec`. The tactical grid, brown ring, bench perimeter, river and lamps remain in the source and structural test fixtures; the exact exterior-cell visual target has **not** received image-level approval.
- Overlapping tactical highlights use an explicit priority (`direct > area > invalid > valid > source > hover`) rather than the previous last-write-wins behavior. Each new batch resets prior instance priorities; clearing restores original checker colors.
- `tests/arena-mapping.test.ts` exercises direct/area/hover and invalid/valid/source in both input orders across `solo`, `coop2` and `coop4`, as well as a lower-priority subsequent batch, invalid coordinates, color restoration and instance-color dirty signals.
- `pnpm exec vitest run tests/arena-mapping.test.ts tests/scenery-presentation.test.ts`: **2 files / 12 tests PASS**.
- `pnpm typecheck`: **PASS**. `pnpm build`: **PASS** (Vite 95 modules).
- Independent headless Chromium/SwiftShader WebGL2 render of `createArena()`, `solo`, pixel center of tactical cell (2,1): checker RGBA `[35,55,4,255]`, direct-over-hover RGBA `[202,5,2,255]`, clear RGBA `[35,55,4,255]`. Real GPU draw calls: 34. This verifies visible highlight mutation and exact pixel restoration at one sampled cell, not all devices or camera angles.
- BrowserPanel remained accessible at the isolated preview; an earlier purchase of Kiến Hộ Vệ changed gold from 10 to 9. Its screenshot payload is not available for visual inspection.

## Not yet verified

- Specific unwanted exterior path cells versus surrounding terrain under the intended gameplay camera; no visual acceptance claim.
- Bench-to-board drag, valid/invalid/occupied drop, cancellation, UID preservation in the current Arena branch.
- Rendered GPU highlight under all three board profiles and real interactive drag highlights.
- Human review for the **final** feature-branch HEAD; PR #42 targets `dev` and must not merge until a matching human `APPROVED` review exists.

The older `docs/worktree-status-2026-10-21.md` remains a separate historical snapshot.
