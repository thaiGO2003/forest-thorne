# Library / Planning Shared Unit Card + 360 Portrait + Full Detail Plan

Date: 2026-09-20  
Branch: `feature/threejs-migration`  
Status: SOURCE IMPLEMENTED — browser/Vitest/build verification pending  
Scope: Three.js production Library + Planning shop presentation. Read-only reference to `old_src/`; never modify `old_src/`.

## CARD-ASSET-1 — Cut owner ZIP sheet into reusable medieval card assets

- **Source symbol:** uploaded `UIBundleFree.zip -> UIBundleFree/MediavelFree.png`; `src/three/ThreeUnitCardFrame.ts`.
- **Migration method:** crop the medieval wooden panel into project-owned PNG derivatives and store under `public/assets/ui/cards/`. Use the cropped frame/fill as the only shared card chrome authority.
- **Allowed:** lossless PNG crop from supplied sheet, CSS background-size/border-image/image overlay, semantic role glow underneath the wooden asset.
- **Forbidden:** recoloring the supplied artwork into synthetic rectangles, role-color background replacing the asset, shipping the whole source sheet when only cropped runtime assets are needed.
- **Targeted Vitest:** `threeUnitCardFrame.test.ts` asserts frame/fill URLs, asset metadata, and shared DOM contract.
- **Runtime evidence:** Planning shop cards and Library roster cards visibly share the same wooden card frame/fill.
- **Done criterion:** both surfaces use `applyUnitCardFrameStyle/decorateUnitCardFrame`; Library no longer owns a separate role-color card background.

## CARD-SHARED-1 — Same card renderer contract in Planning and Library

- **Source symbol:** `ThreePlanningShopRuntime.ts`, `ThreeLibraryModal.ts::buildUnits`, `ThreeUnitCardFrame.ts`.
- **Migration method:** preserve content differences, but apply the same frame helper, same asset URLs, same art inset and hover contract on both surfaces.
- **Allowed:** Library card keeps name + tier/tribe/class; Planning card keeps cost/stats/buy behavior.
- **Forbidden:** two independent CSS skins, hardcoded Library role-card background, hiding the 3D unit snapshot.
- **Targeted Vitest:** Planning + Library tests assert identical `data-unit-card-skin` and frame asset.
- **Runtime evidence:** cards read as one component family across both screens.
- **Done criterion:** shared helper is the sole card-skin authority.

## ROTATE-1 — Hold/drag Library portrait to rotate 360°

- **Source symbol:** `ThreeLibraryUnitPortrait.ts`.
- **Migration method:** enable pointer events on the detail portrait canvas; on pointerdown capture pointer and enter drag state; horizontal pointer delta accumulates a yaw offset without clamp, giving full 360° rotation. Release/cancel ends drag. Idle/action animation continues, but every pose adds the manual yaw offset to the canonical base facing.
- **Allowed:** mouse, touch, pen through Pointer Events; `touchAction="none"`; cursor feedback.
- **Forbidden:** orbit controls dependency, mutating gameplay model state, rotating Library list-card snapshots.
- **Targeted Vitest:** portrait exposes drag metadata/API; simulated pointer delta changes yaw offset deterministically and dispose clears listeners/state.
- **Runtime evidence:** hold the large portrait and drag horizontally through a complete rotation while idle remains animated.
- **Done criterion:** repeated drag can rotate past ±2π; release preserves chosen viewing angle until modal rerender/star change.

## LIB-DESC-1 — Restore old-src detail richness using current tooltip authority

