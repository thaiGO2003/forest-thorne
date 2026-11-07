import type Phaser from "phaser";
import { PHASE } from "../../core/boardConstants.js";
import { clamp, scaledBaseStats } from "../../core/gameUtils.js";
import { UI_FONT, EMOJI_FONT, UI_COLORS } from "../../core/uiTheme.js";
import { getClassIcon, getTribeIcon, getUnitVisual } from "../../data/unitVisuals.js";
import { createUnitVisualModel } from "../../visuals/visualRegistry.js";
import {
  createRuneterraUnitCard,
  destroyRuneterraUnitCard,
  setRuneterraUnitCardVisible,
  syncRuneterraUnitCard
} from "../../ui/runeterraUnitCard.js";
import {
  createPlanningDockHeader,
  computePlanningDockHeaderLayout,
  fitDockHeaderText
} from "./planningDockHeaderLayout.js";
import { computePlanningLowerDockPanelLayout } from "./planningLowerDockPanelLayout.js";
import { t } from "../../i18n/index.js";

import { getPlanningRoleTheme } from "./planningBoardChromeRuntime.js";
import { showPlanningContextMenu } from "./planningContextMenuRuntime.js";
import { setPlanningCortisolDanceEligibility } from "./planningCortisolRuntime.js";
import { isPlanningCreativeMode } from "./planningCreativeSandboxRuntime.js";
import { getPlanningBenchCap, onPlanningBenchClick } from "./planningFormationRuntime.js";
import { addPlanningLog } from "./planningLogRuntime.js";
import { getPlanningUnitTooltip } from "./planningTooltipRuntime.js";

import { ensurePlanningLowerDockPanels } from "./planningLowerDockRuntime.js";

type SceneWithHelpers = Phaser.Scene & Record<string, unknown> & {
  benchSlots?: BenchSlot[];
  benchHeader?: { relayout?: (options: { infoText?: string; infoVisible?: boolean }) => void; destroy?: () => void } | null;
  benchTitle?: Phaser.GameObjects.Text | null;
  benchPagePrevBtn?: { setVisible?: (v: boolean) => void; setEnabled?: (v: boolean) => void } | null;
  benchPageNextBtn?: { setVisible?: (v: boolean) => void; setEnabled?: (v: boolean) => void } | null;
  benchPageText?: Phaser.GameObjects.Text | null;
  benchPage?: number;
  benchPageMax?: number;
  benchPageSlotCount?: number;
  creativeDummySlot?: BenchSlot | null;
  shopTitle?: Phaser.GameObjects.Text | null;
  player?: { bench?: OwnedUnit[] | null; [k: string]: unknown };
  phase?: string;
  selectedBenchIndex?: number | null;
  settingsVisible?: boolean;
  historyModalVisible?: boolean;
  versionInfoVisible?: boolean;
  libraryModal?: { isOpen?: () => boolean };
  tooltip?: { attach?: (target: unknown, getContent: () => unknown) => void };
  layout?: Record<string, unknown> | null;
  collectionProfile?: unknown;
};

interface PlanningLayoutLike {
  benchCols: number;
  benchRows: number;
  benchSlotsRegionX?: number;
  benchRegionX?: number;
  benchY: number;
  benchSlotW: number;
  benchSlotH: number;
  benchGap: number;
  benchRowGap: number;
  shopInnerPad?: number;
  compactHud?: boolean;
}

