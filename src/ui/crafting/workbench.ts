// Crafting workbench: 3×3 forge table + output well, draggable bag, filtered recipe journal,
// and nested item/recipe overlays. Staging stays in the bridge; this file is presentation only.
import type { App } from "../../app/app";
import { activeIndices, BASE_MATERIALS, matchRecipe, RECIPES, type Recipe } from "../../core/craft";
import { getEquipment } from "../../core/equipment";
import { ICONS } from "../../core/emojiIcon";
import { getLocale } from "../../core/i18n";
import { equipmentBonusCopy, itemDisplayName } from "../../core/itemPresentation";
import { outputIdForRecipe, recipeIngredients } from "../../core/recipeGraph";
import { disposeSurfaceTree, h, kitButton, LABEL, nineSlice, panelEl, SLICE, surface, type KitButton } from "../kit";
import { itemArt } from "./art";
import { itemTooltipContent, recipeCraftable, recipeMissing } from "./copy";
import { openCraftLibraryOverlay, openItemSheetOverlay } from "./library";

type BagKind = "all" | "material" | "equipment";
type DragSource = { kind: "bag" } | { kind: "cell"; index: number };
interface DragState {
  itemId: string;
  source: DragSource;
  sourceEl: HTMLElement;
  ghost: HTMLElement;
  cell: number | null;
  bag: boolean;
}

const GRID_SLOTS = 9;
const RECIPE_PAGE_SIZE = 6;

function countItems(items: readonly (string | null)[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) if (item) out[item] = (out[item] ?? 0) + 1;
  return out;
}

function recipeStaging(recipe: Recipe, level: number): (string | null)[] | null {
  const active = activeIndices(level);
  const side = Math.round(Math.sqrt(active.length));
  if (!recipe.size || recipe.size > side || !side) return null;
  const result: (string | null)[] = Array(GRID_SLOTS).fill(null);
  for (let row = 0; row < recipe.size; row++) {
    for (let col = 0; col < recipe.size; col++) {
      const cell = active[row * side + col];
      if (cell !== undefined) result[cell] = recipe.pattern[row * recipe.size + col] ?? null;
    }
  }
  return result;
}