- **Source symbol:** `old_src/ui/LibraryRenderers.ts::resolveLibrarySkillDescriptionText/renderUnitDetailExt` (reference only); current `src/core/unitDescriptionHelper.ts::buildTooltipViewModel`; `src/data/unitCatalog.ts::resolveUnitSkillForStar`; `ThreeLibraryModal.ts::buildUnitDetail`.
- **Migration method:** build one current-star tooltip VM from the canonical unit + resolved skill and render separate full sections for Basic Attack and Skill. Reuse VM lines instead of reconstructing formulas in Library.
- **Allowed:** strip inline highlight markup for plain DOM, structured labeled rows for cast/target/shape/selection/affected-count/duration/area, passive section, current-star detail text and authored stat rows.
- **Forbidden:** importing Phaser Library renderers into `src/three/**`, duplicating combat formulas, showing only `description` while discarding tooltipModel details.
- **Targeted Vitest:** a V3 unit detail contains non-empty attack lines + skill lines and exposes current-star target/detail metadata; switching star refreshes resolved text.
- **Runtime evidence:** Library shows complete attack description and skill description comparable to old-src information density.
- **Done criterion:** Library detail consumes `buildTooltipViewModel` and no longer relies on the current one-paragraph skill-only rendering.

## TEST-1 — Regression + architecture gates

- **Source symbol:** `tests/three/threeUnitCardFrame.test.ts`, `threePlanningShopRuntime.test.ts`, `threeLibraryCollection.test.ts`.
- **Migration method:** update asset expectations and add shared-card, 360-drag, and full-description tests.
- **Allowed:** source/static tests and DOM simulation.
- **Forbidden:** claiming browser/build/Vitest PASS without execution.
- **Targeted Vitest:** the suites above.
- **Runtime evidence:** card parity, rotate gesture, star detail text smoke.
- **Done criterion:** static readback confirms all hooks and `old_src/` touched = 0.

## Runtime assets to create

- `public/assets/ui/cards/medieval-unit-card-frame.png` — crop `MediavelFree.png [3,20]-[74,93]`.
- `public/assets/ui/cards/medieval-unit-card-fill.png` — crop `MediavelFree.png [10,28]-[67,85]`.

## Verification policy

Source rows become SOURCE IMPLEMENTED only after live GitHub readback. Browser/Vitest/build remain pending unless actually executed.


## Implementation status — SOURCE IMPLEMENTED

- **CARD-ASSET-1:** complete. The uploaded `UIBundleFree/MediavelFree.png` was cropped into `public/assets/ui/cards/medieval-unit-card-frame.png` and `medieval-unit-card-fill.png`. The source sheet itself was not copied into production assets.
- **CARD-SHARED-1:** complete. `ThreeUnitCardFrame.ts` is the shared skin authority with `data-unit-card-skin="medieval-bundle-wide"`. Production Planning (`ThreeRoundScene.updateShopCards()`), reusable `ThreePlanningShopRuntime`, and Library roster cards all consume the same frame/fill URLs. Role colors remain semantic accent/art-glow inputs rather than the visible card background.
- **ROTATE-1:** complete. `ThreeLibraryUnitPortrait` enables Pointer Events on the live WebGL canvas, captures hold-drag input, accumulates unclamped yaw at 0.012 rad/px, preserves the manual offset through idle/action poses, and exposes a localized rotate hint in Library detail.
- **LIB-DESC-1:** complete. Library detail resolves the current-star skill through `resolveUnitSkillForStar`, builds the canonical `buildTooltipViewModel`, and renders separate full Basic Attack / Skill / Passive sections after stripping inline highlight markup. No Phaser/old-src renderer is imported.
- **TEST-1:** source regressions updated for the new frame/fill URLs, shared Planning/Library skin, >360° accumulated yaw, and full attack/skill detail sections including star refresh.
- **Static readback:** both cropped PNG blobs exist on the feature branch; production Planning + Library share `ThreeUnitCardFrame`; direct Phaser imports added under touched `src/three/**` = 0; explicit any/suppressions added = 0; `old_src/` touched = 0.
- **Verification limit:** Vitest/build/browser/device execution was not run in this connector session, so runtime PASS is not claimed.


## CARD-ASSET-2 — Replace distorted square crop with a true wide card asset

