# Issue #128 — browser evidence (partial)

Tool: OMP-managed headless Chromium and Playwright Chromium against Vite. Not BrowserPanel. Baseline served from detached `origin/dev` commit `45ac2af24a5dd5963ad19fa3ffcfe67cc954b244`; after images from the modified feature worktree before commit. All images show Settings → return-to-menu confirmation, with equivalent viewport and state.

| Viewport | Baseline | Feature |
|---|---|---|
| 1280 × 720 | `before-desktop-1280x720.png` | `after-desktop-1280x720.png` |
| 390 × 844 | `before-mobile-390x844.png` | `after-mobile-390x844.png` |

Baseline confirmation has Cancel, Confirm and Close; feature confirmation additionally has Back. At 390 × 844 the Back rectangle was [26, 243.22, 78.66, 40] and Close [326, 237.22, 44, 44]. Prior feature captures `desktop-confirm.png` and `mobile-confirm.png` are after images, not baselines.

## Observed behavior

- Settings confirmation → Back, Cancel, X and Escape restored the Display tab and focus to the home header action. Scroll/selection variants remain unverified.
- Library at 390 × 844: page 2/2 → `frog_alchemy` detail → Back restored page 2/2 and focused `frog_alchemy`. Search `kiến` yielded 2/15, selected `ant_guard`; Back restored query, count and card focus. Grid scroll was 0 before and after; nonzero scroll was not exercised. Other chip filters remain unverified.
- Crafting real-DOM Playwright regressions exercise workbench → library → item → Back twice, restoring parent search/selected item/scroll/focus, Escape and Close at depths one and two, and 50 history cleanup cycles. They use the production crafting UI with a deterministic bridge fixture rather than a full game run.
- Playwright modal regressions exercise Back, replacement without onClose, stale handles, mandatory modal Escape and backdrop, reentrant observers, disconnected focus target, keyboard and change-listener cleanup.
- Planning enemy detail → Back returned to Planning; preview preservation was not measured. Playwright full-game fixture verified Inventory → Library → Back restores the exact owned UID and current equipment; deleting that UID while Library is open returns to Planning without selecting another unit of the same species. Library → Inventory → Planning also restores the original Planning focus.

Targeted command before the final Planning Back change: `NODE_OPTIONS=--localstorage-file=.vitest-ls.json pnpm exec vitest --run tests/audio-modal-lifecycle.test.ts tests/unit-inventory.test.ts tests/craft-contracts.test.ts tests/craft-zoom.test.ts tests/info-modal-copy.test.ts tests/modal-back-navigation.test.ts tests/crafting-local-history.test.ts tests/modal-origin-inventory.test.ts`: 8 files, 51 tests passed. A subsequent combined run after the change failed 13 browser tests with Vite dynamic-import errors while 39 tests passed; an isolated rerun of `tests/modal-back-navigation.test.ts tests/crafting-local-history.test.ts` passed all 13. The full-game Playwright fixture uses Chromium, not BrowserPanel.

Final isolated inventory fixture: `NODE_OPTIONS=--localstorage-file=.vitest-ls.json pnpm exec vitest --run tests/modal-origin-inventory.test.ts` passed 4 tests, including Planning focus fallback. `pnpm typecheck`, `pnpm build`, and `git diff --check` passed afterward. Build emitted Vite's large-chunk warning.

Attempts to boot the deterministic Planning fixture with `scripts/qa/lib.mjs` against ports 4188 and 4191 each timed out waiting 120 seconds for `window.__app`. A separate managed browser open against port 4191 also timed out after 30 seconds. These observations do not establish a provider or network cause.

## Lifecycle measurement

On the real Settings screen, instrumented `EventTarget.addEventListener` and `removeEventListener` during 50 confirmation → Back cycles: canvas count 57 → 57, `history.length` 2 → 2, global dialogs 1 → 1, and one `window` keydown listener active at the end. The instrumentation saw 9,250 registrations and 49 explicit removals; 9,045 registrations belonged to detached nodes, which the instrumentation itself retained. Detached-node listeners may be garbage-collected with their targets, so this is neither proof of a leak nor proof of collection. Connected-node registrations at the end: 155. No heap/GC or GPU resource disposal measurement was made. Counts are scoped to registrations after instrumentation, not all pre-existing listeners.

## UNVERIFIED

Settings scroll and selection variants; Library nonzero scroll and role/faction/tier restoration; enemy preview preservation and invalid preview; heap collection and GPU disposal; BrowserPanel-specific evidence. The OMP-managed Chromium smoke attempt at port 4199 did not expose `window.__app` within 90 seconds; the full-game Playwright regression fixture did initialize and pass. These gates are not implied by the checks above.

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
