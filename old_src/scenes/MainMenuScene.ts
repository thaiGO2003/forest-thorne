import Phaser from "phaser"; // Updated Encyclopedia
import { createMainMenuAchievementsPanel } from "./MainMenuAchievementsPanel.js";
import { createSocialAndDonate as _createSocialAndDonate } from "./MainMenuSocialDonate.js";
import { createMainMenuTributeGalleryPanel } from "./MainMenuTributeGalleryPanel.js";
import { createMenuButton, createMenuRadioGroup } from "./MainMenuUIHelpers.js";
import { AudioFx } from "../core/audioFx.js";
import { clearRunProgress, loadProgress } from "../core/persistence.js";
import {
  getEndlessAchievementClaimableCount,
  getEndlessAchievementButtonLabel,
  loadEndlessAchievementProfile
} from "../core/endlessAchievements.js";
import {
  claimAchievementSkin,
  loadCollectionProfile,
  saveCollectionProfile
} from "../core/collectionProfile.js";
import type { CollectionProfile } from "../core/collectionProfile.js";
import type { LibraryModal } from "../ui/LibraryModal.js";
import { lazyLoadAndPlayBgm, prefetchDeferredSceneAudio } from "../core/sharedAssetLoader.js";
import {
  createDefaultUiSettings,
  loadUiSettings,
  onSettingsChange,
  saveUiSettings,
  stepTooltipMode,
  type UiSettings
} from "../core/uiSettings.js";
import { ResolutionManager } from "../core/resolutionManager.js";
import { getAiModeI18nKey } from "../core/aiModes.js";
import { hydrateRunState } from "../core/runState.js";
import { getLoseConditionLabel, normalizeLoseCondition } from "../core/gameRules.js";
import { APP_LAST_UPDATED, APP_VERSION_TAG } from "../core/appMeta.js";
import {
  getNewGameRoute,
  NEW_GAME_ROUTE_COOP_LOBBY,
  NEW_GAME_ROUTE_FORTRESS_MAP,
  NEW_GAME_ROUTE_SOLO
} from "../core/newGameRoute.js";
import { isEndlessFortressMode, getFortressPendingNode } from "../core/fortressMode.js";
import {
  getAvailableAiModesForGameMode,
  getEffectiveAiModeForGameMode,
  getRequiredPlayerCapacityForGameMode,
  isPvpGameMode
} from "../core/gameModeRuntime.js";
import { CRAFT_RECIPES, ITEM_BY_ID } from "../data/items.js";
import { getSkinByAchievementId } from "../data/unitSkins.js";
import GameModeRegistry from "../gameModes/GameModeRegistry.js";
import type { GameModeConfig } from "../gameModes/GameModeConfig.js";
import { getAvailableLocales, getLocaleLabel, t } from "../i18n/index.js";
import { loadCombatSettingsPanelModule, loadLibraryModalModule } from "../ui/lazyLoaders.js";
import {
  getMenuAchievementsButtonLabel,
  getMenuCloseButtonLabel,
  getMenuContinueButtonLabel,
  getMenuEnterGameButtonLabel,
  getMenuLibraryButtonLabel,
  getMenuNewGameButtonLabel,
  getMenuSettingsButtonLabel,
  prefixButtonEmoji
} from "../ui/buttonEmojiLabels.js";
import { prewarmLazyScene, startManagedScene } from "./sceneLazyRouting.js";
import { applySceneDisplaySettings } from "./shared/sceneDisplayRuntime.js";

type UnknownRecord = Record<string, unknown>;
type EndlessProfile = unknown;
type Locale = UiSettings["language"];
type BackgroundDisplayObject = Phaser.GameObjects.Image | Phaser.GameObjects.Video;
type LocalizedGameModeConfig = GameModeConfig & { nameVi?: string; descriptionVi?: string };
type LibraryModalConstructor = new (
  scene: Phaser.Scene,
  options: { title: string; onCollectionProfileChanged: (profile: CollectionProfile) => void }
) => LibraryModal;
type SettingsPanelBuilder = (
  scene: Phaser.Scene,
  options: UnknownRecord
) => SettingsResultLike;
type MenuButtonFactory = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  onClick: () => void,
  fill: number,
  stroke: number,
  parent?: Phaser.GameObjects.Container | null
) => MenuButton;
type RadioGroupFactory = (
  scene: Phaser.Scene,
  options: RadioGroupOptions
) => RadioGroup;
interface SkinAppearanceLike extends UnknownRecord {
  displayNameVi?: unknown;
}

interface SkinRewardLike extends UnknownRecord {
  skinId: string;
  unitId?: unknown;
  nameVi?: unknown;
  getAppearance?: ((star: number) => unknown) | null;
}

function readUnknownRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

interface MenuButton {
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  text: Phaser.GameObjects.Text;
  enabled: boolean;
  baseFill: number;
  baseStroke: number;
  setLabel(value: string): void;
  setEnabled(enabled: boolean): void;
}

interface RadioOption {
  value: string;
  label: string;
  getLabel?: () => string;
  disabled?: boolean;
}

interface RadioGroup {
  group: Phaser.GameObjects.Container;
  refresh(): void;
  scrollBy(deltaY: number): boolean;
  wheelTarget: Phaser.GameObjects.Zone;
  canScroll(): boolean;
  containsPoint(pointer: unknown): boolean;
}

interface DifficultyOption {
  value: string;
  label: string;
  getLabel: () => string;
}

interface DifficultyRadioLayout {
  parent: Phaser.GameObjects.Container;
  x: number;
  y: number;
  width: number;
  maxHeight: number;
}

interface LanguagePanelButton {
  locale: string;
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  selected: boolean;
  setLabel(value: string): LanguagePanelButton;
  setSelected(selected: boolean): LanguagePanelButton;
}

interface LanguagePanelEntry {
  locale: string;
  label: string;
}

interface MenuLayoutOptions {
  openStartPanel?: boolean;
  openSettingsPanel?: boolean;
  selectedMode?: string | null;
}

interface IncomingSceneData {
  selectedMode?: string;
  openStartPanel?: boolean;
  openSettingsPanel?: boolean;
}

interface CraftRecipeEntry extends UnknownRecord {
  _requiredLabel: string;
  tier?: number;
  requires?: string[];
}

interface SettingsResultLike {
  container: Phaser.GameObjects.Container;
  refresh(settings?: unknown, audioFx?: unknown): void;
}

interface RadioGroupOptions {
  parent: Phaser.GameObjects.Container;
  x: number;
  y: number;
  width: number;
  title: string | (() => string);
  options: RadioOption[];
  getValue: () => string;
  onChange: (value: string, option?: RadioOption) => void;
  maxHeight?: number | null;
}

export function computeMenuBackgroundCover(
  sourceWidth: number,
  sourceHeight: number,
  frameWidth: number,
  frameHeight: number
): { width: number; height: number; scale: number } {
  const safeFrameWidth = Number.isFinite(frameWidth) && frameWidth > 0 ? frameWidth : 1;
  const safeFrameHeight = Number.isFinite(frameHeight) && frameHeight > 0 ? frameHeight : 1;
  const safeSourceWidth = Number.isFinite(sourceWidth) && sourceWidth > 0 ? sourceWidth : safeFrameWidth;
  const safeSourceHeight = Number.isFinite(sourceHeight) && sourceHeight > 0 ? sourceHeight : safeFrameHeight;
  const scale = Math.max(safeFrameWidth / safeSourceWidth, safeFrameHeight / safeSourceHeight);

  return {
    width: safeSourceWidth * scale,
    height: safeSourceHeight * scale,
    scale
  };
}