- **Source symbol:** owner `UIBundleFree/MediavelFree.png`; `public/assets/ui/cards/medieval-unit-card-wide.png`; `ThreeUnitCardFrame.ts`; shared card CSS in `src/styles.css`.
- **Migration method:** build a 320x150 horizontal card from the original medieval panel with source-preserving 9-slice composition, then use that finished wide PNG as the card background. Runtime must not stretch the previous square crop through `border-image`.
- **Allowed:** nearest-neighbor 9-slice composition performed once when producing the PNG; `background-size:100% 100%` on the finished wide asset.
- **Forbidden:** stretching the 71x71 crop into horizontal cards, keeping the malformed `border-image` path, synthesizing new artwork unrelated to the supplied sheet.
- **Targeted Vitest:** shared card test asserts `medieval-unit-card-wide.png` is the active runtime URL and the old frame/fill pair is no longer the visible skin authority.
- **Runtime evidence:** Planning and Library cards keep undistorted corner/border proportions at desktop and mobile widths.
- **Done criterion:** both surfaces render the same wide asset and no runtime card uses the old square crop as border-image.

## STAR-SCOPE-1 — Show only the selected star's skill/attack details

- **Source symbol:** `ThreeLibraryModal.ts::buildUnitDetail`; `buildTooltipViewModel`; `resolveUnitSkillForStar`.
- **Migration method:** keep the canonical tooltip VM, but Library post-processes VM lines into a selected-star scope: collapse `[1★ / 2★ / 3★]` metric displays to the active highlighted value and keep only the active star milestone block. Rebuilding after a star button click must resolve that star's skill and detail text.
- **Allowed:** Library-only formatting of the already-resolved VM lines; selected-star dataset markers for tests.
- **Forbidden:** showing 2★/3★ milestones while 1★ is selected, duplicating combat formulas, mutating the global tooltip formatter used by combat.
- **Targeted Vitest:** 1★ detail omits 2★/3★ milestone text; selecting 2★/3★ refreshes the section to that star and no other star milestone is present.
- **Runtime evidence:** clicking each star button changes only the corresponding attack/skill values and description.
- **Done criterion:** every Library detail section exposes `data-preview-star` matching the selected button and contains only that star's scoped information.

## MODAL-1 — Library uses nearly the full horizontal viewport

- **Source symbol:** `ThreeLibraryModal.ts::show`.
- **Migration method:** enlarge the desktop panel to roughly the full viewport width while preserving safe-area padding and responsive mobile behavior.
- **Allowed:** `min(99.2vw,1880px)`-class sizing and taller desktop max-height.
- **Forbidden:** fixed 1240px desktop cap, overflowing the viewport, removing safe-area padding.
- **Targeted Vitest:** root/panel style contract exposes the expanded width and body remains scrollable.
- **Runtime evidence:** on 1440/1920 desktop the modal leaves only a small outer gutter.
- **Done criterion:** desktop width is no longer capped at 1240px and Library cards/detail use the extra horizontal space.

## SCROLL-1 — Preserve Library body scroll across every internal rerender

- **Source symbol:** `ThreeLibraryModal.ts::show/hide` and every button/filter/star/action callback that calls `show()`.
- **Migration method:** capture the current Library body `scrollTop/scrollLeft` before teardown, mark the new body with a stable data attribute, restore the saved position after rebuild, and focus with `preventScroll:true`.
- **Allowed:** modal-owned scroll memory preserved while the modal instance stays open.
- **Forbidden:** resetting scroll to zero on star selection, pagination, tab/action toggles, skin changes, or back/list rerenders.
- **Targeted Vitest:** seed body scroll, click star/action/back controls, and assert the rebuilt body restores the previous scroll position.
- **Runtime evidence:** clicking buttons inside Library never jumps the scrollbar to the top.
- **Done criterion:** all internal `show()` rerenders restore the prior body scroll offset.


## Final wide-card implementation closeout

