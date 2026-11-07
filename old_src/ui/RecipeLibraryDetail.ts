/**
 * RecipeLibraryDetail — Detail panel rendering logic
 *
 * Extracted from RecipeLibraryPanel.js to keep under 500 lines.
 */

import { RECIPE_BY_ID } from "../data/items.js";
import { UI_FONT, EMOJI_FONT, TIER_COLORS } from "../core/uiTheme.js";
import { t } from "../i18n/index.js";
import { formatRecipeBonusList, getRecipeCategoryLabel } from "./recipeLocalization.js";

interface RecipeBonus {
  [key: string]: number | boolean | undefined;
}

interface Recipe {
  icon: string;
  name: string;
  tier: number;
  bonus?: RecipeBonus;
  description?: string;
}

interface DetailNode {
  setOrigin: (x: number, y?: number) => unknown;
  enableFilters: () => DetailNode;
  filters: {
    external: {
      addMask: (mask: unknown) => unknown;
    };
  };
  height: number;
}

interface DetailTextSource {
  setOrigin: (x: number, y?: number) => DetailTextSource;
  height?: number;
}

interface SceneLike {
  add: {
    text: (x: number, y: number, text: string, style: Record<string, unknown>) => DetailTextSource;
    rectangle: (x: number, y: number, w: number, h: number, fill: number, alpha: number) => DetailTextSource;
  };
}

interface MaskApplier {
  (object: DetailNode): unknown;
}

interface RecipeLibraryPanelLike {
  _clearDetail: () => void;
  _detailScrollY: number;
  detailX: number;
  detailW: number;
  y: number;
  h: number;
  selectedRecipeId: string | null;
  activeCategory: string;
  scene: SceneLike;
  _addDetail: (node: DetailNode, depth: number) => DetailNode;
  _detailMask: unknown;
  _renderEmptyDetail: (dx: number, dw: number, applyMask: MaskApplier) => void;
  _renderCraftingGrid: (recipe: Recipe, dx: number, y: number, dw: number, applyMask: MaskApplier) => number;
  _detailMaxScroll: number;
}

type Tier = 1 | 2 | 3 | 4;

function tierColorLookup(tier: number): { border: number; bg: number; glow: number; label: string } {
  const safeTier: Tier = tier === 2 || tier === 3 || tier === 4 ? tier : 1;
  return TIER_COLORS[safeTier];
}

function formatBonus(bonus: RecipeBonus | null | undefined): string[] {
  if (!bonus || typeof bonus !== "object") return [];
  return formatRecipeBonusList(bonus);
}

function asDetailNode(node: DetailTextSource): DetailNode {
  return node as unknown as DetailNode;
}

export function refreshDetail(panel: RecipeLibraryPanelLike): void {
  panel._clearDetail();
  panel._detailScrollY = 0;
  const dx = panel.detailX + 14;
  const dw = panel.detailW - 28;
  const applyMask: MaskApplier = (object) => {
    object.enableFilters();
    return object.filters.external.addMask(panel._detailMask);
  };

  if (!panel.selectedRecipeId) {
    panel._renderEmptyDetail(dx, dw, applyMask);
    return;
  }

  const recipe = RECIPE_BY_ID[panel.selectedRecipeId] as unknown as Recipe | undefined;
  if (!recipe) { panel._renderEmptyDetail(dx, dw, applyMask); return; }

  let y = panel.y + 14;
  const tc = tierColorLookup(recipe.tier);

  const iconSource = panel.scene.add.text(dx + dw / 2, y, recipe.icon, {
    fontFamily: EMOJI_FONT, fontSize: "40px", color: "#ffffff"
  });
  iconSource.setOrigin(0.5, 0);
  const iconObj = panel._addDetail(asDetailNode(iconSource), 4);
  applyMask(iconObj);
  y += 52;

  const nameSource = panel.scene.add.text(dx + dw / 2, y, recipe.name, {
    fontFamily: UI_FONT, fontSize: "18px", color: "#ffeab0", fontStyle: "bold"
  });
  nameSource.setOrigin(0.5, 0);
  const nameObj = panel._addDetail(asDetailNode(nameSource), 4);
  applyMask(nameObj);
  y += 28;

  const badgeStr = `${t("label.tier")} ${recipe.tier} • ${getRecipeCategoryLabel(panel.activeCategory)}`;
  const badgeSource = panel.scene.add.text(dx + dw / 2, y, badgeStr, {
    fontFamily: UI_FONT, fontSize: "12px", color: tc.label
  });
  badgeSource.setOrigin(0.5, 0);
  const badgeObj = panel._addDetail(asDetailNode(badgeSource), 4);
  applyMask(badgeObj);
  y += 24;

  const div1Source = panel.scene.add.rectangle(
    dx + dw / 2, y, dw - 8, 1, 0x3a5a7a, 0.5
  );
  div1Source.setOrigin(0.5, 0);
  const div1 = panel._addDetail(asDetailNode(div1Source), 4);
  applyMask(div1);
  y += 10;

  const bonusParts = formatBonus(recipe.bonus || {});
  if (bonusParts.length) {
    const hdrSource = panel.scene.add.text(dx + 4, y, t("library.recipeStatsTitle"), {
      fontFamily: UI_FONT, fontSize: "12px", color: "#8df2eb", fontStyle: "bold"
    });
    const hdr = panel._addDetail(asDetailNode(hdrSource), 4);
    applyMask(hdr);
    y += 20;

    bonusParts.forEach(line => {
      const lineSource = panel.scene.add.text(dx + 12, y, `• ${line}`, {
        fontFamily: UI_FONT, fontSize: "11px", color: "#c0ddf5"
      });
      const lineObj = panel._addDetail(asDetailNode(lineSource), 4);
      applyMask(lineObj);
      y += 17;
    });
    y += 6;
  }

  if (recipe.description) {
    const div2Source = panel.scene.add.rectangle(
      dx + dw / 2, y, dw - 8, 1, 0x3a5a7a, 0.4
    );
    div2Source.setOrigin(0.5, 0);
    const div2 = panel._addDetail(asDetailNode(div2Source), 4);
    applyMask(div2);
    y += 10;

    const descSource = panel.scene.add.text(dx + 4, y, recipe.description, {
      fontFamily: UI_FONT, fontSize: "11px", color: "#a6bed3",
      wordWrap: { width: dw - 8 }, lineSpacing: 4
    });
    const desc = panel._addDetail(asDetailNode(descSource), 4);
    applyMask(desc);
    y += desc.height + 14;
  }

  const div3Source = panel.scene.add.rectangle(
    dx + dw / 2, y, dw - 8, 1, 0x5a8ab0, 0.6
  );
  div3Source.setOrigin(0.5, 0);
  const div3 = panel._addDetail(asDetailNode(div3Source), 4);
  applyMask(div3);
  y += 10;

  const gridHdrSource = panel.scene.add.text(dx + 4, y, t("library.recipeCraftTitle"), {
    fontFamily: UI_FONT, fontSize: "12px", color: "#ffd580", fontStyle: "bold"
  });
  const gridHdr = panel._addDetail(asDetailNode(gridHdrSource), 4);
  applyMask(gridHdr);
  y += 24;

  y = panel._renderCraftingGrid(recipe, dx, y, dw, applyMask);

  panel._detailMaxScroll = Math.max(0, y - (panel.y + panel.h) + 20);
}