const TEMPORARILY_ENABLED_GAME_MODE_IDS = new Set<string>(["EndlessPvEClassic"]);

export function isGameModeTemporarilyLocked(gameModeId: unknown): boolean {
  return typeof gameModeId === "string" && !TEMPORARILY_ENABLED_GAME_MODE_IDS.has(gameModeId);
}

export function normalizeMenuSelectedMode(gameModeId: unknown): string {
  if (typeof gameModeId !== "string" || !gameModeId) return "EndlessPvEClassic";
  return isGameModeTemporarilyLocked(gameModeId) ? "EndlessPvEClassic" : gameModeId;
}

function getModeDevelopmentLabel(): string {
  return t("ui.inDevelopment");
}

function getLockedContinueLabel(): string {
  return `${t("menu.continue")} (${getModeDevelopmentLabel()})`;
}

function hasTemporarilyLockedModes(): boolean {
  return GameModeRegistry.getAll().some((mode) => isGameModeTemporarilyLocked(mode?.id));
}

export class MainMenuScene extends Phaser.Scene {
  settings: UiSettings;
  incomingData: IncomingSceneData | null;
  endlessAchievementProfile: EndlessProfile | null;
  collectionProfile: CollectionProfile | null;
  statusText: Phaser.GameObjects.Text | null;
  selectedMode: string;
  startPanel: Phaser.GameObjects.Container | null;
  startInfoText: Phaser.GameObjects.Text | null;
  modeRadioGroup: RadioGroup | null;
  difficultyRadioGroup: RadioGroup | null;
  startPanelScrollGroups: Array<RadioGroup | null>;
  tributeScrollGroup: RadioGroup | null;
  continueButton: MenuButton | null;
  tributePanel: Phaser.GameObjects.Container | null;
  tributePanelTitleText: Phaser.GameObjects.Text | null;
  tributePanelSubtitleText: Phaser.GameObjects.Text | null;
  savedRun: ReturnType<typeof hydrateRunState>;
  _craftRecipes: CraftRecipeEntry[] | null;
  _menuLayoutGeneration: number;
  _menuLayoutRebuildCall: Phaser.Time.TimerEvent | null;
  _scheduledMenuLayoutOptions: MenuLayoutOptions | null;
  _startPanelDifficultyLayout: DifficultyRadioLayout | null;
  _settingsChangeOff: (() => void) | null;
  _menuInputHandlersInstalled: boolean;
  _menuWheelHandler: ((pointer: Phaser.Input.Pointer, objects: unknown[], _deltaX: number, deltaY: number) => void) | null;
  _menuEscHandler: (() => void) | null;
  _mainMenuResizeHandler: ((gameSize: Phaser.Structs.Size) => void) | null;
  audioFx: AudioFx | null;
  newGameButton: MenuButton | null;
  settingsButton: MenuButton | null;
  libraryButton: MenuButton | null;
  achievementButton: MenuButton | null;
  headerTitleText: Phaser.GameObjects.Text | null;
  headerSubtitleText: Phaser.GameObjects.Text | null;
  languagePanel: Phaser.GameObjects.Container | null;
  languagePanelTitleText: Phaser.GameObjects.Text | null;
  languagePanelButtons: LanguagePanelButton[];
  settingsPanel: Phaser.GameObjects.Container | null;
  _settingsResult: SettingsResultLike | null;
  _settingsPanelPromise: Promise<Phaser.GameObjects.Container | null> | null;
  libraryModal: LibraryModal | null;
  _libraryModalPromise: Promise<unknown> | null;
  achievementPanel: Phaser.GameObjects.Container | null;
  achievementCloseButton: Phaser.GameObjects.Text | null;
  achievementScrollGroup: RadioGroup | null;
  footerLeftText: Phaser.GameObjects.Text | null;
  footerRightText: Phaser.GameObjects.Text | null;
  startPanelTitleText: Phaser.GameObjects.Text | null;
  startEnterButton: MenuButton | null;
  startCloseButton: MenuButton | null;

  constructor() {
    super("MainMenuScene");
    this.settings = createDefaultUiSettings();
    this.incomingData = null;
    this.statusText = null;
    this.selectedMode = "EndlessPvEClassic";
    this.startPanel = null;
    this.startInfoText = null;
    this.modeRadioGroup = null;
    this.difficultyRadioGroup = null;
    this.startPanelScrollGroups = [];
    this.tributeScrollGroup = null;
    this.continueButton = null;
    this.tributePanel = null;
    this.tributePanelTitleText = null;
    this.tributePanelSubtitleText = null;
    this.savedRun = null;
    this.endlessAchievementProfile = null;
    this.collectionProfile = null;
    this._craftRecipes = null;
    this._menuLayoutGeneration = 0;
    this._menuLayoutRebuildCall = null;
    this._scheduledMenuLayoutOptions = null;
    this._startPanelDifficultyLayout = null;
    this._settingsChangeOff = null;
    this._menuInputHandlersInstalled = false;
    this._menuWheelHandler = null;
    this._menuEscHandler = null;
    this._mainMenuResizeHandler = null;
    this.audioFx = null;
    this.newGameButton = null;
    this.settingsButton = null;
    this.libraryButton = null;
    this.achievementButton = null;
    this.headerTitleText = null;
    this.headerSubtitleText = null;
    this.languagePanel = null;
    this.languagePanelTitleText = null;
    this.languagePanelButtons = [];
    this.settingsPanel = null;
    this._settingsResult = null;
    this._settingsPanelPromise = null;
    this.libraryModal = null;
    this._libraryModalPromise = null;
    this.achievementPanel = null;
    this.achievementCloseButton = null;
    this.achievementScrollGroup = null;
    this.footerLeftText = null;
    this.footerRightText = null;
    this.startPanelTitleText = null;
    this.startEnterButton = null;
    this.startCloseButton = null;
  }

  init(data: IncomingSceneData | undefined): void {
    this.incomingData = data ?? null;
    if (typeof this.incomingData?.selectedMode === "string") {
      this.selectedMode = this.incomingData.selectedMode;
    }
    this.selectedMode = normalizeMenuSelectedMode(this.selectedMode);
  }

  create(): void {
    this.settings = loadUiSettings();
    this.selectedMode = normalizeMenuSelectedMode(this.selectedMode);
    this.syncGameModeAiSelection();
    this.applyDisplaySettings(this.settings);
    this.savedRun = hydrateRunState(loadProgress());
    this.endlessAchievementProfile = loadEndlessAchievementProfile();
    this.collectionProfile = loadCollectionProfile();
    this.audioFx = new AudioFx(this as unknown as {});
    this.audioFx.setEnabled(this.settings.audioEnabled !== false);
    this.audioFx.setVolumeLevel(this.settings.volumeLevel ?? 10);
    this.ensureCraftRecipesReady();
    this.installMenuInputHandlers();
    this.installSettingsListener();
    this.rebuildMenuLayout({
      openStartPanel: this.incomingData?.openStartPanel === true,
      openSettingsPanel: this.incomingData?.openSettingsPanel === true
    });
    this.installResizeListener();
    prewarmLazyScene("PlanningScene");
    prewarmLazyScene("FortressMapScene");
    prewarmLazyScene("CoopLobbyScene");
    lazyLoadAndPlayBgm(this, "menu", this.audioFx, "bgm_menu", 0.18, {
      onSettled: () => {
        prefetchDeferredSceneAudio(this, ["planning", "combat"]);
      }
    });
  }

  shutdown(): void {
    this.removeMenuInputHandlers();
    this.removeResizeListener();
    this._settingsChangeOff?.();
    this._settingsChangeOff = null;
  }