- **CARD-ASSET-2 — SOURCE IMPLEMENTED:** `medieval-unit-card-wide.png` is the active card body. `ThreeUnitCardFrame.ts` sets `data-unit-card-skin="medieval-bundle-wide"`, the wide URL is the actual `backgroundImage`, and the older frame/fill URLs remain compatibility/provenance metadata only.
- **CARD-SHARED-1 — SOURCE IMPLEMENTED:** production `ThreeRoundScene.updateShopCards()`, reusable `ThreePlanningShopRuntime`, and `ThreeLibraryModal::buildUnits` all call `applyUnitCardFrameStyle/decorateUnitCardFrame`; Planning and Library therefore share one runtime skin authority.
- **ROTATE-1 — SOURCE IMPLEMENTED:** `ThreeLibraryUnitPortrait` captures Pointer Events, uses `touchAction="none"`, accumulates unclamped manual yaw at 0.012 rad/px, applies the yaw offset to idle/action poses, and removes listeners during dispose.
- **LIB-DESC-1 + STAR-SCOPE-1 — SOURCE IMPLEMENTED:** Library resolves the selected-star skill, builds `buildTooltipViewModel`, renders attack/skill/passive sections, strips inline markup, labels skill summary/detail, and scopes milestone/value lines to the selected star only.
- **MODAL-1 + SCROLL-1 — SOURCE IMPLEMENTED:** Library desktop width is expanded to `min(99.2vw,1880px)`; body scroll offsets are captured before rerender and restored with `preventScroll:true`.
- **TEST-1 — UPDATED:** card tests now assert the active wide-card URL/skin; Library tests cover >360° drag yaw, full attack/skill detail density, selected-star refresh, and shared card skin.
- **Verification limit:** source/static readback only. Vitest/build/browser were not executed in this connector session.


## 2026-09-22T18:32:00+07:00 — Library portrait free-rotation + fullscreen viewer

- Extended the live Three.js Library unit portrait from yaw-only drag to unconstrained yaw + pitch drag. Horizontal drag changes yaw; vertical drag changes pitch; neither axis is clamped, so the model can be reviewed through full 360° in both directions.
- Added wheel zoom and true two-pointer pinch zoom to the same portrait controller, with a safety range of 0.38×–3.2×.
- Added a `⛶ Phóng to` / `⛶ Full screen` button in Library unit detail.
- The fullscreen viewer reuses `ThreeLibraryUnitPortrait`, fills the viewport overlay, keeps action preview state, supports yaw/pitch drag + wheel/pinch zoom, Escape close, and the project-standard `−` close control instead of an X icon.
- Added regression coverage for unclamped pitch > 2π, zoom bounds, fullscreen viewer creation, two-finger hint, and close behavior.
- Verification: GitHub static/source readback only; no browser/device runtime execution in this connector session.

## Audit 2026-09-22 20:58 +07:00

- Current HEAD readback: all declared source rows remain SOURCE IMPLEMENTED; no plan checkbox is open.
- Shared card skin, Library drag rotation, star-scoped canonical skill detail and modal scroll preservation remain the intended live owners.
- **Still pending before archival:** targeted Vitest/build rerun on the post-cleanup commit plus browser hold-drag 360° portrait and Library detail/card parity inspection.

## 2026-09-23T18:52:00+07:00 — Library Card V2 architecture reset

- Replaced the failed shared Shop/Planning roster-card geometry with an isolated Library-only DOM composition: `three-library-unit-card-v2`.
- Library roster cards no longer emit any `three-planning-shop-card-*` children and no longer opt into `data-unit-card-skin`; they reuse only audited UIBundleFree artwork (medieval frame/fill + fantasy plank), icons, and the existing Three.js snapshot authority.
- New fixed composition is portrait-first: portrait + tier/star overlays → full-width nameplate → tier/tribe/class chips → HP/ATK/DEF row → full-width localized detail CTA.
- Removed both previous Library-specific CSS override experiments instead of stacking a third override layer. The new CSS namespace owns all Library roster geometry and keeps mobile at two columns.
- Fixed the missing `library.searchPlaceholder` translation in VI/EN and added localized `library.viewDetails`.
- Updated Library regression coverage for V2 namespace, exactly one HP/ATK/DEF stat each, absence of Shop-card descendants, localized search text, pagination, and click-through into unit detail.
- Architecture boundary: this change does not touch animal rig/animation ownership or `old_src/`.
- Verification state: GitHub source readback and CI verification are tracked separately; do not mark runtime PASS until the dev workflow finishes successfully.

