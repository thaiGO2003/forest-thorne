/**
 * LibraryModal - Renderer modules (Unit Detail + Odds Tab)
 * Extracted from LibraryModal.js to keep under 500 lines
 */

import { UNIT_BY_ID } from "../data/unitCatalog.js";
import { getResolvedSkillDefinition } from "../data/skills.js";
import { getSkinById, getUnitSkinDefs, getUnlockedUnitSkins } from "../data/unitSkins.js";
import { getUnitVisual } from "../data/unitVisuals.js";
import { getEndlessAchievementEntries } from "../core/endlessAchievements.js";
import { CLASS_SYNERGY, TRIBE_SYNERGY } from "../data/synergies.js";
import {
  buildTooltipViewModel
} from "../core/unitDescriptionHelper.js";
import { getTierPeakLevel } from "../core/gameUtils.js";
import { getTierOdds } from "../systems/ShopSystem.js";
import { buildUnitStatsLines, buildSynergyBonusTexts } from "../core/unitStatsFormatter.js";
import { hasTooltipHighlightMarkup, stripTooltipHighlightMarkup } from "../core/tooltipInlineMarkup.js";
import { getLocale, t } from "../i18n/index.js";
import { LibraryBattlePreview } from "./LibraryBattlePreview.js";
import { createUnitAvatar } from "./unitAvatarRenderer.js";
import {
  canUseBrowserSpeechSynthesis,
  resolveBrowserSpeechLang,
  speakWithBrowserVoice
} from "../core/browserSpeech.js";
import { EMOJI_FONT, UI_FONT } from "../core/uiTheme.js";
interface LibraryModalLike {
  scene: Phaser.Scene & { flashStatus?: (message: string) => void; player?: { level?: number } };
  layout: { viewportW: number; viewportH: number };
  detailPreviewStar: number;
  detailPreviewSkinId: string | null;
  detailUnitId: string | null;
  collectionProfile: unknown;
  achievementProfile: unknown;
  attackPreview: LibraryBattlePreview | null;
  skillPreview: LibraryBattlePreview | null;
  getEquippedSkinId: (unitId: string) => string | null;
  resolveDetailSkinPreviewId: (unitId: string) => string | null;
  buildSkinPreviewCollectionProfile: (unitId: string, skinId: string | null) => unknown;
  setEquippedSkin: (unitId: string, skinId: string | null) => boolean;
  refresh: () => void;
  scrollY: number;
  renderUnitsTab: (y: number) => number;
  createButton: (
    x: number, y: number, width: number, height: number, label: string, onClick: () => void,
    bgFill?: number, stroke?: number, parent?: Phaser.GameObjects.Container | null
  ) => { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text };
  contentContainer: Phaser.GameObjects.Container;
}

interface LibraryPreviewAvatarOptions {
  unit?: unknown;
  star?: number;
  appearance?: unknown;
  surface?: string;
  ownerKind?: string;
  collectionProfile?: unknown;
  accentColor?: number;
  fallbackIcon?: string;
  visual?: unknown;
  x?: number;
  y?: number;
  size?: number;
}

interface LibrarySkinRow {
  skinId: string;
  label: string;
  previewIcon: string;
  statusLabel: string;
  statusColor: string;
  unlocked: boolean;
  equipped: boolean;
  selected: boolean;
  isDefault: boolean;
}

interface LibraryRewardSkin {
  skinId: string;
  skinKey?: string;
  nameVi?: string;
  nameEn?: string;
  previewIcon?: string;
  getAppearance?: (star: number, locale?: string) => unknown;
  unlock?: { type?: string; achievementId?: string };
  sortOrder?: number;
}

interface LibrarySkillVoiceButtonOptions {
  x?: number;
  y?: number;
  label?: string;
  size?: number;
  container?: { add?: (items: unknown[]) => unknown } | Phaser.GameObjects.Container | null;
  fillColor?: number;
  hoverFillColor?: number;
  strokeColor?: number;
  textColor?: string;
}

interface LibrarySkinReviewPanelLayoutOptions {
  sectionLeft?: number;
  sectionWidth?: number;
  y?: number;
}

interface LibrarySkinReviewPanelLayout {
  panelX: number;
  panelY: number;
  panelWidth: number;
  panelHeight: number;
  cardTop: number;
  cardHeight: number;
  cards: Array<{ star: number; x: number; y: number; width: number; height: number }>;
}

interface LibrarySkinPreviewAvatarFrameLayoutOptions {
  previewX?: number;
  previewInset?: number;
  previewBodyTop?: number;
  previewBodyBottom?: number;
  avatarColumnWidth?: number;
  previewAvatarY?: number;
  previewAvatarSize?: number;
}
interface LibrarySkinReviewCardModelsOptions {
  modal?: LibraryModalLike | null;
  unit: { id: string; classType: string; name?: string; nameVi?: string; nameEn?: string };
  selectedSkin?: LibraryRewardSkin | null;
  selectedSkinId?: string | null;
  previewCollectionProfile?: unknown;
  previewStar?: number;
  locale?: string;
}

interface LibrarySkinReviewCard {
  star: number;
  skinId: string;
  active: boolean;
  previewIcon: string;
  displayName: string;
  visual: unknown;
  onSelect: () => void;
}

interface LibraryRewardSkinEntry {
  skin: LibraryRewardSkin;
  sortIndex: number;
  sortOrder: number;
  rank: number;
  claimable: boolean;
  nearComplete: boolean;
  progressRatio: number;
  achievementId: string | null;
  achievementEntry: { unlocked?: boolean; progressRatio?: number } | null;
}

interface LibraryUnitCatalogEntry {
  id: string;
  classType: string;
  tribe: string;
  tier: number;
  skillId: string;
  stats?: { range?: number };
  name?: string;
  nameVi?: string;
  nameEn?: string;
  descriptionVi?: string;
  descriptionEn?: string;
  description?: string;
}

interface LibraryTooltipVmLike {
  skill?: {
    detailByStar?: Record<number, string>;
    detailText?: string;
    summaryByStar?: Record<number, string>;
    summaryText?: string;
    lines?: string[];
  };
  passive?: { lines?: string[]; title?: string };
  attack: { lines: string[] };
}

