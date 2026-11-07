import { PLAYER_COLS } from "../../core/boardConstants.js";
import { t } from "../../i18n/index.js";

import { UNIT_BY_ID } from "../../data/unitCatalog.js";
import { getResolvedSkillDefinition } from "../../data/skills.js";
import { getUnitVisual } from "../../data/unitVisuals.js";

import { getPlanningBoardOwnerSlot, getPlanningBoardRowCount, getPlanningBoardUnit, getPlanningCoopPlayerState } from "./planningCoopSessionRuntime.js";
import { getPlanningUnitVariantSummary } from "./planningDescriptionRuntime.js";

import { clamp, scaledBaseStats } from "../../core/gameUtils.js";
import { CRAFT_RECIPES } from "../../data/items.js";
import { getClassLabelVi, getTribeLabelVi } from "../../data/unitVisuals.js";
import { recommendPlanningEquipmentRecipes } from "./planningUnitInfoRecommendations.js";
import { collectOwnedEquipmentPreviewBonuses } from "./sceneEquipmentRuntime.js";

interface PlanningUnit {
  uid?: string;
  side?: string;
  row?: number;
  col?: number;
  baseId?: string;
  id?: string;
  star?: number;
  skillId?: string;
  rageMax?: number;
  rage?: number;
  shield?: number;
  hp?: number;
  maxHp?: number;
  base?: { id?: string; skillId?: string; stats?: { rageMax?: number } };
  [key: string]: unknown;
}

interface UnitInfoSelection {
  source?: string;
  uid?: string | null;
  baseId: string;
  star?: number;
  benchIndex?: number | null;
  shopIndex?: number | null;
  row?: number | null;
  col?: number | null;
}

interface UnitInfoPlayer {
  bench?: Array<PlanningUnit | null>;
  board?: Array<Array<PlanningUnit | null>>;
  shop?: Array<{ baseId?: string; star?: number } | null>;
  enemyPreview?: unknown[];
  startingRage?: number;
  startingShield?: number;
}

interface UiObject {
  x: number;
  y: number;
  setVisible(visible: boolean): unknown;
  setText(text: string): unknown;
  setDisplaySize(width: number, height: number): unknown;
  getBounds?(): { x: number; y: number; right: number; bottom: number };
}

interface InfoBar {
  bg: UiObject;
  tagText: UiObject;
  barBg: UiObject;
  barFill: UiObject;
  valueText: UiObject;
  barW?: number;
  barFillH: number;
}

interface UnitInfoPanel {
  bg?: UiObject;
  portraitText: UiObject;
  nameText: UiObject;
  hpBar?: InfoBar;
  rageBar?: InfoBar;
  hpBarW?: number;
  statusBadges?: Record<string, { bg: UiObject; text: UiObject }>;
  t3Text: UiObject;
  t4Text: UiObject;
  emptyText: UiObject;
  suggestionLineLimit?: number;
  suggestionViewport?: { y: number; h: number };
  suggestionScrollItems?: Array<{ item: UiObject; baseY: number }>;
  suggestionScrollOffset?: number;
  suggestionMaxScroll?: number;
}

interface UnitInfoScene {
  player?: UnitInfoPlayer;
  unitInfoPortraitModel?: { destroy(): void } | null;
  unitInfoSelection?: UnitInfoSelection | null;
  selectedBenchIndex?: number | null;
  collectionProfile?: unknown;
  unitInfoPanel?: UnitInfoPanel | null;
  layout?: { compactHud?: boolean };
}

interface SuggestionRecipe { icon?: string; name: string }
interface SelectionSource { source?: string; benchIndex?: number; row?: number; col?: number }