### Verification note — 2026-09-23T18:58:00+07:00

- GitHub Actions `dev-verify` run 473 reached TypeScript checking but is blocked by an unrelated visual-unit error in `src/three/animals/jellyfish-shock/ThreeJellyfishShockAnimation.ts:250:29` (`TS2556`).
- TypeScript did not report an error in the Library Card V2/i18n/test files before the workflow stopped.
- Build and runtime Vitest were skipped by the workflow after that upstream typecheck failure, so they are not claimed PASS here.
- The Library-card task intentionally does not modify the jellyfish animation because unit visual/animation ownership is being handled separately.



## 2026-09-23 — Library Card V3 sliced-asset reset

- Replaced Library Card V2's CSS-painted parchment/brown surfaces with a sliced-art asset contract sourced from the owner-provided UIBundleFree sheets.
- New production assets live under `public/assets/ui/library-card-v3/`: `shell.png`, `portrait-frame.png`, `nameplate.png`, `chip.png`, `stat.png`, `cta.png`, and `badge.png`.
- `shell.png`, `portrait-frame.png`, `chip.png`, `stat.png`, and `badge.png` are derived from `FreeHorrorUi.png`; `nameplate.png` and `cta.png` are derived from `freefantasy.png`. Runtime does not ship the full source sheets.
- Added `src/three/ThreeLibraryUnitCard.ts` as the Library roster-card composition owner. `ThreeLibraryModal.ts` now supplies unit data and click behavior instead of manually composing card chrome.
- Runtime namespace is now `three-library-unit-card-v3` / `three-library-unit-grid-v3` with `data-library-card-version="3"` and `data-library-card-skin="uibundle-sliced-v3"`.
- V3 CSS uses PNG shell/frame/plank/button assets for visible card surfaces. The card body is transparent aside from the sliced shell artwork; no brown parchment fill, synthetic border, role-gradient portrait fill, or CSS-drawn CTA remains in the V3 block.
- The real Three.js `createLibraryUnitModelSnapshot` remains the portrait authority and is mounted inside the asset-backed portrait window.
- Mobile remains exactly two columns; tablet/desktop scale to three/four columns.
- Regression coverage now checks the V3 DOM namespace, sliced asset URLs, exactly one HP/ATK/DEF stat, no Shop-card descendants, localization, pagination, and click-through.
- Static GitHub readback: no `three-library-unit-card-v2` / `three-library-unit-grid-v2` references remain in the touched Library modal, card component, stylesheet, or Library regression test.
- Verification status: source readback complete; CI/runtime status must be reported separately and must not be claimed PASS unless the workflow reaches those steps successfully.


## 2026-09-23 — Library Card V4 direct-crop audit

- Re-audited the supplied sprite sheets by alpha-connected component bounds instead of selecting visually approximate regions.
- Important missed source asset: `UIBundleFree/freefantasy.png` contains a complete blank framed panel at `x=84, y=48, w=71, h=112`. V4 uses this exact crop directly as the card shell; it is not a synthesized 240×344 composition.
- Exact direct crops now shipped under `public/assets/ui/library-card-v4/`:
  - `fantasy-panel-blank.png` ← `freefantasy.png (84,48,71,112)`
  - `fantasy-plank-long.png` ← `freefantasy.png (138,2,45,29)`
  - `fantasy-plank-small.png` ← `freefantasy.png (96,2,32,29)`
  - `source-map.json` records those source coordinates for auditability.