interface OwnedUnit {
  baseId: string;
  star: number;
  base: {
    icon?: string;
    classType: string;
    tribe?: string;
    nameVi?: string;
    name?: string;
    tier: number;
    stats: { range?: number; [k: string]: unknown };
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

interface RuneterraCardLocal {
  bg: Phaser.GameObjects.GameObject & {
    setInteractive?: (options?: unknown) => void;
    on?: (event: string, handler: (...args: unknown[]) => void) => void;
  };
  titleText: Phaser.GameObjects.Text;
  portraitText: Phaser.GameObjects.Text;
  portraitAnchor: { x: number; y: number };
  portraitScale?: number;
  [key: string]: unknown;
}

interface BenchSlot {
  x: number;
  y: number;
  slotW: number;
  slotH: number;
  bg: Phaser.GameObjects.GameObject & {
    setInteractive?: (options?: unknown) => void;
    on?: (event: string, handler: (...args: unknown[]) => void) => void;
    destroy?: () => void;
    visible?: boolean;
  };
  label: Phaser.GameObjects.Text;
  icon: Phaser.GameObjects.Text;
  cardChrome: RuneterraCardLocal;
  slotIndex: number;
  benchIndex: number | null;
  isCreativeDummy: boolean;
  _visualModel?: { destroy?: () => void; setDepth?: (depth: number) => void } | null;
}



export function createPlanningBenchSlots(scene: SceneWithHelpers): void {
    ensurePlanningLowerDockPanels(scene as unknown as Parameters<typeof ensurePlanningLowerDockPanels>[0]);
    destroyPlanningBenchPaginationControls(scene);
    scene.creativeDummySlot = null;
    (scene.benchSlots ?? []).forEach((s: BenchSlot) => {
      destroyPlanningBenchSlotVisualModel(scene, s);
      if (s.cardChrome) {
        destroyRuneterraUnitCard(s.cardChrome as unknown as Parameters<typeof destroyRuneterraUnitCard>[0]);
      } else {
        s.bg?.destroy?.();
        s.label?.destroy?.();
        s.icon?.destroy?.();
      }
    });
    scene.benchSlots = [];

    const l = scene.layout as unknown as PlanningLayoutLike;
    const maxSlots = l.benchCols * l.benchRows;
    const startX = (l.benchSlotsRegionX ?? l.benchRegionX ?? 0) + 8;
    const y = l.benchY;
    const slotW = l.benchSlotW;
    const slotH = l.benchSlotH;
    const cols = l.benchCols;

    for (let i = 0; i < maxSlots; i += 1) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (slotW + l.benchGap);
      const yy = y + row * (slotH + l.benchRowGap);
      const compactCard = slotW < 112 || slotH < 82;
      const cardChrome = createRuneterraUnitCard(scene as unknown as Parameters<typeof createRuneterraUnitCard>[0], {
        x,
        y: yy,
        w: slotW,
        h: slotH,
        depth: 1500,
        compact: compactCard
      }) as unknown as RuneterraCardLocal;
      const bg = cardChrome.bg as BenchSlot["bg"];
      const slot: BenchSlot = {
        x,
        y: yy,
        slotW,
        slotH,
        bg,
        label: cardChrome.titleText,
        icon: cardChrome.portraitText,
        cardChrome,
        slotIndex: i,
        benchIndex: i,
        isCreativeDummy: false
      };
      bg.setInteractive?.({ useHandCursor: true });
      bg.on?.("pointerdown", (pointer: unknown, _localX: unknown, _localY: unknown, event: unknown) => {
        if (slot.isCreativeDummy) {
          if (scene.selectedBenchIndex == null || !scene.player?.bench?.[scene.selectedBenchIndex]) {
            addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("log.dummySlotInactive"), "EVENT");
          } else {
            addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("log.dummySlotActive"), "EVENT");
          }
          return;
        }
        const benchIndex = slot.benchIndex;
        const ptr = pointer as { rightButtonDown?: () => boolean; x?: number; y?: number };
        const ev = event as { stopPropagation?: () => void } | undefined;
        if (ptr?.rightButtonDown?.()) {
          if (ev?.stopPropagation) ev.stopPropagation();
          if (scene.phase !== PHASE.PLANNING || scene.settingsVisible || scene.libraryModal?.isOpen?.() || scene.historyModalVisible || scene.versionInfoVisible) return;
          const unit = Number.isInteger(benchIndex) ? scene.player?.bench?.[benchIndex as number] : null;
          if (unit) showPlanningContextMenu(scene as unknown as Parameters<typeof showPlanningContextMenu>[0], unit as unknown as Parameters<typeof showPlanningContextMenu>[1], "BENCH" as Parameters<typeof showPlanningContextMenu>[2], benchIndex as number, 0, Number(ptr.x ?? 0), Number(ptr.y ?? 0));
          return;
        }
        if (Number.isInteger(benchIndex)) onPlanningBenchClick(scene as unknown as Parameters<typeof onPlanningBenchClick>[0], benchIndex as number);
      });
      scene.tooltip?.attach?.(bg, () => {
        if (slot.isCreativeDummy) {
          const selected = scene.selectedBenchIndex != null ? scene.player?.bench?.[scene.selectedBenchIndex] : null;
          return {
            title: t("creative.dummySlotLabel"),
            body: selected ? t("creative.dummySlotActive") : t("creative.dummySlotInactive")
          };
        }
        const benchIndex = slot.benchIndex;
        const unit = Number.isInteger(benchIndex) ? scene.player?.bench?.[benchIndex as number] : null;
        if (!unit) {
          const displayIndex = Number.isInteger(benchIndex) ? (benchIndex as number) + 1 : i + 1;
          return { title: t("planning.ui.benchSlot", { index: displayIndex }), body: t("planning.ui.emptySlot") };
        }
        return getPlanningUnitTooltip(scene as unknown as Parameters<typeof getPlanningUnitTooltip>[0], unit.baseId, unit.star, unit as Parameters<typeof getPlanningUnitTooltip>[3]);
      });
      scene.benchSlots!.push(slot);
    }

    const dockPanels = computePlanningLowerDockPanelLayout(l as unknown as Parameters<typeof computePlanningLowerDockPanelLayout>[0]);
    const shopHeaderArea = dockPanels.headerArea.shop;
    const shopTitlePadX = Math.max(dockPanels.titlePadX, l.shopInnerPad ?? dockPanels.titlePadX);
    const shopHeaderLayout = computePlanningDockHeaderLayout({
      areaX: shopHeaderArea.areaX,
      areaY: shopHeaderArea.areaY,
      areaW: shopHeaderArea.areaW,
      compact: l.compactHud,
      leftPad: shopHeaderArea.leftPad,
      rightPad: shopHeaderArea.rightPad,
      buttonCount: 0,
      reservedInfoWidth: 0
    });

    if (scene.shopTitle) scene.shopTitle.destroy();
    scene.shopTitle = scene.add.text(
      shopHeaderLayout.titleX as number,
      shopHeaderLayout.rowY as number,
      t("ui.shop"),
      {
      fontFamily: UI_FONT,
      fontSize: l.compactHud ? "15px" : "17px",
      color: UI_COLORS.textSecondary,
       fontStyle: "bold"
      }
    );
    fitDockHeaderText(scene.shopTitle, Math.max(32, shopHeaderArea.areaW - shopTitlePadX * 2), 0.8);
    scene.shopTitle.setDepth(2000);

    destroyPlanningBenchPaginationControls(scene);
    createPlanningBenchPaginationControls(scene);
    refreshPlanningBenchPaginationUi(scene);
}

