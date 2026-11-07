# Issue #128 — browser evidence (partial)

Tool: OMP-managed headless Chromium and Playwright Chromium against Vite. Not BrowserPanel. Baseline served from detached `origin/dev` commit `45ac2af24a5dd5963ad19fa3ffcfe67cc954b244`; after images from the modified feature worktree before commit. All images show Settings → return-to-menu confirmation, with equivalent viewport and state.

| Viewport | Baseline | Feature |
|---|---|---|
| 1280 × 720 | `before-desktop-1280x720.png` | `after-desktop-1280x720.png` |
| 390 × 844 | `before-mobile-390x844.png` | `after-mobile-390x844.png` |

Baseline confirmation has Cancel, Confirm and Close; feature confirmation additionally has Back. At 390 × 844 the Back rectangle was [26, 243.22, 78.66, 40] and Close [326, 237.22, 44, 44]. Prior feature captures `desktop-confirm.png` and `mobile-confirm.png` are after images, not baselines.

## Observed behavior

- Full-game Chromium fixture: Settings → return-menu confirmation → Back, Cancel, X and Escape each restored the selected Keys tab, changed audio option, focused control, nonzero settings-body scroll and nonzero horizontal tab scroll. A separate keyboard test restored focus to the header action.
- Library browser-module fixture: Back restored query, role, faction and tier selections, page 2, nonzero grid and modal scroll, and focused card. Its deterministic catalog fixture changes one unit faction and constrains layout to force multiple pages and scroll; it is not a full-game WebGL run.
- Library detail: browser-module fixture verified selected star, skin and animation controls through star/skin changes, and reset of star and animation controls after root reopen. Its stateful viewer double models the real viewer's action reset on `setUnit`; assertions verify semantic `attack` after both changes and `idle` after root reopen, not just button appearance. Skin explicitly equipped through the existing collection account remains equipped across root reopen; this is persistent account equipment, not a transient preview. A full-game Chromium test exercises the real portrait canvas and animation/star controls, but does not measure rendered animation poses.
- Crafting real-DOM Playwright regressions exercise workbench → library → item → Back twice, restoring parent search/selected item/scroll/focus, Escape and Close at depths one and two, and 50 history cleanup cycles. They use the production crafting UI with a deterministic bridge fixture rather than a full game run.
- Playwright modal regressions exercise Back, replacement without onClose, stale handles, mandatory modal Escape and backdrop, reentrant observers, disconnected focus target, keyboard and change-listener cleanup.
- Full-game Chromium fixture verified enemy hover → detail → Back produces visible target-preview arrows, and that replacing the inspected UID while detail is open clears stale arrows and focuses the Planning HUD. It also verified Inventory → Library → Back restores the exact owned UID and current equipment; deleting that UID returns to Planning without selecting another unit of the same species.

Aggregate verification uses `NODE_OPTIONS=--localstorage-file=.vitest-ls.json pnpm exec vitest --run --no-file-parallelism tests/audio-modal-lifecycle.test.ts tests/unit-inventory.test.ts tests/craft-contracts.test.ts tests/craft-zoom.test.ts tests/info-modal-copy.test.ts tests/modal-back-navigation.test.ts tests/crafting-local-history.test.ts tests/modal-origin-inventory.test.ts tests/settings-confirm-navigation.test.ts tests/library-session-browser.test.ts`. After fixture isolation, a serialized run passed 10 files / 64 tests.
`pnpm typecheck`, `pnpm build` and `git diff --check` also passed after the final code and test changes; Vite emitted its large-chunk warning.

Earlier concurrent runs were unstable: one reported 13 browser dynamic-import failures without recording the underlying HTTP responses, and another timed out the modal fixture's 10-second setup hook while Vite's dependency scan was running; the scan then reported that its server was closed. The exact cause of the original 13 failures is not established by that output. The two small DOM fixtures now use separate temporary Vite caches, disable unnecessary dependency discovery, and allow 60 seconds for setup; the documented aggregate command also serializes files. These changes mitigate observed setup contention/cache sharing; they do not retroactively prove the original HTTP failure cause.

Attempts to boot the deterministic Planning fixture with `scripts/qa/lib.mjs` against ports 4188 and 4191 each timed out waiting 120 seconds for `window.__app`. A separate managed browser open against port 4191 also timed out after 30 seconds. These observations do not establish a provider or network cause.

## Lifecycle measurement

Full-game Chromium instrumented listeners using WeakMap keys, without retaining detached elements. After warm-up, 60 Settings confirmation → Back cycles had these before → after counts: window listeners 21 → 21; document listeners 2 → 2; connected-node listeners 314 → 314; canvases 48 → 48; history length 2 → 2, state `null` → `null`; active modal `settings` and modal roots 1 → 1. Detached-node GC, heap and GPU resources were not measured; equal live counts do not prove their collection.

## UNVERIFIED

Rendered animation poses/timing across star or skin changes; heap collection and GPU disposal; BrowserPanel-specific evidence; exact cause of the earlier 13 dynamic-import failures. The OMP-managed Chromium smoke attempt at port 4199 did not expose `window.__app` within 90 seconds; the full-game Playwright fixture did initialize and pass.

## Modal → parent → Back matrix

| Surface | Parent | Back |
|---|---|---|
| Settings return-menu confirmation | Settings | Yes; Cancel/X/Escape also return |
| Library unit detail opened from browse | Library browse | Yes, local |
| Library detail opened directly | None | No |
| Owned-unit inventory | Planning | Yes |
| Library detail opened from owned inventory | Same owned inventory | Yes |
| Enemy detail | Planning preview | Yes |
| Crafting child or nested item/recipe | Immediate local parent | Yes; X/Escape dismisses child flow |
| Root Menu, Settings, Library, Recipes, Craft, Tech, History, Inventory, Information | None | No |
| Mandatory augment, blessing, result | None | No; non-dismissible |
