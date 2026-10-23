import { t } from "../../i18n/index.js";
import { UI_FONT } from "../../core/uiTheme.js";
import { scaleFontPx, scaleUiSize } from "../../core/uiResponsive.js";

const GROUP_POWER_BONUS: Record<string, number> = {
  ECONOMY: 2,
  FORMATION: 5,
  COMBAT: 4,
  SYNERGY: 8
};

const AUGMENT_POWER_THRESHOLDS = {
  tactical: 0,
  strong: 62,
  rare: 82
} as const;

interface AugmentPowerRule {
  baseScore: number;
  valueUnit: number;
  valueWeight: number;
  maxBonus: number;
  useAbs?: boolean;
}

const AUGMENT_POWER_RULES: Record<string, AugmentPowerRule> = {
  gold_flat: { baseScore: 43, valueUnit: 1, valueWeight: 2.3, maxBonus: 18 },
  interest_cap: { baseScore: 66, valueUnit: 1, valueWeight: 12, maxBonus: 18 },
  roll_cost_delta: { baseScore: 60, valueUnit: 1, valueWeight: 10, maxBonus: 14, useAbs: true },
  deploy_cap_bonus: { baseScore: 74, valueUnit: 1, valueWeight: 11, maxBonus: 14 },
  bench_bonus: { baseScore: 56, valueUnit: 1, valueWeight: 6, maxBonus: 12 },
  inventory_bonus: { baseScore: 44, valueUnit: 1, valueWeight: 7, maxBonus: 10 },
  starting_rage: { baseScore: 63, valueUnit: 1, valueWeight: 10, maxBonus: 14 },
  team_atk_pct: { baseScore: 52, valueUnit: 0.01, valueWeight: 1.2, maxBonus: 16 },
  team_hp_pct: { baseScore: 52, valueUnit: 0.01, valueWeight: 1.15, maxBonus: 16 },
  team_matk_pct: { baseScore: 54, valueUnit: 0.01, valueWeight: 1.2, maxBonus: 18 },
  team_def_pct: { baseScore: 51, valueUnit: 0.01, valueWeight: 1.1, maxBonus: 15 },
  team_mdef_pct: { baseScore: 51, valueUnit: 0.01, valueWeight: 1.1, maxBonus: 15 },
  starting_shield: { baseScore: 54, valueUnit: 5, valueWeight: 1.5, maxBonus: 16 },
  extra_class_count: { baseScore: 79, valueUnit: 1, valueWeight: 7, maxBonus: 10 },
  extra_tribe_count: { baseScore: 79, valueUnit: 1, valueWeight: 7, maxBonus: 10 },
  lifesteal_pct: { baseScore: 58, valueUnit: 0.01, valueWeight: 1.15, maxBonus: 14 },
  xp_flat: { baseScore: 47, valueUnit: 1, valueWeight: 1.25, maxBonus: 16 },
  win_gold_bonus: { baseScore: 56, valueUnit: 1, valueWeight: 7, maxBonus: 16 },
  interest_rate_bonus: { baseScore: 72, valueUnit: 0.01, valueWeight: 6, maxBonus: 12 },
  xp_cost_delta: { baseScore: 72, valueUnit: 1, valueWeight: 10, maxBonus: 12, useAbs: true },
  rage_gain_pct: { baseScore: 56, valueUnit: 0.01, valueWeight: 1.15, maxBonus: 16 }
};

interface AugmentSceneLike extends Phaser.Scene {
  scale: Phaser.Scale.ScaleManager;
  add: Phaser.GameObjects.GameObjectFactory;
  tweens: Phaser.Tweens.TweenManager;
  tooltip?: { attach: (target: unknown, getter: () => unknown) => void; hide?: () => void };
  overlaySprites: Phaser.GameObjects.GameObject[];
  currentAugmentChoices: unknown;
  [key: string]: unknown;
}

interface GroupTheme {
  accent: number;
  fill: number;
  edge: number;
  badge: number;
  glow: number;
}

