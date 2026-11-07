/**
 * ============================================================================
 * Three.js 3D Module — Barrel Exports
 * ============================================================================
 */

export { ThreeFxPool, type PoolLimits, type ActiveTween } from "./ThreeFxPool.js";
export { ThreeCameraManager } from "./ThreeCameraManager.js";
export { ThreeLighting, type LightingOptions } from "./ThreeLighting.js";
export {
  buildBoard,
  gridToWorld,
  benchToWorld,
  applyHighlight,
  clearHighlight,
  clearAllHighlights,
  type BuiltBoard
} from "./ThreeBoard.js";
export { createUnit3D, type Unit3DHandle } from "./ThreeUnitFactory.js";
export {
  createTree,
  createRock,
  createCrystal,
  scatterForestProps,
  disposeProps,
  type ScatterOptions
} from "./ThreeForestProps.js";
export {
  getUiViewportMetrics,
  getUiDeviceContext,
  getUiViewportProfile,
  getUiScaleTokens,
  scaleUiSize,
  scaleFontPx,
  getMinTouchTarget,
  shouldUsePinnedTooltip,
  type ThreeUiSceneLike
} from "./ThreeUiResponsive.js";
export {
  KEYBOARD_BINDING_CONTEXTS,
  normalizeKeyboardBindings,
  getKeyboardBindings,
  getContextKeyboardBindings,
  getBindingActions,
  formatBindingLabel,
  formatBindingBracket,
  toPhaserKeyEvent,
  captureBindingFromKeyboardEvent,
  setKeyboardBinding,
  resetKeyboardBindings,
  installKeyboardBindings,
  watchKeyboardBindings,
  getBindingActionLabel,
  getBindingInfoLines,
  buildKeyboardShortcutHelpLines,
  getKeyboardShortcutHelpText,
  isReservedBindingKey,
  type BindingContext,
  type BindingAction,
  type BindingMap,
  type NormalizedBindingEntry,
  type BindingValue,
  type KeyboardActionHandler,
  type KeyboardHandlers,
  type KeyboardScene,
  type BindingKey,
  type PhaserKeydownEvent,
  type ThreeKeyboardInput,
  type ThreeKeyboardPlugin
} from "./ThreeKeyboardBindings.js";
export {
  GamepadController,
  type GamepadSceneLike,
  type GamepadCallbacks,
  type GamepadControllerConfig,
  type GamepadPadLike,
  type TouchPoint,
  type TouchInputTarget
} from "./ThreeGamepadController.js";
export {
  BOARD_ROWS,
  BOARD_COLS,
  BATTLEFIELD_ROWS,
  BATTLEFIELD_COLS,
  PLAYER_COLS,
  RIGHT_COL_START,
  RIGHT_COL_END,
  BOARD_GAP_COLS,
  TILE_SIZE,
  TILE_SPACING,
  BENCH_DEFAULT_CAP,
  BENCH_MAX_SLOTS,
  SHOP_CARD_COUNT,
  DEFAULT_CAMERA_POSITIONS,
  COLOR_PALETTE,
  type CameraPreset,
  type GraphicsQuality,
  type BoardTileData,
  type Unit3DConfig,
  type CameraConfig,
  type ThreeEngineConfig,
  type PropConfig
} from "./types.js";
export { ThreeApp, type ThreeAppOptions, type ThreeAppScene } from "./ThreeApp.js";
export { ThreeCombatScene, type ThreeCombatSceneData, type ThreeCombatResult } from "./ThreeCombatScene.js";
export { ThreeMainMenuScene, type ThreeMainMenuCallbacks } from "./ThreeMainMenuScene.js";
export { ThreePlanningScene, type ThreePlanningSceneData } from "./ThreePlanningScene.js";
export { ThreeLoadingScene, LoadingScene as ThreeLoadingSceneAlias, type LoadingSceneCopy } from "./ThreeLoadingScene.js";
export { ThreeLazySceneLoaderScene, LazySceneLoaderScene as ThreeLazySceneLoaderSceneAlias, type ThreeLazySceneStatusText } from "./ThreeLazySceneLoaderScene.js";
export {
  attachUnitAvatarStarIdentity,
  buildUnitAvatarModelPlacements,
  createUnitAvatar,
  disposeUnitAvatar,
  type ThreeAvatarSceneLike,
  type ThreeAvatarVisualModule,
  type ThreeAvatarVisualLike,
  type ThreeAvatarContainerLike,
  type CreateThreeUnitAvatarOptions,
  type ThreeUnitAvatarGroup
} from "./ThreeUnitAvatarRenderer.js";
export {
  buildUnitStarVisualLayers as buildThreeUnitStarVisualLayers,
  getAnchorOffset as getThreeStarAnchorOffset,
  type ThreeStarVisualLayersResult
} from "./ThreeStarVisualEffectFactory.js";
export {
  emojiToCodepoints,
  getEmojiTextureKey,
  GAME_EMOJIS,
  UNIQUE_GAME_EMOJIS,
  getEmojiAssetUrl,
  hasEmojiTexture,
  queueEmojiAssets,
  isEmojiAtlasReady,
  createEmojiSprite,
  replaceTextWithEmoji,
  updateEmojiObject,
  createEmojiInContainer,
  disposeEmojiAtlas,
  type ThreeEmojiSprite,
  type EmojiSpriteOptions,
  type EmojiSceneLike
} from "./ThreeEmojiAtlas.js";
export {
  ThreeVfxController,
  VfxController as ThreeVfxControllerAlias,
  type ThreeVfxSceneLike
} from "./ThreeVfx.js";
export {
  BASE_GAME_WIDTH,
  BASE_GAME_HEIGHT,
  GAME_SCALE_CONFIG,
  GAME_RENDER_CONFIG,
  createThreeGameConfig,
  createPhaserGameConfig,
  type ThreeGameConfigOptions,
  type ThreeGameConfigResult
} from "./ThreeGameConfig.js";
export {
  LAZY_SCENE_LOADER_KEY,
  isLazySceneKey,
  isSceneRegistered,
  loadLazySceneClass,
  prewarmLazyScene,
  startManagedScene,
  resetLazySceneRegistry,
  type LazySceneKey,
  type LazySceneClass,
  type SceneRoutingContextLike
} from "./ThreeSceneLazyRouting.js";
export {
  createMenuButton,
  createMenuRadioGroup,
  type MenuButton,
  type RadioOptionLike,
  type RadioGroupConfig,
  type RadioGroup
} from "./ThreeMainMenuUIHelpers.js";
export {
  DONATE_QR_ADD_INFO_MESSAGES,
  pickRandomDonateQrAddInfo,
  buildDonateQrUrl,
  createSocialAndDonate,
  type SceneWithButtonFactory
} from "./ThreeMainMenuSocialDonate.js";
export {
  createMainMenuTributeGalleryPanel,
  type TributeScrollGroup,
  type TributePanelHost
} from "./ThreeMainMenuTributeGalleryPanel.js";
export {
  sortAchievementEntries,
  createMainMenuAchievementsPanel,
  type AchievementEntry,
  type AchievementUiCopy,
  type AchievementsScrollGroup,
  type AchievementsPanelHost
} from "./ThreeMainMenuAchievementsPanel.js";
export {
  fitDockHeaderText,
  computePlanningDockHeaderLayout,
  createPlanningDockHeader,
  type DockHeaderOptions,
  type DockHeaderLayout,
  type DockHeader,
  type TextObjectLike
} from "./ThreePlanningDockHeaderLayout.js";
export {
  createCombatButtons,
  type CombatButton,
  type CombatButtonScene
} from "./ThreeCombatActionButtonsRuntime.js";
export {
  getPlanningActionButtonWidths,
  getPlanningTechTreeButtonLabel,
  getPlanningRollButtonLabel,
  getPlanningLockButtonLabel,
  getPlanningXpButtonLabel,
  getPlanningStartButtonLabel,
  createPlanningButtons,
  type PlanningLayout,
  type PlanningButtons,
  type ActionButtonScene,
  type StartButtonOptions
} from "./ThreePlanningActionButtonsRuntime.js";
export {
  buildCombatTeamStatusModel,
  getCombatHudCardLayout,
  getCombatTopRightButtonLayout,
  getCombatBubblePopupBounds,
  createCombatHud,
  type CombatHudLayout,
  type CombatSide,
  type CombatUnitLike,
  type PowerResolver,
  type BuildTeamStatusOptions,
  type TeamStatusResult,
  type TeamHudColors,
  type TeamStatusHudResult,
  type CombinedTeamStatusHudResult,
  type HudCardLayout,
  type TopRightButtonSpec,
  type TopRightButtonLayout,
  type BubblePopupBounds,
  type HudCardOptions,
  type CombatSceneLike
} from "./ThreeCombatHudRuntime.js";
export {
  showFortressPharmacyModal,
  showFortressBeastDenModal,
  showFortressBlacksmithModal,
  type ModalButton,
  type ModalScene,
  type ServiceOption,
  type ServiceChoice,
  type ModalArgs,
  type PharmacyModalArgs,
  type BeastDenUnit,
  type BeastDenModalArgs,
  type BlacksmithModalArgs
} from "./ThreeFortressServiceModalRuntime.js";
export {
  TOP_HEADER_BUTTON_ORDER,
  getPlanningTopButtonWidths,
  computePlanningTopHeaderMetrics,
  computePlanningTeamStatusStripMetrics,
  layoutPlanningHeaderMeta,
  type TextLike as TopHeaderTextLike,
  type LayoutLike as TopHeaderLayoutLike,
  type TopButtonKey,
  type TopButtonWidths,
  type TopHeaderMetrics,
  type TeamStatusStripMetrics
} from "./ThreePlanningTopHeaderLayout.js";
export {
  setPlanningAIMode,
  planningCycleAiMode,
  getPlanningConfiguredLoseCondition,
  getPlanningConfiguredStartingHp,
  isPlanningEndlessFortressMode,
  ensurePlanningFortressMeta,
  startPlanningFortressMapScene,
  getPlanningLoseCondition,
  setPlanningLoseCondition,
  togglePlanningLoseCondition,
  type FortressFortMeta,
  type FortressPlayer,
  type FortressGameModeConfig,
  type FortressScene,
  type LoseFallback
} from "./ThreePlanningFortressHelpersRuntime.js";
export {
  applySceneHealUnit
} from "./ThreeHealUnitRuntime.js";
export {
  processSharedStartTurn
} from "./ThreeStatusTurnRuntime.js";

export default {
  module: "three",
  backend: "three@^0.186.0 (pure, no plugins)"
};