interface LibrarySkillLike {
  detailTextVi?: string;
  detailTextEn?: string;
  detailText?: string;
  descriptionVi?: string;
  descriptionEn?: string;
  description?: string;
  nameVi?: string;
  nameEn?: string;
  name?: string;
  cost?: number;
  damageType?: string;
}

export function renderLibraryPreviewAvatar(
  modal: LibraryModalLike,
  {
    x,
    y,
    size,
    unit = null,
    visual,
    star = 1,
    appearance = null,
    surface = "library",
    ownerKind = "LIBRARY",
    collectionProfile = null,
    accentColor = 0xffeab0,
    fallbackIcon = "🎀"
  }: LibraryPreviewAvatarOptions = {}
) {
  const unitLike = unit as { id?: string; classType?: string; tribe?: string } | null;
  const visualLike = visual as { baseId?: string; icon?: string; previewIcon?: string } | null;
  return createUnitAvatar(modal.scene, {
    x: x as number,
    y: y as number,
    size: size as number,
    baseId: unitLike?.id ?? visualLike?.baseId ?? null,
    unitCore: unit,
    classType: unitLike?.classType ?? null,
    tribe: unitLike?.tribe ?? null,
    appearance,
    surface,
    ownerKind,
    collectionProfile,
    star,
    visual: visual as unknown as NonNullable<Parameters<typeof createUnitAvatar>[1]>["visual"],
    fallbackIcon
  });
}

function buildAchievementEntryById(profile: unknown) {
  return new Map(
    getEndlessAchievementEntries(profile).map((entry, index) => [
      entry.id,
      { ...entry, _sourceIndex: index }
    ])
  );
}

export function sanitizeLibraryPlainText(value: unknown): string {
  return stripTooltipHighlightMarkup(String(value ?? ""));
}

export function sanitizeLibraryPlainTextLines(lines: unknown): string[] {
  return Array.isArray(lines) ? lines.map((line) => sanitizeLibraryPlainText(line)) : [];
}

export function sanitizeLibrarySkillLines(lines: unknown): string[] {
  return Array.isArray(lines)
    ? lines.map((line) => {
      const rawLine = String(line ?? "");
      const plainLine = sanitizeLibraryPlainText(rawLine);
      return hasTooltipHighlightMarkup(rawLine) ? `▶ ${plainLine}` : plainLine;
    })
    : [];
}

export function resolveLibrarySkillDescriptionText(
  unit: LibraryUnitCatalogEntry | null | undefined,
  tooltipVm: LibraryTooltipVmLike | null | undefined,
  skill: LibrarySkillLike | null | undefined,
  previewStar: number | string,
  locale: string = getLocale()
): string {
  const currentStar = Math.max(1, Math.min(3, Number(previewStar) || 1));
  if (locale === "en") {
    return sanitizeLibraryPlainText(
      tooltipVm?.skill?.detailByStar?.[currentStar]
      ?? tooltipVm?.skill?.detailText
      ?? tooltipVm?.skill?.summaryByStar?.[currentStar]
      ?? tooltipVm?.skill?.summaryText
      ?? skill?.detailTextEn
      ?? skill?.descriptionEn
      ?? unit?.descriptionEn
      ?? t("combat.noDescription")
    );
  }
  return sanitizeLibraryPlainText(
    tooltipVm?.skill?.detailByStar?.[currentStar]
    ?? tooltipVm?.skill?.detailText
    ?? tooltipVm?.skill?.summaryByStar?.[currentStar]
    ?? tooltipVm?.skill?.summaryText
    ?? skill?.detailTextVi
    ?? skill?.detailText
    ?? skill?.descriptionVi
    ?? skill?.description
    ?? unit?.descriptionVi
    ?? unit?.description
    ?? t("combat.noDescription")
  );
}

export function createLibrarySkillVoiceButton(
  scene: Phaser.Scene,
  {
    x,
    y,
    label,
    size = 18,
    container = null,
    fillColor = 0x28465f,
    hoverFillColor = 0x345b79,
    strokeColor = 0x8ff0c0,
    textColor = "#f2fbff"
  }: LibrarySkillVoiceButtonOptions = {}
) {
  const speechLabel = sanitizeLibraryPlainText(label).trim();
  if (!speechLabel || !canUseBrowserSpeechSynthesis()) return null;

  const bg = scene.add.rectangle(x as number, y as number, size, size, fillColor, 0.96).setOrigin(0.5);
  bg.setStrokeStyle(1, strokeColor, 0.95);
  bg.setInteractive({ useHandCursor: true });
  bg.on("pointerover", () => bg.setFillStyle(hoverFillColor, 0.98));
  bg.on("pointerout", () => bg.setFillStyle(fillColor, 0.96));
  bg.on("pointerdown", () => {
    speakWithBrowserVoice(speechLabel, { lang: resolveBrowserSpeechLang(getLocale()) });
  });

  const icon = scene.add.text(x as number, y as number, "🔊", {
    fontFamily: `${EMOJI_FONT}, ${UI_FONT}`,
    fontSize: `${Math.max(11, size - 4)}px`,
    color: textColor,
    fontStyle: "bold"
  }).setOrigin(0.5);

  const c = container as { add?: (items: unknown[]) => void } | null;
  if (c?.add) {
    c.add([bg, icon]);
  }

  return { bg, icon, label: speechLabel };
}

export function buildSkinReviewPanelLayout({
  sectionLeft,
  sectionWidth,
  y
}: LibrarySkinReviewPanelLayoutOptions = {}): LibrarySkinReviewPanelLayout {
  const sectionLeftNum = sectionLeft as number;
  const sectionWidthNum = sectionWidth as number;
  const yNum = y as number;
  const panelPadding = 14;
  const cardGap = 12;
  const panelHeaderHeight = 66;
  const cardTop = yNum + panelHeaderHeight + 12;
  const cardHeight = 188;
  const panelHeight = cardTop - yNum + cardHeight + 14;
  const usableWidth = Math.max(0, sectionWidthNum - panelPadding * 2);
  const cardWidth = Math.max(120, Math.floor((usableWidth - cardGap * 2) / 3));
  const totalCardWidth = cardWidth * 3 + cardGap * 2;
  const cardStartX = sectionLeftNum + Math.max(0, Math.floor((sectionWidthNum - totalCardWidth) / 2));

  return {
    panelX: sectionLeftNum,
    panelY: yNum,
    panelWidth: sectionWidthNum,
    panelHeight,
    cardTop,
    cardHeight,
    cards: [0, 1, 2].map((index) => ({
      star: index + 1,
      x: cardStartX + index * (cardWidth + cardGap),
      y: cardTop,
      width: cardWidth,
      height: cardHeight
    }))
  };
}