export function getPlanningOwnedUnitOwnerPlayer(scene: UnitInfoScene, ownedUnit: PlanningUnit | null | undefined): UnitInfoPlayer | undefined {
    if (!ownedUnit) return scene.player;
    if (ownedUnit.side === "LEFT" && Number.isFinite(ownedUnit.row) && Number.isFinite(ownedUnit.col) && (ownedUnit.col ?? PLAYER_COLS) < PLAYER_COLS) {
      const ownerSlot = getPlanningBoardOwnerSlot(scene as unknown as Parameters<typeof getPlanningBoardOwnerSlot>[0], ownedUnit.row!);
      return (getPlanningCoopPlayerState(scene as unknown as Parameters<typeof getPlanningCoopPlayerState>[0], ownerSlot) ?? scene.player) as UnitInfoPlayer | undefined;
    }
    return scene.player;
}

export function getPlanningOwnedUnitDisplayBonuses(scene: UnitInfoScene, ownedUnit: PlanningUnit) {
    const equipmentBonuses = collectOwnedEquipmentPreviewBonuses(ownedUnit, ownedUnit as Parameters<typeof collectOwnedEquipmentPreviewBonuses>[1], { includeLegacy: true });
    const variantBonuses = getPlanningUnitVariantSummary(scene as unknown as Parameters<typeof getPlanningUnitVariantSummary>[0], ownedUnit as Parameters<typeof getPlanningUnitVariantSummary>[1]);
    return {
      startingRage: Math.max(
        0,
        Math.round(
          (Number(equipmentBonuses?.startingRage) || 0)
          + (Number(variantBonuses?.startingRage) || 0)
        )
      ),
      shieldStart: Math.max(
        0,
        Math.round(
          (Number(equipmentBonuses?.shieldStart) || 0)
          + (Number(variantBonuses?.shieldStart) || 0)
        )
      )
    };
}

export function getPlanningUnitDisplayResources(scene: UnitInfoScene, ownedUnit: PlanningUnit | null | undefined, ownerPlayer: UnitInfoPlayer | undefined = getPlanningOwnedUnitOwnerPlayer(scene, ownedUnit)) {
    const star = Math.max(1, Math.round(Number(ownedUnit?.star ?? 1) || 1));
    const baseId = ownedUnit?.baseId ?? ownedUnit?.base?.id ?? ownedUnit?.id ?? null;
    const resolvedSkill = baseId
      ? getResolvedSkillDefinition(ownedUnit?.skillId ?? ownedUnit?.base?.skillId, { baseId, star })
      : null;
    const explicitRageMax = Number(ownedUnit?.rageMax);
    const rageMax = Math.max(0, Math.round(Number(
      Number.isFinite(explicitRageMax)
        ? explicitRageMax
        : (resolvedSkill?.cost ?? ownedUnit?.base?.stats?.rageMax ?? 0)
    ) || 0));
    const currentRage = Math.max(0, Math.round(Number(ownedUnit?.rage ?? 0) || 0));
    const currentShield = Math.max(0, Math.round(Number(ownedUnit?.shield ?? 0) || 0));
    const playerStartingRage = Math.max(0, Math.round(Number(ownerPlayer?.startingRage ?? scene.player?.startingRage ?? 0) || 0));
    const playerStartingShield = Math.max(0, Math.round(Number(ownerPlayer?.startingShield ?? scene.player?.startingShield ?? 0) || 0));
    const unitBonuses = getPlanningOwnedUnitDisplayBonuses(scene, ownedUnit!);
    const unitStartingRage = Math.min(4, Math.max(0, Math.round(Number(unitBonuses?.startingRage ?? 0) || 0)));
    const unitStartingShield = Math.max(0, Math.round(Number(unitBonuses?.shieldStart ?? 0) || 0));
    const startingRage = playerStartingRage + unitStartingRage;
    const startingShield = playerStartingShield + unitStartingShield;
    return {
      rage: Math.min(rageMax, Math.max(currentRage, startingRage)),
      rageMax,
      shield: Math.max(currentShield, startingShield),
      startingRage,
      startingShield,
      unitStartingRage,
      unitStartingShield
    };
}