  installSettingsListener(): void {
    this._settingsChangeOff?.();
    this._settingsChangeOff = onSettingsChange((nextSettings: UiSettings) => {
      this.settings = { ...this.settings, ...nextSettings };
      this.syncGameModeAiSelection();
      this.audioFx?.setEnabled(this.settings.audioEnabled !== false);
      this.audioFx?.setVolumeLevel(this.settings.volumeLevel ?? 10);
      this.refreshLocaleInPlace();
      this.refreshSettingsPanel();
    });
    this.events.once("shutdown", () => this.shutdown());
    this.events.once("destroy", () => this.shutdown());
  }

  getAiLabel(mode: string | null | undefined): string {
    const key = typeof mode === "string" ? getAiModeI18nKey(mode) : null;
    if (!key) return String(mode ?? "");
    const translated = t(key);
    return translated !== key ? translated : String(mode ?? "");
  }

  getModeAiSelections(): Record<string, string> {
    if (!this.settings.aiModeByGameMode || typeof this.settings.aiModeByGameMode !== "object") {
      this.settings.aiModeByGameMode = {};
    }
    return this.settings.aiModeByGameMode;
  }

  getStoredAiModeForGameMode(gameModeId: string = this.selectedMode): string {
    const selections = this.getModeAiSelections();
    const preferredAiMode = typeof selections[gameModeId] === "string"
      ? selections[gameModeId]
      : this.settings.aiMode;
    return getEffectiveAiModeForGameMode(gameModeId, preferredAiMode);
  }

  syncGameModeAiSelection(gameModeId: string = this.selectedMode): string {
    const selections = this.getModeAiSelections();
    const effectiveAiMode = this.getStoredAiModeForGameMode(gameModeId);
    if (selections[gameModeId] !== effectiveAiMode) {
      selections[gameModeId] = effectiveAiMode;
    }
    if (gameModeId === this.selectedMode) {
      this.settings.aiMode = effectiveAiMode;
    }
    return effectiveAiMode;
  }

  setGameModeAiSelection(gameModeId: string, aiMode: string): string {
    const effectiveAiMode = getEffectiveAiModeForGameMode(gameModeId, aiMode);
    this.getModeAiSelections()[gameModeId] = effectiveAiMode;
    if (gameModeId === this.selectedMode) {
      this.settings.aiMode = effectiveAiMode;
    }
    return effectiveAiMode;
  }

  getEffectiveAiMode(): string {
    return this.syncGameModeAiSelection(this.selectedMode);
  }

  getDifficultyOptionsForMode(gameModeId: string = this.selectedMode): DifficultyOption[] {
    const availableAiModes = getAvailableAiModesForGameMode(gameModeId);
    const aiModes = Array.isArray(availableAiModes) && availableAiModes.length > 0
      ? availableAiModes
      : [this.getStoredAiModeForGameMode(gameModeId)];
    return aiModes.map((value: string) => ({
      value,
      label: this.getAiLabel(value),
      getLabel: () => this.getAiLabel(value)
    }));
  }

  rebuildDifficultyRadioGroup(): void {
    if (!this._startPanelDifficultyLayout?.parent) return;
    this.difficultyRadioGroup?.group?.destroy?.(true);
    this.difficultyRadioGroup = this.createRadioGroup({
      parent: this._startPanelDifficultyLayout.parent,
      x: this._startPanelDifficultyLayout.x,
      y: this._startPanelDifficultyLayout.y,
      width: this._startPanelDifficultyLayout.width,
      maxHeight: this._startPanelDifficultyLayout.maxHeight,
      title: () => t("difficulty.label"),
      options: this.getDifficultyOptionsForMode(this.selectedMode),
      getValue: () => this.getStoredAiModeForGameMode(this.selectedMode),
      onChange: (value: string) => {
        this.setGameModeAiSelection(this.selectedMode, value);
        saveUiSettings(this.settings);
        this.refreshSettingsPanel();
        this.refreshStartPanel();
      }
    });
    this.startPanelScrollGroups = [this.modeRadioGroup, this.difficultyRadioGroup].filter(Boolean) as RadioGroup[];
  }

  getModeLabel(mode: string): string {
    const config = GameModeRegistry.get(mode) as LocalizedGameModeConfig | null;
    if (!config) {
      if (mode === "EndlessPvEClassic") return t("menu.endlessPvELabel");
      return t("menu.sandboxLabel");
    }
    return this.settings.language === "en"
      ? config.nameEn ?? config.name
      : config.nameVi ?? config.name;
  }

  getModeMenuOptionLabel(mode: string): string {
    const baseLabel = this.getModeLabel(mode);
    return isGameModeTemporarilyLocked(mode)
      ? `${baseLabel} (${getModeDevelopmentLabel()})`
      : baseLabel;
  }

  getModeDescription(mode: string): string {
    const config = GameModeRegistry.get(mode) as LocalizedGameModeConfig | null;
    if (config) {
      return this.settings.language === "en"
        ? config.descriptionEn ?? config.description
        : config.descriptionVi ?? config.description;
    }
    if (mode === "EndlessPvEClassic") {
      return t("menu.endlessPvEDescription");
    }
    return t("menu.sandboxDescription");
  }

  ensureCraftRecipesReady(): void {
    if (Array.isArray(this._craftRecipes) && this._craftRecipes.length > 0) return;
    this._craftRecipes = CRAFT_RECIPES.map((r) => ({
      ...r,
      _requiredLabel: (r.requires ?? [])
        .map((id: string) => ITEM_BY_ID[id] ?? { icon: "?", name: id })
        .map((item: { icon: string; name: string }) => `${item.icon} ${item.name}`)
        .join(" + ")
    })).sort((a, b) => (a.tier ?? 1) - (b.tier ?? 1));
  }

  removeMenuInputHandlers(): void {
    if (this._menuWheelHandler) {
      this.input?.off?.("wheel", this._menuWheelHandler);
      this._menuWheelHandler = null;
    }
    if (this._menuEscHandler) {
      this.input?.keyboard?.off?.("keydown-ESC", this._menuEscHandler);
      this._menuEscHandler = null;
    }
    this._menuInputHandlersInstalled = false;
  }

  installMenuInputHandlers(): void {
    this.removeMenuInputHandlers();
    this._menuWheelHandler = (pointer: Phaser.Input.Pointer, objects: unknown[], _deltaX: number, deltaY: number) => {
      if (this.libraryModal?.isOpen()) {
        this.libraryModal.scrollBy?.(deltaY);
        return;
      }
      if (this.achievementPanel?.visible && this.achievementScrollGroup?.wheelTarget && typeof this.achievementScrollGroup.scrollBy === "function") {
        const pointerWithinAchievements = Array.isArray(objects) && objects.includes(this.achievementScrollGroup.wheelTarget)
          ? true
          : typeof this.achievementScrollGroup.containsPoint === "function" && this.achievementScrollGroup.containsPoint(pointer);
        if (pointerWithinAchievements && this.achievementScrollGroup.scrollBy(deltaY)) return;
      }
      if (this.tributeScrollGroup?.wheelTarget && typeof this.tributeScrollGroup.scrollBy === "function") {
        const pointerWithinTribute = Array.isArray(objects) && objects.includes(this.tributeScrollGroup.wheelTarget)
          ? true
          : typeof this.tributeScrollGroup.containsPoint === "function" && this.tributeScrollGroup.containsPoint(pointer);
        if (pointerWithinTribute && this.tributeScrollGroup.scrollBy(deltaY)) return;
      }
      if (this.startPanel?.visible) {
        const scrollGroups = Array.isArray(this.startPanelScrollGroups) ? this.startPanelScrollGroups : [];
        const handled = scrollGroups.some((group) => {
          if (!group?.wheelTarget || typeof group.scrollBy !== "function") return false;
          const pointerWithinGroup = Array.isArray(objects) && objects.includes(group.wheelTarget)
            ? true
            : typeof group.containsPoint === "function" && group.containsPoint(pointer);
          if (!pointerWithinGroup) return false;
          return group.scrollBy(deltaY);
        });
        if (handled) return;
      }
    };
    this._menuEscHandler = () => {
      if (this.libraryModal?.isOpen()) this.libraryModal.hide();
      if (this.achievementPanel?.visible) this.toggleAchievementsPanel(false);
    };
    this.input.on("wheel", this._menuWheelHandler);
    this.input.keyboard?.on("keydown-ESC", this._menuEscHandler);
    this._menuInputHandlersInstalled = true;
  }