export function createPlanningBenchSlotLabel(scene: SceneWithHelpers, x: number, y: number, slotW: number): Phaser.GameObjects.Text {
    const fontSize = slotW < 36 ? "8px" : slotW < 52 ? "9px" : "10px";
    const label = scene.add.text(x + 8, y + 8, "", {
      fontFamily: UI_FONT,
      fontSize,
      color: UI_COLORS.textPrimary,
      wordWrap: { width: Math.max(8, slotW - 10) }
    });
    label.setDepth(1501);
    return label;
}

export function createPlanningBenchSlotIcon(scene: SceneWithHelpers, x: number, y: number, slotW: number, slotH: number): Phaser.GameObjects.Text {
    const iconX = x + (slotW < 40 ? 4 : 8);
    const fontSize = slotW < 36 ? "11px" : slotW < 52 ? "13px" : "16px";
    const icon = scene.add.text(iconX, y + slotH - 22, "", {
      fontFamily: EMOJI_FONT,
      fontSize,
      color: "#ffffff"
    });
    icon.setDepth(1502);
    return icon;
}

export function destroyPlanningBenchPaginationControls(scene: SceneWithHelpers): void {
    scene.benchHeader?.destroy?.();
    scene.benchHeader = null;
    scene.benchTitle = null;
    scene.benchPagePrevBtn = null;
    scene.benchPageNextBtn = null;
    scene.benchPageText = null;
}

