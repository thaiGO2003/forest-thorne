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