  handleScaleResize(): void {
    this.scheduleMenuLayoutRebuild({
      openStartPanel: this.startPanel?.visible === true,
      openSettingsPanel: this.settingsPanel?.visible === true,
      selectedMode: this.selectedMode
    });
  }

  removeResizeListener(): void {
    if (this._mainMenuResizeHandler) {
      this.scale?.off?.("resize", this._mainMenuResizeHandler);
      this._mainMenuResizeHandler = null;
    }
  }

  installResizeListener(): void {
    this.removeResizeListener();
    this._mainMenuResizeHandler = (_gameSize: Phaser.Structs.Size) => {
      this.handleScaleResize();
    };
    this.scale?.on?.("resize", this._mainMenuResizeHandler);
  }

  createFooterInfo(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.footerLeftText = this.add.text(24, h - 18, `${t("menu.lastUpdate")}: ${APP_LAST_UPDATED}\n${t("menu.version")}: ${APP_VERSION_TAG}`, {
      fontFamily: "Consolas",
      fontSize: "14px",
      color: "#a9c6ff",
      lineSpacing: 4
    }).setOrigin(0, 1);
    this.footerRightText = this.add.text(w - 24, h - 18, `DevGOVietnam\n${t("menu.author")}`, {
      fontFamily: "Consolas",
      fontSize: "14px",
      color: "#a9c6ff",
      lineSpacing: 4,
      align: "right"
    }).setOrigin(1, 1);

    // Ảnh M-TP comment ở dưới giữa
    if (this.textures.exists("mtp_comment")) {
      const img = this.add.image(w * 0.5, h - 8, "mtp_comment").setOrigin(0.5, 1);
      // Scale vừa phải, không quá to
      const maxW = Math.min(360, w * 0.3);
      const scale = maxW / img.width;
      img.setScale(scale);
      img.setAlpha(0.85);
      img.setDepth(5);
    }
  }

  resetMenuLayoutState(): void {
    this.headerTitleText = null;
    this.headerSubtitleText = null;
    this.languagePanel = null;
    this.languagePanelTitleText = null;
    this.languagePanelButtons = [];
    this.statusText = null;
    this.startPanel = null;
    this.startInfoText = null;
    this.modeRadioGroup = null;
    this.difficultyRadioGroup = null;
    this.startPanelScrollGroups = [];
    this.tributeScrollGroup = null;
    this.continueButton = null;
    this.tributePanel = null;
    this.tributePanelTitleText = null;
    this.tributePanelSubtitleText = null;
    this.settingsPanel = null;
    this._settingsResult = null;
    this._settingsPanelPromise = null;
    this.libraryModal = null;
    this._libraryModalPromise = null;
    this.achievementButton = null;
    this.achievementPanel = null;
    this.achievementCloseButton = null;
    this.achievementScrollGroup = null;
    this.footerLeftText = null;
    this.footerRightText = null;
    this._startPanelDifficultyLayout = null;
  }

  destroyMenuLayout(): void {
    this._menuLayoutGeneration += 1;
    this.libraryModal?.hide?.();
    this.settingsPanel?.setVisible?.(false);
    this.startPanel?.setVisible?.(false);
    this.children.removeAll(true);
    this.resetMenuLayoutState();
  }

  rebuildMenuLayout({ openStartPanel = false, openSettingsPanel = false, selectedMode = null }: MenuLayoutOptions = {}): void {
    this.destroyMenuLayout();
    if (typeof selectedMode === "string" && selectedMode) {
      this.selectedMode = selectedMode;
    }
    this.selectedMode = normalizeMenuSelectedMode(this.selectedMode);
    this.drawBackground();
    this.createHeader();
    this.createTributePanel();
    this.createMainButtons();
    this.createStartPanel();
    if (openStartPanel) {
      this.startPanel?.setVisible(true);
      this.refreshStartPanel();
    }
    this.createSocialAndDonate();
    this.createFooterInfo();
    if (openSettingsPanel) {
      this.startPanel?.setVisible(false);
      void this.ensureSettingsPanelLoaded().then((panel) => panel?.setVisible?.(true));
    }
  }

  scheduleMenuLayoutRebuild(options: MenuLayoutOptions = {}): void {
    this._scheduledMenuLayoutOptions = options;
    this._menuLayoutRebuildCall?.remove?.(false);
    const rebuild = (): void => {
      this._menuLayoutRebuildCall = null;
      const nextOptions = this._scheduledMenuLayoutOptions ?? options;
      this._scheduledMenuLayoutOptions = null;
      this.rebuildMenuLayout(nextOptions);
    };
    if (this.time?.delayedCall) {
      this._menuLayoutRebuildCall = this.time.delayedCall(0, rebuild);
      return;
    }
    rebuild();
  }

  drawBackground(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const hasMenuVideo = this.cache?.video?.exists?.("menu_bg_video") && typeof this.add?.video === "function";
    const hasMenuImage = this.textures.exists("menu_bg");
    const applyBackgroundCover = (displayObject: BackgroundDisplayObject | null, sourceWidth: number | undefined, sourceHeight: number | undefined): { width: number; height: number; scale: number } => {
      const fitted = computeMenuBackgroundCover(sourceWidth ?? 0, sourceHeight ?? 0, w, h);
      displayObject?.setDisplaySize?.(fitted.width, fitted.height);
      displayObject?.setPosition?.(w * 0.5, h * 0.5);
      return fitted;
    };
    let bgImage: Phaser.GameObjects.Image | null = null;

    if (hasMenuImage) {
      bgImage = this.add.image(w * 0.5, h * 0.5, "menu_bg");
      bgImage?.setOrigin?.(0.5);
      applyBackgroundCover(bgImage, bgImage?.width, bgImage?.height);
      bgImage?.setDepth?.(-3);
    } else {
      const bg = this.add.graphics();
      bg.fillGradientStyle(0x12263a, 0x12263a, 0x0c1728, 0x0c1728, 1);
      bg.fillRect(0, 0, w, h);
    }

    if (hasMenuVideo) {
      const bgVideo = this.add.video(w * 0.5, h * 0.5, "menu_bg_video");
      const revealVideo = (sourceWidth: number, sourceHeight: number): void => {
        applyBackgroundCover(bgVideo, sourceWidth, sourceHeight);
        bgVideo?.setVisible?.(true);
        bgImage?.setVisible?.(false);
      };

      bgVideo?.setOrigin?.(0.5);
      bgVideo?.setMute?.(true);
      bgVideo?.setDepth?.(-2);
      bgVideo?.setVisible?.(false);
      bgVideo?.on?.("created", (_video: unknown, width: number, height: number) => {
        revealVideo(width, height);
      });
      bgVideo?.on?.("textureready", (_video: unknown, texture: { get?: () => { width: number; height: number } | null }) => {
        const baseFrame = texture?.get?.();
        revealVideo(baseFrame?.width ?? 0, baseFrame?.height ?? 0);
      });
      bgVideo?.on?.("error", () => {
        bgVideo?.setVisible?.(false);
        bgImage?.setVisible?.(true);
      });
      const video = bgVideo.video;
      if (Number(video?.videoWidth) > 0 && Number(video?.videoHeight) > 0) {
        revealVideo(video?.videoWidth ?? 0, video?.videoHeight ?? 0);
      }
      bgVideo?.play?.(true);
    }

    const overlay = this.add.rectangle(0, 0, w, h, 0x0a1520, 0.55).setOrigin(0, 0);
    overlay.setDepth(-1);

    const mist = this.add.graphics();
    mist.fillStyle(0x2a7a5e, 0.15);
    mist.fillEllipse(w * 0.2, h * 0.75, w * 0.45, h * 0.36);
    mist.fillStyle(0x5d96d1, 0.12);
    mist.fillEllipse(w * 0.76, h * 0.26, w * 0.4, h * 0.33);
  }

