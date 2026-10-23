import Phaser from "phaser";
import {
  getEndlessAchievementEntries,
  getEndlessAchievementSummary,
  getEndlessAchievementUiCopy
} from "../core/endlessAchievements.js";
import { getSkinByAchievementId } from "../data/unitSkins.js";
import { getLocale, t } from "../i18n/index.js";
import type { CollectionProfile } from "../core/collectionProfile.js";
import type { MenuButton } from "./MainMenuUIHelpers.js";

type AchievementEntry = {
  id: string;
  icon: string;
  title: string;
  description: string;
  categoryLabel: string;
  current: number;
  threshold: number;
  unlocked: boolean;
  progressRatio: number;
};

type AchievementUiCopy = {
  title: string;
  subtitle: string;
  claim: string;
  claimed: string;
  unlocked: string;
  locked: string;
  rewardSection: string;
  rewardSkin: string;
  rewardLocked: string;
  close: string;
  summaryUnlocked: string;
  summaryBestRound: string;
  summaryRoundsWon: string;
  summaryHighestLevel: string;
};

type RewardSkin = {
  getAppearance?: ((star: number, locale?: string) => RewardAppearance | null) | null;
  previewIcon?: string;
  nameEn?: string;
  nameVi?: string;
  skinKey?: string;
};

type RewardAppearance = {
  previewIcon?: string;
  displayNameEn?: string;
  displayNameVi?: string;
};

type EndlessStats = {
  bestRound: number;
  roundsWon: number;
  highestLevel: number;
};

type EndlessProfileLike = {
  stats: EndlessStats;
};

type AchievementsScrollGroup = {
  wheelTarget: Phaser.GameObjects.Zone;
  scrollBy: (deltaY: number) => boolean;
  containsPoint: (pointerOrX: unknown, maybeY?: unknown) => boolean;
};

type AchievementsPanelHost = Phaser.Scene & {
  endlessAchievementProfile: unknown;
  collectionProfile: CollectionProfile | null;
  createButton: (
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    onClick: () => void,
    fill: number,
    stroke: number,
    parent?: Phaser.GameObjects.Container | null
  ) => MenuButton;
  claimAchievementReward(achievementId: string): boolean;
  toggleAchievementsPanel(force?: boolean | null): void;
  achievementPanel: Phaser.GameObjects.Container | null;
  achievementCloseButton: MenuButton | null;
  achievementScrollGroup: AchievementsScrollGroup | null;
};

function createSummaryCard(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  value: string | number,
  accent: number
): Phaser.GameObjects.Container {
  const card = scene.add.container(x, y);
  const bg = scene.add.rectangle(0, 0, width, height, 0x10263a, 0.96).setOrigin(0, 0);
  bg.setStrokeStyle(1, accent, 0.9);
  const accentBar = scene.add.rectangle(0, 0, 6, height, accent, 0.95).setOrigin(0, 0);
  const title = scene.add.text(18, 12, label, {
    fontFamily: "Consolas",
    fontSize: "13px",
    color: "#9ecaf2"
  }).setOrigin(0, 0);
  const stat = scene.add.text(18, 32, String(value), {
    fontFamily: "Trebuchet MS",
    fontSize: "28px",
    color: "#f6fbff",
    fontStyle: "bold"
  }).setOrigin(0, 0);
  card.add([bg, accentBar, title, stat]);
  return card;
}