export function buildSkinPreviewAvatarFrameLayout({
  previewX,
  previewInset,
  previewBodyTop,
  previewBodyBottom,
  avatarColumnWidth,
  previewAvatarY,
  previewAvatarSize
}: LibrarySkinPreviewAvatarFrameLayoutOptions = {}): { x: number; y: number; size: number } {
  const previewXNum = previewX as number;
  const previewInsetNum = previewInset as number;
  const previewBodyTopNum = previewBodyTop as number;
  const previewBodyBottomNum = previewBodyBottom as number;
  const avatarColumnWidthNum = avatarColumnWidth as number;
  const previewAvatarYNum = previewAvatarY as number;
  const previewAvatarSizeNum = previewAvatarSize as number;
  const availableHeight = Math.max(0, previewBodyBottomNum - previewBodyTopNum);
  const frameSize = Math.min(
    avatarColumnWidthNum,
    availableHeight,
    Math.max(Math.min(avatarColumnWidthNum, 120), previewAvatarSizeNum + 24)
  );

  return {
    x: previewXNum + previewInsetNum + avatarColumnWidthNum * 0.5,
    y: previewAvatarYNum + previewAvatarSizeNum * 0.5,
    size: frameSize
  };
}

export function buildSkinReviewCardModels({
  modal,
  unit,
  selectedSkin = null,
  selectedSkinId = null,
  previewCollectionProfile = null,
  previewStar = 1,
  locale = "vi"
}: LibrarySkinReviewCardModelsOptions = {} as LibrarySkinReviewCardModelsOptions): LibrarySkinReviewCard[] {
  const safePreviewStar = Math.max(1, Math.min(3, Number(previewStar) || 1));
  const skinLike = selectedSkin as { getAppearance?: (star: number, locale: string) => unknown } | null;
  return [1, 2, 3].map((star) => {
    const appearance = (skinLike && typeof skinLike.getAppearance === "function")
      ? skinLike.getAppearance(star, locale)
      : null;
    const visual = getUnitVisual(unit.id, unit.classType, star, {
      ownerKind: "LIBRARY",
      collectionProfile: previewCollectionProfile
    });
    const appearanceLike = appearance as { displayNameEn?: string; displayNameVi?: string; previewIcon?: string; icon?: string } | null;
    const visualLike = visual as { nameVi?: string; nameEn?: string; name?: string; icon?: string; previewIcon?: string } | null;
    const unitLike = unit as { name?: string; nameVi?: string; nameEn?: string; id: string };
    const displayName = locale === "en"
      ? (
          appearanceLike?.displayNameEn
          ?? appearanceLike?.displayNameVi
          ?? visualLike?.nameEn
          ?? visualLike?.name
          ?? unitLike?.nameEn
          ?? unitLike?.name
          ?? unitLike?.id
        )
      : (
          appearanceLike?.displayNameVi
          ?? appearanceLike?.displayNameEn
          ?? visualLike?.nameVi
          ?? visualLike?.name
          ?? unitLike?.name
          ?? unitLike?.nameEn
          ?? unitLike?.id
        );

    return {
      star,
      skinId: selectedSkinId ?? "",
      active: safePreviewStar === star,
      previewIcon: appearanceLike?.previewIcon ?? appearanceLike?.icon ?? visualLike?.previewIcon ?? visualLike?.icon ?? "🎀",
      displayName: sanitizeLibraryPlainText(displayName),
      visual,
      onSelect: () => {
        if (!modal) return;
        modal.detailPreviewStar = star;
        modal.refresh?.();
      }
    };
  });
}

export function sortRewardSkinsByPriority(skins: LibraryRewardSkin[], modal: LibraryModalLike): LibraryRewardSkinEntry[] {
  const achievementEntryById = buildAchievementEntryById(modal.achievementProfile);
  const collectionProfile = modal.collectionProfile as { claimedAchievementIds?: string[]; unlockedSkinIds?: string[] } | null;
  const claimedAchievementIds = new Set(collectionProfile?.claimedAchievementIds ?? []);
  return skins
    .map((skin, index): LibraryRewardSkinEntry => {
      const achievementId = skin?.unlock?.achievementId ?? null;
      const achievementEntry = achievementId ? achievementEntryById.get(achievementId) as { unlocked?: boolean; progressRatio?: number } | undefined ?? null : null;
      const unlocked = skin?.unlock?.type === "free" || (collectionProfile?.unlockedSkinIds?.includes(skin.skinId) === true);
      const claimable = Boolean(achievementId && achievementEntry?.unlocked && !claimedAchievementIds.has(achievementId));
      const nearComplete = Boolean(!claimable && !unlocked && achievementEntry && achievementEntry.unlocked !== true);
      const rank = claimable ? 0 : nearComplete ? 1 : unlocked ? 2 : 3;
      return {
        skin,
        sortIndex: index,
        sortOrder: Number.isFinite(skin?.sortOrder) ? Number(skin.sortOrder) : Number.MAX_SAFE_INTEGER,
        rank,
        claimable,
        nearComplete,
        progressRatio: achievementEntry?.progressRatio ?? 0,
        achievementId,
        achievementEntry
      };
    })
    .sort((a, b) => a.rank - b.rank || b.progressRatio - a.progressRatio || a.sortOrder - b.sortOrder || a.sortIndex - b.sortIndex);
}

/**
 * Renders the unit detail view inside the library modal.
 * @param modal - The modal instance (this)
 * @param y - Current Y offset
 * @param unitId - Unit ID to display
 * @returns Updated Y offset
 */
