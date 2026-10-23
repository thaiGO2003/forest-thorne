import Phaser from "phaser";
import { UNIT_BY_ID } from "../../data/unitCatalog.js";
import { getClassIcon, getTribeIcon, getUnitVisual } from "../../data/unitVisuals.js";
import { createUnitVisualModel } from "../../visuals/visualRegistry.js";
import { scaledBaseStats } from "../../core/gameUtils.js";
import { UI_COLORS, UI_FONT } from "../../core/uiTheme.js";
import { PHASE } from "../../core/boardConstants.js";
import { t } from "../../i18n/index.js";
import { computePlanningLowerDockPanelLayout } from "./planningLowerDockPanelLayout.js";
import {
  createRuneterraUnitCard,
  destroyRuneterraUnitCard,
  syncRuneterraUnitCard
} from "../../ui/runeterraUnitCard.js";
import { getPlanningRoleTheme } from "./planningBoardChromeRuntime.js";
import { planningCountUnitCopies } from "./planningItemHelpersRuntime.js";
import { buyPlanningFromShop } from "./planningShopActionsRuntime.js";
import { getPlanningUnitTooltip } from "./planningTooltipRuntime.js";
import { planningShouldShowShopInPlanning } from "./planningTechRuntime.js";

interface UnitRecordLocal {
  id: string;
  tier: number;
  classType: string;
  tribe?: string;
  stats: { atk: number; hp: number; [key: string]: number };
  [key: string]: unknown;
}

type UnitShopOffer = { baseId: string; tier: number } | null;

interface ShopPlayerLocal {
  shop: UnitShopOffer[];
  collectionProfile?: unknown;
}

interface PlanningLayoutLocal {
  compactHud?: boolean;
  shopY: number;
  shopCardW: number;
  shopCardH: number;
  shopGap: number;
  shopCardsX?: number;
  shopCardsW?: number;
  shopRegionX: number;
  shopRegionW: number;
  boardPanelW: number;
}

interface ShopCardLocal {
  bg: Phaser.GameObjects.Shape;
  chrome: ShopRuneterraCard;
  visualModel?: unknown;
  renderData: Record<string, unknown>;
  copyPulse?: Phaser.Tweens.Tween;
}

interface ShopRuneterraCard {
  bg: Phaser.GameObjects.Shape;
  innerFrame?: { active?: boolean; setStrokeStyle: (w: number, color: number, alpha: number) => void };
  portraitText: Phaser.GameObjects.Text;
  portraitAnchor: { x: number; y: number };
  portraitScale?: number;
  [key: string]: unknown;
}

interface TooltipLike {
  attach: (target: Phaser.GameObjects.Shape, getter: () => unknown) => void;
}

type CollectionProfileLike = Record<string, unknown> | null | undefined;

type PlanningShopScene = Phaser.Scene & {
  layout: PlanningLayoutLocal;
  player: ShopPlayerLocal;
  buttons: Record<string, unknown>;
  phase: string;
  collectionProfile?: CollectionProfileLike;
  shopCards: ShopCardLocal[];
  shopPlaceholderBg?: Phaser.GameObjects.Rectangle | null;
  shopPlaceholderText?: Phaser.GameObjects.Text | null;
  tooltip: TooltipLike;
  tweens: Phaser.Tweens.TweenManager;
  [key: string]: unknown;
};

interface RenderData {
  fill: number;
  stroke: number;
  artFill: number;
  title: string;
  bottomText: string;
  bottomIcons: string[];
  costText: string;
  starText: string;
  atkText: string;
  hpText: string;
  iconText: string;
  statusText: string;
}

function clearPlanningShopCards(scene: PlanningShopScene): void {
  scene.shopCards.forEach((card) => {
    card.copyPulse?.remove?.();
    try { (card.visualModel as { destroy?: () => void } | null | undefined)?.destroy?.(); } catch { /* ignore visual model destroy errors */ }
    destroyRuneterraUnitCard(card.chrome as unknown as Parameters<typeof destroyRuneterraUnitCard>[0]);
  });
  scene.shopCards = [];
}