export function destroyPlanningUnitInfoPortraitModel(scene: UnitInfoScene): void {
    if (!scene.unitInfoPortraitModel) return;
    try {
      scene.unitInfoPortraitModel.destroy();
    } catch (_err) {
      // Best-effort cleanup for custom portrait visuals.
    }
    scene.unitInfoPortraitModel = null;
}

export function findPlanningOwnedUnitByUid(scene: UnitInfoScene, uid: string | null | undefined): PlanningUnit | null {
    if (!uid) return null;
    for (const unit of scene.player?.bench ?? []) {
      if (unit?.uid === uid) return unit as unknown as PlanningUnit;
    }
    for (let row = 0; row < getPlanningBoardRowCount(scene as unknown as Parameters<typeof getPlanningBoardRowCount>[0]); row += 1) {
      for (let col = 0; col < PLAYER_COLS; col += 1) {
        const unit = getPlanningBoardUnit(scene as unknown as Parameters<typeof getPlanningBoardUnit>[0], row, col);
        if (unit?.uid === uid) return unit as unknown as PlanningUnit;
      }
    }
    return null;
}

export function setPlanningUnitInfoSelection(scene: UnitInfoScene, selection: UnitInfoSelection | null = null): void {
    scene.unitInfoSelection = selection ? { ...selection } : null;
    refreshPlanningUnitInfoPanel(scene);
}

export function setPlanningUnitInfoSelectionFromOwnedUnit(scene: UnitInfoScene, unit: PlanningUnit | null | undefined, source: SelectionSource = {}): void {
    if (!unit?.baseId) return;
    setPlanningUnitInfoSelection(scene, {
      source: source.source ?? "owned",
      uid: unit.uid ?? null,
      baseId: unit.baseId!,
      star: unit.star ?? 1,
      benchIndex: Number.isInteger(source.benchIndex) ? source.benchIndex : null,
      row: Number.isInteger(source.row) ? source.row : null,
      col: Number.isInteger(source.col) ? source.col : null
    });
}

export function setPlanningUnitInfoSelectionFromShopOffer(scene: UnitInfoScene, index: number): void {
    const offer = scene.player?.shop?.[index];
    if (!offer?.baseId) return;
    setPlanningUnitInfoSelection(scene, {
      source: "shop",
      shopIndex: index,
      baseId: offer.baseId,
      star: offer.star ?? 1
    });
}

export function getPlanningDefaultUnitInfoSelection(scene: UnitInfoScene): UnitInfoSelection | null {
    const selectedBenchIndex = scene.selectedBenchIndex;
    if (selectedBenchIndex != null && scene.player?.bench?.[selectedBenchIndex]) {
      const unit = scene.player.bench[selectedBenchIndex]!;
      return {
        source: "bench",
        uid: unit.uid ?? null,
        baseId: unit.baseId!,
        star: unit.star ?? 1,
        benchIndex: selectedBenchIndex
      };
    }
    const bench = scene.player?.bench ?? [];
    const firstBenchIndex = bench.findIndex(Boolean);
    if (firstBenchIndex >= 0) {
      const unit = bench[firstBenchIndex]!;
      return {
        source: "bench",
        uid: unit.uid ?? null,
        baseId: unit.baseId!,
        star: unit.star ?? 1,
        benchIndex: firstBenchIndex
      };
    }
    for (let row = 0; row < getPlanningBoardRowCount(scene as unknown as Parameters<typeof getPlanningBoardRowCount>[0]); row += 1) {
      for (let col = 0; col < PLAYER_COLS; col += 1) {
        const unit = getPlanningBoardUnit(scene as unknown as Parameters<typeof getPlanningBoardUnit>[0], row, col);
        if (unit?.baseId) {
          return {
            source: "board",
            uid: unit.uid ?? null,
            baseId: unit.baseId!,
            star: unit.star ?? 1,
            row,
            col
          };
        }
      }
    }
    const firstOfferIndex = (scene.player?.shop ?? []).findIndex((offer) => offer?.baseId);
    if (firstOfferIndex >= 0) {
      const offer = scene.player?.shop?.[firstOfferIndex];
      if (!offer?.baseId) return null;
      return {
        source: "shop",
        shopIndex: firstOfferIndex,
        baseId: offer.baseId,
        star: offer.star ?? 1
      };
    }
    return null;
}