export function getPlanningBenchPageSlotCount(scene: SceneWithHelpers): number {
    const layout = scene.layout as unknown as PlanningLayoutLike;
    const cols = Math.max(1, Number.isFinite(layout.benchCols) ? Math.floor(layout.benchCols) : 4);
    const rows = Math.max(1, Number.isFinite(layout.benchRows) ? Math.floor(layout.benchRows) : 2);
    return cols * rows;
}

export function syncPlanningBenchPageState(scene: SceneWithHelpers): { page: number; pageMax: number; slotCount: number } {
    const slotCount = Math.max(1, getPlanningBenchPageSlotCount(scene));
    const cap = Math.max(0, getPlanningBenchCap(scene as unknown as Parameters<typeof getPlanningBenchCap>[0]));
    const firstPageCapacity = getPlanningBenchPageUnitCapacity(scene, 0, slotCount);
    const remainingAfterFirstPage = Math.max(0, cap - firstPageCapacity);
    const pageMax = remainingAfterFirstPage > 0
      ? Math.ceil(remainingAfterFirstPage / slotCount)
      : 0;
    if (!Number.isInteger(scene.benchPage)) scene.benchPage = 0;
    scene.benchPage = clamp(scene.benchPage ?? 0, 0, pageMax);
    scene.benchPageMax = pageMax;
    scene.benchPageSlotCount = slotCount;
    return {
      page: scene.benchPage,
      pageMax: scene.benchPageMax,
      slotCount: scene.benchPageSlotCount
    };
}

export function getPlanningBenchReservedSlotCount(scene: SceneWithHelpers, page: number = scene.benchPage ?? 0): number {
    return isPlanningCreativeMode(scene as unknown as Parameters<typeof isPlanningCreativeMode>[0]) && Math.floor(Number(page) || 0) === 0 ? 1 : 0;
}

export function getPlanningBenchPageUnitCapacity(scene: SceneWithHelpers, page: number = scene.benchPage ?? 0, slotCount: number = getPlanningBenchPageSlotCount(scene)): number {
    return Math.max(0, Math.max(1, slotCount) - getPlanningBenchReservedSlotCount(scene, page));
}

export function getPlanningBenchPageOffset(scene: SceneWithHelpers): number {
    const { page, slotCount } = syncPlanningBenchPageState(scene);
    if (page <= 0) return 0;
    const firstPageCapacity = getPlanningBenchPageUnitCapacity(scene, 0, slotCount);
    return firstPageCapacity + (page - 1) * slotCount;
}

export function setPlanningBenchPage(scene: SceneWithHelpers, nextPage: number): boolean {
    const { pageMax } = syncPlanningBenchPageState(scene);
    const resolvedPage = clamp(Math.floor(Number(nextPage) || 0), 0, pageMax);
    if (resolvedPage === scene.benchPage) {
      refreshPlanningBenchPaginationUi(scene);
      return false;
    }
    scene.benchPage = resolvedPage;
    refreshPlanningBenchUi(scene);
    return true;
}