  createHeader(): void {
    const w = this.scale.width;
    this.headerTitleText = this.add.text(w * 0.5, 96, t("menu.title"), {
      fontFamily: "Trebuchet MS",
      fontSize: "58px",
      color: "#f6f1d5",
      fontStyle: "bold"
    }).setOrigin(0.5);

    this.headerSubtitleText = this.add.text(w * 0.5, 154, t("menu.subtitle"), {
      fontFamily: "Consolas",
      fontSize: "24px",
      color: "#b7d9ff"
    }).setOrigin(0.5);

    this.createLanguagePanel();
  }

  getLanguagePanelEntries(): LanguagePanelEntry[] {
    const locales = getAvailableLocales();
    const priority: Locale[] = ["en", "vi"];
    const orderedLocales = [
      ...priority.filter((locale) => locales.includes(locale)),
      ...locales.filter((locale) => !priority.includes(locale))
    ];
    return orderedLocales.map((locale) => ({
      locale,
      label: getLocaleLabel(locale)
    }));
  }

  createLanguagePanel(): void {
    const w = this.scale.width;
    const entries = this.getLanguagePanelEntries();
    const panelWidth = Math.min(292, Math.max(236, Math.floor(w * 0.25)));
    const panelLeft = -panelWidth + 14;
    const columns = Math.min(2, Math.max(1, entries.length));
    const buttonGap = 10;
    const rowGap = 8;
    const buttonWidth = Math.floor((panelWidth - 28 - buttonGap * (columns - 1)) / columns);
    const buttonHeight = 34;
    const buttonTop = 46;
    const rows = Math.max(1, Math.ceil(entries.length / columns));
    const panelHeight = 46 + rows * buttonHeight + Math.max(0, rows - 1) * rowGap + 12;

    this.languagePanel = this.add.container(w - 28, 34).setDepth(30);

    const panelBg = this.add.rectangle(0, 0, panelWidth, panelHeight, 0x102338, 0.9).setOrigin(1, 0);
    panelBg.setStrokeStyle(1, 0x8bc8ff, 0.72);
    const accentBar = this.add.rectangle(-panelWidth + 6, 8, 4, panelHeight - 16, 0x8bc8ff, 0.92).setOrigin(0, 0);

    this.languagePanelTitleText = this.add.text(panelLeft, 12, "", {
      fontFamily: "Consolas",
      fontSize: "15px",
      color: "#7fd4ff",
      fontStyle: "bold"
    }).setOrigin(0, 0);

    this.languagePanel.add([panelBg, accentBar, this.languagePanelTitleText]);
    this.languagePanelButtons = entries.map((entry, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = panelLeft + col * (buttonWidth + buttonGap);
      const y = buttonTop + row * (buttonHeight + rowGap);
      return this.createLanguagePanelButton(x, y, buttonWidth, buttonHeight, entry.locale);
    });
    this.refreshLanguagePanel();
  }

  createLanguagePanelButton(x: number, y: number, width: number, height: number, locale: string): LanguagePanelButton {
    const bg = this.add.rectangle(x, y, width, height, 0x233850, 0.78).setOrigin(0, 0);
    bg.setStrokeStyle(1, 0x6f99c9, 0.8);
    bg.setInteractive({ useHandCursor: true });
    const label = this.add.text(x + width * 0.5, y + height * 0.5, getLocaleLabel(locale), {
      fontFamily: "Consolas",
      fontSize: "16px",
      color: "#e7f4ff"
    }).setOrigin(0.5);

    const button: LanguagePanelButton = {
      locale,
      bg,
      label,
      selected: false,
      setLabel: (value: string): LanguagePanelButton => {
        label.setText(value);
        return button;
      },
      setSelected: (selected: boolean): LanguagePanelButton => {
        button.selected = selected === true;
        bg.setFillStyle(button.selected ? 0x2f8f6f : 0x233850, button.selected ? 0.96 : 0.78);
        bg.setStrokeStyle(1, button.selected ? 0x8bffd7 : 0x6f99c9, 1);
        label.setColor(button.selected ? "#ffffff" : "#dbeeff");
        label.setFontStyle(button.selected ? "bold" : "normal");
        return button;
      }
    };

    bg.on("pointerover", () => {
      if (button.selected) return;
      bg.setFillStyle(0x2f4d6a, 0.9);
      label.setColor("#ffffff");
    });
    bg.on("pointerout", () => {
      if (button.selected) return;
      bg.setFillStyle(0x233850, 0.78);
      label.setColor("#dbeeff");
    });
    bg.on("pointerdown", () => {
      this.selectLanguage(locale);
    });

    this.languagePanel?.add([bg, label]);
    return button;
  }

  selectLanguage(locale: string): void {
    const selectedLocale = getAvailableLocales().find((availableLocale) => availableLocale === locale);
    if (!selectedLocale) return;
    if (this.settings?.language === locale) return;
    this.settings.language = selectedLocale;
    const success = saveUiSettings(this.settings);
    if (!success) {
      this.flashStatus(t("menu.memoryError"));
    }
  }

  refreshLanguagePanel(): void {
    this.languagePanelTitleText?.setText(t("menu.languagePanelLabel"));
    const currentLocale = this.settings?.language ?? "vi";
    const localeLabels = new Map<string, string>(this.getLanguagePanelEntries().map((entry) => [entry.locale, entry.label]));
    this.languagePanelButtons?.forEach((button) => {
      button.setLabel(localeLabels.get(button.locale) ?? getLocaleLabel(button.locale));
      button.setSelected(button.locale === currentLocale);
    });
  }

  refreshAchievementProfile(): EndlessProfile {
    this.endlessAchievementProfile = loadEndlessAchievementProfile();
    return this.endlessAchievementProfile;
  }

  refreshCollectionProfile(): CollectionProfile {
    this.collectionProfile = loadCollectionProfile();
    return this.collectionProfile;
  }

  getAchievementButtonLabel(): string {
    const achievementProfile = this.refreshAchievementProfile();
    const collectionProfile = this.refreshCollectionProfile();
    return getEndlessAchievementButtonLabel(
      achievementProfile,
      undefined,
      getEndlessAchievementClaimableCount(achievementProfile, collectionProfile)
    );
  }

  refreshAchievementButton(): void {
    this.achievementButton?.setLabel(getMenuAchievementsButtonLabel(this.getAchievementButtonLabel()));
  }

  ensureAchievementsPanelLoaded(): Phaser.GameObjects.Container | null {
    this.refreshAchievementProfile();
    this.refreshCollectionProfile();
    this.achievementPanel?.destroy?.(true);
    this.achievementPanel = null;
    this.achievementScrollGroup = null;
    this.achievementCloseButton = null;
    return createMainMenuAchievementsPanel(this as unknown as Parameters<typeof createMainMenuAchievementsPanel>[0]);
  }

