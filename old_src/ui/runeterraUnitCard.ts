import type { Scene as PhaserScene } from "phaser";
import { EMOJI_FONT, UI_COLORS, UI_FONT } from "../core/uiTheme.js";

const FRAME_GOLD = 0xd2b173;
const FRAME_GOLD_SOFT = 0x8f7143;
const COST_STROKE = 0xfff1a8;
const STAR_STROKE = 0xc8ebff;
const STAT_FILL = 0x1b2b3d;
const STAT_STROKE = 0xc6def7;
const TRAIT_FILL = 0x152233;
const TRAIT_STROKE = 0xb99863;
const COST_TEXT_COLOR = "#ffd759";
const STAR_TEXT_COLOR = "#84c6ff";
const ATK_TEXT_COLOR = "#ffad5c";
const HP_TEXT_COLOR = "#ff6d7b";
const STAT_TEXT_STROKE = "#09111b";
const TITLE_RAISE_Y = 2;
const AVATAR_FRAME_DROP_RATIO = 0.3;
const TOP_META_RAISE_Y = 2;

interface RuneterraSceneLike extends PhaserScene, Record<string, unknown> {}

interface CardNode {
  visible?: boolean;
  active?: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  depth?: number;
  texture?: { key: string };
  scene?: RuneterraSceneLike;
  setText?: (v: string) => void;
  setColor?: (v: string) => void;
  setVisible?: (v: boolean) => void;
  setDepth?: (v: number) => void;
  setStrokeStyle?: (width: number, color: number, alpha?: number) => void;
  setFillStyle?: (fill: number, alpha?: number) => void;
  setScale?: (v: number) => void;
  setStroke?: (color: string, thickness: number) => void;
  setShadow?: (x: number, y: number, color: string, qty: number) => void;
  setWordWrapWidth?: (w: number, b: boolean) => void;
  setX?: (v: number) => void;
  setDisplaySize?: (w: number, h: number) => void;
  setTexture?: (key: string) => void;
  setOrigin?: (x?: number, y?: number) => void;
  setPosition?: (x: number, y: number) => void;
  destroy?: () => void;
}

interface RuneterraCard {
  x: number;
  y: number;
  w: number;
  h: number;
  compact: boolean;
  nodes: CardNode[];
  bg: CardNode;
  innerFrame: CardNode;
  artBg: CardNode;
  artShade: CardNode;
  footerBg: CardNode;
  statusText: CardNode;
  costOrb: CardNode;
  costText: CardNode;
  costIconText: CardNode;
  starOrb: CardNode;
  starText: CardNode;
  starIconText: CardNode;
  portraitSprite: CardNode | null;
  portraitText: CardNode;
  portraitAnchor: { x: number; y: number };
  portraitFitW: number;
  portraitFitH: number;
  footerY: number;
  footerH: number;
  footerTitleY: number;
  typeTextY: number;
  tribeChip: CardNode;
  tribeIconText: CardNode;
  classChip: CardNode;
  classIconText: CardNode;
  traitChipRadius: number;
  traitChipGap: number;
  traitCenterX: number;
  atkBadge: CardNode;
  atkText: CardNode;
  hpBadge: CardNode;
  hpText: CardNode;
  metaLeftX: number;
  metaRightX: number;
  metaY: number;
  plainAtkX: number;
  plainHpX: number;
  plainStatY: number;
  footerTextWrapW: number;
  titleText?: CardNode;
  typeText?: CardNode;
  depth?: number;
}

interface SyncRuneterraData {
  fill?: number;
  fillAlpha?: number;
  stroke?: number;
  accentStroke?: number;
  selected?: boolean;
  artFill?: number;
  artAlpha?: number;
  footerFill?: number;
  footerAlpha?: number;
  artShadeAlpha?: number;
  title?: string;
  titleColor?: string;
  bottomText?: string;
  bottomColor?: string;
  bottomIcons?: unknown[];
  statusText?: string;
  statusColor?: string;
  costText?: number | string;
  costColor?: string;
  starText?: number | string;
  starColor?: string;
  atkText?: number | string;
  atkColor?: string;
  hpText?: number | string;
  hpColor?: string;
  iconText?: number | string;
  portraitKey?: string | null;
}

