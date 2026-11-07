# Issue #125 — Tất cả nút dùng Times New Roman

- Issue: https://github.com/thaiGO2003/forest-thorne/issues/125
- Branch: `fix/ui/button-times-new-roman-issue125`
- Target: `dev`
- Worktree: `/home/thaigo/forest-thorne-issue-125`
- Status: Developer implemented and verified on Linux Chromium; independent Verifier review pending
- Base: `origin/dev` after merge PR #133 (`f99d398e1173fdce0ab471aa993bbeaa8d9336b6`)

## Problem and acceptance (issue source)

Game buttons currently prefer decorative `Forest Normal`, causing inconsistency. Times New Roman must be the **first actual button face**, not a fallback behind Forest Normal, on Canvas kit buttons and DOM buttons throughout Menu, Planning, Shop, Library, modal, Combat and Settings.

- [x] All sampled visible buttons use Times New Roman rather than Forest Normal (Canvas skins: wood/green/plum/red/icon; DOM buttons including native crafting controls).
- [x] Non-button heading, title, tooltip and body font declarations remain unchanged.
- [x] No new label clipping, overflow, icon/emoji regression or layout breakage at 390×844, 844×390 and 1280×720; preexisting XP-button intrinsic scrollWidth measurements persist unchanged.
- [x] Genuine before/after screenshots and computed DOM / Canvas / actual platform font evidence captured.

## Planned implementation and exclusions

Inspect `src/ui/kit.ts` (`BUTTON_FONT`, Canvas `label({ font: "button" })`), `src/ui/ui.css` (`.kit-btn` and all actual button classes), then inspect DOM button components under `src/ui/` and app screens. Set button-only font stacks to `"Times New Roman", Times, serif`, account for Canvas-based labels, button pseudo-elements and SVG/emoji/icon treatment. Preserve the existing icon helper instead of hard-coding emoji. Verify inherited/cascaded selectors and font sizes against real runtime button instances; do not blindly replace non-button typography.

Keep changes scoped to font and necessary button layout metrics. No new assets, font binaries, network font downloads, gameplay changes, new UI chrome, mode/save changes, or redesign. Keep existing PNG/9-slice asset-first chrome. No CSS background/border-color/shadow replacements for the current assets.

Reference: existing screenshot cited in issue (Windows temp path may be unavailable on Linux); authoritative baseline is a newly captured live Forest Throne browser surface.

## Visual plan — mandatory visual lane

### Desired player-visible behavior

**Before:** some buttons have Forest Normal glyph shapes. **After:** every button label visibly adopts Times New Roman without losing legibility, without changing headings/body, and without changing button assets or positions except essential padding to avoid overflow.

### References and provenance

Use existing `src/ui/kit.ts`, `src/ui/ui.css`, current rendered menu/planning/unit detail, and approved local game assets. Do not use Liên Quân or external third-party art. The local Linux test host currently resolves `Times New Roman` from `/usr/share/fonts/truetype/litefonts/times.ttf`; **do not copy or commit this OS font**. A missing font on other platforms must be reported, not hidden by claiming that CSS declarations guarantee installed glyphs.

### Visual Developer acceptance

- [x] Capture before baseline of representative Menu, Library, modal, and Planning button controls at 390×844 and 1280×720 (landscape 844×390 where it affects fit).
- [x] Inventory button surfaces needing Times New Roman, including Canvas text, DOM buttons, disabled/focused states, and semantic icons.
- [x] Capture after screenshots and evaluated computed DOM styles and actual Canvas context font. Compare clipping/overflow, keyboard-focus screenshot, icon glyphs and touch targets.
- [x] Preserve asset-first assets, mobile layout and accessibility. No unrelated visual edits.
- [x] Report tested Linux Chromium platform font availability; no assumed cross-platform font installation.

### Visual baseline — Visual Developer, 2026-11-06, base `f99d398`

**Runtime:** Chromium (playwright-core 1.63, headless, SwiftShader). Vite dev chạy bằng `NODE_ENV=development pnpm exec vite --port 5225`, vì shell export `NODE_ENV=production` nên nếu không đặt lại thì `window.__app` không tồn tại. Script nằm ngoài repo: `/tmp/capture125.mjs <tag> <WxH>` và `/tmp/probe125.mjs <tag>`. Script dùng `scripts/qa/lib.mjs`, instrument `CanvasRenderingContext2D.fillText` trên canvas nằm trong `<button>`, và gọi CDP `CSS.getPlatformFontsForNode`.