export function createPlanningBenchPaginationControls(scene: SceneWithHelpers): void {
    const l = scene.layout as unknown as PlanningLayoutLike;

    const dockPanels = computePlanningLowerDockPanelLayout(l as unknown as Parameters<typeof computePlanningLowerDockPanelLayout>[0]);
    const benchHeaderArea = dockPanels.headerArea.bench;
    const benchHeader = createPlanningDockHeader(scene as unknown as Parameters<typeof createPlanningDockHeader>[0], {
      areaX: benchHeaderArea.areaX,
      areaY: benchHeaderArea.areaY,
      areaW: benchHeaderArea.areaW,
      compact: l.compactHud,
      leftPad: benchHeaderArea.leftPad,
      title: t("ui.bench"),
      infoText: "",
      reservedInfoWidth: Math.max(82, Math.floor(benchHeaderArea.areaW * 0.18)),
      titleFontSize: l.compactHud ? "15px" : "17px",
      infoFontSize: l.compactHud ? "12px" : "13px",
      infoColor: UI_COLORS.textSecondary,
      infoFontStyle: "bold",
      infoYOffset: 1,
      onPrev: () => setPlanningBenchPage(scene, (scene.benchPage ?? 0) - 1),
      onNext: () => setPlanningBenchPage(scene, (scene.benchPage ?? 0) + 1)
    }) as unknown as { titleText: Phaser.GameObjects.Text; infoText: Phaser.GameObjects.Text; prevBtn: SceneWithHelpers["benchPagePrevBtn"]; nextBtn: SceneWithHelpers["benchPageNextBtn"] };
    scene.benchHeader = benchHeader as unknown as SceneWithHelpers["benchHeader"];
    scene.benchTitle = benchHeader.titleText;
    scene.benchPageText = benchHeader.infoText;
    scene.benchPagePrevBtn = benchHeader.prevBtn;
    scene.benchPageNextBtn = benchHeader.nextBtn;
}

export function refreshPlanningBenchPaginationUi(scene: SceneWithHelpers): void {
    const { page, pageMax } = syncPlanningBenchPageState(scene);
    const showPagination = pageMax > 0;
    scene.benchHeader?.relayout?.({
      infoText: showPagination ? `Trang ${page + 1}/${pageMax + 1}` : "",
      infoVisible: showPagination
    });
    scene.benchPagePrevBtn?.setVisible?.(true);
    scene.benchPageNextBtn?.setVisible?.(true);
    scene.benchPagePrevBtn?.setEnabled?.(page > 0);
    scene.benchPageNextBtn?.setEnabled?.(page < pageMax);
}

export function getVisiblePlanningBenchSlotByIndex(scene: SceneWithHelpers, benchIndex: number): BenchSlot | null {
    if (!Number.isInteger(benchIndex)) return null;
    return (scene.benchSlots ?? []).find((slot) => slot?.benchIndex === benchIndex && slot?.bg?.visible) ?? null;
}

export function destroyPlanningBenchSlotVisualModel(scene: SceneWithHelpers, slot: BenchSlot | null | undefined): void {
    const target = slot?._visualModel;
    if (!target) return;
    try {
      target.destroy?.();
    } catch {
      // Best-effort cleanup for custom bench visuals.
    }


}

export function isPlanningBenchTextRenderable(scene: SceneWithHelpers, obj: unknown): boolean {
    const textObj = obj as {
      active?: boolean;
      scene?: unknown;
      texture?: { source?: Array<{ image?: unknown }> };
    };
    return Boolean(textObj && textObj.active && textObj.scene && textObj.texture?.source?.[0]?.image);
}

export function ensurePlanningBenchSlotTextObjects(scene: SceneWithHelpers, slot: BenchSlot | null | undefined): void {
    if (!slot) return;
    if (!isPlanningBenchTextRenderable(scene, slot.label)) {
      slot.label?.destroy?.();
      slot.label = createPlanningBenchSlotLabel(scene, slot.x, slot.y, slot.slotW);
    }
    if (!isPlanningBenchTextRenderable(scene, slot.icon)) {
      slot.icon?.destroy?.();
      slot.icon = createPlanningBenchSlotIcon(scene, slot.x, slot.y, slot.slotW, slot.slotH);
    }
}