export function resolvePlanningUnitInfoSelection(scene: UnitInfoScene) {
    let selection = scene.unitInfoSelection;
    if (!selection) {
      selection = getPlanningDefaultUnitInfoSelection(scene);
      if (selection) scene.unitInfoSelection = { ...selection };
    }
    if (!selection?.baseId) return null;

    let ownedUnit = selection.uid ? findPlanningOwnedUnitByUid(scene, selection.uid) : null;
    if (!ownedUnit && Number.isInteger(selection.benchIndex)) {
      const benchUnit = selection.benchIndex != null ? scene.player?.bench?.[selection.benchIndex] : null;
      if (benchUnit?.baseId === selection.baseId) ownedUnit = benchUnit;
    }
    if (!ownedUnit && Number.isInteger(selection.row) && Number.isInteger(selection.col)) {
      const boardUnit = getPlanningBoardUnit(scene as unknown as Parameters<typeof getPlanningBoardUnit>[0], selection.row!, selection.col!);
      if (boardUnit?.baseId === selection.baseId) ownedUnit = boardUnit as unknown as PlanningUnit;
    }
    if (!ownedUnit && selection.source === "shop" && Number.isInteger(selection.shopIndex)) {
      const offer = selection.shopIndex != null ? scene.player?.shop?.[selection.shopIndex] : null;
      if (offer?.baseId) {
        selection = {
          ...selection,
          baseId: offer.baseId,
          star: offer.star ?? selection.star ?? 1
        };
        scene.unitInfoSelection = { ...selection };
      }
    }

    const baseId = ownedUnit?.baseId ?? selection.baseId;
    const base = UNIT_BY_ID[baseId];
    if (!base) return null;
    const star = Math.max(1, Math.round(Number(ownedUnit?.star ?? selection.star ?? 1) || 1));
    const skill = getResolvedSkillDefinition(base.skillId, { baseId, star });
    const scaledStats = scaledBaseStats(base.stats, star, base.classType);
    const visual = getUnitVisual(baseId, base.classType, star, {
      side: ownedUnit?.side ?? "LEFT",
      ownerKind: ownedUnit?.side === "RIGHT" ? "ENEMY" : "PLAYER",
      collectionProfile: scene.collectionProfile
    });
    const displayResources = ownedUnit
      ? getPlanningUnitDisplayResources(scene, ownedUnit)
      : {
          rage: 0,
          rageMax: Math.max(0, Math.round(Number(skill?.cost ?? base.stats?.rageMax ?? 0) || 0)),
          shield: 0
        };

    return {
      selection,
      ownedUnit,
      base,
      star,
      skill,
      scaledStats,
      visual,
      hp: Math.max(0, Math.round(Number(ownedUnit?.hp ?? scaledStats.hp) || 0)),
      maxHp: Math.max(1, Math.round(Number(ownedUnit?.maxHp ?? scaledStats.hp) || 1)),
      rage: displayResources.rage,
      rageMax: displayResources.rageMax,
      tier: Math.max(1, Math.round(Number(base.tier ?? 1) || 1)),
      price: Math.max(1, Math.round(Number(base.tier ?? 1) || 1)),
      classLabel: getClassLabelVi(base.classType),
      tribeLabel: getTribeLabelVi(base.tribe),
      name: visual.nameVi ?? visual.name ?? base.nameVi ?? base.name ?? baseId,
      icon: visual.previewIcon ?? visual.icon ?? base.icon ?? "🐾",
      suggestionsT3: recommendPlanningEquipmentRecipes(base, CRAFT_RECIPES, skill, 3, 3),
      suggestionsT4: recommendPlanningEquipmentRecipes(base, CRAFT_RECIPES, skill, 4, 3)
    };
}