const GROUP_THEMES: Record<string, GroupTheme> = {
  ECONOMY: { accent: 0xf4cd6b, fill: 0x2e2612, edge: 0xe8c05a, badge: 0x5d4818, glow: 0xffdc7b },
  COMBAT: { accent: 0xff7d6e, fill: 0x351917, edge: 0xf1796e, badge: 0x613028, glow: 0xff9286 },
  FORMATION: { accent: 0x83d6ff, fill: 0x162735, edge: 0x72c4f0, badge: 0x214662, glow: 0x98e0ff },
  SYNERGY: { accent: 0x8bf0b5, fill: 0x173023, edge: 0x7fdba5, badge: 0x244d38, glow: 0x9effc2 }
};

const DEFAULT_GROUP_THEME: GroupTheme = { accent: 0xcfd9e8, fill: 0x1e2a39, edge: 0x9eb8d1, badge: 0x31465d, glow: 0xd8e6ff };

interface AugmentLike {
  effect?: { type?: string; value?: unknown; [key: string]: unknown };
  group?: string;
  description?: string;
  name?: string;
  [key: string]: unknown;
}

function createLabel(scene: AugmentSceneLike, x: number, y: number, text: string, style: Record<string, unknown> | null | undefined, origin: [number, number] = [0, 0]): Phaser.GameObjects.Text {
  const nextStyle: Record<string, unknown> = { ...(style ?? {}) };
  if (nextStyle.fontSize != null) {
    const role = nextStyle.fontStyle === "bold" ? "label" : "body";
    nextStyle.fontSize = scaleFontPx(scene, nextStyle.fontSize as number | string, role);
  }
  const label = scene.add.text(x, y, text, {
    fontFamily: UI_FONT,
    ...nextStyle
  }) as Phaser.GameObjects.Text;
  label.setOrigin(origin[0], origin[1]);
  return label;
}

function formatEffectSummary(augment: AugmentLike): string {
  const effect = augment?.effect ?? {};
  const value = effect.value as number | string | undefined;
  switch (effect.type) {
    case "gold_flat":
      return `+${value} vàng ngay lập tức`;
    case "interest_cap":
      return `+${value} trần lãi`;
    case "roll_cost_delta":
      return `${value} vàng đổi shop`;
    case "deploy_cap_bonus":
      return `+${value} giới hạn triển khai`;
    case "bench_bonus":
      return `+${value} ô dự bị`;
    case "starting_rage":
      return `+${value} nộ đầu giao tranh`;
    case "team_atk_pct":
      return `+${Math.round((value as number ?? 0) * 100)}% công vật lý`;
    case "team_hp_pct":
      return `+${Math.round((value as number ?? 0) * 100)}% máu`;
    case "starting_shield":
      return `+${value} khiên đầu giao tranh`;
    case "team_matk_pct":
      return `+${Math.round((value as number ?? 0) * 100)}% công phép`;
    case "extra_class_count":
      return `+${value} mốc cộng hưởng nghề`;
    case "extra_tribe_count":
      return `+${value} mốc cộng hưởng tộc`;
    case "lifesteal_pct":
      return `+${Math.round((value as number ?? 0) * 100)}% hút máu`;
    case "xp_flat":
      return `+${value} XP ngay`;
    case "win_gold_bonus":
      return `+${value} vàng mỗi vòng thắng`;
    case "interest_rate_bonus":
      return `+${Math.round((value as number ?? 0) * 100)}% lãi suất`;
    case "team_def_pct":
      return `+${Math.round((value as number ?? 0) * 100)}% giáp`;
    case "team_mdef_pct":
      return `+${Math.round((value as number ?? 0) * 100)}% kháng phép`;
    case "rage_gain_pct":
      return `+${Math.round((value as number ?? 0) * 100)}% tốc độ hồi nộ`;
    case "inventory_bonus":
      return `+${value} ô túi đồ`;
    case "xp_cost_delta":
      return `${value} vàng mua XP`;
    default:
      return augment?.description ?? t("augment.effectUnknown");
  }
}