  toggleAchievementsPanel(force: boolean | null = null): void {
    const next = typeof force === "boolean" ? force : !this.achievementPanel?.visible;
    if (!next) {
      this.achievementPanel?.setVisible(false);
      return;
    }

    this.startPanel?.setVisible(false);
    this.settingsPanel?.setVisible(false);
    this.libraryModal?.hide?.();
    const panel = this.ensureAchievementsPanelLoaded();
    panel?.setVisible(true);
  }

  createMainButtons(): void {
    const w = this.scale.width;
    const startY = 250;
    const buttonX = w * 0.5;
    const gap = 70;
    const buttonWidth = 480;

    this.continueButton = this.createButton(buttonX, startY, buttonWidth, 56, getMenuContinueButtonLabel(), () => {
      this.continueRun();
    }, 0x2b5874, 0x9cd0ff);

    this.newGameButton = this.createButton(buttonX, startY + gap, buttonWidth, 56, getMenuNewGameButtonLabel(), () => {
      this.openStartPanel();
    }, 0x2f8f6f, 0x8bffd7);

    this.settingsButton = this.createButton(buttonX, startY + gap * 2, buttonWidth, 50, getMenuSettingsButtonLabel(), () => {
      this.toggleSettingsPanel();
    }, 0x284b78, 0x9cd0ff);

    this.libraryButton = this.createButton(buttonX, startY + gap * 3 - 4, buttonWidth, 50, getMenuLibraryButtonLabel(), () => {
      this.startPanel?.setVisible(false);
      this.settingsPanel?.setVisible(false);
      this.toggleAchievementsPanel(false);
      this.toggleLibraryModal();
    }, 0x2e5f7d, 0x9ed8ff);

    this.achievementButton = this.createButton(buttonX, startY + gap * 4 - 8, buttonWidth, 50, getMenuAchievementsButtonLabel(this.getAchievementButtonLabel()), () => {
      this.toggleAchievementsPanel();
    }, 0x3a5f82, 0xb0e4ff);

    this.statusText = this.add.text(buttonX, startY + 338, "", {
      fontFamily: "Consolas",
      fontSize: "17px",
      color: "#ccecff"
    }).setOrigin(0.5);

    this.refreshMainButtons();
  }

  openStartPanel(): void {
    this.toggleAchievementsPanel(false);
    this.selectedMode = normalizeMenuSelectedMode(this.selectedMode);
    this.startPanel?.setVisible(!this.startPanel.visible);
  }

  startNewRun(): void {
    if (isGameModeTemporarilyLocked(this.selectedMode)) {
      this.flashStatus?.(t("menu.modeLockedMessage"));
      this.startEnterButton?.setEnabled?.(false);
      this.startEnterButton?.setLabel?.(prefixButtonEmoji("⏳", getModeDevelopmentLabel()));
      return;
    }

    const effectiveAiMode = typeof this.getEffectiveAiMode === "function"
      ? this.getEffectiveAiMode()
      : getEffectiveAiModeForGameMode(this.selectedMode, this.settings?.aiMode);
    const route = getNewGameRoute({
      aiMode: effectiveAiMode,
      gameModeId: this.selectedMode
    });

    if (route === NEW_GAME_ROUTE_SOLO) {
      clearRunProgress();
      this.savedRun = null;
      startManagedScene(this, "PlanningScene", {
        settings: {
          ...this.settings,
          aiMode: effectiveAiMode
        },
        mode: this.selectedMode,
        aiMode: effectiveAiMode,
        forceNewRun: true
      });
      return;
    }

    if (route === NEW_GAME_ROUTE_FORTRESS_MAP) {
      clearRunProgress();
      this.savedRun = null;
      startManagedScene(this, "FortressMapScene", {
        settings: {
          ...this.settings,
          aiMode: effectiveAiMode
        },
        mode: this.selectedMode,
        aiMode: effectiveAiMode,
        forceNewRun: true
      });
      return;
    }

    if (route === NEW_GAME_ROUTE_COOP_LOBBY) {
      startManagedScene(this, "CoopLobbyScene", {
        settings: {
          ...this.settings,
          aiMode: effectiveAiMode
        },
        selectedMode: this.selectedMode,
        aiMode: effectiveAiMode,
        requiredPlayerCapacity: getRequiredPlayerCapacityForGameMode(this.selectedMode, effectiveAiMode)
      });
    }
  }

  continueRun(): void {
    const restored = this.savedRun ?? hydrateRunState(loadProgress());
    if (!restored) {
      this.flashStatus(t("menu.noSaveFound"));
      this.refreshMainButtons();
      return;
    }
    this.savedRun = restored;
    const restoredMode = restored.player?.gameMode ?? this.selectedMode;
    if (isGameModeTemporarilyLocked(restoredMode)) {
      this.flashStatus?.(t("menu.modeLockedMessage"));
      this.refreshMainButtons?.();
      return;
    }
    this.selectedMode = restoredMode;
    this.setGameModeAiSelection(restoredMode, restored.aiMode ?? this.settings.aiMode);
    if (typeof restored.audioEnabled === "boolean") {
      this.settings.audioEnabled = restored.audioEnabled;
      this.audioFx?.setEnabled(restored.audioEnabled);
    }
    if (isEndlessFortressMode(restoredMode)) {
      const pendingNode = getFortressPendingNode(restored.player);
      if (pendingNode) {
        startManagedScene(this, "PlanningScene", {
          settings: this.settings,
          mode: restoredMode,
          restoredState: restored
        });
        return;
      }
      startManagedScene(this, "FortressMapScene", {
        settings: this.settings,
        mode: restoredMode,
        restoredState: restored
      });
      return;
    }
    startManagedScene(this, "PlanningScene", {
      settings: this.settings,
      mode: restored.player?.gameMode ?? this.selectedMode,
      restoredState: restored
    });
  }