**Evidence** (`.agents/merge-review/fix.ui.button-times-new-roman-issue125/visual/`):
- `before-{menu,menu-focus,planning,library,settings,unit-detail}-{390x844,1280x720,844x390}.png`, `before-crafting-1280x720.png`.
- `before-metrics-{390x844,1280x720,844x390}.json`: mỗi nút visible có computed DOM font, font của `.kit-measure`, kích thước, touch ≥44 và overflow. Kèm theo là từng `ctx.font`, text, `measureText` width, `maxW` và tỉ lệ nén (squeeze) của canvas label trong nút.
- `before-platform-fonts-1280x720.json`: font hệ thống thực sự render (CDP).
- Alias theo tên plan: `before-390x844.png` = menu 390×844, `before-1280x720.png` = unit-detail 1280×720 (bề mặt trong screenshot của issue).

**Font availability (đo trên runtime, không suy từ CSS):** `document.fonts.check` trả true cho cả `"Forest Normal"` và `"Times New Roman"`. CDP xác nhận label nút hiện render bằng **`Fz Bonestay`** (tên nội bộ của file `Normal - Bonestay.otf` = Forest Normal). Emoji trong `.kit-measure` DOM rơi về `Segoe UI Emoji` / `Noto Sans Symbols2`. Trên canvas, emoji được `splitEmojiText` vẽ bằng ảnh, nên đổi font không ảnh hưởng. Times New Roman trên host này là `/usr/share/fonts/truetype/litefonts/times.ttf` (`fc-match`). Không copy font này vào repo.