function getGroupTheme(group: string | null | undefined): GroupTheme {
  const key = String(group ?? "").toUpperCase();
  return GROUP_THEMES[key] ?? DEFAULT_GROUP_THEME;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function scoreAugmentPower(augment: AugmentLike): number {
  const effect = augment?.effect ?? {};
  const type = String(effect.type ?? "");
  const value = Number(effect.value ?? 0) || 0;
  const rule = AUGMENT_POWER_RULES[type];
  const groupBonus = GROUP_POWER_BONUS[String(augment?.group ?? "").toUpperCase()] ?? 0;

  if (!rule) {
    return clampScore(50 + groupBonus);
  }

  const valueUnit = Math.abs(rule.valueUnit ?? 1) || 1;
  const scaledValue = (rule.useAbs ? Math.abs(value) : value) / valueUnit;
  const scaledBonus = Math.max(0, scaledValue * (rule.valueWeight ?? 0));
  const valueBonus = Math.min(rule.maxBonus ?? scaledBonus, scaledBonus);
  return clampScore((rule.baseScore ?? 50) + valueBonus + groupBonus);
}

export function getAugmentPowerTier(augment: AugmentLike): { key: "tactical" | "strong" | "rare"; score: number } {
  const score = scoreAugmentPower(augment);
  if (score >= AUGMENT_POWER_THRESHOLDS.rare) return { key: "rare", score };
  if (score >= AUGMENT_POWER_THRESHOLDS.strong) return { key: "strong", score };
  return { key: "tactical", score };
}

function getAugmentRibbon(augment: AugmentLike): { label: string; fill: number; edge: number; text: string } {
  const { key, score } = getAugmentPowerTier(augment);
  if (key === "rare") {
    return {
      label: `${t("augment.ribbonRare")} • ${score}`,
      fill: 0x7e5a15,
      edge: 0xffdc7f,
      text: "#fff3cb"
    };
  }

  if (key === "strong") {
    return {
      label: `${t("augment.ribbonStrong")} • ${score}`,
      fill: 0x5b1f20,
      edge: 0xff9e95,
      text: "#ffe2de"
    };
  }

  return {
    label: `${t("augment.ribbonTactical")} • ${score}`,
    fill: 0x17354d,
    edge: 0x9ad9ff,
    text: "#e2f6ff"
  };
}

interface OverlayTargets {
  shade: Phaser.GameObjects.Rectangle;
  glow: Phaser.GameObjects.Rectangle;
  panel: Phaser.GameObjects.Rectangle;
  headerBand: Phaser.GameObjects.Rectangle;
  title: Phaser.GameObjects.Text;
  subtitle: Phaser.GameObjects.Text;
  hint: Phaser.GameObjects.Text;
  cards: CardEntry[];
}

interface CardEntry {
  container: Phaser.GameObjects.Container;
  baseY: number;
  theme: GroupTheme;
  glowRect: Phaser.GameObjects.Rectangle;
  card: Phaser.GameObjects.Rectangle;
  ribbonBg: Phaser.GameObjects.Rectangle;
  iconBubble: Phaser.GameObjects.Arc;
  ctaBg: Phaser.GameObjects.Rectangle;
  ctaText: Phaser.GameObjects.Text;
}

function tweenOverlayOpen(scene: AugmentSceneLike, targets: OverlayTargets): void {
  const {
    shade,
    glow,
    panel,
    headerBand,
    title,
    subtitle,
    hint,
    cards
  } = targets;

  shade.setAlpha(0);
  glow.setAlpha(0);
  glow.setScale(0.96);
  panel.setAlpha(0);
  panel.setScale(0.97);
  headerBand.setAlpha(0);
  headerBand.setY(headerBand.y - 14);
  title.setAlpha(0);
  title.setY(title.y - 12);
  subtitle.setAlpha(0);
  subtitle.setY(subtitle.y - 10);
  hint.setAlpha(0);
  hint.setY(hint.y + 12);
  cards.forEach((entry, idx) => {
    entry.container.setAlpha(0);
    entry.container.setScale(0.96);
    entry.container.setY(entry.baseY + 26 + idx * 2);
  });

  scene.tweens.add({ targets: shade, alpha: 1, duration: 180, ease: "Quad.easeOut" });
  scene.tweens.add({
    targets: [glow, panel],
    alpha: 1,
    scaleX: 1,
    scaleY: 1,
    duration: 240,
    ease: "Back.easeOut"
  });
  scene.tweens.add({
    targets: headerBand,
    alpha: 1,
    y: headerBand.y + 14,
    duration: 220,
    ease: "Sine.easeOut"
  });
  scene.tweens.add({
    targets: [title, subtitle],
    alpha: 1,
    y: "+=12",
    duration: 220,
    ease: "Sine.easeOut"
  });
  scene.tweens.add({
    targets: hint,
    alpha: 1,
    y: hint.y - 12,
    duration: 220,
    delay: 90,
    ease: "Sine.easeOut"
  });
  cards.forEach((entry, idx) => {
    scene.tweens.add({
      targets: entry.container,
      alpha: 1,
      y: entry.baseY,
      scaleX: 1,
      scaleY: 1,
      duration: 280,
      delay: 110 + idx * 60,
      ease: "Back.easeOut"
    });
  });
}

function setCardFocused(scene: AugmentSceneLike, entry: CardEntry, focused: boolean): void {
  const {
    container,
    baseY,
    theme,
    glowRect,
    card,
    ribbonBg,
    iconBubble,
    ctaBg,
    ctaText
  } = entry;

  scene.tweens.killTweensOf([container, glowRect, iconBubble, ctaBg, ribbonBg]);
  if (focused) {
    card.setFillStyle(theme.badge, 0.94);
    card.setStrokeStyle(3, theme.accent, 1);
    ctaText.setColor("#102018");
    scene.tweens.add({
      targets: container,
      y: baseY - 7,
      duration: 150,
      ease: "Quad.easeOut"
    });
    scene.tweens.add({
      targets: glowRect,
      alpha: 0.42,
      scaleX: 1.05,
      scaleY: 1.03,
      duration: 150,
      ease: "Quad.easeOut"
    });
    scene.tweens.add({
      targets: [iconBubble, ctaBg, ribbonBg],
      scaleX: 1.03,
      scaleY: 1.03,
      duration: 150,
      ease: "Quad.easeOut"
    });
    scene.tweens.add({
      targets: ctaBg,
      fillAlpha: 1,
      duration: 150,
      ease: "Quad.easeOut"
    });
  } else {
    card.setFillStyle(theme.fill, 0.98);
    card.setStrokeStyle(2, theme.edge, 0.92);
    ctaText.setColor("#f8fffb");
    scene.tweens.add({
      targets: container,
      y: baseY,
      duration: 150,
      ease: "Quad.easeOut"
    });
    scene.tweens.add({
      targets: glowRect,
      alpha: 0.16,
      scaleX: 1,
      scaleY: 1,
      duration: 150,
      ease: "Quad.easeOut"
    });
    scene.tweens.add({
      targets: [iconBubble, ctaBg, ribbonBg],
      scaleX: 1,
      scaleY: 1,
      duration: 150,
      ease: "Quad.easeOut"
    });
    scene.tweens.add({
      targets: ctaBg,
      fillAlpha: 0.94,
      duration: 150,
      ease: "Quad.easeOut"
    });
  }
}

export function clearSharedAugmentChoiceModal(scene: AugmentSceneLike): void {
  scene.overlaySprites?.forEach((node: Phaser.GameObjects.GameObject) => (node as { destroy?: () => void })?.destroy?.());
  scene.overlaySprites = [];
  scene.currentAugmentChoices = null;
}

interface ShowAugmentModalOptions {
  choices: AugmentLike[];
  onChoose: (choice: AugmentLike) => void;
  getAugmentIcon: (choice: AugmentLike) => string;
  translateAugmentGroup: (group: string) => string;
  getAugmentTooltip: (choice: AugmentLike) => unknown;
}

export function showSharedAugmentChoiceModal(scene: AugmentSceneLike, options: ShowAugmentModalOptions): void {
  const {
    choices,
    onChoose,
    getAugmentIcon,
    translateAugmentGroup,
    getAugmentTooltip
  } = options;

  clearSharedAugmentChoiceModal(scene);
  scene.currentAugmentChoices = choices;

  const w = scene.scale.width;
  const h = scene.scale.height;
  const cx = Math.floor(w * 0.5);
  const cy = Math.floor(h * 0.5);
  const panelW = Math.min(scaleUiSize(scene, 1160, "control"), Math.floor(w * 0.92));
  const panelH = Math.min(scaleUiSize(scene, 520, "control"), Math.floor(h * 0.76));
  const x0 = cx - panelW / 2;
  const y0 = cy - panelH / 2;
  const depth = 3000;

  const shade = scene.add.rectangle(cx, cy, w, h, 0x04080d, 0.76) as Phaser.GameObjects.Rectangle;
  shade.setDepth(depth);
  shade.setInteractive();
  scene.overlaySprites.push(shade);

  const glow = scene.add.rectangle(cx, cy, panelW + 24, panelH + 24, 0x173425, 0.2) as Phaser.GameObjects.Rectangle;
  glow.setStrokeStyle(3, 0x78d6a4, 0.35);
  glow.setDepth(depth + 1);
  scene.overlaySprites.push(glow);

  const panel = scene.add.rectangle(cx, cy, panelW, panelH, 0x0e1a24, 0.98) as Phaser.GameObjects.Rectangle;
  panel.setStrokeStyle(2, 0x7edfb1, 0.9);
  panel.setDepth(depth + 2);
  scene.overlaySprites.push(panel);

  const headerBand = scene.add.rectangle(cx, y0 + 42, panelW - 24, 58, 0x173223, 0.96) as Phaser.GameObjects.Rectangle;
  headerBand.setStrokeStyle(1, 0x88e4b5, 0.42);
  headerBand.setDepth(depth + 3);
  scene.overlaySprites.push(headerBand);

  const title = createLabel(scene, cx, y0 + 26, t("augment.blessingTitle"), {
    fontSize: "30px",
    color: "#d9ffe9",
    fontStyle: "bold"
  }, [0.5, 0]);
  title.setDepth(depth + 4);
  const subtitle = createLabel(scene, cx, y0 + 58, t("augment.blessingSubtitle"), {
    fontSize: "14px",
    color: "#9fd9ba"
  }, [0.5, 0]);
  subtitle.setDepth(depth + 4);
  scene.overlaySprites.push(title, subtitle);

  const hint = createLabel(scene, cx, y0 + panelH - 28, t("augment.blessingHint"), {
    fontSize: "13px",
    color: "#86a9bf"
  }, [0.5, 0.5]);
  hint.setDepth(depth + 4);
  scene.overlaySprites.push(hint);

  const cardGap = 18;
  const cardW = Math.floor((panelW - 52 - cardGap * 2) / 3);
  const cardH = panelH - 144;
  const startX = x0 + 26;
  const cardY = y0 + 92;
  const cardEntries: CardEntry[] = [];

  choices.forEach((choice, idx) => {
    const theme = getGroupTheme(choice.group);
    const ribbon = getAugmentRibbon(choice);
    const cardX = startX + idx * (cardW + cardGap);
    const cardCx = cardX + cardW / 2;
    const cardCy = cardY + cardH / 2;
    const icon = getAugmentIcon(choice);
    const groupLabel = translateAugmentGroup(choice.group ?? "");
    const effectSummary = formatEffectSummary(choice);

    const container = scene.add.container(cardCx, cardCy) as Phaser.GameObjects.Container;
    container.setDepth(depth + 4);

    const glowRect = scene.add.rectangle(0, 0, cardW + 20, cardH + 20, theme.glow, 0.16) as Phaser.GameObjects.Rectangle;
    glowRect.setStrokeStyle(2, theme.accent, 0.38);

    const card = scene.add.rectangle(0, 0, cardW, cardH, theme.fill, 0.98) as Phaser.GameObjects.Rectangle;
    card.setStrokeStyle(2, theme.edge, 0.92);
    card.setInteractive({ useHandCursor: true });

    const accentStrip = scene.add.rectangle(0, -cardH / 2 + 22, cardW - 18, 26, theme.badge, 0.95) as Phaser.GameObjects.Rectangle;

    const ribbonBg = scene.add.rectangle(cardW / 2 - 54, -cardH / 2 + 22, 108, 22, ribbon.fill, 0.98) as Phaser.GameObjects.Rectangle;
    ribbonBg.setAngle(14);
    ribbonBg.setStrokeStyle(1, ribbon.edge, 0.95);
    const ribbonText = createLabel(scene, cardW / 2 - 54, -cardH / 2 + 22, ribbon.label, {
      fontSize: "11px",
      color: ribbon.text,
      fontStyle: "bold"
    }, [0.5, 0.5]);
    ribbonText.setAngle(14);

    const badge = createLabel(scene, -cardW / 2 + 18, -cardH / 2 + 14, `${t("augment.groupLabel")} ${groupLabel}`, {
      fontSize: "12px",
      color: "#f7f0d2",
      fontStyle: "bold"
    });
    const iconBubble = scene.add.circle(0, -cardH / 2 + 66, 24, theme.badge, 0.96) as Phaser.GameObjects.Arc;
    iconBubble.setStrokeStyle(2, theme.accent, 0.9);
    const iconText = createLabel(scene, 0, -cardH / 2 + 64, icon, {
      fontSize: "28px"
    }, [0.5, 0.5]);
    const nameText = createLabel(scene, 0, -cardH / 2 + 102, choice.name ?? "", {
      fontSize: "20px",
      color: "#f3fbff",
      fontStyle: "bold",
      align: "center",
      wordWrap: { width: cardW - 36, useAdvancedWrap: true }
    }, [0.5, 0]);
    const effectHeader = createLabel(scene, -cardW / 2 + 18, -cardH / 2 + 152, t("augment.effectSummaryLabel"), {
      fontSize: "12px",
      color: "#f7d98d",
      fontStyle: "bold"
    });
    const effectText = createLabel(scene, -cardW / 2 + 18, -cardH / 2 + 172, effectSummary, {
      fontSize: "15px",
      color: "#dff6ff",
      wordWrap: { width: cardW - 36, useAdvancedWrap: true },
      lineSpacing: 4
    });
    const descHeader = createLabel(scene, -cardW / 2 + 18, -cardH / 2 + 230, t("augment.descriptionLabel"), {
      fontSize: "12px",
      color: "#9bc8df",
      fontStyle: "bold"
    });
    const descText = createLabel(scene, -cardW / 2 + 18, -cardH / 2 + 250, choice.description ?? "", {
      fontSize: "14px",
      color: "#b8d1e5",
      wordWrap: { width: cardW - 36, useAdvancedWrap: true },
      lineSpacing: 5
    });
    const ctaBg = scene.add.rectangle(0, cardH / 2 - 28, cardW - 34, 34, theme.badge, 0.94) as Phaser.GameObjects.Rectangle;
    ctaBg.setStrokeStyle(1, theme.edge, 0.9);
    const ctaText = createLabel(scene, 0, cardH / 2 - 29, t("augment.pickNow"), {
      fontSize: "14px",
      color: "#f8fffb",
      fontStyle: "bold"
    }, [0.5, 0.5]);

    container.add([
      glowRect,
      card,
      accentStrip,
      ribbonBg,
      badge,
      ribbonText,
      iconBubble,
      iconText,
      nameText,
      effectHeader,
      effectText,
      descHeader,
      descText,
      ctaBg,
      ctaText
    ]);

    scene.overlaySprites.push(container);

    if (scene.tooltip && typeof getAugmentTooltip === "function") {
      scene.tooltip.attach(card, () => getAugmentTooltip(choice));
    }

    const entry: CardEntry = {
      container,
      baseY: cardCy,
      theme,
      glowRect,
      card,
      ribbonBg,
      iconBubble,
      ctaBg,
      ctaText
    };
    cardEntries.push(entry);

    card.on("pointerover", () => setCardFocused(scene, entry, true));
    card.on("pointerout", () => setCardFocused(scene, entry, false));
    card.on("pointerdown", () => onChoose(choice));
  });

  tweenOverlayOpen(scene, {
    shade,
    glow,
    panel,
    headerBand,
    title,
    subtitle,
    hint,
    cards: cardEntries
  });
}