function createAchievementCard(
  scene: AchievementsPanelHost,
  entry: AchievementEntry,
  copy: AchievementUiCopy,
  x: number,
  y: number,
  width: number,
  height: number
): Phaser.GameObjects.Container {
  const unlocked = entry.unlocked;
  const rewardSkin = getSkinByAchievementId(entry.id) as RewardSkin | null;
  const locale = getLocale();
  const rewardAppearance = typeof rewardSkin?.getAppearance === "function"
    ? rewardSkin.getAppearance(1, locale)
    : null;
  const claimed = scene.collectionProfile?.claimedAchievementIds?.includes(entry.id) === true;
  const fill = unlocked ? 0x16354f : 0x111f2c;
  const edge = unlocked ? 0x8de8ff : 0x455c73;
  const progressColor = unlocked ? 0x7ceec4 : 0x5d85b5;
  const card = scene.add.container(x, y);

  const bg = scene.add.rectangle(0, 0, width, height, fill, unlocked ? 0.98 : 0.92).setOrigin(0, 0);
  bg.setStrokeStyle(1, edge, unlocked ? 0.95 : 0.6);
  const accent = scene.add.rectangle(0, 0, 6, height, unlocked ? 0x7ceec4 : 0x5d85b5, 0.92).setOrigin(0, 0);
  const title = scene.add.text(16, 10, `${entry.icon} ${entry.title}`, {
    fontFamily: "Consolas",
    fontSize: "18px",
    color: unlocked ? "#ffffff" : "#d8e4f0",
    fontStyle: "bold"
  }).setOrigin(0, 0);
  const category = scene.add.text(width - 16, 12, entry.categoryLabel, {
    fontFamily: "Consolas",
    fontSize: "11px",
    color: "#8fc7ff"
  }).setOrigin(1, 0);
  const description = scene.add.text(16, 36, entry.description, {
    fontFamily: "Consolas",
    fontSize: "12px",
    color: unlocked ? "#cfe8ff" : "#8fa5bc",
    wordWrap: { width: width - 188 }
  }).setOrigin(0, 0);
  const badge = scene.add.text(width - 16, 42, claimed ? copy.claimed : unlocked ? copy.unlocked : copy.locked, {
    fontFamily: "Consolas",
    fontSize: "12px",
    color: claimed ? "#ffd58e" : unlocked ? "#89ffd3" : "#8ea0b2"
  }).setOrigin(1, 0);
  const rewardLabel = locale === "en"
    ? rewardAppearance?.displayNameEn ?? rewardSkin?.nameEn ?? rewardSkin?.nameVi ?? rewardSkin?.skinKey
    : rewardAppearance?.displayNameVi ?? rewardSkin?.nameVi ?? rewardSkin?.nameEn ?? rewardSkin?.skinKey;
  const rewardSection = scene.add.text(16, 70, `🎁 ${copy.rewardSection}`, {
    fontFamily: "Consolas",
    fontSize: "11px",
    color: unlocked ? "#ffd580" : "#8ea0b2",
    fontStyle: "bold"
  }).setOrigin(0, 0);
  const rewardText = scene.add.text(16, 86, rewardSkin
    ? `${rewardAppearance?.previewIcon ?? rewardSkin.previewIcon ?? "🎀"} ${copy.rewardSkin}: ${rewardLabel}`
    : copy.rewardLocked, {
    fontFamily: "Consolas",
    fontSize: "11px",
    color: rewardSkin ? (unlocked ? "#ffd8f0" : "#8ea0b2") : "#8ea0b2",
    wordWrap: { width: width - 176 }
  }).setOrigin(0, 0);

  const trackWidth = width - 144;
  const track = scene.add.rectangle(16, height - 16, trackWidth, 8, 0x0a1520, 0.95).setOrigin(0, 0.5);
  track.setStrokeStyle(1, 0x28445f, 0.75);
  const fillWidth = entry.progressRatio > 0 ? Math.max(8, Math.round(trackWidth * entry.progressRatio)) : 0;
  const fillBar = scene.add.rectangle(16, height - 16, fillWidth, 8, progressColor, 1).setOrigin(0, 0.5);
  const progressText = scene.add.text(width - 16, height - 28, `${entry.current}/${entry.threshold}`, {
    fontFamily: "Consolas",
    fontSize: "13px",
    color: "#f4fbff"
  }).setOrigin(1, 0);

  card.add([bg, accent, title, category, description, badge, rewardSection, rewardText, track, fillBar, progressText]);
  if (rewardSkin && unlocked && !claimed) {
    scene.createButton(
      width - 74,
      88,
      88,
      28,
      copy.claim,
      () => scene.claimAchievementReward(entry.id),
      0x2c6a56,
      0x8ff0c0,
      card
    );
  }
  return card;
}

type SortableEntry = {
  entry: AchievementEntry;
  rank: number;
  progressRatio: number;
  index: number;
};