export function refreshPlanningUnitInfoPanel(scene: UnitInfoScene): void {
    const panel = scene.unitInfoPanel;
    if (!panel) return;
    const payload = resolvePlanningUnitInfoSelection(scene);
    if (!payload) {
      destroyPlanningUnitInfoPortraitModel(scene);
      panel.portraitText.setVisible(true);
      panel.portraitText.setText("?");
      panel.nameText.setText(t("planning.ui.noBeastSelected"));
      [panel.hpBar, panel.rageBar].forEach((bar) => {
        if (!bar) return;
        bar.valueText.setText("");
        bar.bg.setVisible(false);
        bar.tagText.setVisible(false);
        bar.barBg.setVisible(false);
        bar.barFill.setVisible(false);
        bar.valueText.setVisible(false);
      });
      Object.values(panel.statusBadges ?? {}).forEach(({ bg, text }) => {
        bg.setVisible(false);
        text.setVisible(false);
        text.setText("");
      });
      panel.t3Text.setText(t("planning.ui.noSuggestion"));
      panel.t4Text.setText(t("planning.ui.noSuggestion"));
      panel.emptyText.setVisible(true);
      refreshPlanningUnitInfoPanelScrollMetrics(scene);
      return;
    }

    const { star, visual, hp, maxHp, rage, rageMax, tier, price, classLabel, tribeLabel, name, icon } = payload;
    destroyPlanningUnitInfoPortraitModel(scene);
    scene.unitInfoPortraitModel = null;
    panel.portraitText.setVisible(true);
    panel.portraitText.setText(icon);
    const safeName = name.length > 22 ? `${name.slice(0, 21)}…` : name;
    panel.nameText.setText(safeName);
    const badges = panel.statusBadges ?? {};
    const compact = scene.layout?.compactHud === true;
    const trimBadgeLabel = (label: unknown, maxLen = compact ? 5 : 6): string => {
      const safe = String(label ?? "").trim();
      return safe.length > maxLen ? `${safe.slice(0, maxLen - 1)}…` : safe;
    };
    if (panel.hpBar) {
      panel.hpBar.bg.setVisible(true);
      panel.hpBar.tagText.setVisible(true);
      panel.hpBar.barBg.setVisible(true);
      panel.hpBar.valueText.setVisible(true);
      panel.hpBar.valueText.setText(`${hp}/${maxHp}`);
      const hpRatio = clamp(maxHp > 0 ? hp / maxHp : 0, 0, 1);
      const hpWidth = Math.round((panel.hpBarW ?? panel.hpBar.barW ?? 0) * hpRatio);
      panel.hpBar.barFill.setVisible(hpWidth > 0);
      if (hpWidth > 0) panel.hpBar.barFill.setDisplaySize(hpWidth, panel.hpBar.barFillH);
    }
    badges.class?.bg.setVisible(true);
    badges.class?.text.setVisible(true);
    badges.class?.text.setText(trimBadgeLabel(classLabel));
    badges.tribe?.bg.setVisible(true);
    badges.tribe?.text.setVisible(true);
    badges.tribe?.text.setText(trimBadgeLabel(tribeLabel));
    const showRage = rageMax > 0;
    if (panel.rageBar) {
      panel.rageBar.bg.setVisible(showRage);
      panel.rageBar.tagText.setVisible(showRage);
      panel.rageBar.barBg.setVisible(showRage);
      panel.rageBar.valueText.setVisible(showRage);
      if (showRage) {
        panel.rageBar.valueText.setText(`${rage}/${rageMax}`);
        const rageRatio = clamp(rageMax > 0 ? rage / rageMax : 0, 0, 1);
        const rageWidth = Math.round((panel.hpBarW ?? panel.rageBar.barW ?? 0) * rageRatio);
        panel.rageBar.barFill.setVisible(rageWidth > 0);
        if (rageWidth > 0) panel.rageBar.barFill.setDisplaySize(rageWidth, panel.rageBar.barFillH);
      } else {
        panel.rageBar.barFill.setVisible(false);
        panel.rageBar.valueText.setText("");
      }
    }
    badges.star?.bg.setVisible(true);
    badges.star?.text.setVisible(true);
    badges.star?.text.setText(`${star}★`);
    badges.tier?.bg.setVisible(true);
    badges.tier?.text.setVisible(true);
    badges.tier?.text.setText(`B${tier}`);
    badges.price?.bg.setVisible(true);
    badges.price?.text.setVisible(true);
    badges.price?.text.setText(`${price}🪙`);
    panel.emptyText.setVisible(false);

    const formatSuggestions = (recipes: SuggestionRecipe[]): string => {
      if (!recipes?.length) return t("planning.ui.noSuggestion");
      const maxLines = Math.max(1, panel.suggestionLineLimit ?? 2);
      const visibleRecipes = recipes.slice(0, maxLines);
      const lines = visibleRecipes.map((recipe) => `${recipe.icon ?? "•"} ${recipe.name}`);
      const remaining = recipes.length - visibleRecipes.length;
      if (remaining > 0) lines.push(t("planning.ui.moreItems", { count: remaining }));
      return lines.join("\n");
    };
    panel.t3Text.setText(formatSuggestions(payload.suggestionsT3));
    panel.t4Text.setText(formatSuggestions(payload.suggestionsT4));

    panel.portraitText.setText(visual.previewIcon ?? visual.icon ?? icon);
    refreshPlanningUnitInfoPanelScrollMetrics(scene);
}

