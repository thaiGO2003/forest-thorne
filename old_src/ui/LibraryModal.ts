import { UNIT_CATALOG, UNIT_BY_ID } from "../data/unitCatalog.js";
import { renderUnitDetailExt, renderOddsTabExt } from "./LibraryRenderers.js";
import { getResolvedSkillDefinition } from "../data/skills.js";
import { CRAFT_RECIPES, ITEM_BY_ID } from "../data/items.js";
import { getClassLabel, getTribeLabel, getUnitVisual } from "../data/unitVisuals.js";
import { getSkinById, getUnitSkinDefs } from "../data/unitSkins.js";
import { getSynergyTier } from "../systems/SynergySystem.js";
import { getElementLabel } from "../data/elementInfo.js";
import {
  describeBasicAttack,
  describeSkillWithElement,
  getSpeciesEvasion,
  getClassAccuracy
} from "../core/unitDescriptionHelper.js";
import { getBaseCritRate } from "../core/gameUtils.js";
import { getTierOdds } from "../systems/ShopSystem.js";
import { RecipeLibraryPanel } from "./RecipeLibraryPanel.js";
import { buildUnitStatsLines, buildSynergyBonusTexts } from "../core/unitStatsFormatter.js";
import { getLocale, t } from "../i18n/index.js";
import { UI_FONT } from "../core/uiTheme.js";
import {
  CollectionProfile,
  equipUnitSkin,
  loadCollectionProfile,
  normalizeCollectionProfile,
  saveCollectionProfile
} from "../core/collectionProfile.js";
import { loadEndlessAchievementProfile } from "../core/endlessAchievements.js";
import {
  isDisplayObjectAlive,
  safeDestroy,
  safeSetFillStyle,
  safeSetStrokeStyle,
  safeSetText,
  safeSetTint,
  safeSetVisible,
  safeSetY
} from "./displayObjectGuards.js";
import { refreshSearchUi as _refreshSearchUi } from "./LibraryModalFilters.js";

type PhaserScene = Phaser.Scene;
type DisplayObject = Phaser.GameObjects.GameObject;
type Container = Phaser.GameObjects.Container;
type Rectangle = Phaser.GameObjects.Rectangle;
type Text = Phaser.GameObjects.Text;
type Graphics = Phaser.GameObjects.Graphics;
interface EndlessProfile {
  version: number;
  lastUpdatedAt: number;
  stats: {
    runsStarted: number;
    bestRound: number;
    roundsWon: number;
    roundsLost: number;
    shopRefreshes: number;
    xpPurchases: number;
    unitsBought: number;
    merges: number;
    augmentsChosen: number;
    craftedItems: number;
    itemsLooted: number;
    highestLevel: number;
    highestGold: number;
    bestWinStreak: number;
  };
}
type Tween = Phaser.Tweens.Tween;

type LibraryTabKey = "units" | "recipes" | "odds";

interface LibraryLayout {
  modalW: number;
  modalH: number;
  modalX: number;
  modalY: number;
  viewportX: number;
  viewportY: number;
  viewportW: number;
  viewportH: number;
}

interface LibraryTab {
  bg: Rectangle;
  text: Text;
  key: LibraryTabKey;
}

interface LibraryDeferredHandle {
  remove: (autoClear?: boolean) => void;
}

interface LibraryRecipeItem {
  id: string;
  name: string;
  icon: string;
  kind: string;
}

interface LibraryNormalizedRecipe {
  id: string;
  name?: string;
  gridSize?: number;
  pattern?: ReadonlyArray<string | null>;
  bonus?: Record<string, unknown>;
  output?: { itemId?: string };
  tier?: number;
  category?: string;
  _gridSize: number;
  _pattern: Array<LibraryRecipeItem | null>;
}

interface LibraryButton {
  bg: Rectangle;
  label: Text;
}

interface LibraryModalOptions {
  depth?: number;
  title?: string;
  deferFirstShowRefresh?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  onCollectionProfileChanged?: (profile: CollectionProfile) => void;
}