export function renderUnitDetailExt(modal: LibraryModalLike, y: number, unitId: string): number {
  const unit = UNIT_BY_ID[unitId] as { id: string; classType: string; tribe: string; tier: number; skillId: string; name?: string; nameVi?: string; nameEn?: string; descriptionVi?: string; descriptionEn?: string; description?: string; stats?: { range?: number } } | undefined;
  if (!unit) {
    modal.detailUnitId = null;
    modal.detailPreviewSkinId = null;
    return modal.renderUnitsTab(y);
  }

  const locale = getLocale();
  const previewStar = Math.max(1, Math.min(3, Number(modal.detailPreviewStar) || 1));
  const skinDefs = Object.values(getUnitSkinDefs(unit.id));
  const sortedSkinEntries = sortRewardSkinsByPriority(skinDefs as unknown as LibraryRewardSkin[], modal);
  const unlockedSkins = new Set(getUnlockedUnitSkins(unit.id, modal.collectionProfile).map((skin) => String(skin.skinId)));
  const equippedSkinId = modal.getEquippedSkinId(unit.id);
  const selectedSkinId = modal.resolveDetailSkinPreviewId(unit.id);
  const previewCollectionProfile = modal.buildSkinPreviewCollectionProfile(unit.id, selectedSkinId);
  const selectedSkin = selectedSkinId ? getSkinById(selectedSkinId) as unknown as LibraryRewardSkin | null : null;
  const selectedIsDefault = !selectedSkinId;
  const selectedAppearance = typeof selectedSkin?.getAppearance === "function"
    ? selectedSkin.getAppearance(previewStar, locale) as { displayNameVi?: string; displayNameEn?: string; previewIcon?: string; icon?: string } | null
    : null;
  const visual = getUnitVisual(unit.id, unit.classType, previewStar, {
    ownerKind: "LIBRARY",
    collectionProfile: previewCollectionProfile
  });
  const skill = getResolvedSkillDefinition(unit.skillId, { baseId: unit.id, star: previewStar }) as LibrarySkillLike | null;
  const tooltipVm = buildTooltipViewModel(unit as unknown as Parameters<typeof buildTooltipViewModel>[0], previewStar, { skill: skill as unknown as NonNullable<Parameters<typeof buildTooltipViewModel>[2]>["skill"] }) as unknown as LibraryTooltipVmLike;

  // Synergy bonus texts using shared formatter
  const classBonusTexts = buildSynergyBonusTexts(CLASS_SYNERGY[unit.classType]);
  const tribeBonusTexts = buildSynergyBonusTexts(TRIBE_SYNERGY[unit.tribe]);

  // Skill damage type icon
  let skillIcon = "✨";
  if (skill?.damageType === "physical") skillIcon = "🗡️";
  else if (skill?.damageType === "magic") skillIcon = "🪄";
  else if (skill?.damageType === "true") skillIcon = "💠";

  const W = modal.layout.viewportW - 14;
  const add = <T extends Phaser.GameObjects.GameObject>(txt: T): T => { modal.contentContainer.add(txt); return txt; };
  const textStyle = (fontSize = 14, color = "#c0ddf5") => ({
    fontFamily: UI_FONT, fontSize: `${fontSize}px`, color,
    lineSpacing: 7, wordWrap: { width: W - 32 }
  });


  // ── Back button ──
  const back = add(modal.scene.add.text(0, y, t("library.backToList"), textStyle(14, "#7ab8f5"))
    .setInteractive({ useHandCursor: true }));
  back.on("pointerdown", () => {
    modal.detailUnitId = null;
    modal.detailPreviewSkinId = null;
    modal.scrollY = 0;
    modal.refresh();
  });
  y += 28;

  // ── Header: Name + Tier ──
  add(modal.scene.add.text(16, y, `${visual.icon} ${sanitizeLibraryPlainText(visual.name)}`, {
    ...textStyle(26, "#ffeab0"), fontStyle: "bold"
  }));
  add(modal.scene.add.text(W - 24, y + 4, `${t("label.tier")} ${unit.tier}`, textStyle(16, "#8df2ff")).setOrigin(1, 0));
  y += 40;

  const previewLabel = add(modal.scene.add.text(16, y, t("combat.previewStar"), {
    ...textStyle(13, "#8ab4d4"),
    fontStyle: "bold"
  }));

  const starButtonStartX = previewLabel.x + previewLabel.width + 56;
  const starButtonY = y + 10;
  [1, 2, 3].forEach((star, index) => {
    const active = previewStar === star;
    modal.createButton(
      starButtonStartX + index * 70,
      starButtonY,
      58,
      28,
      `${star}★`,
      () => {
        modal.detailPreviewStar = star;
        modal.refresh();
      },
      active ? 0x355d8a : 0x233850,
      active ? 0xffeab0 : 0x5a8ab0,
      modal.contentContainer
    );
  });
  y += 30;

  add(modal.scene.add.rectangle(16, y, W - 32, 1, 0x3a5a7a, 0.6).setOrigin(0, 0));
  y += 10;
  add(modal.scene.add.text(16, y, t("library.skins"), {
    ...textStyle(15, "#ffd580"),
    fontStyle: "bold"
  }));
  y += 24;

  const sectionLeft = 16;
  const sectionWidth = W - 32;

  if (!skinDefs.length) {
    const emptySkinText = add(modal.scene.add.text(sectionLeft, y, t("library.noSkinsUnlocked"), textStyle(12, "#8ab4d4")));
    y += emptySkinText.height + 10;
  } else {
    const listWidth = Math.min(420, Math.max(320, Math.floor(sectionWidth * 0.31)));
    const previewGap = 18;
    const previewX = sectionLeft + listWidth + previewGap;
    const previewWidth = sectionWidth - listWidth - previewGap;
    const rowHeight = 58;
    const rowGap = 10;
    const footerHeight = 56;
    const previewInset = 18;
    const previewBodyTop = y + previewInset;
    const skinRows = [
      {
        skinId: "",
        label: sanitizeLibraryPlainText(t("library.skinDefault")),
        previewIcon: visual.previewIcon ?? visual.icon ?? "🐾",
        statusLabel: sanitizeLibraryPlainText(equippedSkinId ? t("library.skinDefault") : t("library.equippedSkin")),
        statusColor: equippedSkinId ? "#8ab4d4" : "#ffeab0",
        unlocked: true,
        equipped: !equippedSkinId,
        selected: selectedIsDefault,
        isDefault: true
      },
      ...sortedSkinEntries.map(({ skin, claimable, progressRatio, achievementEntry }) => {
        const skinId = skin.skinId;
        const unlocked = unlockedSkins.has(skinId);
        const equipped = equippedSkinId === skinId;
        const appearance = typeof skin.getAppearance === "function" ? skin.getAppearance(previewStar, locale) : null;
        const appearanceLike = appearance as { displayNameVi?: string; displayNameEn?: string; previewIcon?: string; icon?: string } | null;
        const label = appearanceLike?.displayNameVi ?? appearanceLike?.displayNameEn ?? skin.nameVi ?? skin.nameEn ?? skin.skinKey;
        const statusLabel = claimable
          ? t("library.skinClaimable")
          : equipped
            ? t("library.equippedSkin")
            : unlocked
              ? t("library.skinUnlocked")
              : achievementEntry
                ? `${Math.round((progressRatio ?? 0) * 100)}%`
                : t("library.skinLocked");
        const statusColor = claimable
          ? "#ffd580"
          : equipped
            ? "#ffeab0"
            : unlocked
              ? "#89ffd3"
              : "#8a99a8";
        return {
          skinId,
          label: sanitizeLibraryPlainText(label),
          previewIcon: appearanceLike?.previewIcon ?? skin.previewIcon ?? "🎀",
          statusLabel: sanitizeLibraryPlainText(statusLabel),
          statusColor,
          unlocked,
          equipped,
          selected: selectedSkinId === skinId,
          isDefault: false
        };
      })
    ];
    const listTop = y + 14;
    const listHeight = skinRows.length * rowHeight + Math.max(0, skinRows.length - 1) * rowGap + 30;
    const previewHeight = Math.max(292, listHeight);
    const footerTop = y + previewHeight - footerHeight;
    const previewBodyBottom = footerTop - 14;
    const avatarColumnWidth = Math.min(156, Math.max(128, Math.floor((previewWidth - previewInset * 2) * 0.24)));
    const previewContentGap = 18;
    const previewAvatarSize = Math.min(96, avatarColumnWidth - 24);
    const previewAvatarX = previewX + previewInset + Math.floor((avatarColumnWidth - previewAvatarSize) * 0.5);
    const previewAvatarY = previewBodyTop + 18;
    const previewAvatarFrame = buildSkinPreviewAvatarFrameLayout({
      previewX,
      previewInset,
      previewBodyTop,
      previewBodyBottom,
      avatarColumnWidth,
      previewAvatarY,
      previewAvatarSize
    });
    const previewDetailsX = previewX + previewInset + avatarColumnWidth + previewContentGap;
    const previewDetailsWidth = Math.max(180, previewWidth - previewInset * 2 - avatarColumnWidth - previewContentGap);
    const previewSkillWidth = Math.max(140, previewDetailsWidth - 34);

    add(modal.scene.add.rectangle(
      sectionLeft + listWidth * 0.5,
      y + previewHeight * 0.5,
      listWidth,
      previewHeight,
      0x112133,
      0.94
    ).setStrokeStyle(1, 0x35526d, 0.9));
    add(modal.scene.add.rectangle(
      previewX + previewWidth * 0.5,
      y + previewHeight * 0.5,
      previewWidth,
      previewHeight,
      0x16273c,
      0.96
    ).setStrokeStyle(1, 0x4d7191, 0.95));

    add(modal.scene.add.text(sectionLeft + 14, y + 10, t("library.skinListTitle"), {
      ...textStyle(12, "#8ab4d4"),
      fontStyle: "bold"
    }));
    add(modal.scene.add.text(previewX + 14, y + 10, t("library.skinPreviewTitle"), {
      ...textStyle(12, "#8ab4d4"),
      fontStyle: "bold"
    }));
    add(modal.scene.add.rectangle(
      previewAvatarFrame.x,
      previewAvatarFrame.y,
      previewAvatarFrame.size,
      previewAvatarFrame.size,
      0x112133,
      0.55
    ).setStrokeStyle(1, 0x34526b, 0.55));

    skinRows.forEach((row, index) => {
      const rowY = listTop + index * (rowHeight + rowGap);
      const rowBg = add(modal.scene.add.rectangle(
        sectionLeft + listWidth * 0.5,
        rowY + rowHeight * 0.5,
        listWidth - 16,
        rowHeight,
        row.selected ? 0x315578 : row.unlocked ? 0x21384f : 0x172331,
        0.96
      ));
      rowBg.setStrokeStyle(1, row.selected ? 0xffeab0 : row.unlocked ? 0x6faee0 : 0x485d73, 1);
      rowBg.setInteractive({ useHandCursor: true });
      rowBg.on("pointerover", () => {
        rowBg.setFillStyle(row.selected ? 0x39628b : row.unlocked ? 0x284662 : 0x1c2b3b, 0.98);
      });
      rowBg.on("pointerout", () => {
        rowBg.setFillStyle(row.selected ? 0x315578 : row.unlocked ? 0x21384f : 0x172331, 0.96);
      });
      rowBg.on("pointerdown", () => {
        modal.detailPreviewSkinId = row.skinId;
        modal.refresh();
      });

      add(modal.scene.add.text(sectionLeft + 18, rowY + 8, row.previewIcon, {
        ...textStyle(14, row.unlocked ? "#f4fbff" : "#9aa9b8")
      }));
      add(modal.scene.add.text(sectionLeft + 42, rowY + 8, sanitizeLibraryPlainText(row.label), {
        ...textStyle(13, row.unlocked ? "#f4fbff" : "#9aa9b8"),
        fontStyle: row.selected ? "bold" : "normal",
        wordWrap: { width: listWidth - 60 }
      }));
      add(modal.scene.add.text(sectionLeft + 42, rowY + rowHeight - 20, sanitizeLibraryPlainText(row.statusLabel), {
        ...textStyle(11, row.statusColor),
        fontStyle: "bold",
        wordWrap: { width: listWidth - 60 }
      }));
    });

    const selectedSkinRow = skinRows.find((row) => row.selected) ?? skinRows[0];
    const previewName = sanitizeLibraryPlainText(selectedIsDefault
      ? t("library.skinDefault")
      : (
          selectedAppearance?.displayNameVi
          ?? selectedAppearance?.displayNameEn
          ?? selectedSkin?.nameVi
          ?? selectedSkin?.nameEn
          ?? selectedSkin?.skinKey
          ?? t("library.skinPreviewEmpty")
        ));
    const previewState = sanitizeLibraryPlainText(selectedSkinRow?.statusLabel ?? t("library.skinPreviewEmpty"));
    const skillLabel = sanitizeLibraryPlainText(locale === "en"
      ? skill?.nameEn ?? skill?.name ?? t("combat.skillNone")
      : skill?.nameVi ?? skill?.name ?? t("combat.skillNone"));

    add(renderLibraryPreviewAvatar(modal, {
      x: previewAvatarX,
      y: previewAvatarY,
      size: previewAvatarSize,
      unit,
      visual,
      star: previewStar,
      appearance: selectedAppearance,
      surface: "library",
      ownerKind: "LIBRARY",
      collectionProfile: previewCollectionProfile,
      accentColor: selectedIsDefault || unlockedSkins.has(selectedSkinId ?? "") ? 0x8ff0c0 : selectedSkinRow?.statusLabel === t("library.skinClaimable") ? 0xffd580 : 0xffeab0,
      fallbackIcon: selectedAppearance?.previewIcon ?? selectedAppearance?.icon ?? selectedSkin?.previewIcon ?? visual.previewIcon ?? visual.icon ?? "🎀"
    }));

    const previewNameText = add(modal.scene.add.text(previewDetailsX, previewBodyTop + 18, previewName, {
      ...textStyle(18, "#ffeab0"),
      fontStyle: "bold",
      wordWrap: { width: previewDetailsWidth }
    }));
    const previewMetaY = previewBodyTop + 18 + previewNameText.height + 8;
    const previewStateText = add(modal.scene.add.text(previewDetailsX, previewMetaY, `${previewState} • ${previewStar}★`, {
      ...textStyle(12, selectedSkinRow?.statusColor ?? (unlockedSkins.has(selectedSkinId ?? "") ? "#89ffd3" : "#8ab4d4")),
      fontStyle: "bold"
    }));
    const previewSkillY = previewMetaY + previewStateText.height + 10;
    add(modal.scene.add.text(previewDetailsX, previewSkillY, `${t("combat.skillLabel")}: ${skillLabel}`, {
      ...textStyle(12, "#d4e9ff"),
      wordWrap: { width: previewSkillWidth }
    }));
    createLibrarySkillVoiceButton(modal.scene, {
      x: previewDetailsX + previewDetailsWidth - 8,
      y: previewSkillY + 8,
      label: skillLabel,
      size: 18,
      container: modal.contentContainer
    });
    add(modal.scene.add.text(previewDetailsX, previewSkillY + 28, selectedIsDefault ? t("library.skinDefaultHint") : t("library.skinPreviewHint"), {
      ...textStyle(11, "#9eb7cd"),
      wordWrap: { width: previewDetailsWidth }
    }));

    add(modal.scene.add.rectangle(
      previewX + previewWidth * 0.5,
      footerTop + footerHeight * 0.5,
      previewWidth - 20,
      footerHeight,
      0x102132,
      0.98
    ).setStrokeStyle(1, 0x39576f, 0.75));

    const actionLabel = selectedIsDefault
      ? equippedSkinId
        ? t("library.skinDefaultAction")
        : t("library.equippedSkin")
      : equippedSkinId === selectedSkin?.skinId
        ? t("library.equippedSkin")
        : unlockedSkins.has(selectedSkin?.skinId ?? "")
          ? t("library.skinEquipAction")
          : t("library.skinLockedAction");
    const actionEnabled = selectedIsDefault
      ? Boolean(equippedSkinId)
      : Boolean(selectedSkin?.skinId && unlockedSkins.has(selectedSkin.skinId) && equippedSkinId !== selectedSkin.skinId);

    if (actionEnabled) {
      modal.createButton(
        previewX + previewWidth * 0.5,
        footerTop + footerHeight * 0.5 + 2,
        Math.min(188, previewWidth - 32),
        32,
        actionLabel,
        () => {
          const targetSkinId = selectedIsDefault ? "" : selectedSkin?.skinId ?? null;
          const saved = modal.setEquippedSkin(unit.id, targetSkinId);
          if (!saved) {
            modal.scene.flashStatus?.(t("menu.memoryError"));
            return;
          }
          modal.detailPreviewSkinId = targetSkinId ?? "";
          modal.refresh();
        },
        0x2c6a56,
        0x8ff0c0,
        modal.contentContainer
      );
    } else {
      add(modal.scene.add.rectangle(
        previewX + previewWidth * 0.5,
        footerTop + footerHeight * 0.5 + 2,
        Math.min(188, previewWidth - 32),
        32,
        (selectedIsDefault && !equippedSkinId) || equippedSkinId === selectedSkin?.skinId ? 0x2d5d76 : 0x223042,
        0.96
      ).setStrokeStyle(1, (selectedIsDefault && !equippedSkinId) || equippedSkinId === selectedSkin?.skinId ? 0xffeab0 : 0x52657a, 1));
      add(modal.scene.add.text(previewX + previewWidth * 0.5, footerTop + footerHeight * 0.5 + 2, actionLabel, {
        ...textStyle(12, (selectedIsDefault && !equippedSkinId) || equippedSkinId === selectedSkin?.skinId ? "#ffeab0" : "#8ea0b2"),
        fontStyle: "bold"
      }).setOrigin(0.5));
    }

    y += previewHeight + 12;
  }

  const reviewLayout = buildSkinReviewPanelLayout({
    sectionLeft,
    sectionWidth,
    y
  });
  const reviewCards = buildSkinReviewCardModels({
    modal,
    unit,
    selectedSkin,
    selectedSkinId,
    previewCollectionProfile,
    previewStar,
    locale
  });

  add(modal.scene.add.rectangle(
    reviewLayout.panelX + reviewLayout.panelWidth * 0.5,
    reviewLayout.panelY + reviewLayout.panelHeight * 0.5,
    reviewLayout.panelWidth,
    reviewLayout.panelHeight,
    0x112133,
    0.95
  ).setStrokeStyle(1, 0x35526d, 0.95));
  add(modal.scene.add.text(sectionLeft + 14, y + 12, t("library.skinReviewTitle"), {
    ...textStyle(13, "#8ab4d4"),
    fontStyle: "bold"
  }));
  add(modal.scene.add.text(sectionLeft + 14, y + 32, t("library.skinReviewHint"), {
    ...textStyle(11, "#9eb7cd"),
    wordWrap: { width: sectionWidth - 28 }
  }));

  reviewLayout.cards.forEach((cardLayout, index) => {
    const card = reviewCards[index];
    const cardBg = add(modal.scene.add.rectangle(
      cardLayout.x + cardLayout.width * 0.5,
      cardLayout.y + cardLayout.height * 0.5,
      cardLayout.width,
      cardLayout.height,
      card.active ? 0x315578 : 0x18283a,
      0.98
    ));
    cardBg.setStrokeStyle(1, card.active ? 0xffeab0 : 0x5a8ab0, 1);
    cardBg.setInteractive({ useHandCursor: true });
    cardBg.on("pointerover", () => {
      cardBg.setFillStyle(card.active ? 0x39628b : 0x1e344a, 0.99);
    });
    cardBg.on("pointerout", () => {
      cardBg.setFillStyle(card.active ? 0x315578 : 0x18283a, 0.98);
    });
    cardBg.on("pointerdown", () => {
      card.onSelect();
    });

    add(modal.scene.add.text(cardLayout.x + 14, cardLayout.y + 10, `${card.star}★`, {
      ...textStyle(14, card.active ? "#ffeab0" : "#8ab4d4"),
      fontStyle: "bold",
      wordWrap: { width: cardLayout.width - 28 }
    }));
    add(renderLibraryPreviewAvatar(modal, {
      x: cardLayout.x + Math.floor((cardLayout.width - 72) * 0.5),
      y: cardLayout.y + 32,
      size: 72,
      unit,
      visual: card.visual,
      star: card.star,
      surface: "library",
      ownerKind: "LIBRARY",
      collectionProfile: previewCollectionProfile,
      accentColor: card.active ? 0xffeab0 : 0x6faee0,
      fallbackIcon: card.previewIcon
    }));
    add(modal.scene.add.text(cardLayout.x + 12, cardLayout.y + 114, card.displayName, {
      ...textStyle(12, "#f4fbff"),
      fontStyle: card.active ? "bold" : "normal",
      wordWrap: { width: cardLayout.width - 24 }
    }));
    add(modal.scene.add.text(cardLayout.x + 12, cardLayout.y + cardLayout.height - 28, card.active ? t("combat.previewStar") : t("library.skinPreviewTitle"), {
      ...textStyle(11, card.active ? "#ffeab0" : "#9eb7cd"),
      wordWrap: { width: cardLayout.width - 24 }
    }));
  });
  y += reviewLayout.panelHeight + 14;

  // ── Stats block (shared formatter) ──
  const statScale = previewStar === 1 ? 1 : previewStar === 2 ? 1.6 : 2.5;
  const statsLines = sanitizeLibraryPlainTextLines(buildUnitStatsLines(unit, { star: previewStar, statScale, skill }));
  const classDef = CLASS_SYNERGY[unit.classType];
  const tribeDef = TRIBE_SYNERGY[unit.tribe];
  const classMarks = classDef ? classDef.thresholds.join("/") : "-";
  const tribeMarks = tribeDef ? tribeDef.thresholds.join("/") : "-";
  statsLines.push(
    `📊 ${t("label.classSynergy")} (${classMarks}): ${classBonusTexts.join(" | ") || "-"}`,
    `🌿 ${t("label.tribeSynergy")} (${tribeMarks}): ${tribeBonusTexts.join(" | ") || "-"}`
  );
  const statsTxt = add(modal.scene.add.text(16, y, statsLines.join("\n"), textStyle(13, "#c0ddf5")));
  y += statsTxt.height + 10;

  // ── Basic attack ──
  const passiveLines = sanitizeLibraryPlainTextLines(tooltipVm.passive?.lines ?? []);
  const passiveTitle = sanitizeLibraryPlainText(tooltipVm.passive?.title ?? "Nội tại");
  if (passiveLines.length > 0) {
    add(modal.scene.add.rectangle(16, y, W - 32, 1, 0x3a5a7a, 0.6).setOrigin(0, 0));
    y += 6;
    const passiveSection = `🧬 ${passiveTitle}:\n${passiveLines.map((line) => `  • ${line}`).join("\n")}`;
    const passiveTxt = add(modal.scene.add.text(16, y, passiveSection, textStyle(13, "#d7ffe0")));
    y += passiveTxt.height + 10;
  }
  add(modal.scene.add.rectangle(16, y, W - 32, 1, 0x3a5a7a, 0.6).setOrigin(0, 0));
  y += 6;
  const basicAtkLines = sanitizeLibraryPlainTextLines(tooltipVm.attack.lines);
  const basicSection = `👊 ${t("combat.basicAttack")}:\n${basicAtkLines.map(l => `  • ${l}`).join("\n")}`;
  const basicTxt = add(modal.scene.add.text(16, y, basicSection, textStyle(13, "#c8d8f0")));
  y += basicTxt.height + 10;

  // ════ SEPARATOR ════
  add(modal.scene.add.rectangle(16, y, W - 32, 2, 0x5a8ab0, 0.8).setOrigin(0, 0));
  y += 10;

  // ── Skill section ──
  const skillName = locale === "en"
    ? skill?.nameEn ?? skill?.name ?? t("combat.skillNone")
    : skill?.nameVi ?? skill?.name ?? t("combat.skillNone");
  add(modal.scene.add.text(16, y, `${skillIcon} ${t("combat.skillLabel")}: ${skillName}`, {
    ...textStyle(16, "#ffd580"), fontStyle: "bold"
  }));
  createLibrarySkillVoiceButton(modal.scene, {
    x: W - 26,
    y: y + 9,
    label: skillName,
    container: modal.contentContainer,
    fillColor: 0x3b2b18,
    hoverFillColor: 0x574022,
    strokeColor: 0xffd580
  });
  y += 26;

  const descText = resolveLibrarySkillDescriptionText(unit, tooltipVm, skill, previewStar, locale);
  const descTxt = add(modal.scene.add.text(16, y, descText, textStyle(13, "#d0eaff")));
  y += descTxt.height + 8;

  // ── Full tooltip view-model output ──
  const skillLines = sanitizeLibrarySkillLines(tooltipVm.skill?.lines?.slice(1) ?? []);
  if (skillLines.length > 0) {
    add(modal.scene.add.text(16, y, t("combat.skillDetail"), { ...textStyle(14, "#ffd580"), fontStyle: "bold" }));
    y += 20;
    const formattedLines = skillLines.join("\n");
    const milestoneTxt = add(modal.scene.add.text(24, y, formattedLines, {
      ...textStyle(13, "#b8e8b0"),
      lineSpacing: 4
    }));
    y += milestoneTxt.height + 10;
  }

  // ── Preview section ──
  add(modal.scene.add.rectangle(16, y, W - 32, 2, 0x5a8ab0, 0.8).setOrigin(0, 0));
  y += 10;
  add(modal.scene.add.text(16, y, t("combat.previewBattle"), { ...textStyle(15, "#ffd580"), fontStyle: "bold" }));
  y += 28;

  const previewW = Math.floor((W - 48) / 2);
  const previewH = 208;

  modal.attackPreview = new LibraryBattlePreview(modal.scene, 16, y, previewW, previewH, unit, skill, {
    mode: "attack",
    star: previewStar,
    collectionProfile: previewCollectionProfile
  });
  modal.contentContainer.add(modal.attackPreview.container);

  modal.skillPreview = new LibraryBattlePreview(modal.scene, 16 + previewW + 16, y, previewW, previewH, unit, skill, {
    mode: "skill",
    star: previewStar,
    collectionProfile: previewCollectionProfile
  });
  modal.contentContainer.add(modal.skillPreview.container);

  y += previewH + 16;
  return y;
}