export function safeUpdatePlanningBenchSlotText(
    scene: SceneWithHelpers,
    slot: BenchSlot | null | undefined,
    labelText: string,
    labelColor: string,
    iconText: string
): void {
    if (!slot) return;
    const safeLabelText = String(labelText ?? "");
    const safeIconText = String(iconText ?? "");
    const apply = (): void => {
      ensurePlanningBenchSlotTextObjects(scene, slot);
      if (slot.label.text !== safeLabelText) slot.label.setText(safeLabelText);
      const currentColor = (slot.label.style as { color?: string } | undefined)?.color;
      if (labelColor && currentColor !== labelColor) {
        try {
          slot.label.setColor(labelColor);
        } catch {
          slot.label.setStyle({ color: labelColor });
        }
      }
      if (slot.icon.text !== safeIconText) slot.icon.setText(safeIconText);
      slot.icon.setVisible(Boolean(safeIconText));
    };

    try {
      apply();
    } catch {
      slot.label?.destroy?.();
      slot.icon?.destroy?.();
      slot.label = createPlanningBenchSlotLabel(scene, slot.x, slot.y, slot.slotW);
      slot.icon = createPlanningBenchSlotIcon(scene, slot.x, slot.y, slot.slotW, slot.slotH);
      apply();
    }
}