interface LibraryUnitSummary {
  id: string;
  classType: string;
  tribe: string;
  tier: number;
  skillId: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '' || value === '?') {
    return fallback;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeRecipes(): LibraryNormalizedRecipe[] {
  return CRAFT_RECIPES.map((recipe) => ({
    ...recipe,
    _gridSize: recipe.gridSize ?? 2,
    _pattern: Array.from({ length: (recipe.gridSize ?? 2) ** 2 }, (_, idx) => {
      const itemId = recipe.pattern?.[idx] ?? null;
      if (!itemId) return null;
      const item = ITEM_BY_ID[itemId];
      if (!item) return null;
      return {
        id: item.id,
        name: item.name,
        icon: item.icon,
        kind: item.kind
      };
    }),
    bonus: { ...(recipe.bonus ?? {}) }
  }));
}

export class LibraryModal {
  scene: PhaserScene;
  options: LibraryModalOptions;
  depth: number;
  title: string;
  activeTab: LibraryTabKey;
  searchQuery: string;
  filterClass: string | null;
  filterTribe: string | null;
  filterTier: number | null;
  detailUnitId: string | null;
  detailPreviewStar: number;
  detailPreviewSkinId: string | null;
  scrollY: number;
  maxScroll: number;
  visible: boolean;
  deferFirstShowRefresh: boolean;
  _hasRenderedVisibleContent: boolean;
  _deferredShowRefreshHandle: LibraryDeferredHandle | null;
  _pendingRecipeId: string | null;
  overlayParts: DisplayObject[];
  recipeDiagram: { destroy: () => void } | null;
  attackPreview: { destroy: () => void } | null;
  skillPreview: { destroy: () => void } | null;
  recipeLibraryPanel: RecipeLibraryPanel | null;
  recipes: LibraryNormalizedRecipe[];
  collectionProfile: CollectionProfile;
  achievementProfile: EndlessProfile;
  layout!: LibraryLayout;
  dimmer!: Rectangle;
  panel!: Rectangle;
  titleText!: Text;
  subtitleText!: Text;
  closeBg!: Rectangle;
  closeText!: Text;
  unitTab!: LibraryTab;
  recipeTab!: LibraryTab;
  oddsTab!: LibraryTab;
  filterContainer!: Container;
  contentContainer!: Container;
  baseContentY!: number;
  contentMaskShape!: Graphics;

  constructor(scene: PhaserScene, options: LibraryModalOptions = {}) {
    this.scene = scene;
    this.options = options;
    this.depth = options.depth ?? 6000;
    this.title = options.title ?? t("library.title");
    this.activeTab = "units";
    this.searchQuery = "";
    this.filterClass = null;
    this.filterTribe = null;
    this.filterTier = null;
    this.detailUnitId = null;
    this.detailPreviewStar = 1;
    this.detailPreviewSkinId = null;
    this.scrollY = 0;
    this.maxScroll = 0;
    this.visible = false;
    this.deferFirstShowRefresh = options.deferFirstShowRefresh === true;
    this._hasRenderedVisibleContent = false;
    this._deferredShowRefreshHandle = null;
    this._pendingRecipeId = null;
    this.overlayParts = [];
    this.recipeDiagram = null;
    this.attackPreview = null;
    this.skillPreview = null;
    this.recipeLibraryPanel = null;
    this.recipes = normalizeRecipes();
    this.collectionProfile = loadCollectionProfile();
    this.achievementProfile = loadEndlessAchievementProfile();
    this.build();
    this.setVisible(false);
  }

  build(): void {
    const scene = this.scene;
    const width = scene.scale.width;
    const height = scene.scale.height;
    const modalW = Math.min(1060, width - 40);
    const modalH = Math.min(760, height - 40);
    const modalX = width / 2;
    const modalY = height / 2;
    const viewportX = modalX - modalW / 2 + 24;
    const viewportY = modalY - modalH / 2 + 144;
    const viewportW = modalW - 48;
    const viewportH = modalH - 176;

    this.layout = {
      modalW,
      modalH,
      modalX,
      modalY,
      viewportX,
      viewportY,
      viewportW,
      viewportH
    };

    this.dimmer = scene.add.rectangle(modalX, modalY, width, height, 0x060d17, 0.85);
    this.dimmer.setDepth(this.depth);
    this.dimmer.setInteractive({ useHandCursor: true });
    this.dimmer.on("pointerdown", () => this.hide());

    this.panel = scene.add.rectangle(modalX, modalY, modalW, modalH, 0x0e1828, 0.98);
    this.panel.setDepth(this.depth + 1);
    this.panel.setStrokeStyle(1, 0x5aa8c8, 1);
    this.panel.setInteractive();

    this.titleText = scene.add.text(modalX - modalW / 2 + 24, modalY - modalH / 2 + 20, this.title, {
      fontFamily: UI_FONT,
      fontSize: "24px",
      color: "#e9f5ff",
      fontStyle: "bold"
    });
    this.titleText.setDepth(this.depth + 2);

    this.subtitleText = scene.add.text(modalX - modalW / 2 + 24, modalY - modalH / 2 + 54, t("library.subtitle"), {
      fontFamily: UI_FONT,
      fontSize: "14px",
      color: "#a6bed3"
    });
    this.subtitleText.setDepth(this.depth + 2);

    this.closeBg = scene.add.rectangle(modalX + modalW / 2 - 88, modalY - modalH / 2 + 36, 120, 34, 0x162433, 0.94);
    this.closeBg.setStrokeStyle(1, 0x39576f, 0.9);
    this.closeBg.setDepth(this.depth + 2);
    this.closeBg.setInteractive({ useHandCursor: true });
    this.closeBg.on("pointerdown", () => this.hide());

    this.closeText = scene.add.text(this.closeBg.x, this.closeBg.y, t("ui.close"), {
      fontFamily: UI_FONT,
      fontSize: "14px",
      color: "#e9f5ff",
      fontStyle: "bold"
    }).setOrigin(0.5);
    this.closeText.setDepth(this.depth + 3);

    this.unitTab = this.createTab(modalX - modalW / 2 + 24, modalY - modalH / 2 + 86, 160, t("library.unitsTab"), "units");
    this.recipeTab = this.createTab(modalX - modalW / 2 + 194, modalY - modalH / 2 + 86, 160, t("library.recipesTab"), "recipes");
    this.oddsTab = this.createTab(modalX - modalW / 2 + 364, modalY - modalH / 2 + 86, 160, t("library.oddsTab"), "odds");

    this.filterContainer = scene.add.container(modalX - modalW / 2 + 24, modalY - modalH / 2 + 128);
    this.filterContainer.setDepth(this.depth + 2);

    this.contentContainer = scene.add.container(viewportX, viewportY);
    this.contentContainer.setDepth(this.depth + 2);
    this.baseContentY = viewportY;

    const maskShape = scene.make.graphics();
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(viewportX, viewportY, viewportW, viewportH);
    this.contentMaskShape = maskShape;
    this.contentContainer.enableFilters();
    this.contentContainer.filters?.external?.addMask(maskShape);

    // Register wheel scrolling on the panel itself (no separate blocking zone)
    this.panel.on("wheel", (_pointer: unknown, _dx: number, dy: number) => this.scrollBy(dy));

    this.overlayParts = [
      this.dimmer,
      this.panel,
      this.titleText,
      this.subtitleText,
      this.closeBg,
      this.closeText,
      this.unitTab.bg,
      this.unitTab.text,
      this.recipeTab.bg,
      this.recipeTab.text,
      this.oddsTab.bg,
      this.oddsTab.text,
      this.filterContainer,
      this.contentContainer,
      this.contentMaskShape
    ];

    this.refreshTabStyles();
  }

  createTab(x: number, y: number, width: number, label: string, key: LibraryTabKey): LibraryTab {
    const bg = this.scene.add.rectangle(x + width / 2, y, width, 30, 0x1a2d40, 0.8);
    bg.setOrigin(0.5);
    bg.setStrokeStyle(1, 0x3a5070, 1);
    bg.setDepth(this.depth + 2);
    bg.setInteractive({ useHandCursor: true });
    bg.on("pointerdown", () => {
      if (this.activeTab === key) return;
      this.activeTab = key;
      this.scrollY = 0;
      if (key !== "units") this.detailUnitId = null;
      this.refresh();
    });

    const text = this.scene.add.text(x + width / 2, y, label, {
      fontFamily: UI_FONT,
      fontSize: "14px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5);
    text.setDepth(this.depth + 3);

    return { bg, text, key };
  }

  getOverlayParts(): DisplayObject[] {
    return this.overlayParts;
  }

  setVisible(next: boolean): void {
    this.visible = !!next;
    this.overlayParts.forEach((part) => safeSetVisible(part, this.visible));
    if (!this.visible) {
      this.destroyRecipeDiagram();
      this.destroyPreviews();
    }
    if (!this.visible && this.options.onClose) {
      this.options.onClose();
    }
  }

  isOpen(): boolean {
    return this.visible;
  }

  clearDeferredShowRefresh(): void {
    if (this._deferredShowRefreshHandle?.remove) {
      this._deferredShowRefreshHandle.remove(false);
    }
    this._deferredShowRefreshHandle = null;
  }

  scheduleDeferredShowRefresh(): void {
    if (this._deferredShowRefreshHandle) return;

    const run = () => {
      this._deferredShowRefreshHandle = null;
      if (!this.visible) return;
      this.refresh();
    };

    const scene = this.scene as PhaserScene & {
      time?: { delayedCall?: (delay: number, cb: () => void) => Tween };
    };
    if (scene?.time?.delayedCall) {
      this._deferredShowRefreshHandle = scene.time.delayedCall(0, run) as unknown as LibraryDeferredHandle;
      return;
    }
    if (typeof globalThis.setTimeout === "function") {
      const timeoutId = globalThis.setTimeout(run, 0);
      this._deferredShowRefreshHandle = {
        remove: () => globalThis.clearTimeout(timeoutId)
      };
      return;
    }
    run();
  }

  show(): void {
    if (this.visible) return;
    this.refreshCollectionProfile();
    this.refreshAchievementProfile();
    this.setVisible(true);
    if (this.options.onOpen) this.options.onOpen();
    if (this.deferFirstShowRefresh && !this._hasRenderedVisibleContent) {
      this.scheduleDeferredShowRefresh();
      return;
    }
    this.refresh();
  }

  refreshLocale(): void {
    this.title = this.options.title ?? t("library.title");
    safeSetText(this.titleText, this.title);
    safeSetText(this.subtitleText, t("library.subtitle"));
    safeSetText(this.closeText, t("ui.close"));
    safeSetText(this.unitTab?.text, t("library.unitsTab"));
    safeSetText(this.recipeTab?.text, t("library.recipesTab"));
    safeSetText(this.oddsTab?.text, t("library.oddsTab"));
    if (this.visible) {
      this.refresh();
    }
  }

  hide(): void {
    if (!this.visible) return;
    this.clearDeferredShowRefresh();
    this.setVisible(false);
  }

  toggle(force: boolean | null = null): void {
    const next = typeof force === "boolean" ? force : !this.visible;
    if (next) this.show();
    else this.hide();
  }

  scrollBy(deltaY: number): void {
    if (!this.visible) return;
    this.scrollY = clamp(this.scrollY + deltaY * 0.5, 0, this.maxScroll);
    safeSetY(this.contentContainer, this.baseContentY - this.scrollY);
  }

  refreshCollectionProfile(): CollectionProfile {
    this.collectionProfile = normalizeCollectionProfile(loadCollectionProfile());
    return this.collectionProfile;
  }

  refreshAchievementProfile(): EndlessProfile {
    this.achievementProfile = loadEndlessAchievementProfile();
    return this.achievementProfile;
  }

  getEquippedSkinId(unitId: string): string | null {
    return this.collectionProfile?.equippedSkinByUnitId?.[unitId] ?? null;
  }

  setEquippedSkin(unitId: string, skinId: string | null): boolean {
    const knownSkins = getUnitSkinDefs(unitId);
    const skinKey = skinId ? skinId.split(".").slice(1).join(".") : "";
    if (skinId && !knownSkins?.[skinKey]) return false;
    const next = equipUnitSkin(this.collectionProfile, unitId, skinId);
    this.collectionProfile = next;
    const saved = saveCollectionProfile(next);
    this.options.onCollectionProfileChanged?.(next);
    return saved;
  }

  resolveDetailSkinPreviewId(unitId: string): string | null {
    const skinDefs = Object.values(getUnitSkinDefs(unitId) as Record<string, { skinId: string; unitId?: string }>);
    if (!skinDefs.length) {
      this.detailPreviewSkinId = null;
      return null;
    }

    const currentPreviewSkinId = this.detailPreviewSkinId;
    if (currentPreviewSkinId === "" || currentPreviewSkinId === null) {
      return null;
    }
    if (skinDefs.some((skin) => skin.skinId === currentPreviewSkinId)) {
      return currentPreviewSkinId;
    }

    const equippedSkinId = this.getEquippedSkinId(unitId);
    const fallbackSkinId = skinDefs.find((skin) => skin.skinId === equippedSkinId)?.skinId ?? "";
    this.detailPreviewSkinId = fallbackSkinId;
    return fallbackSkinId || null;
  }

  buildSkinPreviewCollectionProfile(unitId: string, skinId: string): CollectionProfile {
    const baseProfile = normalizeCollectionProfile(this.collectionProfile);
    const skin = getSkinById(skinId);
    if (!skin || skin.unitId !== unitId) return baseProfile;

    const previewProfile: CollectionProfile = {
      ...baseProfile,
      unlockedSkinIds: [...baseProfile.unlockedSkinIds],
      claimedAchievementIds: [...baseProfile.claimedAchievementIds],
      equippedSkinByUnitId: { ...baseProfile.equippedSkinByUnitId }
    };
    if (!previewProfile.unlockedSkinIds.includes(skinId)) {
      previewProfile.unlockedSkinIds.push(skinId);
    }
    previewProfile.equippedSkinByUnitId[unitId] = skinId;
    return previewProfile;
  }

  setDetailUnit(unitId: string): void {
    this.activeTab = "units";
    this.detailUnitId = unitId;
    this.detailPreviewStar = 1;
    this.detailPreviewSkinId = null;
    this.scrollY = 0;
    this.refresh();
  }

  setDetailRecipe(recipeId: string): void {
    this.activeTab = "recipes";
    this._pendingRecipeId = recipeId;
    this.scrollY = 0;
    if (!this.visible) {
      this.setVisible(true);
      if (this.options.onOpen) this.options.onOpen();
    }
    this.refresh();
    // After refresh, recipeLibraryPanel is created — select the recipe
    const panel = this.recipeLibraryPanel as (RecipeLibraryPanel & {
      selectedRecipeId: string | null;
      _highlightSelected: () => void;
      _refreshDetail: () => void;
    }) | null;
    if (this._pendingRecipeId && panel) {
      panel.selectedRecipeId = this._pendingRecipeId;
      panel._highlightSelected();
      panel._refreshDetail();
      this._pendingRecipeId = null;
    }
  }

  refresh(): void {
    if (!this.visible) return;
    this.clearDeferredShowRefresh();
    this.refreshCollectionProfile();
    this.refreshAchievementProfile();
    if (!isDisplayObjectAlive(this.contentContainer) || typeof this.contentContainer.removeAll !== "function") return;
    this.contentContainer.removeAll(true);
    this.destroyRecipeDiagram();
    this.destroyPreviews();
    this.refreshTabStyles();
    this.refreshSearchUi();

    let y = 0;
    if (this.activeTab === "units") {
      y = this.renderUnitsTab(y);
    } else if (this.activeTab === "odds") {
      y = this.renderOddsTab(y);
    } else {
      y = this.renderRecipesTab(y);
    }
    this.maxScroll = Math.max(0, y - this.layout.viewportH);
    this.scrollY = clamp(this.scrollY, 0, this.maxScroll);
    safeSetY(this.contentContainer, this.baseContentY - this.scrollY);
    this._hasRenderedVisibleContent = true;
  }

  refreshTabStyles(): void {
    const setStyle = (tab: LibraryTab | undefined, active: boolean) => {
      safeSetFillStyle(tab?.bg, active ? 0x2a5080 : 0x1a2d40, active ? 1 : 0.8);
      safeSetStrokeStyle(tab?.bg, 1, active ? 0x7ab8f5 : 0x3a5070, 1);
      safeSetTint(tab?.text, active ? 0xffeab0 : 0x8ab4d4);
    };
    setStyle(this.unitTab, this.activeTab === "units");
    setStyle(this.recipeTab, this.activeTab === "recipes");
    setStyle(this.oddsTab, this.activeTab === "odds");
  }

  createButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    onClick: () => void,
    bgFill: number = 0x233850,
    stroke: number = 0x5a8ab0,
    parent: Container | null = null
  ): LibraryButton {
    const bg = this.scene.add.rectangle(x, y, width, height, bgFill, 0.9).setOrigin(0.5);
    bg.setStrokeStyle(1, stroke, 1);
    bg.setInteractive({ useHandCursor: true });
    bg.on("pointerover", () => bg.setFillStyle(0x355070, 0.95));
    bg.on("pointerout", () => bg.setFillStyle(bgFill, 0.9));
    bg.on("pointerdown", onClick);

    const txt = this.scene.add.text(x, y, label, {
      fontFamily: UI_FONT,
      fontSize: "13px",
      color: "#e9f5ff",
      fontStyle: "bold"
    }).setOrigin(0.5);

    if (parent) {
      parent.add([bg, txt]);
    }
    return { bg, label: txt };
  }

  refreshSearchUi(): void {
    _refreshSearchUi(this as unknown as Parameters<typeof _refreshSearchUi>[0]);
  }

  renderUnitsTab(y: number): number {
    if (this.detailUnitId) {
      return this.renderUnitDetail(y, this.detailUnitId);
    }

    let units: LibraryUnitSummary[] = [...(UNIT_CATALOG as unknown as LibraryUnitSummary[])];

    if (this.filterClass) {
      units = units.filter((u) => u.classType === this.filterClass);
    }
    if (this.filterTribe) {
      units = units.filter((u) => u.tribe === this.filterTribe);
    }
    if (this.filterTier) {
      units = units.filter((u) => u.tier === this.filterTier);
    }
    const query = String(this.searchQuery ?? "").trim().toLowerCase();
    if (query) {
      units = units.filter((unit) => {
        const visual = getUnitVisual(unit.id, unit.classType, 1, {
          ownerKind: "LIBRARY",
          collectionProfile: this.collectionProfile
        });
        return (
          visual.name.toLowerCase().includes(query) ||
          String(unit.id).toLowerCase().includes(query) ||
          getClassLabel(unit.classType).toLowerCase().includes(query) ||
          getTribeLabel(unit.tribe).toLowerCase().includes(query)
        );
      });
    }
    units.sort((a, b) => a.tier - b.tier || String(a.classType).localeCompare(String(b.classType)));

    const intro = this.scene.add.text(0, y, `${t("label.units")}: ${units.length}`, {
      fontFamily: UI_FONT,
      fontSize: "16px",
      color: "#d8edff"
    });
    this.contentContainer.add(intro);
    y += intro.height + 10;

    const columns = this.layout.viewportW > 860 ? 2 : 1;
    const gap = 12;
    const cardW = Math.floor((this.layout.viewportW - gap * (columns - 1)) / columns);
    const cardH = 96;

    units.forEach((unit, idx) => {
      const col = idx % columns;
      const row = Math.floor(idx / columns);
      const cardX = col * (cardW + gap);
      const cardY = y + row * (cardH + 8);
      const visual = getUnitVisual(unit.id, unit.classType, 1, {
        ownerKind: "LIBRARY",
        collectionProfile: this.collectionProfile
      });
      const skill = getResolvedSkillDefinition(unit.skillId, { baseId: unit.id, star: 1 });

      const bg = this.scene.add.rectangle(cardX, cardY, cardW, cardH, idx % 2 === 0 ? 0x182b44 : 0x16273f, 0.88).setOrigin(0, 0);
      bg.setStrokeStyle(1, 0x7ab8f5, 0.45);
      bg.setInteractive({ useHandCursor: true });
      bg.on("pointerover", () => bg.setStrokeStyle(1, 0xffeab0, 0.9));
      bg.on("pointerout", () => bg.setStrokeStyle(1, 0x7ab8f5, 0.45));
      bg.on("pointerdown", () => this.setDetailUnit(unit.id));

      const name = this.scene.add.text(cardX + 10, cardY + 8, `${visual.icon} ${visual.name}`, {
        fontFamily: UI_FONT,
        fontSize: "15px",
        color: "#ffeab0",
        fontStyle: "bold"
      });
      const skillName = getLocale() === "en"
        ? skill?.nameEn ?? skill?.name ?? unit.skillId
        : skill?.nameVi ?? skill?.name ?? unit.skillId;
      const meta = this.scene.add.text(cardX + 10, cardY + 32, `${t("label.tier")} ${unit.tier} • ${getTribeLabel(unit.tribe)} • ${getClassLabel(unit.classType)}`, {
        fontFamily: UI_FONT,
        fontSize: "13px",
        color: "#a6bed3"
      });
      const skillText = this.scene.add.text(cardX + 10, cardY + 56, `${t("combat.skillLabel")}: ${skillName}`, {
        fontFamily: UI_FONT,
        fontSize: "13px",
        color: "#d6f5ff"
      });

      this.contentContainer.add([bg, name, meta, skillText]);
    });

    const rows = Math.ceil(units.length / columns);
    return y + rows * (cardH + 8) + 8;
  }

  renderUnitDetail(y: number, unitId: string): number {
    return renderUnitDetailExt(this as unknown as Parameters<typeof renderUnitDetailExt>[0], y, unitId);
  }

  renderRecipesTab(y: number): number {
    // Render the full Liên Quân Mobile-style recipe panel
    const panelW = this.layout.viewportW;
    const panelH = this.layout.viewportH;
    const panelX = this.layout.viewportX;
    const panelY = this.layout.viewportY;

    try {
      this.recipeLibraryPanel = new RecipeLibraryPanel(
        this.scene, panelX, panelY, panelW, panelH, this.depth + 4
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[RecipeLibraryPanel] Failed to create:", err);
      // Show error fallback in content area
      const errText = this.scene.add.text(0, y, t("library.recipeLoadError", { message }), {
        fontFamily: UI_FONT, fontSize: "14px", color: "#ff6666",
        wordWrap: { width: panelW - 20 }
      });
      this.contentContainer.add(errText);
      y += errText.height + 20;
    }

    return y;
  }

  renderOddsTab(y: number): number {
    return renderOddsTabExt(this as unknown as Parameters<typeof renderOddsTabExt>[0], y);
  }

  destroyRecipeDiagram(): void {
    if (this.recipeDiagram) {
      this.recipeDiagram.destroy();
      this.recipeDiagram = null;
    }
    if (this.recipeLibraryPanel) {
      this.recipeLibraryPanel.destroy();
      this.recipeLibraryPanel = null;
    }
  }

  destroyPreviews(): void {
    if (this.attackPreview) {
      this.attackPreview.destroy();
      this.attackPreview = null;
    }
    if (this.skillPreview) {
      this.skillPreview.destroy();
      this.skillPreview = null;
    }
  }

  destroy(): void {
    this.clearDeferredShowRefresh();
    this.destroyRecipeDiagram();
    this.destroyPreviews();
    this.overlayParts.forEach((part) => safeDestroy(part));
    this.overlayParts = [];
  }
}
