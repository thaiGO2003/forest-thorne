# Recipe Library — standalone modal design (Issue #27)

**Status:** Design proposal — pending human design review; **not implemented**.
**Branch:** `design/ui/recipe-library-modal` → `dev`
**Related:** [Issue #26](https://github.com/thaiGO2003/forest-thorne/issues/26) Quick Navigate, [Issue #27](https://github.com/thaiGO2003/forest-thorne/issues/27) design, WBS-061 production implementation, Issues #28/#29 authored content, #35 dependency diagram, #36 ingredient navigation.

## 1. Scope and boundaries

Design a **read-only**, standalone “Thư viện công thức” dialog that displays real recipe patterns, ingredient counts and resulting items. Users can enter from Quick Navigate **after Issue #26 supplies that entry point**, choose a recipe, inspect the pattern, return to the list and close the dialog. Browsing does **not** stage materials, consume items, grant output or change crafting history.

This document specifies interaction, layouts and integration contracts, **not** production UI, restored recipe data or a new modal manager. WBS-061 additionally requires the interactive crafting table, dependency diagrams and production acceptance; Issue #27 does not complete WBS-061. Current Library already has a Recipes tab in `src/ui/library.ts`; the standalone destination should share the same canonical read-only recipe/presentation source, rather than independently defining recipes, output names or catalog state.

**Data truth (updated 2026-11-03):** the item registry has since landed, so this design's original one-recipe premise is obsolete. Current truth: `src/core/itemRegistry.ts` is the single authority with `Recipe { id, outputId, size: 1|2|3, pattern }`; `src/content/items.json` authors **205** recipes (tier 1 = 6, tier 2 = 49, tier 3 = 150) over 6 base materials (`tear`, `bark`, `claw`, `feather`, `crystal`, `belt`), 54 of the ingredient tokens are equipment identities, and `src/core/recipeGraph.ts` supplies `recipeIngredients`, `baseIngredients`, `recipeTree`, `recipesUsing` and craftable ranking. Category comes from `equipmentCategory()`; there is still **no authored rarity, description, unlock condition or English locale**, so those must not be displayed. The implemented modal (`src/ui/crafting/library.ts`) therefore renders category rail + level columns + detail + zoom, with search enabled because the catalog is now meaningfully large. Sections below describe the layout and states; where they mention a single recipe, read them as the degenerate case that must keep working.

`src/core/itemPresentation.ts` already provides `itemDisplayName("tear")`, `itemDisplayName("eq_blue_buff")`, semantic icons `droplet` and `sparkles`, respectively. Real SVG item assets also exist. Source identity is always the stable ID, not a translated label or an icon.

## 2. Desktop layout — list + selected detail

Conceptual proportions, **not fixed pixel coordinates**; the dialog is `ModalHost.open({ id: "recipe-library", size: "lg", … })`. A wide dialog uses two columns: list ≈35%, selected detail ≈65%, both with independent scroll regions and a persistent close control.

```text
┌──────────────────────────────────────────────────────────────────────────┐
│        [ribbon: THƯ VIỆN CÔNG THỨC]                            [Đóng ×] │
├────────────────────────┬─────────────────────────────────────────────────┤
│ CÔNG THỨC (1)          │ CHI TIẾT                                       │
│ ┌────────────────────┐ │ ┌───────────────────────────────────────────┐   │
│ │ [icon] Bùa Xanh    │ │ │ [eq_blue_buff icon] Bùa Xanh              │   │
│ │ Đã chọn           ◀│ │ │ Công thức 1 ô — 1 nguyên liệu             │   │
│ └────────────────────┘ │ │                                           │   │
│                        │ │ Cách ghép (1×1)       Thành phẩm          │   │
│ [list scroll ↕]        │ │ ┌───────────┐         ┌───────────┐      │   │
│                        │ │ │ [tear]    │ ──────▶ │ [result]  │      │   │
│                        │ │ └───────────┘         └───────────┘      │   │
│                        │ │ Nguyên liệu: Nước mắt ×1                  │   │
│                        │ │ [detail scroll ↕]                         │   │
│                        │ └───────────────────────────────────────────┘   │
└────────────────────────┴─────────────────────────────────────────────────┘
```

“Bùa Xanh” and “Nước mắt” here are **presentation examples from existing localization hooks**, not new recipe metadata. The list/card's accessible name includes the translated output name and a selected indication; avoid an invented rarity/tier badge. A result panel is an **information display, not a Craft button**.

On desktop, selection updates only the right pane; list scroll offset is preserved. When there is no valid selection and the list is nonempty, the detail pane may show “Chọn một công thức để xem chi tiết”; on initial open, automatically select the sole available recipe for a meaningful one-recipe experience. Restore selected ID within the modal while navigating between detail and list; if that ID no longer exists, fall back to the first real recipe.

## 3. Portrait mobile — list screen

A single-column dialog uses the available visual viewport and safe-area insets. Close is persistent; content scrolls **inside** the modal, never the page. Initially display a list, even with just one recipe, so the navigation model remains clear.

```text
┌────────────────────────────┐
│ THƯ VIỆN CÔNG THỨC    [×]  │
├────────────────────────────┤
│ 1 công thức                │
│ ┌────────────────────────┐ │
│ │ [icon] Bùa Xanh      › │ │
│ │ 1 nguyên liệu · 1×1    │ │
│ └────────────────────────┘ │
│                            │
│ [list scroll ↕]            │
└────────────────────────────┘
```

Tapping the card or pressing Enter/Space opens the recipe detail **inside the same major modal**; do not open a second stacked `ModalHost`. Keep list position so Back restores it.

## 4. Portrait mobile — detail screen

```text
┌────────────────────────────┐
│ [← Danh sách]         [×]  │
├────────────────────────────┤
│ [icon] Bùa Xanh            │
│ Công thức 1×1              │
│                            │
│      ┌──────────┐          │
│      │   tear   │          │
│      └──────────┘          │
│           ↓                │
│      ┌──────────┐          │
│      │ eq_blue… │          │
│      └──────────┘          │
│ Nguyên liệu                │
│ Nước mắt ×1                │
│                            │
│ [detail scroll ↕]          │
└────────────────────────────┘
```

The mobile direction changes from a horizontal arrow to a vertical arrow, **not** the recipe row-major pattern. The Back control returns to the same list/scroll position; the close control exits the modal entirely. In landscape/narrow short viewports, use the single-column flow with an independently scrollable content region and a fixed-size, unobstructed header, rather than clipping the diagram.

## 5. Zero-recipe and missing-selection states

The current build has **one** recipe, so this is a data-driven future/fixture state, **not** a claim that the shipped catalog is empty.

```text
┌────────────────────────────┐
│ THƯ VIỆN CÔNG THỨC    [×]  │
├────────────────────────────┤
│ Không có công thức nào.    │
│ Khi dữ liệu được bổ sung,  │
│ công thức sẽ xuất hiện     │
│ tại đây.                  │
│                            │
│              [Đóng]        │
└────────────────────────────┘
```

No blank category columns, empty tier filter or disabled pseudo-recipe card. A stale selected ID falls back to first current recipe, otherwise to this empty state. If optional text search is introduced with sufficient data later, “Không tìm thấy kết quả” is **distinct** from an empty catalog and exposes a clear/reset action; current one-recipe design does not render search/filter controls.

## 6. Interaction contract and transitions

```text
Quick Navigate (#26, future) ──open──▶ RecipeLibraryModal: List
                                              │ choose recipe (pointer/Enter/Space)
                                              ▼
                                         Detail(selected ID)
                                              │ Back (mobile) / select another (desktop)
                                              ▼
                                            List
List or Detail ──Close / Escape / allowed backdrop──▶ previous UI + restored focus
```

- **Entry:** After #26 integration, Quick Navigate routes to an `openRecipeLibrary` action. Until then, the proposed entry is a dependency, not an implemented click target. A standalone opener may be added only as part of the production integration plan. Opening another major modal follows the existing single-modal policy.
- **Selection:** `selectedRecipeId` is local to the dialog view, never crafting state. Choose a valid recipe ID, refresh detail, announce new heading and move focus appropriately for mobile; on desktop, keep focus on the selected list item unless the user explicitly navigates to detail.
- **Back:** Mobile Back returns to list; restore the previously selected card focus and list scroll. Desktop has no Back requirement while both panes are visible. Do not intercept Escape as Back because the existing ModalHost uses Escape to dismiss the dialog.
- **Close:** Explicit ×/Đóng, Escape and permitted backdrop each close the **same** major modal. Focus returns to the opener when still mounted and focusable. If the opener has been removed, choose a safe nearby navigation control; do not let focus disappear behind an overlay.
- **Scrolling:** Desktop list/detail scroll independently; scrolling a pane must not scroll the underlying page. Mobile list and detail retain separate scroll positions. Do not reset detail scroll on unrelated list refresh; reset to top on a deliberate new recipe selection.
- **Search/filter:** Deferred until the canonical data actually supports meaningful choices. No offense/defense/magic or tier columns. When added later, search may match localized output display name and stable recipe ID, with proper result counts and no inventory writes.
- **Ingredient links:** Show ingredient name/quantity for every distinct ID. Prerequisite navigation to another authored recipe is conditional on a true output-to-ingredient relation in canonical data and belongs to Issue #36. For the current `tear` input, display an informational ingredient, not a clickable fake dependency.
- **Dependency graph:** The legacy `RecipeDiagram.ts` supports connected nodes, wheel zoom and pointer-drag pan; a production diagram is **not** part of this design's initial one-recipe UI. Detailed zoom/navigation belongs to Issue #35, which must include keyboard/touch alternatives.

## 7. Recipe geometry and labels (data-driven rules)

Read `recipe.size` exactly. Draw an `n × n` square in the original **row-major** order: index `r*n+c`; null cells remain visually empty, including leading/trailing nulls. Never squeeze the pattern or replace it with a generic 2×2. This is a **recipe footprint illustration**, distinct from the game table's `craftTableLevel` and its 3×3 stage offsets. Browsing does not require the player to own, unlock or place ingredients.

```text
n=1 (ACTUAL):     n=2 (GENERIC RULE):  n=3 (GENERIC RULE):
┌──────┐          ┌──────┬──────┐      ┌────┬────┬────┐
│ tear │          │ p[0] │ p[1] │      │p[0]│p[1]│p[2]│
└──────┘          ├──────┼──────┤      ├────┼────┼────┤
                  │ p[2] │ p[3] │      │p[3]│p[4]│p[5]│
                  └──────┴──────┘      ├────┼────┼────┤
                                      │p[6]│p[7]│p[8]│
                                      └────┴────┴────┘
```

The 2×2/3×3 diagrams show **slot indices only**, not currently available recipes. Each non-null slot has `itemSemanticIcon(id)` / item SVG, `itemDisplayName(id)`, and an accessible text label. A null slot is decorative but remains visibly empty. Group equal ingredient IDs into one legend row with count `×k`; the 1×1 recipe legend reads `tear ×1`. Both slots and legend retain counts; duplicated slots still render individually. Output is resolved from canonical authored output authority (current core uses `eq_${id}`; PR #55 proposes `outputId`). If no authoritative output exists, show the stable ID with an unavailable-description indicator; never fabricate bonuses or equipment lore.

## 8. UI assets: present vs missing

| Surface | Current asset/primitive | Decision |
|---|---|---|
| Modal frame and title | `panel_parchment.png`, `ribbon.png`, `src/ui/modal.ts` | Reuse `ModalHost` frame; preserve nine-slice and three-slice edges. |
| List/detail containers | `panel_wood.png`, `panel_tooltip.png`, `panelEl()` | Asset-backed surface; independent scrolling and fluid layout. |
| Ingredient and result cells | `slot_well.png`, `nineSlice()` | Preserve corner geometry; do not scale the entire frame as a flat background. |
| Buttons and states | `btn_wood_*.png`, `btn_icon_*.png`, `btn_close_*.png`, `kitButton()` | Reuse semantic controls with native button focus and labels. |
| Icons: input/output | `public/assets/items/tear.svg`, `eq_blue_buff.svg`; `itemSemanticIcon()` | Existing art and semantic fallback cover today's recipe. |
| Modal dimming | `shade.png` through existing modal | Reuse; no new CSS-drawn decorative shade. |

**Missing for the design's required single-recipe flow: none identified.** A *dedicated* recipe illustration, bespoke output border, or separate diagram arrows could be commissioned **only if** an approved visual design later demonstrates a need that existing kit surfaces cannot meet; they are optional, not blockers. The full historical catalog's ingredient/output artwork cannot be assessed until Issues #28/#29 restore authoritative definitions.

CSS for this design controls columns, heights, text flow, overflow, safe areas and hit-target sizing only. No new color/gradient/border/shadow/pseudo-element decoration; decorative chrome must come from approved image assets, preserving slice borders.

## 9. Localization and accessibility

**Language reality:** `src/core/i18n.ts` currently exports only `Locale = "vi"` and `LOCALES = ["vi"]`. VI labels can use current `t()` and `itemDisplayName()`. English **does not work at runtime today**; prepare translations and locale-switch contract for a separate localization change.

Suggested future semantic copy keys (names to reconcile with actual dictionary during implementation):

| Key | VI | EN draft |
|---|---|---|
| `recipeLibrary.title` | Thư viện công thức | Recipe Library |
| `recipeLibrary.count` | {count} công thức | {count} recipes |
| `recipeLibrary.detail` | Chi tiết công thức | Recipe details |
| `recipeLibrary.ingredients` | Nguyên liệu | Ingredients |
| `recipeLibrary.output` | Thành phẩm | Result |
| `recipeLibrary.back` | Danh sách | Back to recipes |
| `recipeLibrary.empty` | Không có công thức nào. | No recipes available. |
| `recipeLibrary.select` | Chọn công thức | Select a recipe |
| `recipeLibrary.pattern` | Công thức {size}×{size} | {size}×{size} pattern |

The output/item localization remains in the item presentation authority; do not add duplicate hardcoded recipe translations. Strings may wrap to two lines, support 200% text zoom without clipped actions, and avoid baking words into PNGs.

**Keyboard + screen reader contract for eventual implementation:**
- Modal: `role="dialog"`, `aria-modal="true"`, descriptive accessible name and initial focus. Current ModalHost already has those primitives, Escape dismissal and opener focus restoration; **it does not implement a proven Tab focus trap**. Production integration must keep keyboard focus within the dialog (or update ModalHost centrally), including Shift+Tab cycling, and verify opener restore.
- Recipe list: native buttons with visible focus, accessible output name, current selection `aria-current` or `aria-selected` according to the chosen semantic pattern; avoid fake ARIA tabs without tab keyboard logic. Tab/Shift+Tab to traverse; Enter/Space select. Do not rely on hover.
- Mobile Back and Close: independently named controls with ≥44×44 CSS-pixel touch targets; focus Back when entering detail, selected recipe button when returning. Screen-reader announcement of a changed detail heading via focus, not an endlessly repeating live region.
- Grid: announce “1 hàng × 1 cột”, each filled cell's ingredient and position; empty cells announced only when required to explain pattern. Nonessential arrow/icon imagery `alt=""`; the output name remains text. Text and item count convey meaning without color alone.
- Scroll: pointer wheel, touch drag and keyboard/PageDown work in the active pane; focus never disappears into clipped content. Test with screen reader, keyboard-only, 200% zoom and reduced-motion preferences.

## 10. Responsive acceptance matrix (design, not test evidence)

| Layout case | Intended behavior |
|---|---|
| Wide desktop, e.g. 1280×800 | Two-column list/detail, independent scroll, fixed close control. |
| Medium desktop/tablet, e.g. 900×600 | Columns flex/shrink until content would become unreadable, then one-column transition. |
| Narrow portrait, e.g. 390×844 | List → detail state, separate Back/Close, scroll only inside modal. |
| Narrow landscape, e.g. 700×390 | Single-column, shallow-header layout, scrollable detail and safe action area. |
| 200% text zoom / keyboard-only | No clipped text, no hidden close control, deterministic focus order. |
| Device safe-area insets | Header/close/back and last scroll row remain reachable above notches/home indicator. |
| RTL-ready future locale | No meaning encoded by the arrow alone; align using logical layout properties. |

These are **design acceptance targets**, not observed browser test results. Physical-device touch and screen-reader operation must be verified separately at implementation time.

## 11. Integration contract and dependencies

1. Implement modal view as a consumer of `src/core/craft.ts` / eventual canonical item registry. Do not mutate `CraftState.itemBag`, staged grid, `craftHistory`, or crafting results during browsing. Use `itemDisplayName` and semantic/icon assets.
2. Open via existing `ModalHost.open()` and mount under `ModalHandle.body`; dispose event handlers and scroll observers on close. Do not create another modal owner, intercept gameplay clicks under an open modal, or introduce page-level scroll.
3. Quick Navigate (#26) must supply a route into the modal; design does **not** assume it exists now. If the current Library Recipes tab remains, both interfaces derive from one canonical data source. Decide navigation authority during implementation review.
4. WBS-061 depends on WBS-007/051/060. Its production scope (craft table, dependency graph, material navigation) is separate from Issue #27. Issues #28/#29 are prerequisites for any metadata requiring real restored authored content; #35/#36 cover richer graph/ingredient drill-down.
5. The historical Phaser `old_src/ui/RecipeLibraryPanel.ts`, `RecipeLibraryDetail.ts`, `RecipeLibraryCraftGrid.ts`, `LibraryModal.ts`, `RecipeDiagram.ts` and `recipeLocalization.ts` informed selected/list/detail flows, row-major grids, ingredient multiplicities and graph navigation. They are **references in the Git tree**, not production implementations to transplant. Legacy tier/category/bonus fields, Phaser scene widgets and hardcoded rectangle decoration are explicitly rejected.

## 12. Design acceptance and review gate

- [x] Desktop selected/list/detail wireframe and single-recipe data example.
- [x] Mobile list and detail wireframes, responsive landscape and zero-recipe empty state.
- [x] Navigation contract, Back/Close/Escape, scroll ownership and conditional search.
- [x] Accurate current `tear` → `eq_blue_buff` **1×1** recipe; generic 2×2/3×3 slot-order rules without invented recipes.
- [x] Verified inventory of existing wood/parchment/slot/button/icon assets; no required missing art assumed.
- [x] VI/EN translation **readiness** with English runtime explicitly out of scope.
- [x] Keyboard, focus trap gap, touch, screen reader and safe-area requirements.
- [x] Separated legacy references, current data authority, Quick Navigate #26 and WBS-061 production dependencies.
- [ ] **Human design review**: approve or revise desktop/mobile information hierarchy, entry navigation and asset treatment.
- [ ] **Human merge review**: approval must name the exact PR HEAD and `Target: dev`.
- [ ] **Production implementation + native verification**: future WBS-061 work; not part of Issue #27 design commit.

**Review questions:** Is the standalone Recipe Library allowed to coexist with the existing Library Recipes tab? Is Quick Navigate the only primary entry point? Does the single-recipe state merit showing its detail by default on desktop? Resolve these during human design review **before** production UI changes. No merge or Issue #27 closure is implied by this proposal.
