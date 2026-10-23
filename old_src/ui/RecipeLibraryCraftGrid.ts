/**
 * RecipeLibraryPanel - Crafting Grid renderer
 * Extracted from RecipeLibraryPanel.js to keep under 500 lines
 */

import { ITEM_BY_ID, RECIPE_BY_ID } from "../data/items.js";
import { UI_FONT, EMOJI_FONT, TIER_COLORS } from "../core/uiTheme.js";
import { t } from "../i18n/index.js";
import { getRecipeIngredientSuffix } from "./recipeLocalization.js";

interface RecipeBonus {
  atkPct?: number;
  critPct?: number;
  lifestealPct?: number;
  hpPct?: number;
  defFlat?: number;
  mdefFlat?: number;
  shieldStart?: number;
  matkPct?: number;
  startingRage?: number;
  healPct?: number;
  burnOnHit?: number;
}

interface Recipe {
  _category?: string;
  bonus?: RecipeBonus;
  gridSize?: number;
  pattern?: Array<string | null>;
  icon: string;
  id: string;
  tier: number;
}

interface DetailNode {
  setInteractive?: (opts: { useHandCursor: boolean }) => void;
  on?: (event: string, handler: () => void) => void;
  setStrokeStyle?: (...args: unknown[]) => void;
  setOrigin: (x: number, y?: number) => unknown;
}

interface DetailTextNode {
  setOrigin: (x: number, y?: number) => unknown;
}

interface SceneLike {
  add: {
    rectangle: (x: number, y: number, w: number, h: number, fill: number, alpha: number) => DetailNode;
    text: (x: number, y: number, text: string, style: Record<string, unknown>) => DetailTextNode;
  };
}

interface RecipeLibraryPanelLike {
  scene: SceneLike;
  _addDetail: (node: DetailNode, depth: number) => DetailNode;
  activeCategory: string | null;
  selectedRecipeId: string | null;
  _detailScrollY: number;
  refresh: () => void;
}

type Tier = 1 | 2 | 3 | 4;

function tierColorLookup(tier: number): { border: number; bg: number; glow: number } {
  const safeTier: Tier = tier === 2 || tier === 3 || tier === 4 ? tier : 1;
  return TIER_COLORS[safeTier];
}

function getRecipeCategory(recipe: Recipe): string {
  if (recipe._category) return recipe._category;
  const b = recipe.bonus || {};
  const atkScore = (b.atkPct ? 2 : 0) + (b.critPct ? 1.5 : 0) + (b.lifestealPct ? 0.5 : 0);
  const defScore = (b.hpPct ? 1.5 : 0) + (b.defFlat ? 1 : 0) + (b.mdefFlat ? 1 : 0) + (b.shieldStart ? 1 : 0);
  const magScore = (b.matkPct ? 2 : 0) + (b.startingRage ? 0.5 : 0) + (b.healPct ? 1 : 0) + (b.burnOnHit ? 0.5 : 0);
  if (magScore > atkScore && magScore > defScore) return "magic";
  if (defScore > atkScore) return "defense";
  return "offense";
}