function clearPlanningShopPlaceholder(scene: PlanningShopScene): void {
  scene.shopPlaceholderBg?.destroy?.();
  scene.shopPlaceholderText?.destroy?.();
  scene.shopPlaceholderBg = undefined;
  scene.shopPlaceholderText = undefined;
}

export function refreshPlanningShopUi(scene: PlanningShopScene): void {
  clearPlanningShopCards(scene);
  clearPlanningShopPlaceholder(scene);
  if (planningShouldShowShopInPlanning(scene as unknown as Parameters<typeof planningShouldShowShopInPlanning>[0]) === false) {
    const layout = scene.layout;
    const dockPanels = computePlanningLowerDockPanelLayout(layout as unknown as Parameters<typeof computePlanningLowerDockPanelLayout>[0]);
    const shopPanel = (dockPanels as unknown as { shop: { w: number; cx: number } }).shop;
    const compact = layout.compactHud === true;
    const x = shopPanel.cx;
    const y = layout.shopY + layout.shopCardH * 0.5;
    const width = Math.max(280, Math.min(shopPanel.w, layout.boardPanelW * 0.36));
    const bg = scene.add.rectangle(x, y, width, Math.max(68, layout.shopCardH * 0.72), 0x101824, 0.92);
    bg.setStrokeStyle(1.2, UI_COLORS.panelEdgeSoft, 0.7);
    bg.setDepth(1499);
    scene.shopPlaceholderBg = bg;
    const text = scene.add.text(x, y, t("fortress.shopInlineLocked"), {
      fontFamily: UI_FONT,
      fontSize: compact ? "11px" : "12px",
      color: UI_COLORS.textSecondary,
      align: "center",
      wordWrap: { width: width - 24 }
    }).setOrigin(0.5).setDepth(1501);
    scene.shopPlaceholderText = text;
    return;
  }

  const layout = scene.layout;
  const compact = layout.compactHud === true;
  const y = layout.shopY;
  const cardW = layout.shopCardW;
  const cardH = layout.shopCardH;
  const totalShopW = cardW * 5 + layout.shopGap * 4;
  const cardsX = layout.shopCardsX ?? layout.shopRegionX;
  const cardsW = layout.shopCardsW ?? layout.shopRegionW;
  const startX = cardsX + Math.max(0, (cardsW - totalShopW) / 2);

  for (let index = 0; index < 5; index += 1) {
    const x = startX + index * (cardW + layout.shopGap);
    const offer = scene.player.shop[index];
    const base: UnitRecordLocal | null = offer
      ? (UNIT_BY_ID[offer.baseId] as UnitRecordLocal | undefined) ?? null
      : null;
    const visual = offer && base ? getUnitVisual(offer.baseId, base.classType) : null;
    const sold = !offer;
    const roleTheme = base ? getPlanningRoleTheme(scene as unknown as Parameters<typeof getPlanningRoleTheme>[0], base.classType as "TANKER" | "FIGHTER" | "MAGE" | "SUPPORT" | "ARCHER" | "ASSASSIN") : null;
    const cardFill = sold ? 0x111826 : roleTheme?.card ?? 0x16283c;
    const cardStroke = sold ? UI_COLORS.panelEdgeSoft : roleTheme?.stroke ?? UI_COLORS.panelEdge;
    const cardHover = roleTheme?.cardHover ?? 0x213c58;
    const compactCard = compact || cardW < 120 || cardH < 136;
    const chrome = createRuneterraUnitCard(
      scene as unknown as Parameters<typeof createRuneterraUnitCard>[0],
      { x, y, w: cardW, h: cardH, depth: 1499, compact: compactCard }
    ) as unknown as ShopRuneterraCard;
    const bg = chrome.bg;
    const baseStats = base ? scaledBaseStats(base.stats as unknown as Parameters<typeof scaledBaseStats>[0], 1, base.classType) : null;
    const renderData: RenderData = {
      fill: cardFill, stroke: cardStroke, artFill: sold ? 0x1a2230 : (roleTheme?.bench ?? 0x25354b),
      title: sold ? t("shop.slotBought") : (visual?.nameVi ?? visual?.name ?? t("ui.unknown")),
      bottomText: sold ? t("shop.slotBoughtHint") : "",
      bottomIcons: sold ? [] : [getTribeIcon(base?.tribe ?? ""), getClassIcon(base?.classType ?? "")],
      costText: sold ? "" : `${base?.tier ?? 0}`,
      starText: sold ? "" : `${base?.tier ?? 0}`,
      atkText: sold ? "" : `${baseStats?.atk ?? ""}`,
      hpText: sold ? "" : `${baseStats?.hp ?? ""}`,
      iconText: sold ? "" : (visual?.icon ?? "❔"),
      statusText: sold ? t("ui.purchased").toUpperCase() : t("ui.ready").toUpperCase()
    };
    syncRuneterraUnitCard(chrome as unknown as Parameters<typeof syncRuneterraUnitCard>[0], renderData as unknown as Parameters<typeof syncRuneterraUnitCard>[1]);
    let copyPulse: Phaser.Tweens.Tween | null = null;
    if (offer && !sold) {
      const ownedCount = planningCountUnitCopies(scene as unknown as Parameters<typeof planningCountUnitCopies>[0], offer.baseId);
      if (ownedCount > 0) {
        copyPulse = scene.tweens.addCounter({
          from: 0, to: 100, duration: 2500, loop: -1,
          onUpdate: (tween) => {
            const value = tween.getValue() as number;
            const color = Phaser.Display.Color.HSVToRGB(value / 100, 1, 1).color;
            if (chrome.innerFrame?.active) chrome.innerFrame.setStrokeStyle(1.2, color as number, 1);
          }
        });
      }
    }
    let visualModel: unknown = null;
    if (offer && !sold) {
      const collectionProfile: Record<string, unknown> | null = scene.collectionProfile ?? (scene.player?.collectionProfile as Record<string, unknown> | null | undefined) ?? null;
      visualModel = createUnitVisualModel(
        scene as unknown as Parameters<typeof createUnitVisualModel>[0],
        offer.baseId,
        {
          x: chrome.portraitAnchor.x,
          y: chrome.portraitAnchor.y,
          scale: chrome.portraitScale ?? 1,
          star: 1,
          surface: "planning",
          ownerKind: "PLAYER",
          collectionProfile: collectionProfile ?? undefined
        } as unknown as Parameters<typeof createUnitVisualModel>[2]
      );
      if (visualModel) {
        (visualModel as { setDepth?: (d: number) => void }).setDepth?.(1505);
        chrome.portraitText.setVisible(false);
      }
    }
    scene.shopCards.push({ bg, chrome, visualModel, renderData: renderData as unknown as Record<string, unknown>, copyPulse: copyPulse ?? undefined });
    bg.setInteractive({ useHandCursor: true });
    bg.on("pointerdown", () => buyPlanningFromShop(scene as unknown as Parameters<typeof buyPlanningFromShop>[0], index));
    scene.tooltip.attach(bg, () => {
      if (!offer) return { title: t("shop.slotBoughtTitle"), body: t("shop.slotBoughtBody") };
      return getPlanningUnitTooltip(scene as unknown as Parameters<typeof getPlanningUnitTooltip>[0], offer.baseId, 1);
    });
    bg.on("pointerover", () => {
      if (scene.phase === PHASE.PLANNING && !sold) {
        syncRuneterraUnitCard(chrome as unknown as Parameters<typeof syncRuneterraUnitCard>[0], { ...renderData, fill: cardHover, stroke: UI_COLORS.accent,
          statusText: t("ui.selected").toUpperCase(), statusColor: "#d7f9ff", selected: true } as unknown as Parameters<typeof syncRuneterraUnitCard>[1]);
        chrome.portraitText.setText(renderData.iconText ?? "");
        const activeModel = (visualModel as { active?: boolean } | null | undefined)?.active;
        if (visualModel && activeModel) chrome.portraitText.setVisible(false);
      }
    });
    bg.on("pointerout", () => {
      syncRuneterraUnitCard(chrome as unknown as Parameters<typeof syncRuneterraUnitCard>[0], renderData as unknown as Parameters<typeof syncRuneterraUnitCard>[1]);
      chrome.portraitText.setText(renderData.iconText ?? "");
      const activeModel = (visualModel as { active?: boolean } | null | undefined)?.active;
      chrome.portraitText.setVisible(!activeModel && Boolean(renderData.iconText));
    });
  }
}