**Baseline đo được (cả 3 viewport):**
- Mọi nút `.kit-btn` visible đều có DOM `font-family: "Forest Normal", "Times New Roman", Times, serif` (menu 9, planning 11–18, library 22–45, settings 29–39, unit-detail 18–25 nút).
- Canvas label nút: mọi `ctx.font` đều bắt đầu bằng `"Forest Normal"`. Size đo được: 16.8 / 18.48 / 19.32 / 21.84 / 22 / 24px weight 400, và `bold 20px` cho nút icon-only (`lib-chip` 1–5).
- Bề mặt có nút: menu (Tiếp tục/Trò chơi mới), planning (Bắt đầu, XP, mua thẻ shop `pl-buy`, reroll/lock/trang), library (tab, `lib-chip`), settings (tab, stepper), unit-detail (Bán thú, Thư viện, Tháo tất cả, Xác nhận, mũi tên `portrait-control`).
- Không label canvas nào bị nén (squeeze = 1). `scrollWidth > clientWidth` đánh dấu nhầm nút XP (4 🪙) trên bốn màn ở 1280×720 và 844×390; nút không bị cắt chữ trong screenshot và chỉ số này không tăng sau fix.
- Touch < 44px (đã có từ trước, không thuộc #125): `lib-chip` 40×40, `portrait-control` 42×42, và 2 nút ở planning/settings 390×844. Không được làm nhỏ thêm.
- Focus: Tab trên menu cho outline sáng quanh «Trò chơi mới» (`before-menu-focus-*`). Cần giữ nguyên.
- Raw DOM `<button>` không phải kit (`craft-cell`, `craft-item-tile`, `craft-relation-row`, `craft-graph-*`): computed `Arial` (UA default, không kế thừa `.ui-root`). Trong baseline crafting chỉ thấy `craft-cell` rỗng, không có text. Text của các nút còn lại dùng span con Noto Sans theo CSS riêng.

**Inventory cho Developer:**
1. `src/ui/kit.ts:22` `BUTTON_FONT` → `"Times New Roman", Times, serif`. Hằng này phủ các nhánh text-only, icon-only và text trong icon+text.
2. `src/ui/ui.css:42` `.kit-btn font-family`. `.kit-measure` kế thừa giá trị này để đo bề rộng nút, nên phải đổi cùng lúc, nếu không bề rộng DOM sẽ lệch với canvas.
3. `kit.ts:271`: glyph icon trong nút icon+text gọi `label()` không có `font: "button"`, nên dùng `NORMAL_FONT` (Forest Normal). Emoji không bị ảnh hưởng vì vẽ bằng ảnh. Glyph không phải emoji (chữ số, mũi tên ←↑→↓) vẫn sẽ là Forest Normal. Nên thêm `font: "button"`.
4. Không đổi `NORMAL_FONT` và các label canvas không phải nút: stat chip trên card, tên stat trong unit-detail, «Chiến thuật rừng sâu», dòng save của menu, tiêu đề shop, version, combat HUD. Theo AC, các label này phải giữ Forest Normal/Heading.
5. Raw native `<button>` crafting controls are actual buttons, and their own and text-bearing descendant fonts are now scoped to Times New Roman via `.ui-root button:not(.kit-btn)`; surrounding headings and body labels are unchanged.

**Visual acceptance đề xuất (after):**
- [x] Same scripts, all 3 viewports and 5 main screens: visible `.kit-btn` DOM font and `.kit-measure` font begin with `"Times New Roman"`; no captured button `ctx.font` contains `Forest Normal`.
- [x] CDP `getPlatformFontsForNode` reports `Times New Roman` on measured button text; emoji uses fallback/image drawing as designed, no `Fz Bonestay` for button text.
- [x] Minimum Canvas squeeze = 1 across viewports. No *new* DOM overflow; XP (4 🪙) scrollWidth remains flagged on 4 screens at desktop and landscape in both BEFORE and AFTER, despite visually contained label.
- [x] Emoji images and decorative icons remain visible, Tab-focus screenshots captured, and no touched button became smaller than its baseline touch size.
- [x] Heading/title/tooltip/body font declarations and non-button Canvas labels remain unchanged.
- [x] PNG/9-slice chrome assets and CSS chrome styles unchanged.

Visual evidence path: `.agents/merge-review/fix.ui.button-times-new-roman-issue125/visual/`. Compare `before-menu-390x844.png` with `after-menu-390x844.png`, `before-unit-detail-1280x720.png` with `after-unit-detail-1280x720.png`, and paired metrics/visual files for each viewport. Verifier must pin evidence to final `Verified-Head` after code is committed.

## Targeted verification and handoff

Developer: reproduce original font on real buttons, implement only button font policy, preserve icons and body text, test Canvas `BUTTON_FONT` and representative DOM computed font/scroll bounds, run affected targeted tests, `pnpm typecheck` and `pnpm build`. No full-suite run. Collect screenshot proof, commit with explanatory body, push source branch; **do not open PR, merge, approve or close issue**.

Verifier: independently verify actual runtime font, accessibility/keyboard/touch and viewport coverage; run targeted tests/typecheck/build; open PR into `dev` with strict header and genuine image evidence pinned to final 40-char SHA.

Pull Verifier: inspect exact HEAD and matching `APPROVED` dossier, ensure issue closure audit while PR is still open, merge only after all gates, verify `origin/dev` post-merge.

Risk: Times New Roman is not guaranteed installed on every client. Check actual font availability on test devices; do not copy proprietary OS fonts or misrepresent a fallback as Times New Roman. Revert scoped button-font changes to roll back; no save migration needed.

## Developer implementation evidence — 2026-11-06

- Code: `src/ui/kit.ts` changes `BUTTON_FONT`, eagerly checks the button face with `document.fonts.load`, and draws mixed icon+text glyphs with button font. `src/ui/ui.css` updates `.kit-btn`, hidden `.kit-measure`, and native non-kit button text/descendants without modifying surrounding typography.
- Before: CDP measured actual `Fz Bonestay` button glyphs. After: `after-platform-fonts-1280x720.json` measures `Times New Roman` on button glyphs (with emoji/symbol fallbacks). Raw crafting buttons and text children compute Times New Roman; 9 crafting controls sampled.
- Screenshots: `after-{menu,menu-focus,planning,library,settings,unit-detail}-{1280x720,390x844,844x390}.png`, `after-crafting-1280x720.png`, `after-combat-1280x720.png`; all stored with preserved `before-*` in this plan's visual evidence folder.
- Metrics: `after-metrics-{1280x720,390x844,844x390}.json`; 134/93/124 sampled visible DOM buttons, minimum Canvas label squeeze 1, no touch target shrink relative to matching BEFORE button, no new scrollWidth overflow. Four repeated `XP (4 🪙)` rows at desktop/landscape retain preexisting measurement-only overflow; screenshot text remains contained. Baseline crafting's oversized “Chế” and lower-left text clipping were present before this fix, not introduced here.
- Combat smoke: clicked Planning `.pl-start`, observed `presentation.combatCycle = 1`; 6 visible buttons and captured Canvas text use Times New Roman, no browser console errors. `app.route()` remains `planning` during combat by design.
- Targeted tests: `NODE_OPTIONS=--localstorage-file=.vitest-ls.json pnpm exec vitest --run tests/recipe-graph.test.ts tests/craft-zoom.test.ts tests/shop-responsive.test.ts tests/emojiIcon.test.ts` → 4 files/20 tests passed. `pnpm typecheck` PASS; `pnpm build` PASS (existing large-chunk warning); `git diff --check` PASS.
- Integration risk: PR #53 independently changes `.kit-btn` to Forest Button. Reconcile cascade while integrating; retain Issue #125's Times New Roman button requirement. No PR, merge or issue closure in Developer scope.