  createStartPanel(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const panelWidth = Math.min(Math.floor(w * 0.92), 980);
    const panelHeight = Math.min(Math.max(520, Math.floor(h * 0.74)), h - 44);
    const panel = this.add.container(w * 0.5, h * 0.5);
    panel.setDepth(100);
    panel.setVisible(false);

    const bg = this.add.rectangle(0, 0, panelWidth, panelHeight, 0x0f1a2b, 0.97);
    bg.setStrokeStyle(2, 0x8bc8ff, 1);
    panel.add(bg);

    const leftX = -panelWidth * 0.5 + 34;
    const topY = -panelHeight * 0.5 + 30;
    const rightWidth = Math.min(320, panelWidth * 0.36);
    const rightX = panelWidth * 0.5 - rightWidth - 34;
    const footerHeight = 88;
    const footerTopY = panelHeight * 0.5 - footerHeight;

    this.startPanelTitleText = this.add.text(leftX, topY, t("menu.selectMode"), {
      fontFamily: "Consolas",
      fontSize: "25px",
      color: "#ffeab0"
    });
    panel.add(this.startPanelTitleText);

    this.startInfoText = this.add.text(leftX, topY + 74, "", {
      fontFamily: "Consolas",
      fontSize: "18px",
      color: "#c9e7ff",
      lineSpacing: 5,
      wordWrap: { width: panelWidth * 0.5 }
    });
    panel.add(this.startInfoText);

    // Get available game modes from registry
    const availableModes: GameModeConfig[] = GameModeRegistry.getAll();
    const modeOptions: RadioOption[] = availableModes.map(mode => ({
      value: mode.id,
      label: this.getModeMenuOptionLabel(mode.id),
      getLabel: () => this.getModeMenuOptionLabel(mode.id),
      disabled: isGameModeTemporarilyLocked(mode.id)
    }));

    // Add placeholder for future modes if no modes registered
    if (modeOptions.length === 0) {
      modeOptions.push(
        { value: "EndlessPvEClassic", label: this.getModeLabel("EndlessPvEClassic"), getLabel: () => this.getModeLabel("EndlessPvEClassic") },
        { value: "PVE_SANDBOX", label: t("menu.sandboxLocked"), getLabel: () => t("menu.sandboxLocked"), disabled: true }
      );
    }

    this.modeRadioGroup = this.createRadioGroup({
      parent: panel,
      x: rightX,
      y: topY + 12,
      width: rightWidth,
      maxHeight: 74,
      title: () => t("difficulty.mode"),
      options: modeOptions,
      getValue: () => this.selectedMode,
      onChange: (value: string, option?: RadioOption) => {
        if (option?.disabled) return;
        this.selectedMode = value;
        this.syncGameModeAiSelection(value);
        saveUiSettings(this.settings);
        this.rebuildDifficultyRadioGroup();
        this.refreshSettingsPanel();
        this.refreshStartPanel();
      }
    });

    this._startPanelDifficultyLayout = {
      parent: panel,
      x: rightX,
      y: topY + 170,
      width: rightWidth,
      maxHeight: Math.max(110, footerTopY - (topY + 170 + 48) - 10)
    };
    this.rebuildDifficultyRadioGroup();

    const footerDivider = this.add.line(0, footerTopY - 14, -panelWidth * 0.5 + 20, 0, panelWidth * 0.5 - 20, 0, 0x27415f, 0.95);
    footerDivider.setLineWidth(1, 1);
    panel.add(footerDivider);

    const actionY = panelHeight * 0.5 - 36;
    this.startEnterButton = this.createButton(-102, actionY, 220, 50, getMenuEnterGameButtonLabel(), () => {
      this.startNewRun();
    }, 0x2f8f6f, 0x8bffd7, panel);

    this.startCloseButton = this.createButton(156, actionY, 220, 50, getMenuCloseButtonLabel(), () => {
      panel.setVisible(false);
    }, 0x3b4e66, 0xb6d3ff, panel);

    this.startPanel = panel;
    this.refreshStartPanel();
  }

  ensureLibraryModalLoaded(): Promise<NonNullable<MainMenuScene["libraryModal"]>> {
    if (this.libraryModal) return Promise.resolve(this.libraryModal);
    if (!this._libraryModalPromise) {
      this._libraryModalPromise = loadLibraryModalModule()
        .then(({ LibraryModal: LoadedLibraryModal }) => {
          if (!this.libraryModal) {
            const LibraryModalClass = LoadedLibraryModal as unknown as LibraryModalConstructor;
            this.libraryModal = new LibraryModalClass(this, {
              title: t("library.title"),
              onCollectionProfileChanged: (profile: CollectionProfile) => {
                this.collectionProfile = profile;
                this.refreshAchievementButton();
              }
            });
          }
          return this.libraryModal;
        })
        .finally(() => {
          this._libraryModalPromise = null;
        });
    }
    return this._libraryModalPromise as Promise<NonNullable<MainMenuScene["libraryModal"]>>;
  }

  ensureSettingsPanelLoaded(): Promise<Phaser.GameObjects.Container | null> {
    if (this.settingsPanel && this.settingsPanel.active !== false) return Promise.resolve(this.settingsPanel);
    if (this.settingsPanel) {
      this.settingsPanel = null;
      this._settingsResult = null;
    }
    if (this._settingsPanelPromise) return this._settingsPanelPromise;

    const w = this.scale.width;
    const h = this.scale.height;
    const layoutGeneration = this._menuLayoutGeneration;

    const checkSave = (success: boolean): void => {
      if (!success) this.flashStatus(t("menu.memoryError"));
    };

    this._settingsPanelPromise = loadCombatSettingsPanelModule().then(({ buildSettingsPanel }) => {
      const panelBuilder = buildSettingsPanel as unknown as SettingsPanelBuilder;
      const sp = panelBuilder(this, {
        context: "menu",
        shortcutContext: "menu",
        callbacks: {
          toggleAudio: () => {
            this.settings.audioEnabled = !this.settings.audioEnabled;
            checkSave(saveUiSettings(this.settings));
            this.refreshSettingsPanel();
          },
          changeVolume: (delta: number) => {
            const cur = Number.isFinite(this.settings.volumeLevel) ? this.settings.volumeLevel : 10;
            const next = Math.max(1, Math.min(10, cur + delta));
            if (next === cur) return;
            this.settings.volumeLevel = next;
            checkSave(saveUiSettings(this.settings));
            this.refreshSettingsPanel();
          },
          changeLanguage: () => {
            const locales = getAvailableLocales();
            const idx = locales.indexOf(this.settings.language ?? "vi");
            this.settings.language = locales[(idx + 1) % locales.length];
            checkSave(saveUiSettings(this.settings));
          },
          changeResolution: (delta: number = 1) => {
            const reopenSettingsPanel = sp.container.visible === true;
            const next = ResolutionManager.changeResolution(this.settings.resolutionKey, delta);
            ResolutionManager.applyResolution(this, next.key, this.settings, (err: string) => this.flashStatus(err));
            checkSave(saveUiSettings(this.settings));
            this.applyDisplaySettings(this.settings);
            this.scheduleMenuLayoutRebuild({
              openSettingsPanel: reopenSettingsPanel,
              openStartPanel: this.startPanel?.visible === true && !reopenSettingsPanel,
              selectedMode: this.selectedMode
            });
          },
          changeTooltip: (delta: number = 1) => {
            this.settings.tooltipMode = stepTooltipMode(this.settings.tooltipMode, delta);
            this.settings.expandedTooltip = this.settings.tooltipMode === "expanded";
            checkSave(saveUiSettings(this.settings));
            this.refreshSettingsPanel();
          },
          changeSubtitle: () => {
            this.settings.subtitleEnabled = !this.settings.subtitleEnabled;
            checkSave(saveUiSettings(this.settings));
            this.refreshSettingsPanel();
          },
          close: () => {
            sp.container.setVisible(false);
          }
        }
      });

      sp.container.setPosition(w * 0.5, h * 0.72);
      sp.container.setVisible(false);
      if (layoutGeneration !== this._menuLayoutGeneration) {
        sp.container.destroy?.(true);
        return this.settingsPanel ?? null;
      }
      this._settingsResult = sp;
      this.settingsPanel = sp.container;
      this.refreshSettingsPanel();
      return this.settingsPanel;
    }).finally(() => {
      this._settingsPanelPromise = null;
    });

    return this._settingsPanelPromise;
  }

  toggleSettingsPanel(): void {
    this.toggleAchievementsPanel(false);
    if (this.settingsPanel && this.settingsPanel.active !== false) {
      this.settingsPanel.setVisible(!this.settingsPanel.visible);
      return;
    }
    this.settingsPanel = null;
    this._settingsResult = null;
    void this.ensureSettingsPanelLoaded().then((panel) => {
      panel?.setVisible?.(true);
    });
  }

  toggleLibraryModal(): void {
    this.startPanel?.setVisible(false);
    this.settingsPanel?.setVisible(false);
    this.toggleAchievementsPanel(false);
    if (this.libraryModal) {
      this.libraryModal.toggle();
      return;
    }
    void this.ensureLibraryModalLoaded().then((modal) => modal.toggle());
  }

  createButton(x: number, y: number, w: number, h: number, label: string, onClick: () => void, fill: number, stroke: number, parent: Phaser.GameObjects.Container | null = null): MenuButton {
    const buttonFactory = createMenuButton as unknown as MenuButtonFactory;
    return buttonFactory(this, x, y, w, h, label, onClick, fill, stroke, parent);
  }