export function pointPlanningInUnitInfoPanel(scene: UnitInfoScene, x: number, y: number): boolean {
    const bg = scene.unitInfoPanel?.bg;
    const bounds = bg?.getBounds?.();
    if (!bounds) return false;
    return x >= bounds.x && x <= bounds.right && y >= bounds.y && y <= bounds.bottom;
}

export function refreshPlanningUnitInfoPanelScrollMetrics(scene: UnitInfoScene): void {
    const panel = scene.unitInfoPanel;
    const viewport = panel?.suggestionViewport;
    const entries = panel?.suggestionScrollItems;
    if (!panel || !viewport || !entries?.length) return;

    let contentBottom = viewport.y;
    entries.forEach((entry) => {
      const bounds = entry.item?.getBounds?.();
      if (!bounds) return;
      const baseBottom = bounds.bottom + (panel.suggestionScrollOffset ?? 0);
      if (baseBottom > contentBottom) contentBottom = baseBottom;
    });
    panel.suggestionMaxScroll = Math.max(0, Math.ceil(contentBottom - (viewport.y + viewport.h) + 4));
    if ((panel.suggestionScrollOffset ?? 0) > panel.suggestionMaxScroll) {
      panel.suggestionScrollOffset = panel.suggestionMaxScroll;
    }
    entries.forEach((entry) => {
      entry.item.y = entry.baseY - (panel.suggestionScrollOffset ?? 0);
    });
}

export function onPlanningUnitInfoPanelWheel(scene: UnitInfoScene, dy: number): void {
    const panel = scene.unitInfoPanel;
    if (!panel || !panel.suggestionMaxScroll) return;
    panel.suggestionScrollOffset = clamp(
      (panel.suggestionScrollOffset ?? 0) + (dy > 0 ? 28 : -28),
      0,
      panel.suggestionMaxScroll
    );
    refreshPlanningUnitInfoPanelScrollMetrics(scene);
}

