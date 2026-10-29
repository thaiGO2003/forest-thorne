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

Desktop after CSS edit: the dock grew from 820 to 1000 CSS pixels, and first card from 94×113 to 117×140 CSS pixels. The captured card crop showed HP, damage, range and gold-price numbers without evident glyph clipping. Text remains compact and may still be hard to read at ordinary viewing distance; this evidence does **not** certify eight populated cards with unusually long names.

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

- Populated eight-offer desktop fixture was not available; the 8-column layout is implemented but only five offers were visually observed on desktop.
- Device-scale readability on physical screens, native OS mobile/browser behavior, and unthrottled GPU performance remain outside this Chromium session's proof.
- The preview is an isolated feature worktree, not merged `dev` or deployed production.
- Coop, crafting transactions, Planning touch drag/drop, the full sixteen-item `docs/Plan.pdf` audit, public endpoint acceptance, exact-HEAD human merge review, and `dev → main` release are separate gates.