export function mountCraftWorkbench(app: App, host: HTMLElement): { dispose(): void } {
  const root = h("div", "crafting-workbench");
  host.append(root);
  const overlayHost = host.closest<HTMLElement>(".modal-root") ?? host;
  const copy = (vi: string, en: string) => getLocale() === "vi" ? vi : en;
  let disposed = false;
  let feedback = "";
  let controls: KitButton[] = [];
  let bagQuery = "";
  let bagKind: BagKind = "all";
  let bagTier = 0;
  let recipeQuery = "";
  let recipeTier = 0;
  let recipeOnlyCraftable = false;
  let recipePage = 0;
  let focusTarget: "bag" | "recipe" | null = null;
  let overlay: { close(): void } | null = null;
  let drag: DragState | null = null;
  const cellHighlights = new Map<number, HTMLElement>();
  let bagHighlight: HTMLElement | null = null;

  const run = () => app.bridge.run();
  const planning = () => run()?.phase === "PLANNING";
  const bagCounts = () => countItems(run()?.itemBag ?? []);
  const stagedCounts = (staged = app.bridge.craftStaging()) => countItems(staged);
  const availableOf = (id: string, bag = bagCounts(), staged = stagedCounts()) => (bag[id] ?? 0) - (staged[id] ?? 0);

  const openInfo = (itemId: string, source: DragSource | null = null) => {
    app.tooltip.hide();
    overlay?.close();
    const level = run()?.craftTableLevel ?? 0;
    const actions = source?.kind === "cell"
      ? {
        onRemove: () => {
          stageAt(source.index, null);
          overlay?.close();
          render();
        },
      }
      : source?.kind === "bag" && availableOf(itemId) > 0
        ? {
          onPlace: () => {
            const staged = app.bridge.craftStaging();
            const empty = activeIndices(level).find((index) => !staged[index]);
            if (empty == null) {
              say(copy("Bàn chế tạo đã đầy.", "The workbench is full."));
            } else {
              stageAt(empty, itemId);
            }
            overlay?.close();
            render();
          },
        }
        : {};
    overlay = openItemSheetOverlay(app, overlayHost, itemId, actions, {
      onOpenLibrary: () => openLibrary(),
      onSelect: (next) => openInfo(next),
    });
  };
  const openLibrary = () => {
    app.tooltip.hide();
    overlay?.close();
    overlay = openCraftLibraryOverlay(app, overlayHost, { onOpenItem: (next) => openInfo(next) });
  };

  const say = (message: string) => { feedback = message; };

  const cleanupDrag = () => {
    if (!drag) return;
    disposeSurfaceTree(drag.ghost);
    drag.ghost.remove();
    drag.sourceEl.classList.remove("is-dragging");
    for (const node of cellHighlights.values()) node.hidden = true;
    if (bagHighlight) bagHighlight.hidden = true;
    drag = null;
  };

  const highlightTarget = (cell: number | null, bag: boolean) => {
    for (const [index, node] of cellHighlights) node.hidden = index !== cell;
    if (bagHighlight) bagHighlight.hidden = !bag;
  };

  const startDrag = (itemId: string, source: DragSource, sourceEl: HTMLElement, event: PointerEvent): boolean => {
    if (source.kind === "bag" && availableOf(itemId) <= 0) {
      feedback = copy("Nguyên liệu này đã nằm hết trên bàn.", "All copies are already staged.");
      const message = root.querySelector<HTMLElement>(".crafting-feedback");
      if (message) message.textContent = feedback;
      return false;
    }
    const ghost = panelEl("slot_well", "craft-drag-ghost");
    ghost.style.color = LABEL;
    ghost.append(itemArt(itemId, "craft-drag-ghost-icon"));
    ghost.append(h("span", "craft-drag-ghost-count", `×${source.kind === "bag" ? availableOf(itemId) : 1}`));
    document.body.append(ghost);
    sourceEl.classList.add("is-dragging");
    drag = { itemId, source, sourceEl, ghost, cell: null, bag: false };
    app.tooltip.hide();
    drag.ghost.style.left = `${event.clientX}px`;
    drag.ghost.style.top = `${event.clientY}px`;
    return true;
  };

  const moveDrag = (event: PointerEvent) => {
    if (!drag) return;
    drag.ghost.style.left = `${event.clientX}px`;
    drag.ghost.style.top = `${event.clientY}px`;
    const hit = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
    const cellEl = hit?.closest<HTMLElement>("[data-craft-cell]");
    const bagEl = hit?.closest<HTMLElement>("[data-craft-bag]");
    drag.cell = cellEl ? Number(cellEl.dataset.craftCell) : null;
    drag.bag = Boolean(bagEl);
    highlightTarget(drag.cell, drag.bag);
  };

  const moveStaged = (from: number, to: number): boolean => {
    const staged = [...app.bridge.craftStaging()];
    const fromId = staged[from];
    if (!fromId || from === to) return false;
    const toId = staged[to] ?? null;
    if (!app.bridge.stageCraft(to, fromId)) {
      say(copy("Không thể đặt vật phẩm ở ô này.", "Cannot place the item there."));
      return false;
    }
    if (!app.bridge.stageCraft(from, toId)) {
      if (toId) app.bridge.stageCraft(to, toId);
      else app.bridge.stageCraft(to, null);
      say(copy("Không thể di chuyển vật phẩm.", "Cannot move the item."));
      return false;
    }
    say(copy("Đã di chuyển vật phẩm.", "Item moved."));
    return true;
  };

  const stageAt = (index: number, itemId: string | null): boolean => {
    if (!planning()) {
      say(copy("Chỉ có thể chế tạo trong giai đoạn chuẩn bị.", "Crafting is available during planning only."));
      return false;
    }
    if (!app.bridge.stageCraft(index, itemId)) {
      say(copy("Không thể xếp vật phẩm ở bước này. Kiểm tra hướng dẫn.", "Cannot stage this item in the current step."));
      return false;
    }
    say(itemId ? copy(`Đã đặt ${itemDisplayName(itemId)}.`, `Placed ${itemDisplayName(itemId)}.`) : copy("Đã lấy vật phẩm ra.", "Item removed."));
    return true;
  };

  const finishDrag = (event: PointerEvent) => {
    if (!drag) return;
    const { itemId, source, cell, bag } = drag;
    cleanupDrag();
    if (cell !== null) {
      if (source.kind === "cell" && source.index === cell) return;
      if (source.kind === "cell") moveStaged(source.index, cell);
      else stageAt(cell, itemId);
    } else if (bag && source.kind === "cell") {
      stageAt(source.index, null);
    }
    render();
  };

  const bindItem = (el: HTMLElement, itemId: string, source: DragSource | null) => {
    let down = false;
    let dragging = false;
    let held = false;
    let pointerId = -1;
    let startX = 0, startY = 0;
    let timer = 0;
    let suppressClick = false;
    const show = () => app.tooltip.show(el, itemTooltipContent(itemId));
    const cancelHold = () => { clearTimeout(timer); timer = 0; };
    const onEnter = (event: PointerEvent) => { if (event.pointerType === "mouse") show(); };
    const onLeave = (event: PointerEvent) => { if (!dragging && event.pointerType === "mouse") app.tooltip.hide(); };
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      down = true;
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      held = false;
      dragging = false;
      try { el.setPointerCapture(event.pointerId); } catch { /* synthetic pointer or host edge */ }
      if (event.pointerType !== "mouse") {
        cancelHold();
        timer = window.setTimeout(() => {
          if (dragging || !down) return;
          held = true;
          show();
        }, 460);
      }
    };
    const onMove = (event: PointerEvent) => {
      if (!down || event.pointerId !== pointerId) return;
      if (!dragging && Math.hypot(event.clientX - startX, event.clientY - startY) > 6) {
        cancelHold();
        held = false;
        if (source) {
          dragging = startDrag(itemId, source, el, event);
          if (!dragging) {
            down = false;
            return;
          }
        }
      }
      if (dragging) moveDrag(event);
    };
    const onUp = (event: PointerEvent) => {
      if (!down) return;
      down = false;
      cancelHold();
      if (dragging) {
        suppressClick = true;
        finishDrag(event);
      } else if (held) {
        held = false;
        app.tooltip.hide();
      } else {
        app.tooltip.hide();
        openInfo(itemId, source);
      }
      if (el.hasPointerCapture(event.pointerId)) {
        try { el.releasePointerCapture(event.pointerId); } catch { /* noop */ }
      }
    };
    const onCancel = (event: PointerEvent) => {
      down = false;
      cancelHold();
      if (dragging) cleanupDrag();
      dragging = false;
      held = false;
      app.tooltip.hide();
      try { if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId); } catch { /* noop */ }
    };
    const onClick = (event: MouseEvent) => {
      if (!suppressClick) return;
      suppressClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openInfo(itemId, source);
    };
    const onContext = (event: Event) => event.preventDefault();
    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onCancel);
    el.addEventListener("click", onClick, true);
    el.addEventListener("keydown", onKey);
    el.addEventListener("contextmenu", onContext);
    return () => {
      cancelHold();
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onCancel);
      el.removeEventListener("click", onClick, true);
      el.removeEventListener("keydown", onKey);
      el.removeEventListener("contextmenu", onContext);
    };
  };

  const bindInfo = (el: HTMLElement, itemId: string) => bindItem(el, itemId, null);

  const clearGrid = () => {
    const staged = app.bridge.craftStaging();
    let failed = false;
    for (let index = 0; index < GRID_SLOTS; index++) {
      if (staged[index] && !app.bridge.stageCraft(index, null)) failed = true;
    }
    say(failed
      ? copy("Một số ô chưa được dọn. Kiểm tra bước hướng dẫn.", "Some slots could not be cleared. Check the tutorial step.")
      : copy("Đã dọn bàn ghép.", "Workbench cleared."));
    render();
  };

  const placeRecipe = (recipe: Recipe) => {
    const state = run();
    if (!state) return;
    const target = recipeStaging(recipe, state.craftTableLevel);
    if (!target) {
      say(copy("Cần nâng cấp bàn ghép để dùng công thức này.", "Upgrade the workbench to use this recipe."));
      render();
      return;
    }
    const bag = bagCounts();
    const needs = countItems(target);
    if (Object.entries(needs).some(([id, count]) => (bag[id] ?? 0) < count)) {
      say(copy("Chưa đủ nguyên liệu cho công thức.", "Not enough ingredients for this recipe."));
      render();
      return;
    }
    const current = app.bridge.craftStaging();
    for (let index = 0; index < GRID_SLOTS; index++) {
      if (current[index] && current[index] !== target[index] && !app.bridge.stageCraft(index, null)) {
        say(copy("Không thể dọn ô lúc này. Kiểm tra hướng dẫn.", "Cannot clear this slot during the current tutorial step."));
        render();
        return;
      }
    }
    for (let index = 0; index < GRID_SLOTS; index++) {
      if (target[index] && app.bridge.craftStaging()[index] !== target[index] && !app.bridge.stageCraft(index, target[index])) {
        say(copy("Chưa thể đặt đủ nguyên liệu. Kiểm tra hướng dẫn.", "Cannot place all ingredients during this tutorial step."));
        render();
        return;
      }
    }
    say(copy("Đã xếp nguyên liệu theo công thức.", "Ingredients placed using the recipe."));
    render();
  };

  const commitCraft = () => {
    const crafted = app.bridge.craft();
    say(crafted
      ? copy(`Đã chế tạo ${itemDisplayName(crafted)}!`, `Crafted ${itemDisplayName(crafted)}!`)
      : copy("Chưa thể chế tạo. Kiểm tra công thức và bước hướng dẫn.", "Crafting unavailable. Check the recipe and tutorial step."));
    if (crafted) void app.sfx.play("buy");
    render();
  };

  const render = () => {
    if (disposed) return;
    cleanupDrag();
    for (const button of controls) button.dispose();
    controls = [];
    disposeSurfaceTree(root);
    root.replaceChildren();
    cellHighlights.clear();
    bagHighlight = null;

    const state = run();
    if (!state) {
      const empty = panelEl("panel_parchment", "crafting-empty");
      empty.append(h("h2", "", copy("Chưa có lượt chơi", "No active run")), h("p", "", copy("Vào trận để mở bàn chế tạo.", "Enter a run to open the workbench.")));
      root.append(empty);
      return;
    }

    const level = state.craftTableLevel;
    const active = new Set(activeIndices(level));
    const staged = app.bridge.craftStaging();
    const bag = countItems(state.itemBag);
    const reserved = countItems(staged);
    const matched = matchRecipe([...staged], level);
    const matchesOwned = Object.entries(reserved).every(([id, count]) => (bag[id] ?? 0) >= count);
    const ready = planning() && Boolean(matched) && matchesOwned;

    const hero = panelEl("panel_wood", "crafting-hero");
    const heading = h("div", "crafting-hero-heading");
    heading.append(
      h("span", "crafting-eyebrow", copy("XƯỞNG RÈN · CÔNG THỨC CỔ", "FORGE · ANCIENT RECIPES")),
      h("h2", "", copy("Chế tạo", "Crafting")),
      h("p", "crafting-subtitle", copy("Kéo nguyên liệu vào bàn, chạm để xem thông tin, nhấn giữ để xem nhanh.", "Drag ingredients onto the table, tap for details, hold for a quick tooltip.")),
    );
    const rank = panelEl("shell_billboard", "crafting-rank");
    rank.append(h("span", "", copy("CẤP BÀN", "TABLE LEVEL")), h("strong", "", level ? `${level} / 3` : copy("CHƯA MỞ", "LOCKED")));
    hero.append(heading, rank);
    root.append(hero);

    const workspace = h("div", "crafting-workspace");

    // ── table + output ───────────────────────────────────────────────────────
    const table = panelEl("panel_wood", "craft-table");
    const tableHead = h("div", "crafting-section-heading");
    const tableTitle = h("div", "");
    tableTitle.append(h("span", "crafting-eyebrow", copy("KHU VỰC CHẾ TẠO", "CRAFTING AREA")), h("h3", "", copy("Bàn chế tạo", "Workbench")));
    tableHead.append(tableTitle, h("span", "crafting-counter", `${active.size} / ${GRID_SLOTS} ${copy("ô mở", "unlocked")}`));
    table.append(tableHead);

    const stage = h("div", "craft-stage");
    const grid = h("div", "craft-grid");
    for (let index = 0; index < GRID_SLOTS; index++) {
      const unlocked = active.has(index);
      const itemId = staged[index];
      const cell = h("button", "craft-cell");
      cell.type = "button";
      if (unlocked) cell.dataset.craftCell = String(index);
      else cell.dataset.craftLocked = String(index);
      cell.disabled = !unlocked;
      cell.style.color = LABEL;
      cell.setAttribute("aria-label", !unlocked
        ? copy(`Ô ${index + 1} bị khóa`, `Slot ${index + 1} locked`)
        : itemId
          ? copy(`Ô ${index + 1}: ${itemDisplayName(itemId)}. Chạm để xem thông tin, kéo để di chuyển.`, `Slot ${index + 1}: ${itemDisplayName(itemId)}. Tap for details, drag to move.`)
          : copy(`Ô ${index + 1} trống`, `Slot ${index + 1} empty`));
      surface(cell, (g, w, hh) => nineSlice(
        g,
        !unlocked ? "btn_wood_disabled" : itemId ? "btn_blue_selected" : "slot_well",
        !unlocked || itemId ? SLICE.btn : SLICE.slot_well,
        0, 0, w, hh,
      ));
      const highlight = h("div", "craft-cell-highlight");
      highlight.hidden = true;
      surface(highlight, (g, w, hh) => nineSlice(g, "btn_blue_selected", SLICE.btn, 0, 0, w, hh));
      cell.append(highlight);
      cellHighlights.set(index, highlight);
      if (!unlocked) {
        const lock = h("span", "crafting-lock", ICONS.lock);
        lock.setAttribute("aria-hidden", "true");
        cell.append(lock);
      } else if (itemId) {
        cell.append(itemArt(itemId, "craft-cell-icon"));
        bindItem(cell, itemId, { kind: "cell", index });
      } else {
        cell.append(h("span", "craft-cell-plus", "+"));
      }
      if (unlocked) {
        const slotNumber = h("span", "crafting-slot-number", String(index + 1));
        slotNumber.setAttribute("aria-hidden", "true");
        cell.append(slotNumber);
      }
      grid.append(cell);
    }

    const arrow = h("div", "craft-stage-arrow", "→");
    arrow.setAttribute("aria-hidden", "true");
    const outputWrap = h("div", "craft-output-wrap");
    const output = panelEl("slot_well", "craft-output");
    const outputId = matched ? outputIdForRecipe(matched) : null;
    if (outputId) {
      output.append(itemArt(outputId, "craft-output-icon"));
      output.dataset.item = outputId;
      output.tabIndex = 0;
      bindInfo(output, outputId);
    } else {
      output.append(h("span", "craft-output-empty", ICONS.question));
    }
    output.setAttribute("aria-label", outputId ? copy(`Đầu ra: ${itemDisplayName(outputId)}`, `Output: ${itemDisplayName(outputId)}`) : copy("Đầu ra trống", "Empty output"));
    const outputLabel = h("span", "craft-output-label", copy("ĐẦU RA", "OUTPUT"));
    const outputName = h("span", "craft-output-name", outputId ? itemDisplayName(outputId) : copy("Chưa khớp", "No match"));
    outputWrap.append(outputLabel, output, outputName);
    stage.append(grid, arrow, outputWrap);
    table.append(stage);

    const resultInfo = h("div", "craft-result-copy");
    if (outputId) {
      const equipment = getEquipment(outputId);
      resultInfo.append(h("small", "", equipment ? equipmentBonusCopy(equipment.bonuses) || copy("Chưa có chỉ số", "No bonuses") : copy("Nguyên liệu gốc", "Base material")));
    } else {
      resultInfo.append(h("small", "", copy("Xếp nguyên liệu đúng công thức để xem thành phẩm.", "Arrange ingredients into a valid recipe to preview the output.")));
    }
    table.append(resultInfo);

    const actions = h("div", "craft-stage-actions");
    const clear = kitButton({ skin: "wood", label: copy("Dọn", "Clear"), cls: "craft-clear", onClick: clearGrid });
    clear.setDisabled(!planning() || !staged.some(Boolean));
    const craft = kitButton({ skin: "green", label: copy("Chế", "Craft"), cls: "craft-commit", onClick: commitCraft, size: 28 });
    craft.setDisabled(!ready);
    actions.append(clear.el, craft.el);
    controls.push(clear, craft);
    table.append(actions);
    table.append(h("p", "crafting-hint", level === 0
      ? copy("Bàn chế tạo chưa mở. Nâng cấp công nghệ để bắt đầu.", "Unlock the crafting table through research to begin.")
      : copy("Kéo vật phẩm giữa túi và các ô. Chạm vào vật phẩm để mở thông tin; nhấn giữ để xem tooltip.", "Drag items between the bag and the grid. Tap an item for details; hold for a tooltip.")));

    // ── bag ──────────────────────────────────────────────────────────────────
    const bagPanel = panelEl("panel_parchment", "craft-bag-panel");
    bagPanel.dataset.craftBag = "true";
    const bagHighlightEl = h("div", "craft-drop-highlight");
    bagHighlightEl.hidden = true;
    surface(bagHighlightEl, (g, w, hh) => nineSlice(g, "btn_blue_selected", SLICE.btn, 0, 0, w, hh));
    bagPanel.append(bagHighlightEl);
    bagHighlight = bagHighlightEl;
    const bagHead = h("div", "crafting-section-heading");
    const bagTitle = h("div", "");
    bagTitle.append(h("span", "crafting-eyebrow", copy("CHỌN NGUYÊN LIỆU", "SELECT INGREDIENTS")), h("h3", "", copy("Túi nguyên liệu", "Ingredient bag")));
    bagHead.append(bagTitle, h("span", "crafting-counter", `${state.itemBag.length} ${copy("vật phẩm", "items")}`));
    bagPanel.append(bagHead);

    const bagFilters = h("div", "craft-filters");
    const bagChip = (value: BagKind, label: string) => {
      const b = kitButton({ skin: "wood", label, size: 14, cls: "craft-filter-chip", onClick: () => { bagKind = value; render(); } });
      b.setSelected(bagKind === value);
      controls.push(b);
      bagFilters.append(b.el);
    };
    bagChip("all", copy("Tất cả", "All"));
    bagChip("material", copy("Nguyên liệu", "Materials"));
    bagChip("equipment", copy("Trang bị", "Equipment"));
    const bagTierWrap = h("div", "craft-filter-tier");
    for (const value of [0, 1, 2, 3]) {
      const label = value ? `B${value}` : copy("Bậc", "Tier");
      const b = kitButton({ skin: "wood", label, size: 13, aria: value ? `Bậc ${value}` : "Mọi bậc", cls: "craft-tier-chip", onClick: () => { bagTier = value; render(); } });
      b.setSelected(bagTier === value);
      controls.push(b);
      bagTierWrap.append(b.el);
    }
    const bagSearch = h("input", "lib-input craft-search");
    bagSearch.type = "search";
    bagSearch.value = bagQuery;
    bagSearch.placeholder = copy("Tìm vật phẩm", "Search items");
    bagSearch.setAttribute("aria-label", copy("Tìm vật phẩm", "Search items"));
    bagSearch.dataset.focus = "bag";
    bagSearch.addEventListener("input", () => { bagQuery = bagSearch.value; focusTarget = "bag"; render(); });
    const bagFilterRow = h("div", "craft-filter-row");
    bagFilterRow.append(bagFilters, bagTierWrap, bagSearch);
    bagPanel.append(bagFilterRow);

    const bagGrid = h("div", "craft-bag-grid");
    const bagIds = Object.keys(bag)
      .filter((id) => bag[id]! > 0)
      .filter((id) => {
        const material = (BASE_MATERIALS as readonly string[]).includes(id);
        if (bagKind === "material" && !material) return false;
        if (bagKind === "equipment" && material) return false;
        if (bagTier) {
          const item = getEquipment(id);
          if (!item || item.tier !== bagTier) return false;
        }
        const q = bagQuery.trim().toLowerCase();
        return !q || itemDisplayName(id).toLowerCase().includes(q) || id.includes(q);
      })
      .sort((a, b) => {
        const ai = (BASE_MATERIALS as readonly string[]).indexOf(a);
        const bi = (BASE_MATERIALS as readonly string[]).indexOf(b);
        if (ai >= 0 || bi >= 0) return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
        return (getEquipment(a)?.tier ?? 0) - (getEquipment(b)?.tier ?? 0) || itemDisplayName(a).localeCompare(itemDisplayName(b));
      });
    for (const id of bagIds) {
      const available = availableOf(id, bag, reserved);
      const tile = h("button", "craft-item-tile");
      tile.type = "button";
      tile.dataset.item = id;
      tile.dataset.staged = String(available <= 0);
      tile.style.color = LABEL;
      tile.setAttribute("aria-label", `${itemDisplayName(id)}, ${available} ${copy("còn lại", "available")}. Chạm để xem thông tin, kéo để xếp.`);
      surface(tile, (g, w, hh) => nineSlice(g, "slot_well", SLICE.slot_well, 0, 0, w, hh));
      tile.append(itemArt(id, "craft-item-tile-icon"));
      tile.append(h("span", "craft-item-tile-name", itemDisplayName(id)));
      tile.append(h("span", "craft-item-tile-count", `×${available}`));
      bindItem(tile, id, { kind: "bag" });
      bagGrid.append(tile);
    }
    if (!bagIds.length) bagGrid.append(h("p", "crafting-muted", copy("Không có vật phẩm phù hợp bộ lọc.", "No items match the filters.")));
    bagPanel.append(bagGrid);

    // ── recipes ──────────────────────────────────────────────────────────────
    const recipePanel = panelEl("panel_parchment", "craft-recipes-panel");
    const recipeHead = h("div", "craft-recipe-head");
    const recipeTitle = h("div", "");
    recipeTitle.append(h("span", "crafting-eyebrow", copy("SỔ TAY CHẾ TẠO", "RECIPE JOURNAL")), h("h3", "", copy("Công thức", "Recipes")));
    const library = kitButton({ skin: "wood", label: copy("Thư viện", "Library"), icon: ICONS.library, cls: "craft-library-button", onClick: openLibrary });
    controls.push(library);
    recipeHead.append(recipeTitle, library.el);
    recipePanel.append(recipeHead);

    const recipeFilters = h("div", "craft-filters");
    const recipeChip = (value: number, label: string) => {
      const b = kitButton({ skin: "wood", label, size: 14, cls: "craft-filter-chip", onClick: () => { recipeTier = value; recipePage = 0; render(); } });
      b.setSelected(recipeTier === value);
      controls.push(b);
      recipeFilters.append(b.el);
    };
    recipeChip(0, copy("Tất cả", "All"));
    for (const size of [1, 2, 3] as const) if (size <= level) recipeChip(size, `B${size}`);
    const only = kitButton({ skin: "plum", label: copy("Đủ nguyên liệu", "Craftable"), size: 14, cls: "craft-filter-chip", onClick: () => { recipeOnlyCraftable = !recipeOnlyCraftable; render(); } });
    only.setSelected(recipeOnlyCraftable);
    controls.push(only);
    recipeFilters.append(only.el);
    const recipeSearch = h("input", "lib-input craft-search");
    recipeSearch.type = "search";
    recipeSearch.value = recipeQuery;
    recipeSearch.placeholder = copy("Tìm công thức", "Search recipes");
    recipeSearch.setAttribute("aria-label", copy("Tìm công thức", "Search recipes"));
    recipeSearch.dataset.focus = "recipe";
    recipeSearch.addEventListener("input", () => { recipeQuery = recipeSearch.value; recipePage = 0; focusTarget = "recipe"; render(); });
    recipePanel.append(recipeFilters, recipeSearch);

    const unlocked = RECIPES.filter((recipe) => recipe.size <= level);
    const query = recipeQuery.trim().toLowerCase();
    const filtered = unlocked.filter((recipe) => {
      if (recipeTier && recipe.size !== recipeTier) return false;
      if (recipeOnlyCraftable && !recipeCraftable(recipe, bag)) return false;
      if (!query) return true;
      return itemDisplayName(outputIdForRecipe(recipe)).toLowerCase().includes(query)
        || recipeIngredients(recipe).some((ingredient) => itemDisplayName(ingredient.id).toLowerCase().includes(query));
    });
    const pages = Math.max(1, Math.ceil(filtered.length / RECIPE_PAGE_SIZE));
    recipePage = Math.min(recipePage, pages - 1);
    if (pages > 1) {
      const pager = h("div", "craft-recipe-pager");
      const prev = kitButton({ skin: "wood", label: "‹", cls: "craft-page", onClick: () => { recipePage = Math.max(0, recipePage - 1); render(); } });
      const next = kitButton({ skin: "wood", label: "›", cls: "craft-page", onClick: () => { recipePage = Math.min(pages - 1, recipePage + 1); render(); } });
      prev.setDisabled(recipePage === 0);
      next.setDisabled(recipePage >= pages - 1);
      controls.push(prev, next);
      pager.append(prev.el, h("span", "crafting-counter", `${recipePage + 1} / ${pages}`), next.el);
      recipePanel.append(pager);
    }
    const recipeList = h("div", "craft-recipe-list");
    for (const recipe of filtered.slice(recipePage * RECIPE_PAGE_SIZE, recipePage * RECIPE_PAGE_SIZE + RECIPE_PAGE_SIZE)) {
      const output = outputIdForRecipe(recipe);
      const target = recipeStaging(recipe, level);
      const missing = recipeMissing(recipe, bag);
      const row = h("div", "craft-recipe-row");
      surface(row, (g, w, hh) => nineSlice(g, "slot_well", SLICE.slot_well, 0, 0, w, hh));
      row.style.color = LABEL;
      const hit = h("div", "craft-recipe-hit");
      hit.tabIndex = 0;
      hit.setAttribute("role", "button");
      hit.setAttribute("aria-label", `${itemDisplayName(output)}. ${missing.length ? `Thiếu ${missing.join(", ")}` : "Đủ nguyên liệu"}`);
      hit.append(itemArt(output, "craft-recipe-icon"));
      const copyBox = h("div", "craft-recipe-copy");
      copyBox.append(
        h("strong", "", itemDisplayName(output)),
        h("small", "", missing.length ? `${copy("Thiếu", "Missing")}: ${missing.slice(0, 2).join(", ")}` : copy("Đủ nguyên liệu", "Craftable")),
      );
      hit.append(copyBox, h("span", "craft-recipe-tier", `B${recipe.size}`));
      bindInfo(hit, output);
      const fill = kitButton({ skin: "blue", label: copy("Xếp", "Fill"), size: 15, cls: "craft-fill", onClick: () => placeRecipe(recipe) });
      fill.setDisabled(!planning() || !target || missing.length > 0);
      controls.push(fill);
      row.append(hit, fill.el);
      recipeList.append(row);
    }
    if (!filtered.length) recipeList.append(h("p", "crafting-muted", copy("Không có công thức phù hợp.", "No recipes match.")));
    recipePanel.append(recipeList);

    workspace.append(table, bagPanel, recipePanel);
    root.append(workspace);
    const message = h("p", "crafting-feedback", feedback || (planning()
      ? copy("Nguyên liệu chỉ tiêu hao khi chế tạo thành công.", "Ingredients are consumed only after a successful craft.")
      : copy("Chỉ có thể chế tạo trong giai đoạn chuẩn bị.", "Crafting is available during planning only.")));
    message.setAttribute("role", "status");
    message.setAttribute("aria-live", "polite");
    table.append(message);

    if (focusTarget) {
      const target = root.querySelector<HTMLInputElement>(`input[data-focus="${focusTarget}"]`);
      if (target) {
        target.focus({ preventScroll: true });
        target.setSelectionRange(target.value.length, target.value.length);
      }
      focusTarget = null;
    }
  };

  const off = app.bridge.onChange(render);
  render();
  return {
    dispose() {
      disposed = true;
      off();
      cleanupDrag();
      overlay?.close();
      overlay = null;
      app.tooltip.hide();
      for (const button of controls) button.dispose();
      controls = [];
      disposeSurfaceTree(root);
      root.remove();
    },
  };
}