export function refreshPlanningBenchUi(scene: SceneWithHelpers): void {
    const cap = getPlanningBenchCap(scene as unknown as Parameters<typeof getPlanningBenchCap>[0]);
    const pageOffset = getPlanningBenchPageOffset(scene);
    const dummyVisible = isPlanningCreativeMode(scene as unknown as Parameters<typeof isPlanningCreativeMode>[0]) && scene.benchPage === 0;
    scene.creativeDummySlot = dummyVisible ? (scene.benchSlots?.[0] ?? null) : null;
    (scene.benchSlots ?? []).forEach((slot: BenchSlot, slotIndex: number) => {
      const isCreativeDummy = dummyVisible && slotIndex === 0;
      const benchIndex = isCreativeDummy ? null : pageOffset + slotIndex - (dummyVisible ? 1 : 0);
      slot.isCreativeDummy = isCreativeDummy;
      slot.benchIndex = benchIndex;
      const chrome = slot.cardChrome;
      if (!isCreativeDummy && benchIndex !== null && benchIndex >= cap) {
        destroyPlanningBenchSlotVisualModel(scene, slot);
        setPlanningCortisolDanceEligibility(scene as unknown as Parameters<typeof setPlanningCortisolDanceEligibility>[0], slot.icon, false);
        setRuneterraUnitCardVisible(chrome as unknown as Parameters<typeof setRuneterraUnitCardVisible>[0], false);
        return;
      }
      setRuneterraUnitCardVisible(chrome as unknown as Parameters<typeof setRuneterraUnitCardVisible>[0], true);
      if (isCreativeDummy) {
        destroyPlanningBenchSlotVisualModel(scene, slot);
        setPlanningCortisolDanceEligibility(scene as unknown as Parameters<typeof setPlanningCortisolDanceEligibility>[0], slot.icon, false);
        const selectedUnit = scene.selectedBenchIndex != null ? scene.player?.bench?.[scene.selectedBenchIndex] : null;
        const active = !!selectedUnit;
        syncRuneterraUnitCard(chrome as unknown as Parameters<typeof syncRuneterraUnitCard>[0], {
          fill: active ? 0x223951 : 0x162433,
          stroke: active ? UI_COLORS.accent : UI_COLORS.panelEdgeSoft,
          artFill: active ? 0x203448 : 0x192231,
          title: t("creative.dummySlotLabel"),
          bottomText: active ? t("planning.creative.readyCopy") : t("planning.ui.noBeastSelected"),
          statusText: "",
          iconText: active ? (selectedUnit?.base?.icon ?? "🪆") : "🪆",
          selected: false
        });
        slot.icon.setVisible(Boolean(active ? (selectedUnit?.base?.icon ?? "🪆") : "🪆"));
        return;
      }
      const unit = scene.player?.bench?.[benchIndex as number];
      const selected = scene.selectedBenchIndex === benchIndex;
      const compactSlot = slot.slotW < 112 || slot.slotH < 82;

      if (!unit) {
        destroyPlanningBenchSlotVisualModel(scene, slot);
        setPlanningCortisolDanceEligibility(scene as unknown as Parameters<typeof setPlanningCortisolDanceEligibility>[0], slot.icon, false);
        syncRuneterraUnitCard(chrome as unknown as Parameters<typeof syncRuneterraUnitCard>[0], {
          fill: selected ? 0x223951 : 0x141f2d,
          stroke: UI_COLORS.panelEdgeSoft,
          artFill: 0x192231,
          title: t("ui.empty"),
          bottomText: t("ui.benchSlot", { index: (benchIndex as number) + 1 }),
          statusText: "",
          iconText: "",
          selected
        });
      } else {
        const roleTheme = getPlanningRoleTheme(scene as unknown as Parameters<typeof getPlanningRoleTheme>[0], unit.base.classType);
        const visual = getUnitVisual(unit.baseId, unit.base.classType, unit.star, {
          side: "LEFT",
          ownerKind: "PLAYER",
          collectionProfile: scene.collectionProfile
        });
        destroyPlanningBenchSlotVisualModel(scene, slot);
        const visualModel = createUnitVisualModel(scene as unknown as Parameters<typeof createUnitVisualModel>[0], unit.baseId, {
          x: chrome.portraitAnchor.x,
          y: chrome.portraitAnchor.y,
          scale: chrome.portraitScale,
          side: "LEFT",
          ownerKind: "PLAYER",
          collectionProfile: scene.collectionProfile as Record<string, unknown> | undefined
        } as unknown as Parameters<typeof createUnitVisualModel>[2]) as { destroy?: () => void; setDepth?: (depth: number) => void } | null;
        const stats = scaledBaseStats(unit.base.stats as unknown as Parameters<typeof scaledBaseStats>[0], unit.star, unit.base.classType);

        const nameLimit = compactSlot ? 12 : 18;
        const visualName = visual.nameVi ?? visual.name ?? unit.base.nameVi ?? unit.base.name ?? unit.baseId;
        const nameShort = visualName.length > nameLimit ? `${visualName.slice(0, nameLimit - 1)}…` : visualName;
        syncRuneterraUnitCard(chrome as unknown as Parameters<typeof syncRuneterraUnitCard>[0], {
          fill: selected ? roleTheme.cardHover : roleTheme.bench,
          stroke: roleTheme.stroke,
          artFill: roleTheme.card,
          title: nameShort,
          bottomText: "",
          bottomIcons: [getTribeIcon(unit.base.tribe), getClassIcon(unit.base.classType)],
          costText: `${unit.base.tier}`,
          starText: `${unit.base.tier}`,
          atkText: `${stats.atk}`,
          hpText: `${stats.hp}`,
          portraitKey: visualModel ? null : ((visual.portraitKey as string | null | undefined) ?? null),

          showStatBadges: false,
          selected
        } as unknown as Parameters<typeof syncRuneterraUnitCard>[1]);
        slot._visualModel = visualModel;
        if (visualModel?.setDepth) visualModel.setDepth(1505);
        chrome.portraitText.setVisible(!visualModel && chrome.portraitText.visible);
        setPlanningCortisolDanceEligibility(scene as unknown as Parameters<typeof setPlanningCortisolDanceEligibility>[0], slot.icon, !visualModel && chrome.portraitText.visible);
        setPlanningCortisolDanceEligibility(scene as unknown as Parameters<typeof setPlanningCortisolDanceEligibility>[0], slot._visualModel as unknown as Parameters<typeof setPlanningCortisolDanceEligibility>[1], Boolean(visualModel));
        slot.icon.setText(visual.previewIcon ?? visual.icon ?? "");
        slot.icon.setVisible(Boolean(!visualModel && slot.icon.visible));
      }
    });
    refreshPlanningBenchPaginationUi(scene);
}