/**
 * Renders the odds tab inside the library modal.
 * @param {LibraryModal} modal - The modal instance (this)
 * @param {number} y - Current Y offset
 * @returns {number} Updated Y offset
 */
export function renderOddsTabExt(modal: LibraryModalLike, y: number): number {
  const W = modal.layout.viewportW;
  const tierColors = ["#e0e0e0", "#4caf50", "#2196f3", "#9c27b0", "#ff9800"];
  const tierLabels = ["T1 ⭐", "T2 ⭐⭐", "T3 ⭐⭐⭐", "T4 ⭐⭐⭐⭐", "T5 ⭐⭐⭐⭐⭐"];
  const colW = Math.floor((W - 80) / 5);
  const rowH = 28;

  const title = modal.scene.add.text(0, y, t("combat.rollOddsTitle"), {
    fontFamily: UI_FONT, fontSize: "18px", color: "#ffeab0", fontStyle: "bold"
  });
  modal.contentContainer.add(title);
  y += 30;

  const subtitle = modal.scene.add.text(0, y, t("combat.rollOddsSubtitle"), {
    fontFamily: UI_FONT, fontSize: "13px", color: "#a6bed3"
  });
  modal.contentContainer.add(subtitle);
  y += 24;

  const peakSummary = modal.scene.add.text(
    0,
    y,
    t("combat.rollOddsPeak"),
    {
      fontFamily: UI_FONT,
      fontSize: "12px",
      color: "#7fd2ff",
      fontStyle: "bold",
      wordWrap: { width: W - 20 }
    }
  );
  modal.contentContainer.add(peakSummary);
  y += peakSummary.height + 10;

  // Header row
  const headerBg = modal.scene.add.rectangle(0, y, W - 14, rowH, 0x1a3050, 0.95).setOrigin(0, 0);
  headerBg.setStrokeStyle(1, 0x3a5a7a, 0.8);
  modal.contentContainer.add(headerBg);

  const lvlHeader = modal.scene.add.text(8, y + 6, getLocale() === "en" ? "Level" : "Cấp", {
    fontFamily: UI_FONT, fontSize: "13px", color: "#8ab4d4", fontStyle: "bold"
  });
  modal.contentContainer.add(lvlHeader);

  for (let t = 0; t < 5; t++) {
    const tx = 60 + t * colW;
    const hdr = modal.scene.add.text(tx + colW / 2, y + 6, tierLabels[t], {
      fontFamily: UI_FONT, fontSize: "12px", color: tierColors[t], fontStyle: "bold"
    }).setOrigin(0.5, 0);
    modal.contentContainer.add(hdr);
  }
  y += rowH;

  const playerLevel = modal.scene.player?.level ?? 1;

  for (let level = 1; level <= 25; level++) {
    const odds = getTierOdds(level);
    const isCurrentLevel = Math.floor(playerLevel) === level;
    const rowColor = isCurrentLevel ? 0x2a5040 : (level % 2 === 0 ? 0x142538 : 0x162a40);
    const rowAlpha = isCurrentLevel ? 0.98 : 0.85;

    const rowBg = modal.scene.add.rectangle(0, y, W - 14, rowH, rowColor, rowAlpha).setOrigin(0, 0);
    if (isCurrentLevel) rowBg.setStrokeStyle(2, 0x4caf50, 0.9);
    modal.contentContainer.add(rowBg);

    const lvlColor = isCurrentLevel ? "#4caf50" : "#c0ddf5";
    const lvlText = modal.scene.add.text(8, y + 6, `Lv.${level}${isCurrentLevel ? " ◀" : ""}`, {
      fontFamily: UI_FONT, fontSize: "13px", color: lvlColor, fontStyle: isCurrentLevel ? "bold" : "normal"
    });
    modal.contentContainer.add(lvlText);

    const tierValues = [odds.tier1, odds.tier2, odds.tier3, odds.tier4, odds.tier5];
    for (let t = 0; t < 5; t++) {
      const pct = Math.round(tierValues[t] * 100);
      const tx = 60 + t * colW;
      const isPeakCell = getTierPeakLevel(t + 1) === level;
      const cellColor = isPeakCell ? "#ffeab0" : (pct > 0 ? tierColors[t] : "#3a4a5a");
      const cell = modal.scene.add.text(tx + colW / 2, y + 6, pct > 0 ? `${pct}%${isPeakCell ? " ▲" : ""}` : "-", {
        fontFamily: UI_FONT, fontSize: "13px", color: cellColor,
        fontStyle: isPeakCell || pct >= 30 ? "bold" : "normal"
      }).setOrigin(0.5, 0);
      modal.contentContainer.add(cell);
    }
    y += rowH;
  }

  y += 16;
  const note = modal.scene.add.text(0, y, t("combat.rollOddsTip"), {
    fontFamily: UI_FONT, fontSize: "12px", color: "#8ab4d4",
    wordWrap: { width: W - 20 }
  });
  modal.contentContainer.add(note);
  y += note.height + 16;

  return y;
}