- V4 card geometry keeps the source panel's native `71:112` aspect ratio and only nearest-neighbour/pixelated scales the exact source crops.
- The card body has no CSS parchment/brown fill, no synthetic frame, no generated horror-shell composition, and no role-gradient portrait background. The Three.js model renders directly over the source panel artwork.
- Name, CTA, tier/star badges, metadata and stat cells use the two directly cropped fantasy planks rather than CSS-drawn rectangles.
- Runtime namespace is `three-library-unit-card-v4` / `three-library-unit-grid-v4`, with `data-library-card-version="4"` and `data-library-card-skin="freefantasy-direct-crop"`.
- V3 remains only in Git history; production Library roster code/styles/tests now target V4.
- Verification limit: GitHub source readback is required after writes; CI/browser status is reported separately.


## 2026-09-26 — Tall Library card overflow regression fix

- Root cause correction after visual feedback: the dense `auto-fill minmax(168px,1fr)` grid is not itself the bug. It exposes the real bug: the `tall` card's 72:100 rendered height did not reserve enough vertical space for portrait + name + Tribe/Class + HP/ATK/DEF.
- Do not solve a vertical-budget problem by reducing desktop density. Library keeps the width-driven dense grid (~10 cards on a wide modal), while the tall card becomes vertically taller at 72:126 with a 260px floor. The shell is 9-sliced, so only the stretchable centre grows; corners/borders remain stable.
- The deterministic `portrait → name → meta → stats` zones, overflow containment, Tier corner badge, two-column Tribe/Class metadata, and one-row HP/ATK/DEF baseline remain in place.
- Mobile still uses exactly two columns; intermediate widths keep the existing 132px auto-fill floor.
- Regression coverage now asserts the height contract and explicitly prevents a future "fix" from replacing dense browse columns with a hard 4/3/2 desktop grid.
- Verification status for this connector commit is source-readback only; CI/browser results must be reported separately after GitHub Actions runs.

### 2026-09-26 follow-up — content owns tall-card height

- Visual retest still showed Tribe/Class and HP/ATK/DEF below the painted shell. Increasing one fixed aspect ratio was therefore the wrong abstraction: it changed a preferred box ratio, but still made the card depend on a guessed vertical budget.
- Final sizing rule: the dense browse grid stays unchanged; the tall card drops its fixed aspect ratio, uses `height:auto` with a 300px floor, and gives only the portrait track a bounded `clamp(158px,90cqw,188px)`. Name/meta/stats stay natural-height rows, so the button grows whenever localization/font metrics need more room and the absolute 9-slice shell follows that real height.
- Browser verification now opens the actual Planning Library and compares card/body/meta/stats/shell DOMRects. Any content below the card or shell/card height mismatch is reported as a geometry failure instead of relying on screenshots alone.



### 2026-09-26 root-cause correction — the PNG shell itself was wrong

- The prior two fixes changed CSS height without auditing the generator that paints `card-shell.png`; that was insufficient.
- `scripts/generate-ui-art.mjs::buildCards` drew a 19px wooden footer at source `y=74..92` and then declared the bottom 9-slice as 26px (`[10,10,26,10]`). Therefore the entire footer lived inside the non-stretching bottom slice and stayed pinned to the last ~27 rendered CSS pixels at every card height.
- The unified Library card renders three separate PNG-backed rows below the portrait: `nameplate`, Tribe/Class pills, and HP/ATK/DEF pills. A one-band baked footer can never be the geometry authority for those three rows.
- Fix: regenerate `card-shell.png` as an outer parchment/wood frame only, switch its slice/border contract to uniform `10 / 11px`, keep name/meta/stats as their own PNG-backed components, and require browser geometry to keep content inside the visible 11px inner frame.
- Tall-card floor is 320px at dense desktop/mobile widths, but height remains content-driven; increasing CSS height is no longer the primary fix.
- Verification must include generator drift check plus the real-browser inner-frame DOMRect probe; source readback alone is not a visual PASS.