export function renderCraftingGridExt(
  panel: RecipeLibraryPanelLike,
  recipe: Recipe,
  dx: number,
  startY: number,
  areaW: number,
  mask: (obj: DetailNode) => void
): number {
  const gridSize = recipe.gridSize || 2;
  const pattern = recipe.pattern || [];
  const slotSize = gridSize >= 3 ? 36 : 42;
  const slotGap = 3;
  const gridTotalW = gridSize * (slotSize + slotGap) - slotGap;
  const gridTotalH = gridTotalW;

  const arrowW = 32;
  const outputW = slotSize + 8;
  const totalW = gridTotalW + arrowW + outputW;
  const startX = dx + Math.max(0, (areaW - totalW) / 2);

  let y = startY;

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const idx = row * gridSize + col;
      const sx = startX + col * (slotSize + slotGap);
      const sy = y + row * (slotSize + slotGap);
      const ingredientId = pattern[idx] || null;

      if (ingredientId) {
        const item = ITEM_BY_ID[ingredientId];
        const isEquip = item?.kind === "equipment";
        const eqRecipe = isEquip ? RECIPE_BY_ID[ingredientId.replace("eq_", "")] as Recipe | undefined : null;
        const tc = eqRecipe ? tierColorLookup(eqRecipe.tier) : null;

        const slotColor = isEquip ? (tc?.bg ?? 0x1a2d4c) : 0x1c2e3e;
        const slotBorderColor = isEquip ? (tc?.border ?? 0x4e9af5) : 0x3a5a6e;
        const slotAlpha = 0.95;

        const bgRect = panel.scene.add.rectangle(
          sx + slotSize / 2, sy + slotSize / 2, slotSize, slotSize, slotColor, slotAlpha
        );
        bgRect.setOrigin(0.5);
        (bgRect as DetailNode).setStrokeStyle?.(isEquip ? 2 : 1.2, slotBorderColor, isEquip ? 0.9 : 0.6);
        const bgNode = panel._addDetail(bgRect as DetailNode, 5);
        mask(bgNode);
        const slotBg: DetailNode = bgNode;

        const emoji = item?.icon ?? "?";
        const textNode = panel.scene.add.text(sx + slotSize / 2, sy + slotSize / 2 - 1, emoji, {
          fontFamily: EMOJI_FONT, fontSize: gridSize >= 3 ? "18px" : "22px", color: "#ffffff"
        });
        textNode.setOrigin(0.5);
        const iconTxt = panel._addDetail(textNode as unknown as DetailNode, 6);
        mask(iconTxt);

        if (isEquip && eqRecipe) {
          bgNode.setInteractive?.({ useHandCursor: true });
          bgNode.on?.("pointerover", () => bgNode.setStrokeStyle?.(2.5, tc?.glow ?? 0xffffff, 1));
          bgNode.on?.("pointerout", () => bgNode.setStrokeStyle?.(2, slotBorderColor, 0.9));
          bgNode.on?.("pointerdown", () => {
            const cat = getRecipeCategory(eqRecipe);
            panel.activeCategory = cat;
            panel.selectedRecipeId = eqRecipe.id;
            panel._detailScrollY = 0;
            panel.refresh();
          });
        }

        // slotBg is currently used for type-narrowing only; reference to keep tree-shaking honest
        void slotBg;
      } else {
        const emptyRect = panel.scene.add.rectangle(
          sx + slotSize / 2, sy + slotSize / 2, slotSize, slotSize, 0x12202c, 0.7
        );
        emptyRect.setOrigin(0.5);
        (emptyRect as DetailNode).setStrokeStyle?.(1, 0x243444, 0.4);
        const slotBg = panel._addDetail(emptyRect as DetailNode, 5);
        mask(slotBg);
      }
    }
  }

  const arrowX = startX + gridTotalW + 6;
  const arrowY = y + gridTotalH / 2;
  const arrowText = panel.scene.add.text(arrowX + arrowW / 2, arrowY, "→", {
    fontFamily: UI_FONT, fontSize: "22px", color: "#ffd580", fontStyle: "bold"
  });
  arrowText.setOrigin(0.5);
  const arrow = panel._addDetail(arrowText as unknown as DetailNode, 5);
  mask(arrow);

  const outX = arrowX + arrowW;
  const outRect = panel.scene.add.rectangle(
    outX + outputW / 2, arrowY, outputW, outputW, 0x2a3e14, 0.9
  );
  outRect.setOrigin(0.5);
  (outRect as DetailNode).setStrokeStyle?.(2, 0xbdcf47, 0.9);
  const outBg = panel._addDetail(outRect as DetailNode, 5);
  mask(outBg);

  const outIconText = panel.scene.add.text(outX + outputW / 2, arrowY, recipe.icon, {
    fontFamily: EMOJI_FONT, fontSize: gridSize >= 3 ? "22px" : "26px", color: "#ffffff"
  });
  outIconText.setOrigin(0.5);
  const outIcon = panel._addDetail(outIconText as unknown as DetailNode, 6);
  mask(outIcon);

  y += gridTotalH + 14;

  const usedIds = [...new Set(pattern.filter((p): p is string => !!p))];
  if (usedIds.length > 0) {
    const legHdrText = panel.scene.add.text(dx + 4, y, t("library.recipeMaterialsTitle"), {
      fontFamily: UI_FONT, fontSize: "10px", color: "#5a7a94"
    });
    const legHdr = panel._addDetail(legHdrText as unknown as DetailNode, 4);
    mask(legHdr);
    y += 16;

    usedIds.forEach(id => {
      const item = ITEM_BY_ID[id];
      if (!item) return;
      const isEquip = item.kind === "equipment";
      const count = pattern.filter(p => p === id).length;
      const suffix = isEquip ? ` ${getRecipeIngredientSuffix(item.kind ?? "")}` : "";
      const label = `${item.icon ?? "?"} ${item.name ?? ""}${count > 1 ? " ×" + count : ""}${suffix}`;
      const ltText = panel.scene.add.text(dx + 10, y, label, {
        fontFamily: UI_FONT, fontSize: "10px", color: isEquip ? "#7ab8f5" : "#a6bed3"
      });
      const lt = panel._addDetail(ltText as unknown as DetailNode, 4);
      mask(lt);
      y += 15;
    });
  }

  return y + 10;
}