function setVisible(target: CardNode | null | undefined, visible: boolean) {
  target?.setVisible?.(visible);
}

function setManyVisible(nodes: unknown[] | null | undefined, visible: boolean) {
  (nodes ?? []).forEach((node) => setVisible(node as CardNode, visible));
}

function destroyMany(nodes: unknown[] | null | undefined) {
  (nodes ?? []).forEach((node) => (node as CardNode | null)?.destroy?.());
}

function applyTextStroke(text: CardNode | null, color: string, thickness: number) {
  if (typeof text?.setStroke === "function") text.setStroke(color, thickness);
  if (typeof text?.setShadow === "function") text.setShadow(0, 0, color, Math.max(1, Math.round(thickness)));
  return text;
}

function formatCostBadgeText(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (/[🪙💰]/u.test(text)) return text;
  return `${text}💰`;
}

function formatUpgradeBadgeText(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (/⬆️/u.test(text)) return text;
  return `${text}⬆️`;
}

function fitPortraitSprite(card: RuneterraCard) {
  const sprite = card?.portraitSprite;
  const scene = card?.bg?.scene;
  const portraitKey = sprite?.texture?.key;
  if (!sprite || !portraitKey || !scene?.textures?.exists?.(portraitKey)) return;
  const texture = scene.textures.get(portraitKey);
  const sourceImage = texture?.getSourceImage?.() ?? null;
  const sourceW = Math.max(1, Number(sourceImage?.width) || sprite.width || card.portraitFitW || 1);
  const sourceH = Math.max(1, Number(sourceImage?.height) || sprite.height || card.portraitFitH || 1);
  const scale = Math.min(
    Math.max(0.1, (card.portraitFitW ?? sourceW) / sourceW),
    Math.max(0.1, (card.portraitFitH ?? sourceH) / sourceH)
  );
  sprite.setScale?.(scale);
}

function ensurePortraitSprite(card: RuneterraCard, portraitKey: string | null) {
  const scene = card?.bg?.scene;
  if (!portraitKey || !scene?.textures?.exists?.(portraitKey) || typeof scene?.add?.image !== "function") {
    if (card?.portraitSprite) card.portraitSprite.setVisible?.(false);
    return false;
  }
  if (!card.portraitSprite) {
    const img = scene.add.image(card.portraitAnchor.x, card.portraitAnchor.y, portraitKey).setOrigin(0.5) as unknown as CardNode;
    img.setDepth?.((card.portraitText.depth ?? 0) - 0.5);
    card.nodes.push(img);
    card.portraitSprite = img;
  } else {
    card.portraitSprite.setTexture?.(portraitKey);
    card.portraitSprite.setPosition?.(card.portraitAnchor.x, card.portraitAnchor.y);
  }
  fitPortraitSprite(card);
  card.portraitSprite.setVisible?.(true);
  return true;
}

