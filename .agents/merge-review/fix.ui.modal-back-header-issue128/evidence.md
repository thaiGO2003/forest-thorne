# Issue #128 addendum — modal header evidence

Baseline: `ff435c84faaeff9086faa09cf409ebe12320aa34` (origin/dev). Screenshots use Playwright Chromium headless against Vite, deviceScaleFactor 1, full game and real modal surfaces; they are not BrowserPanel captures. The game stage was capped at 5 FPS and low render scale solely for screenshot reliability under SwiftShader. CSS viewport sizes remain exactly 390×844 and 1280×720.

| Surface | 390×844 before / after | 1280×720 before / after |
|---|---|---|
| Library root: Close only | `before-library-root-mobile.png` / `after-library-root-mobile.png` | `before-library-root-desktop.png` / `after-library-root-desktop.png` |
| Settings: header action + Close | `before-settings-root-mobile.png` / `after-settings-root-mobile.png` | `before-settings-root-desktop.png` / `after-settings-root-desktop.png` |
| Settings return confirmation: Back + Close | `before-settings-confirm-mobile.png` / `after-settings-confirm-mobile.png` | `before-settings-confirm-desktop.png` / `after-settings-confirm-desktop.png` |
| Library detail from owned inventory: Back + Close | `before-inventory-library-mobile.png` / `after-inventory-library-mobile.png` | `before-inventory-library-desktop.png` / `after-inventory-library-desktop.png` |

## Measurements and input

`after-captures.json` contains per-surface head, body, button and painted-ribbon bounds. All measured controls are 44×44 CSS px, with at least 4 px between adjacent controls; no button intersects the body or painted ribbon. Back exposes `aria-label="Quay lại"` and no visible text. Mobile Settings confirmation: Back [278, 259.22, 44, 44], Close [326, 259.22, 44, 44]; ribbon x=22–260. Desktop Settings confirmation uses the left-alignment fallback because the centered ribbon cannot fit between the two corner controls. Desktop Settings root and Library detail have sufficient room and use centered ribbons; single-Close Library uses a left-aligned ribbon.

Playwright real keyboard focus + Enter exercised Close, Back, and Settings headerAction; Escape returned from Settings confirmation and dismissed owned inventory. Browser-host regression additionally covers Tab order, Enter, Escape, mandatory modal, replacement and a simultaneous Back + headerAction + Close header at both viewports.

Back uses the existing semantic emoji pipeline with `left-arrow`, Twemoji 16.0.1 `2b05.png`, CC BY 4.0: <https://cdn.jsdelivr.net/gh/jdecked/twemoji@16.0.1/assets/72x72/2b05.png>. The actual page loaded that image in both Back screenshot states; the existing `btn_icon_*`, `btn_close_*` and ribbon assets supply chrome.

## Verification

- `NODE_OPTIONS=--localstorage-file=.vitest-ls.json pnpm exec vitest --run --no-file-parallelism --testTimeout 20000 tests/modal-back-navigation.test.ts tests/emojiIcon.test.ts tests/audio-modal-lifecycle.test.ts tests/crafting-local-history.test.ts tests/settings-confirm-navigation.test.ts`: 5 files, 29 tests passed.
- An earlier run of those files at Vitest's default 5-second per-test timeout failed four existing modal/crafting tests by timeout (25 passed); there were no assertion failures. Host load was approximately 12 and swap usage 8.3 GB. The later run used a 20-second test timeout and did not change the assertions; this is not proof the default-timeout run is stable.
- `pnpm typecheck`, `pnpm build` and `git diff --check` passed; Vite warned about the large JavaScript chunk.

## Limits

The OMP-managed browser opened the page but did not expose `window.__app` within 45 seconds; screenshots and interaction proof above use Playwright Chromium instead. The earlier PR #150 inventory suite had reported intermittent keyboard timeouts under SwiftShader; the uncommitted remediation in the separate old worktree was not copied or claimed to pass here. Crafting overlay Back and Library body Back are unchanged, per Leader scope. Rendered animation pose, GPU disposal, and BrowserPanel-specific behavior were not measured.