  refreshMainButtons(): void {
    if (!this.continueButton) return;
    const restored = this.savedRun ?? hydrateRunState(loadProgress());
    this.savedRun = restored;
    if (!restored) {
      this.continueButton.setLabel(getMenuContinueButtonLabel());
      this.continueButton.setEnabled(false);
      this.newGameButton?.setLabel(getMenuNewGameButtonLabel());
      this.settingsButton?.setLabel(getMenuSettingsButtonLabel());
      this.libraryButton?.setLabel(getMenuLibraryButtonLabel());
      this.refreshAchievementButton();
      return;
    }
    const restoredMode = restored.player?.gameMode ?? this.selectedMode;
    if (isGameModeTemporarilyLocked(restoredMode)) {
      this.continueButton.setLabel(prefixButtonEmoji("▶", getLockedContinueLabel()));
      this.newGameButton?.setLabel(getMenuNewGameButtonLabel());
      this.settingsButton?.setLabel(getMenuSettingsButtonLabel());
      this.libraryButton?.setLabel(getMenuLibraryButtonLabel());
      this.refreshAchievementButton();
      this.continueButton.setEnabled(false);
      return;
    }
    const round = restored.player?.round ?? 1;
    const loseCondition = normalizeLoseCondition(restored.player?.loseCondition ?? this.settings?.loseCondition);
    const hp = Math.max(0, Math.floor(restored.player?.hp ?? 0));
    const loseLabel = loseCondition === "NO_HEARTS" ? `${getLoseConditionLabel(loseCondition)} (${t("menu.heartsRemaining", { count: hp })})` : getLoseConditionLabel(loseCondition);
    void loseLabel;
    this.continueButton.setLabel(getMenuContinueButtonLabel(round));
    this.newGameButton?.setLabel(getMenuNewGameButtonLabel());
    this.settingsButton?.setLabel(getMenuSettingsButtonLabel());
    this.libraryButton?.setLabel(getMenuLibraryButtonLabel());
    this.refreshAchievementButton();
    this.continueButton.setEnabled(true);
  }

  createRadioGroup(opts: { parent: Phaser.GameObjects.Container; x: number; y: number; width: number; title: string | (() => string); options: RadioOption[]; getValue: () => string; onChange: (value: string, option?: RadioOption) => void; maxHeight?: number | null }): RadioGroup {
    return createMenuRadioGroup(this, opts) as RadioGroup;
  }

  refreshSettingsPanel(): void {
    this.audioFx?.setEnabled(this.settings.audioEnabled !== false);
    this.audioFx?.setVolumeLevel(this.settings.volumeLevel ?? 10);
    this._settingsResult?.refresh(this.settings);
  }

  applyDisplaySettings(settings: UiSettings): void {
    applySceneDisplaySettings(this, settings);
  }

  refreshStartPanel(): void {
    if (!this.startInfoText) return;

    // Get mode config from registry
    const modeConfig: GameModeConfig | null = GameModeRegistry.get(this.selectedMode);
    const modeLabel = modeConfig ? this.getModeLabel(this.selectedMode) : this.getModeLabel(this.selectedMode);
    const modeDesc = this.getModeDescription(this.selectedMode);
    const effectiveAiMode = this.getEffectiveAiMode();
    const modeLocked = isGameModeTemporarilyLocked(this.selectedMode);
    const infoLines: string[] = [
      t("menu.startMode", { label: modeLabel }),
      t("menu.startDifficulty", {
        label: isPvpGameMode(this.selectedMode)
          ? `${this.getAiLabel(effectiveAiMode)} • ${t("menu.playerCount", { count: getRequiredPlayerCapacityForGameMode(this.selectedMode, effectiveAiMode) })}`
          : this.getAiLabel(effectiveAiMode)
      }),
      effectiveAiMode === "CREATIVE" ? t("difficulty.creativeHint") : "",
      "",
      modeDesc
    ];
    if (modeLocked) {
      infoLines.push("", t("menu.modeLockedMessage"));
    } else if (hasTemporarilyLockedModes()) {
      infoLines.push("", t("menu.modesInDevelopmentNote"));
    }

    this.startInfoText.setText(infoLines.join("\n"));
    this.startPanelTitleText?.setText(t("menu.selectMode"));
    this.startEnterButton?.setLabel(modeLocked ? prefixButtonEmoji("⏳", getModeDevelopmentLabel()) : getMenuEnterGameButtonLabel());
    this.startEnterButton?.setEnabled?.(!modeLocked);
    this.startCloseButton?.setLabel(getMenuCloseButtonLabel());
    this.modeRadioGroup?.refresh();
    this.difficultyRadioGroup?.refresh();
  }

  flashStatus(message: string): void {
    if (!this.statusText) return;
    this.statusText.setText(message);
    this.tweens.add({
      targets: this.statusText,
      alpha: 0,
      duration: 1600,
      ease: "Cubic.easeIn",
      onStart: () => this.statusText?.setAlpha(1),
      onComplete: () => this.statusText?.setText("")
    });
  }

  claimAchievementReward(achievementId: string): boolean {
    const rewardSkin = getSkinByAchievementId(achievementId);
    if (!rewardSkin) {
      this.flashStatus(t("skins.rewardUnavailable"));
      return false;
    }

    const typedRewardSkin = rewardSkin as SkinRewardLike;
    const nextProfile = claimAchievementSkin(this.refreshCollectionProfile(), achievementId, typedRewardSkin.skinId);
    if (!saveCollectionProfile(nextProfile)) {
      this.flashStatus(t("menu.memoryError"));
      return false;
    }
    this.collectionProfile = nextProfile;
    this.refreshAchievementButton();
    if (this.achievementPanel?.visible) {
      this.ensureAchievementsPanelLoaded()?.setVisible(true);
    }
    this.libraryModal?.refresh?.();
    const appearance = readUnknownRecord(typedRewardSkin.getAppearance?.(1)) as SkinAppearanceLike | null;
    const rewardUnit = appearance?.displayNameVi
      ?? typedRewardSkin.nameVi
      ?? typedRewardSkin.unitId;
    this.flashStatus(t("skins.addedToLibrary", { unit: rewardUnit }));
    return true;
  }

  createSocialAndDonate(): void {
    _createSocialAndDonate(this as unknown as Parameters<typeof _createSocialAndDonate>[0]);
  }

  createTributePanel(): void {
    createMainMenuTributeGalleryPanel(this);
  }

  refreshLocaleInPlace(): void {
    this.headerTitleText?.setText(t("menu.title"));
    this.headerSubtitleText?.setText(t("menu.subtitle"));
    this.tributePanelTitleText?.setText(t("menu.tributeTitle"));
    this.tributePanelSubtitleText?.setText(t("menu.tributeSubtitle"));
    this.refreshLanguagePanel();
    this.footerLeftText?.setText(`${t("menu.lastUpdate")}: ${APP_LAST_UPDATED}\n${t("menu.version")}: ${APP_VERSION_TAG}`);
    this.footerRightText?.setText(`DevGOVietnam\n${t("menu.author")}`);
    this.refreshMainButtons();
    if (this.achievementPanel?.visible) {
      this.ensureAchievementsPanelLoaded()?.setVisible(true);
    } else {
      this.refreshAchievementButton();
    }
    this.refreshStartPanel();
    this._settingsResult?.refresh?.(this.settings);
    if (this.libraryModal?.isOpen?.()) {
      this.libraryModal.refreshLocale?.();
    } else {
      this.libraryModal?.refreshLocale?.();
    }
  }
}