function truncateLine(value: unknown, maxLength = 18): string {
  const text = String(value ?? "").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(1, maxLength - 1))}…`;
}

function createStatBadge(scene: RuneterraSceneLike, cx: number, cy: number, width: number, height: number, fill: number, stroke: number, side: string = "left", depth: number = 1506): CardNode {
  const halfW = width / 2;
  const halfH = height / 2;
  const points = side === "right"
    ? [
        -halfW, -halfH,
        halfW - 12, -halfH,
        halfW, -halfH + 7,
        halfW, halfH,
        -halfW + 8, halfH
      ]
    : [
        -halfW + 12, -halfH,
        halfW, -halfH,
        halfW, halfH,
        -halfW, halfH,
        -halfW, -halfH + 7
      ];
  const badge = scene.add.polygon(cx, cy, points, fill, 0.98) as unknown as CardNode;
  badge.setStrokeStyle?.(1.1, stroke, 1);
  badge.setDepth?.(depth);
  return badge;
}

function createTraitChip(scene: RuneterraSceneLike, cx: number, cy: number, radius: number, depth: number = 1505): CardNode {
  const chip = scene.add.circle(cx, cy, radius, TRAIT_FILL, 0.96) as unknown as CardNode;
  chip.setStrokeStyle?.(1, TRAIT_STROKE, 0.95);
  chip.setDepth?.(depth);
  return chip;
}

function measureTextHeight(textObject: { displayHeight?: number; height?: number } | null | undefined, fallback: number): number {
  return Math.max(0, Number(textObject?.displayHeight ?? textObject?.height) || fallback);
}

function applyFooterWrap(textObject: { setWordWrapWidth?: (w: number, b: boolean) => void } | null | undefined, width: number) {
  if (!textObject?.setWordWrapWidth) return;
  textObject.setWordWrapWidth(Math.max(12, Math.round(width)), true);
}

function relayoutFooterContent(card: RuneterraCard, options: { titleVisible?: boolean; bottomTextVisible?: boolean; bottomIconsVisible?: boolean } = {}) {
  if (!card?.titleText || !card?.typeText) return;
  const centerX = card.x + card.w * 0.5;
  const titleVisible = options.titleVisible === true;
  const bottomTextVisible = options.bottomTextVisible === true;
  const bottomIconsVisible = options.bottomIconsVisible === true;
  applyFooterWrap(card.typeText, card.footerTextWrapW ?? (card.w - 12));

  card.titleText.setPosition?.(centerX, card.footerTitleY);
  card.typeText.setPosition?.(centerX, card.typeTextY);

  if (!titleVisible && !bottomTextVisible) return;

  if (bottomIconsVisible) {
    if (titleVisible && !bottomTextVisible) {
      const titleH = measureTextHeight(card.titleText, card.compact ? 9 : 12);
      const centeredTitleY = card.footerY + Math.round((card.footerH - titleH) * 0.5) - TITLE_RAISE_Y;
      const iconTop = Math.min(card.tribeChip?.y ?? Infinity, card.classChip?.y ?? Infinity) - (card.traitChipRadius ?? 0);
      const iconAnchoredTitleY = Math.round(iconTop - titleH - (card.compact ? 8 : 10));
      const minTitleY = card.footerY + (card.compact ? 1 : 2);
      card.titleText.setPosition?.(centerX, Math.max(minTitleY, Math.min(centeredTitleY, iconAnchoredTitleY)));
    }
    return;
  }

  const titleH = titleVisible ? measureTextHeight(card.titleText, card.compact ? 9 : 12) : 0;
  const bottomH = bottomTextVisible ? measureTextHeight(card.typeText, card.compact ? 8 : 10) : 0;
  const gap = titleVisible && bottomTextVisible ? (card.compact ? 2 : 3) : 0;
  const blockH = titleH + bottomH + gap;
  const blockTop = card.footerY + Math.round((card.footerH - blockH) * 0.5) - TITLE_RAISE_Y;

  if (titleVisible) {
    card.titleText.setPosition?.(centerX, blockTop);
  }
  if (bottomTextVisible) {
    const typeCenterY = blockTop + titleH + gap + bottomH * 0.5;
    card.typeText.setPosition?.(centerX, typeCenterY);
  }
}

interface CreateCardOptions {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  depth?: number;
  compact?: boolean;
}

export function createRuneterraUnitCard(scene: RuneterraSceneLike, options: CreateCardOptions = {}): RuneterraCard {
  const {
    x = 0,
    y = 0,
    w = 120,
    h = 160,
    depth = 1500,
    compact = false
  } = options;
  const artInset = compact ? 7 : 9;
  const artTop = compact ? 16 : 18;
  const footerH = compact ? Math.max(26, Math.round(h * 0.28)) : Math.max(34, Math.round(h * 0.3));
  const artH = Math.max(18, h - footerH - artTop - artInset - (compact ? 10 : 14));
  const artBottom = y + artTop + artH;
  const footerY = y + h - footerH - artInset;
  const avatarFrameTravel = Math.max(0, footerY - artBottom);
  const avatarFrameDrop = Math.round(avatarFrameTravel * AVATAR_FRAME_DROP_RATIO);
  const costRadius = compact ? 12 : 14;
  const starRadius = costRadius;
  const statBadgeW = compact ? 28 : 36;
  const statBadgeH = compact ? 16 : 22;
  const topBadgeGap = compact ? 1 : 2;
  const topBadgeInset = costRadius + topBadgeGap;
  const footerCornerInset = compact ? 14 : 18;
  const leftCornerX = x + topBadgeInset;
  const rightCornerX = x + w - topBadgeInset;
  const topCornerY = y + topBadgeInset - TOP_META_RAISE_Y;
  const bottomCornerY = y + h - footerCornerInset;
  const statBadgeY = y + h - statBadgeH * 0.5;
  const atkBadgeX = x + statBadgeW * 0.5;
  const hpBadgeX = x + w - statBadgeW * 0.5;
  const traitChipRadius = compact ? 6.5 : 8.5;
  const traitChipGap = compact ? 16 : 20;
  const traitChipY = bottomCornerY;
  const traitCenterX = x + w * 0.5;
  const footerTitleY = footerY + (compact ? 4 : 6);
  const typeTextY = Math.max(
    footerTitleY + (compact ? 10 : 14),
    statBadgeY - statBadgeH * 0.5 - (compact ? 9 : 11)
  );

  const shadow = scene.add.rectangle(x + w / 2, y + h / 2 + 3, w, h, 0x000000, 0.22) as unknown as CardNode;
  shadow.setDepth?.(depth - 2);

  const bg = scene.add.rectangle(x + w / 2, y + h / 2, w, h, 0x1b2432, 0.18) as unknown as CardNode;
  bg.setStrokeStyle?.(1.6, FRAME_GOLD, 0.98);
  bg.setDepth?.(depth);

  const innerFrame = scene.add.rectangle(x + w / 2, y + h / 2, w - 4, h - 4, 0x101722, 0) as unknown as CardNode;
  innerFrame.setStrokeStyle?.(1, FRAME_GOLD_SOFT, 0.85);
  innerFrame.setDepth?.(depth + 1);

  const artBg = scene.add.rectangle(x + w / 2, y + artTop + artH / 2 + avatarFrameDrop, w - artInset * 2, artH, 0x283246, 0) as unknown as CardNode;
  artBg.setStrokeStyle?.(0.9, 0xd8d3c7, 0.32);
  artBg.setDepth?.(depth + 1);

  const artShade = scene.add.rectangle(x + w / 2, artBottom - 10 + avatarFrameDrop, w - artInset * 2, Math.max(20, footerH * 0.75), 0x090d14, 0) as unknown as CardNode;
  artShade.setDepth?.(depth + 2);

  const footerBg = scene.add.rectangle(x + w / 2, footerY + footerH / 2, w - artInset * 2, footerH, 0x080c12, 0) as unknown as CardNode;
  footerBg.setDepth?.(depth + 2);

  const statusText = scene.add.text(x + w / 2, y + 6, "", {
    fontFamily: UI_FONT,
    fontSize: compact ? "7px" : "8px",
    color: "#fff3d2",
    fontStyle: "bold",
    align: "center"
  }).setOrigin(0.5, 0).setDepth(depth + 4) as unknown as CardNode;

  const costOrb = scene.add.circle(leftCornerX, topCornerY, costRadius, 0x000000, 0) as unknown as CardNode;
  costOrb.setStrokeStyle?.(1.6, COST_STROKE, 1);
  costOrb.setDepth?.(depth + 5);
  const costText = scene.add.text(costOrb.x!, costOrb.y!, "", {
    fontFamily: UI_FONT,
    fontSize: compact ? "9px" : "12px",
    color: COST_TEXT_COLOR,
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(depth + 6) as unknown as CardNode;
  applyTextStroke(costText, STAT_TEXT_STROKE, compact ? 1 : 2);
  const costIconText = scene.add.text(costOrb.x! + costRadius * 0.36, costOrb.y! + costRadius * 0.3, "🪙", {
    fontFamily: EMOJI_FONT,
    fontSize: compact ? "7px" : "9px",
    align: "center"
  }).setOrigin(0.5).setDepth(depth + 7) as unknown as CardNode;

  const starOrb = scene.add.circle(rightCornerX, topCornerY, starRadius, 0x000000, 0) as unknown as CardNode;
  starOrb.setStrokeStyle?.(1.6, STAR_STROKE, 0.95);
  starOrb.setDepth?.(depth + 5);
  const starText = scene.add.text(starOrb.x!, starOrb.y!, "", {
    fontFamily: UI_FONT,
    fontSize: compact ? "9px" : "12px",
    color: STAR_TEXT_COLOR,
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(depth + 6) as unknown as CardNode;
  applyTextStroke(starText, STAT_TEXT_STROKE, compact ? 1 : 2);
  const starIconText = scene.add.text(starOrb.x! + starRadius * 0.34, starOrb.y! + starRadius * 0.3, "⬆️", {
    fontFamily: EMOJI_FONT,
    fontSize: compact ? "7px" : "9px",
    align: "center"
  }).setOrigin(0.5).setDepth(depth + 7) as unknown as CardNode;

  const portraitAnchor = {
    x: x + w / 2,
    y: y + artTop + artH * (compact ? 0.53 : 0.56) + avatarFrameDrop
  };
  const portraitText = scene.add.text(portraitAnchor.x, portraitAnchor.y, "", {
    fontFamily: EMOJI_FONT,
    fontSize: compact ? "22px" : "32px",
    color: "#ffffff",
    align: "center"
  }).setOrigin(0.5).setDepth(depth + 4) as unknown as CardNode;

  const titleText = scene.add.text(x + w / 2, footerTitleY, "", {
    fontFamily: UI_FONT,
    fontSize: compact ? "8px" : "11px",
    color: "#fff5df",
    fontStyle: "bold",
    align: "center"
  }).setOrigin(0.5, 0).setDepth(depth + 6) as unknown as CardNode;

  const typeText = scene.add.text(x + w / 2, typeTextY, "", {
    fontFamily: UI_FONT,
    fontSize: compact ? "7px" : "8px",
    color: "#d9c7a0",
    fontStyle: "bold",
    align: "center",
    wordWrap: { width: Math.max(12, w - artInset * 2 - (compact ? 4 : 8)), useAdvancedWrap: true }
  }).setOrigin(0.5, 0.5).setDepth(depth + 6) as unknown as CardNode;

  const tribeChip = createTraitChip(scene, traitCenterX - traitChipGap * 0.5, traitChipY, traitChipRadius, depth + 5);
  const tribeIconText = scene.add.text(tribeChip.x!, tribeChip.y!, "", {
    fontFamily: EMOJI_FONT,
    fontSize: compact ? "8px" : "11px",
    align: "center"
  }).setOrigin(0.5).setDepth(depth + 6) as unknown as CardNode;

  const classChip = createTraitChip(scene, traitCenterX + traitChipGap * 0.5, traitChipY, traitChipRadius, depth + 5);
  const classIconText = scene.add.text(classChip.x!, classChip.y!, "", {
    fontFamily: EMOJI_FONT,
    fontSize: compact ? "8px" : "11px",
    align: "center"
  }).setOrigin(0.5).setDepth(depth + 6) as unknown as CardNode;

  const atkBadge = createStatBadge(scene, atkBadgeX, statBadgeY, statBadgeW, statBadgeH, STAT_FILL, STAT_STROKE, "left", depth + 5);
  const atkText = scene.add.text(atkBadge.x!, atkBadge.y!, "", {
    fontFamily: UI_FONT,
    fontSize: compact ? "9px" : "12px",
    color: ATK_TEXT_COLOR,
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(depth + 6) as unknown as CardNode;
  applyTextStroke(atkText, STAT_TEXT_STROKE, compact ? 1 : 2);

  const hpBadge = createStatBadge(scene, hpBadgeX, statBadgeY, statBadgeW, statBadgeH, STAT_FILL, STAT_STROKE, "right", depth + 5);
  const hpText = scene.add.text(hpBadge.x!, hpBadge.y!, "", {
    fontFamily: UI_FONT,
    fontSize: compact ? "9px" : "12px",
    color: HP_TEXT_COLOR,
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(depth + 6) as unknown as CardNode;
  applyTextStroke(hpText, STAT_TEXT_STROKE, compact ? 1 : 2);

  const card: RuneterraCard = {
    x,
    y,
    w,
    h,
    compact,
    nodes: [
      shadow,
      bg,
      innerFrame,
      artBg,
      artShade,
      footerBg,
      statusText,
      costOrb,
      costText,
      costIconText,
      starOrb,
      starText,
      starIconText,
      portraitText,
      titleText,
      typeText,
      tribeChip,
      tribeIconText,
      classChip,
      classIconText,
      atkBadge,
      atkText,
      hpBadge,
      hpText
    ],
    bg,
    innerFrame,
    artBg,
    artShade,
    footerBg,
    statusText,
    costOrb,
    costText,
    costIconText,
    starOrb,
    starText,
    starIconText,
    portraitSprite: null,
    portraitText,
    titleText,
    typeText,
    portraitAnchor,
    portraitFitW: Math.max(18, w - artInset * 2 - (compact ? 14 : 18)),
    portraitFitH: Math.max(18, artH - (compact ? 16 : 20)),
    footerY,
    footerH,
    footerTitleY,
    typeTextY,
    tribeChip,
    tribeIconText,
    classChip,
    classIconText,
    traitChipRadius,
    traitChipGap,
    traitCenterX,
    atkBadge,
    atkText,
    hpBadge,
    hpText,
    metaLeftX: x + artInset + (compact ? 1 : 2),
    metaRightX: x + w - artInset - (compact ? 1 : 2),
    metaY: topCornerY,
    plainAtkX: x + artInset + (compact ? 2 : 4),
    plainHpX: x + w - artInset - (compact ? 2 : 4),
    plainStatY: y + h - Math.max(9, artInset),
    footerTextWrapW: Math.max(12, w - artInset * 2 - (compact ? 4 : 8)),
    depth
  };

  return card;
}

export function destroyRuneterraUnitCard(card: RuneterraCard) {
  card.portraitSprite = null;
  destroyMany(card?.nodes);
}

export function setRuneterraUnitCardVisible(card: RuneterraCard, visible: boolean) {
  setManyVisible(card?.nodes, visible);
}

export function syncRuneterraUnitCard(card: RuneterraCard, data: SyncRuneterraData = {}) {
  if (!card) return;
  const fill = data.fill ?? 0x1b2432;
  const stroke = data.stroke ?? FRAME_GOLD;
  const accentStroke = data.accentStroke ?? UI_COLORS.accent;
  const selected = data.selected === true;

  card.bg.setFillStyle?.(fill, data.fillAlpha ?? 0.18);
  card.bg.setStrokeStyle?.(selected ? 1.9 : 1.6, selected ? accentStroke : stroke, 0.98);
  card.innerFrame.setStrokeStyle?.(1, selected ? accentStroke : FRAME_GOLD_SOFT, selected ? 0.9 : 0.82);
  card.artBg.setFillStyle?.(data.artFill ?? fill, data.artAlpha ?? 0);
  card.footerBg.setFillStyle?.(data.footerFill ?? fill, data.footerAlpha ?? 0);
  card.artShade.setFillStyle?.(0x090d14, data.artShadeAlpha ?? 0);

  const titleText = truncateLine(data.title ?? "", card.compact ? 14 : 20);
  const bottomText = String(data.bottomText ?? "").trim();
  const bottomIcons = Array.isArray(data.bottomIcons)
    ? data.bottomIcons.map((icon) => String(icon ?? "").trim()).filter(Boolean).slice(0, 2)
    : [];
  const statusText = String(data.statusText ?? "").trim();
  const costText = data.costText != null && data.costText !== "" ? String(data.costText) : "";
  const starText = data.starText != null && data.starText !== "" ? String(data.starText) : "";
  const atkText = data.atkText != null && data.atkText !== "" ? String(data.atkText) : "";
  const hpText = data.hpText != null && data.hpText !== "" ? String(data.hpText) : "";
  const iconText = data.iconText != null && data.iconText !== "" ? String(data.iconText) : "";
  const showMetaBadges = false;
  const showStatBadges = false;
  const hasPortrait = ensurePortraitSprite(card, data.portraitKey ?? null);
  const showBottomText = bottomIcons.length === 0 && Boolean(bottomText);
  const showTitle = Boolean(titleText);

  card.titleText?.setText?.(titleText);
  card.titleText?.setColor?.(data.titleColor ?? "#fff5df");
  setVisible(card.titleText ?? null, showTitle);
  card.typeText?.setText?.(bottomText);
  card.typeText?.setColor?.(data.bottomColor ?? "#d9c7a0");
  setVisible(card.typeText ?? null, showBottomText);
  setManyVisible([card.tribeChip, card.tribeIconText, card.classChip, card.classIconText], false);
  if (bottomIcons.length > 0) {
    const iconXs = bottomIcons.length === 1
      ? [card.traitCenterX]
      : [card.traitCenterX - card.traitChipGap * 0.5, card.traitCenterX + card.traitChipGap * 0.5];
    const iconEntries = [
      { chip: card.tribeChip, label: card.tribeIconText, icon: bottomIcons[0] ?? "", x: iconXs[0] },
      { chip: card.classChip, label: card.classIconText, icon: bottomIcons[1] ?? "", x: iconXs[1] ?? iconXs[0] }
    ];
    iconEntries.forEach(({ chip, label, icon, x }) => {
      if (!icon) return;
      chip.setPosition?.(x, chip.y ?? 0);
      label.setPosition?.(x, label.y ?? 0);
      label.setText?.(icon);
      setManyVisible([chip, label], true);
    });
  }
  relayoutFooterContent(card, {
    titleVisible: showTitle,
    bottomTextVisible: showBottomText,
    bottomIconsVisible: bottomIcons.length > 0
  });
  card.statusText.setText?.(statusText);
  card.statusText.setColor?.(data.statusColor ?? "#fff3d2");
  setVisible(card.statusText, Boolean(statusText));

  const displayCostText = formatCostBadgeText(costText);
  const displayStarText = formatUpgradeBadgeText(starText);

  card.costText.setColor?.(data.costColor ?? COST_TEXT_COLOR);
  applyTextStroke(card.costText ?? null, "#101620", card.compact ? 1 : 2);
  card.costText.setOrigin?.(0, 0.5);
  card.costText.setPosition?.(card.metaLeftX, card.metaY);
  card.costText.setText?.(displayCostText);
  setVisible(card.costOrb, showMetaBadges && Boolean(displayCostText));
  setVisible(card.costText, Boolean(displayCostText));
  setVisible(card.costIconText, false);
  card.starText.setColor?.(data.starColor ?? STAR_TEXT_COLOR);
  applyTextStroke(card.starText, "#101620", card.compact ? 1 : 2);
  card.starText.setOrigin?.(1, 0.5);
  card.starText.setPosition?.(card.metaRightX, card.metaY);
  card.starText.setText?.(displayStarText);
  setVisible(card.starOrb, showMetaBadges && Boolean(displayStarText));
  setVisible(card.starText, Boolean(displayStarText));
  setVisible(card.starIconText, false);
  card.atkText.setColor?.(data.atkColor ?? ATK_TEXT_COLOR);
  applyTextStroke(card.atkText, STAT_TEXT_STROKE, card.compact ? 1 : 2);
  card.atkText.setText?.(atkText);
  card.atkText.setOrigin?.(0, 0.5);
  card.atkText.setPosition?.(card.plainAtkX, card.plainStatY);
  setVisible(card.atkBadge, showStatBadges && Boolean(atkText));
  setVisible(card.atkText, Boolean(atkText));
  card.hpText.setColor?.(data.hpColor ?? HP_TEXT_COLOR);
  applyTextStroke(card.hpText, STAT_TEXT_STROKE, card.compact ? 1 : 2);
  card.hpText.setText?.(hpText);
  card.hpText.setOrigin?.(1, 0.5);
  card.hpText.setPosition?.(card.plainHpX, card.plainStatY);
  setVisible(card.hpBadge, showStatBadges && Boolean(hpText));
  setVisible(card.hpText, Boolean(hpText));
  card.portraitText.setText?.(iconText);
  setVisible(card.portraitText, !hasPortrait && Boolean(iconText));
}