export function sortAchievementEntries(
  entries: AchievementEntry[],
  collectionProfile: CollectionProfile | null
): AchievementEntry[] {
  const claimedAchievementIds = new Set(collectionProfile?.claimedAchievementIds ?? []);
  const sortable: SortableEntry[] = entries
    .map((entry, index) => {
      const rewardSkin = getSkinByAchievementId(entry.id) as RewardSkin | null;
      const claimable = Boolean(rewardSkin && entry.unlocked && !claimedAchievementIds.has(entry.id));
      const nearComplete = !claimable && entry.unlocked !== true;
      const rank = claimable ? 0 : nearComplete ? 1 : 2;
      return {
        entry,
        rank,
        progressRatio: entry.progressRatio ?? 0,
        index
      };
    })
    .sort((a, b) => a.rank - b.rank || b.progressRatio - a.progressRatio || a.index - b.index);
  return sortable.map(({ entry }) => entry);
}

type SummaryShape = {
  total: number;
  unlocked: number;
  profile: EndlessProfileLike;
};

export function createMainMenuAchievementsPanel(scene: AchievementsPanelHost): Phaser.GameObjects.Container {
  const profile = scene.endlessAchievementProfile;
  const copy = getEndlessAchievementUiCopy() as unknown as AchievementUiCopy;
  const summary = getEndlessAchievementSummary(profile) as unknown as SummaryShape;
  const entries = sortAchievementEntries(
    getEndlessAchievementEntries(profile) as unknown as AchievementEntry[],
    scene.collectionProfile
  );
  const width = Math.min(scene.scale.width - 40, 1040);
  const height = Math.min(scene.scale.height - 44, 700);
  const panel = scene.add.container(scene.scale.width * 0.5, scene.scale.height * 0.5);
  panel.setDepth(120);
  panel.setVisible(false);

  const bg = scene.add.rectangle(0, 0, width, height, 0x0d1723, 0.97).setOrigin(0.5);
  bg.setStrokeStyle(2, 0x8bc8ff, 0.95);
  const topAccent = scene.add.rectangle(-width * 0.5, -height * 0.5, width, 8, 0x7ceec4, 0.95).setOrigin(0, 0);
  const title = scene.add.text(-width * 0.5 + 24, -height * 0.5 + 22, copy.title, {
    fontFamily: "Trebuchet MS",
    fontSize: "30px",
    color: "#ffeab0",
    fontStyle: "bold"
  }).setOrigin(0, 0);
  const subtitle = scene.add.text(-width * 0.5 + 24, -height * 0.5 + 58, copy.subtitle, {
    fontFamily: "Consolas",
    fontSize: "13px",
    color: "#b9d4ec",
    wordWrap: { width: width - 220 }
  }).setOrigin(0, 0);

  const summaryTop = -height * 0.5 + 110;
  const summaryGap = 14;
  const summaryWidth = Math.floor((width - 24 * 2 - summaryGap * 3) / 4);
  const summaryHeight = 72;
  const summaryLeft = -width * 0.5 + 24;
  const summaryCards = [
    createSummaryCard(scene, summaryLeft, summaryTop, summaryWidth, summaryHeight, copy.summaryUnlocked, `${summary.unlocked}/${summary.total}`, 0x7ceec4),
    createSummaryCard(scene, summaryLeft + (summaryWidth + summaryGap), summaryTop, summaryWidth, summaryHeight, copy.summaryBestRound, summary.profile.stats.bestRound, 0x8bc8ff),
    createSummaryCard(scene, summaryLeft + (summaryWidth + summaryGap) * 2, summaryTop, summaryWidth, summaryHeight, copy.summaryRoundsWon, summary.profile.stats.roundsWon, 0xffd07a),
    createSummaryCard(scene, summaryLeft + (summaryWidth + summaryGap) * 3, summaryTop, summaryWidth, summaryHeight, copy.summaryHighestLevel, summary.profile.stats.highestLevel, 0xff98b0)
  ];

  const viewportPaddingX = 24;
  const viewportTop = -height * 0.5 + 202;
  const viewportWidth = width - viewportPaddingX * 2;
  const viewportHeight = height - 250;
  const viewportBounds = new Phaser.Geom.Rectangle(
    scene.scale.width * 0.5 - viewportWidth * 0.5,
    scene.scale.height * 0.5 + viewportTop,
    viewportWidth,
    viewportHeight
  );
  const viewportFrame = scene.add.rectangle(0, viewportTop + viewportHeight * 0.5, viewportWidth, viewportHeight, 0x132334, 0.38).setOrigin(0.5);
  viewportFrame.setStrokeStyle(1, 0x36536f, 0.75);
  const viewportZone = scene.add.zone(0, viewportTop + viewportHeight * 0.5, viewportWidth, viewportHeight);
  const rowsContainer = scene.add.container(-viewportWidth * 0.5, viewportTop);

  const maskGfx = scene.make.graphics({} as object) as {
    fillStyle(color: number, alpha?: number): void;
    fillRect(x: number, y: number, w: number, h: number): void;
  };
  maskGfx.fillStyle(0xffffff);
  maskGfx.fillRect(viewportBounds.x, viewportBounds.y, viewportBounds.width, viewportBounds.height);
  rowsContainer.enableFilters();
  (rowsContainer.filters as { external: { addMask: (g: unknown) => unknown } }).external.addMask(maskGfx);

  const columns = 2;
  const cardGapX = 16;
  const cardGapY = 12;
  const cardWidth = Math.floor((viewportWidth - cardGapX) / columns);
  const cardHeight = 132;
  entries.forEach((entry, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const cardX = col * (cardWidth + cardGapX);
    const cardY = row * (cardHeight + cardGapY);
    rowsContainer.add(createAchievementCard(scene, entry, copy, cardX, cardY, cardWidth, cardHeight));
  });

  let scrollOffset = 0;
  const rows = Math.ceil(entries.length / columns);
  const contentHeight = rows * cardHeight + Math.max(0, rows - 1) * cardGapY;
  const maxOffset = Math.max(0, contentHeight - viewportHeight);
  const scrollHint = scene.add.text(width * 0.5 - 24, height * 0.5 - 34, "", {
    fontFamily: "Consolas",
    fontSize: "11px",
    color: "#8fb9df"
  }).setOrigin(1, 0);

  const updateViewport = (): void => {
    rowsContainer.y = viewportTop - scrollOffset;
    if (maxOffset > 0) {
      scrollHint.setText(scrollOffset >= maxOffset - 1 ? t("menu.scrollUpHint") : t("menu.scrollMoreHint"));
      scrollHint.setVisible(true);
    } else {
      scrollHint.setVisible(false);
    }
  };

  const scrollBy = (deltaY: number): boolean => {
    if (maxOffset <= 0) return false;
    const step = Math.min(Math.abs(deltaY), 180);
    const nextOffset = Phaser.Math.Clamp(scrollOffset + Math.sign(deltaY) * step, 0, maxOffset);
    if (nextOffset === scrollOffset) return false;
    scrollOffset = nextOffset;
    updateViewport();
    return true;
  };

  const containsPoint = (pointerOrX: unknown, maybeY: unknown = null): boolean => {
    const worldX = typeof pointerOrX === "object" ? (pointerOrX as { worldX?: number; x?: number })?.worldX ?? (pointerOrX as { x?: number })?.x : pointerOrX;
    const worldY = typeof pointerOrX === "object" ? (pointerOrX as { worldY?: number; y?: number })?.worldY ?? (pointerOrX as { y?: number })?.y : maybeY;
    return Number.isFinite(worldX as number) && Number.isFinite(worldY as number) && Phaser.Geom.Rectangle.Contains(viewportBounds, worldX as number, worldY as number);
  };

  updateViewport();
  panel.add([
    bg,
    topAccent,
    title,
    subtitle,
    viewportFrame,
    rowsContainer,
    viewportZone,
    scrollHint,
    ...summaryCards
  ]);

  const closeBtn = scene.createButton(
    width * 0.5 - 112,
    -height * 0.5 + 34,
    168,
    42,
    copy.close,
    () => scene.toggleAchievementsPanel(false),
    0x294662,
    0x93ccff,
    panel
  );

  scene.achievementPanel = panel;
  scene.achievementCloseButton = closeBtn;
  scene.achievementScrollGroup = { wheelTarget: viewportZone, scrollBy, containsPoint };
  return panel;
}
