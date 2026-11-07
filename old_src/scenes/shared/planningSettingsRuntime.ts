
import { t } from "../../i18n/index.js";
import { HISTORY_FILTERS } from "../../core/uiTheme.js";
import {
  loadHistoryModalModule,
  loadLibraryModalModule,
  loadPlanningSettingsOverlayModule,
  loadTechTreeModalModule,
  loadVersionInfoModalModule
} from "../../ui/lazyLoaders.js";
import type { SettingsOverlayModalButton } from "../../ui/SettingsOverlay.js";
import { PLANNING_VERSION_INFO } from "./planningSceneConstants.js";

import { createSceneButton } from "../../ui/SceneButton.js";
import { clearPlanningAttackPreview } from "./planningAttackPreviewRuntime.js";
import { refreshPlanningBenchUi } from "./planningBenchRuntime.js";
import { refreshPlanningBoardUi } from "./planningBoardUiRuntime.js";
import { researchPlanningTech } from "./planningTechRuntime.js";
import { destroyPlanningTechTreeModal, hasPlanningUsableTechTreeModal } from "./planningTechTreeModalRuntime.js";

import { clamp } from "../../core/gameUtils.js";
import { safeSetVisible } from "../../ui/displayObjectGuards.js";
import { guardPlanningTutorialAction, recordPlanningTutorialEvent } from "./planningTutorialRuntime.js";
import { ensureSharedHistoryModalLoaded } from "./sceneHistoryModalRuntime.js";
import { clearSharedSettingsOverlayLayoutReferences, ensureSharedSettingsOverlayLoaded, rebuildSharedSettingsOverlayAfterResolutionChange, toggleSharedSettingsOverlay } from "./sceneSettingsOverlayRuntime.js";

interface TutorialOverlayHook {
  handleTrigger?: (event: string) => boolean;
}

interface LibraryModalLike {
  hide: () => void;
  isOpen: () => boolean;
  toggle: () => void;
  setDetailRecipe: (recipeId: string) => void;
  setDetailUnit: (baseId: string) => void;
  show: () => void;
}

interface TechTreeModalLike {
  player: unknown;
  onResearch: (techId: string) => void;
}

interface PlanningSettingsScene {
  aiMode: string;
  settingsVisible: boolean;
  settingsOverlay?: unknown[];
  modalButtons?: Record<string, unknown>;
  _libraryModalPromise?: Promise<unknown> | null;
  _techTreeModalPromise?: Promise<unknown> | null;
  _versionInfoPromise?: Promise<unknown> | null;
  _deferredUiPrewarmDone?: boolean;
  _deferredUiPrewarmPromise?: Promise<unknown> | null;
  _deferredUiPrewarmScheduled?: boolean;
  _deferredUiPrewarmTimer?: Phaser.Time.TimerEvent | null;
  _deferredUiPrewarmIdleId?: number | null;
  _deferredUiPrewarmTimeoutId?: number | null;
  historyModalVisible?: boolean;
  historyFilter?: string;
  historyScrollOffset?: number;
  historyMaxScroll?: number;
  historyListContainer?: { y: number } | null;
  historyListViewport?: { y: number } | null;
  historyModalParts?: Array<{ destroy?: () => void; setVisible?: (v: boolean) => void }>;
  versionInfoVisible?: boolean;
  versionInfoOverlay?: Array<{ setVisible?: (v: boolean) => void }>;
  libraryModal?: LibraryModalLike;
  techTreeModal?: TechTreeModalLike | null;
  tooltip?: { hide?: () => void };
  _refreshHistoryContent?: (scene: unknown, filters: unknown) => void;
  _refreshSettingsOverlayLabels?: (scene: unknown, force: boolean) => void;
  tutorialOverlay?: TutorialOverlayHook | null;
  time?: { delayedCall: (delay: number, callback: () => void) => Phaser.Time.TimerEvent };
  [key: string]: unknown;
}

export function togglePlanningSettingsOverlay(scene: PlanningSettingsScene, force: boolean | null = null): void {
    const next = typeof force === "boolean" ? force : !scene.settingsVisible;
    const action = next ? "open_settings" : "close_settings";
    if (guardPlanningTutorialAction(scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0], action, { buttonKey: next ? "settings" : "close" }) === false) {
      return;
    }
    toggleSharedSettingsOverlay(scene, force, {
      ensureLoaded: () => ensurePlanningSettingsOverlayLoaded(scene),
      onShow: () => {
        togglePlanningHistoryModal(scene, false);
        togglePlanningVersionInfoModal(scene, false);
        scene._refreshSettingsOverlayLabels?.(scene, true);
        recordPlanningTutorialEvent(scene as unknown as Parameters<typeof recordPlanningTutorialEvent>[0], "open_settings");
        scene.tutorialOverlay?.handleTrigger?.("open_settings");
      },
      onHide: () => {
        scene._refreshSettingsOverlayLabels?.(scene, false);
        recordPlanningTutorialEvent(scene as unknown as Parameters<typeof recordPlanningTutorialEvent>[0], "close_settings");
        scene.tutorialOverlay?.handleTrigger?.("close_settings");
      }
    });
}

export function clearPlanningSettingsOverlayLayoutReferences(scene: PlanningSettingsScene): void {
    clearSharedSettingsOverlayLayoutReferences(scene);
}

export function destroyPlanningSettingsOverlayEntries(scene: PlanningSettingsScene, entries: Array<{ destroy?: () => void }> | null | undefined): void {
    entries?.forEach((entry) => entry?.destroy?.());
}

export function rebuildPlanningSettingsOverlayAfterResolutionChange(scene: PlanningSettingsScene, preserveVisible: boolean = false): Promise<unknown[]> {
    return rebuildSharedSettingsOverlayAfterResolutionChange(scene, preserveVisible, {
      ensureLoaded: () => ensurePlanningSettingsOverlayLoaded(scene),
      clearReferences: () => clearPlanningSettingsOverlayLayoutReferences(scene),
      onShow: () => {
        togglePlanningHistoryModal(scene, false);
        togglePlanningVersionInfoModal(scene, false);
        scene._refreshSettingsOverlayLabels?.(scene, true);
      }
    });
}

export function schedulePlanningSettingsOverlayRebuildAfterResolutionChange(scene: PlanningSettingsScene, preserveVisible: boolean = false): void {
    const rebuild = () => {
      void rebuildPlanningSettingsOverlayAfterResolutionChange(scene, preserveVisible);
    };
    if (scene.time?.delayedCall) {
      scene.time.delayedCall(0, rebuild);
      return;
    }
    rebuild();
}

export function togglePlanningHistoryModal(scene: PlanningSettingsScene, force: boolean | null = null): void {
    const wasVisible = scene.historyModalVisible === true;
    const next = typeof force === "boolean" ? force : !scene.historyModalVisible;
    const action = "toggle_history";
    const context = { buttonKey: next ? "history" : "history_close", targetType: next ? "history" : "history_close" };
    if (guardPlanningTutorialAction(scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0], action, context) === false) {
      return;
    }
    if (next === wasVisible) {
      if (next) {
        scene.tooltip?.hide?.();
        refreshPlanningHistoryModal(scene);
      }
      return;
    }
    scene.historyModalVisible = next;
    scene.tooltip?.hide?.();
    if (!next) {
      scene.historyModalParts?.forEach((part) => safeSetVisible(part, false));
      recordPlanningTutorialEvent(scene as unknown as Parameters<typeof recordPlanningTutorialEvent>[0], "close_history");
      scene.tutorialOverlay?.handleTrigger?.("close_history");
      return;
    }

    void ensurePlanningHistoryModalLoaded(scene).then(() => {
      if (!scene.historyModalVisible) return;
      togglePlanningSettingsOverlay(scene, false);
      togglePlanningVersionInfoModal(scene, false);
      scene.libraryModal?.hide();
      scene.historyModalParts?.forEach((part) => safeSetVisible(part, true));
      refreshPlanningHistoryModal(scene);
      recordPlanningTutorialEvent(scene as unknown as Parameters<typeof recordPlanningTutorialEvent>[0], "open_history");
      scene.tutorialOverlay?.handleTrigger?.("open_history");
    });
}

export function togglePlanningVersionInfoModal(scene: PlanningSettingsScene, force: boolean | null = null): void {
    const next = typeof force === "boolean" ? force : !scene.versionInfoVisible;
    if (next && guardPlanningTutorialAction(scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0], "open_version_info") === false) return;
    scene.versionInfoVisible = next;
    if (next) scene.tooltip?.hide?.();
    if (!next) {
      scene.versionInfoOverlay?.forEach((part) => safeSetVisible(part, false));
      return;
    }

    void ensurePlanningVersionInfoModalLoaded(scene).then(() => {
      if (!scene.versionInfoVisible) return;
      togglePlanningSettingsOverlay(scene, false);
      togglePlanningHistoryModal(scene, false);
      scene.libraryModal?.hide();
      scene.versionInfoOverlay?.forEach((part) => safeSetVisible(part, true));
    });
}

export function setPlanningHistoryFilter(scene: PlanningSettingsScene, filterKey: string): void {
    if (guardPlanningTutorialAction(scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0], "history_filter", { filterKey }) === false) return;
    scene.historyFilter = filterKey;
    scene.historyScrollOffset = 0;
    refreshPlanningHistoryModal(scene);
}

export function onPlanningHistoryWheel(scene: PlanningSettingsScene, deltaY: number): void {
    if (!scene.historyModalVisible) return;
    const next = clamp((scene.historyScrollOffset ?? 0) + (deltaY > 0 ? 36 : -36), 0, scene.historyMaxScroll ?? 0);
    scene.historyScrollOffset = next;
    if (scene.historyListContainer && scene.historyListViewport) {
      scene.historyListContainer.y = scene.historyListViewport.y - scene.historyScrollOffset;
    }
}

export function refreshPlanningHistoryModal(scene: PlanningSettingsScene): void {
    scene._refreshHistoryContent?.(scene, HISTORY_FILTERS);
}

export function ensurePlanningLibraryModalLoaded(scene: PlanningSettingsScene): Promise<LibraryModalLike> {
    if (scene.libraryModal) return Promise.resolve(scene.libraryModal);
    if (!scene._libraryModalPromise) {
      scene._libraryModalPromise = loadLibraryModalModule()
        .then(({ LibraryModal }) => {
          if (!scene.libraryModal) {
            scene.libraryModal = new LibraryModal(scene as unknown as ConstructorParameters<typeof LibraryModal>[0], {
              title: t("library.title"),
              deferFirstShowRefresh: true,
              onClose: () => {
                clearPlanningAttackPreview(scene as unknown as Parameters<typeof clearPlanningAttackPreview>[0]);
              },
              onCollectionProfileChanged: (profile: unknown) => {
                scene.collectionProfile = profile;
                refreshPlanningBenchUi(scene as unknown as Parameters<typeof refreshPlanningBenchUi>[0]);
                refreshPlanningBoardUi(scene as unknown as Parameters<typeof refreshPlanningBoardUi>[0]);
              }
            }) as unknown as LibraryModalLike;
          }
          return scene.libraryModal;
        })
        .finally(() => {
          scene._libraryModalPromise = null;
        });
    }
    return scene._libraryModalPromise as Promise<LibraryModalLike>;
}

export function ensurePlanningTechTreeModalLoaded(scene: PlanningSettingsScene): Promise<TechTreeModalLike> {
    if (scene.techTreeModal && !hasPlanningUsableTechTreeModal(scene as unknown as Parameters<typeof hasPlanningUsableTechTreeModal>[0])) {
      destroyPlanningTechTreeModal(scene as unknown as Parameters<typeof destroyPlanningTechTreeModal>[0]);
    }
    if (scene.techTreeModal) {
      scene.techTreeModal.player = scene.player;
      scene.techTreeModal.onResearch = (techId: string) => researchPlanningTech(scene as unknown as Parameters<typeof researchPlanningTech>[0], techId);
      return Promise.resolve(scene.techTreeModal);
    }
    if (!scene._techTreeModalPromise) {
      scene._techTreeModalPromise = loadTechTreeModalModule()
        .then(({ TechTreeModal }) => {
          if (!scene.techTreeModal) {
            scene.techTreeModal = new TechTreeModal(scene as unknown as ConstructorParameters<typeof TechTreeModal>[0], scene.player as unknown as ConstructorParameters<typeof TechTreeModal>[1], (techId: string) => researchPlanningTech(scene as unknown as Parameters<typeof researchPlanningTech>[0], techId)) as unknown as TechTreeModalLike;
          }
          return scene.techTreeModal;
        })
        .finally(() => {
          scene._techTreeModalPromise = null;
        });
    }
    return scene._techTreeModalPromise as Promise<TechTreeModalLike>;
}

export function ensurePlanningSettingsOverlayLoaded(scene: PlanningSettingsScene): Promise<unknown[]> {
    return ensureSharedSettingsOverlayLoaded(scene, () => {
      return loadPlanningSettingsOverlayModule().then((module) => {
        scene._refreshSettingsOverlayLabels = module.refreshSettingsOverlayLabels as unknown as PlanningSettingsScene["_refreshSettingsOverlayLabels"];
        if (!scene.settingsOverlay?.length) {
          const result = module.buildSettingsOverlay(
            scene as unknown as Parameters<typeof module.buildSettingsOverlay>[0],
            (x, y, w, h, label, onClick, opts) => createSceneButton(scene as unknown as Parameters<typeof createSceneButton>[0], x, y, w, h, label, onClick, opts) as unknown as SettingsOverlayModalButton
          );
          scene.settingsOverlay = result.overlay as unknown as PlanningSettingsScene["settingsOverlay"];
          scene.modalButtons = result.modalButtons as unknown as PlanningSettingsScene["modalButtons"];
        }
        return scene.settingsOverlay;
      });
    });
}

export function ensurePlanningHistoryModalLoaded(scene: PlanningSettingsScene): Promise<unknown[]> {
    return ensureSharedHistoryModalLoaded(scene as unknown as Parameters<typeof ensureSharedHistoryModalLoaded>[0], HISTORY_FILTERS, loadHistoryModalModule as unknown as Parameters<typeof ensureSharedHistoryModalLoaded>[2]);
}

export function ensurePlanningVersionInfoModalLoaded(scene: PlanningSettingsScene): Promise<unknown[]> {
    if (scene.versionInfoOverlay?.length) return Promise.resolve(scene.versionInfoOverlay);
    if (!scene._versionInfoPromise) {
      scene._versionInfoPromise = loadVersionInfoModalModule()
        .then(({ buildVersionInfoModal }) => {
          if (!scene.versionInfoOverlay?.length) {
            scene.versionInfoOverlay = buildVersionInfoModal(
              scene as unknown as Parameters<typeof buildVersionInfoModal>[0],
              (x, y, w, h, label, onClick, opts) => createSceneButton(scene as unknown as Parameters<typeof createSceneButton>[0], x, y, w, h, label, onClick, opts),
              PLANNING_VERSION_INFO
            );
          }
          return scene.versionInfoOverlay;
        })
        .finally(() => {
          scene._versionInfoPromise = null;
        });
    }
    return scene._versionInfoPromise as Promise<unknown[]>;
}

export function cancelPlanningDeferredUiPrewarm(scene: PlanningSettingsScene): void {
    if (scene._deferredUiPrewarmIdleId != null && typeof globalThis.cancelIdleCallback === "function") {
      globalThis.cancelIdleCallback(scene._deferredUiPrewarmIdleId);
    }
    scene._deferredUiPrewarmIdleId = null;

    if (scene._deferredUiPrewarmTimer?.remove) {
      scene._deferredUiPrewarmTimer.remove(false);
    }
    scene._deferredUiPrewarmTimer = null;

    if (scene._deferredUiPrewarmTimeoutId != null && typeof globalThis.clearTimeout === "function") {
      globalThis.clearTimeout(scene._deferredUiPrewarmTimeoutId);
    }
    scene._deferredUiPrewarmTimeoutId = null;
    scene._deferredUiPrewarmScheduled = false;
}

export function prewarmPlanningDeferredUiModules(scene: PlanningSettingsScene): Promise<void> {
    if (scene._deferredUiPrewarmDone) return Promise.resolve();
    if (scene._deferredUiPrewarmPromise) return scene._deferredUiPrewarmPromise as Promise<void>;

    const yieldToNextTick = (): Promise<void> => new Promise<void>((resolve) => {
      if (scene.time?.delayedCall) {
        scene.time.delayedCall(0, resolve);
        return;
      }
      if (typeof globalThis.setTimeout === "function") {
        globalThis.setTimeout(resolve, 0);
        return;
      }
      resolve();
    });

    const warmSettings = Promise.resolve()
      .then(() => ensurePlanningSettingsOverlayLoaded(scene))
      .catch((error: unknown) => {
        console.warn("Failed to prewarm PlanningScene settings overlay:", error);
        return null;
      });

    scene._deferredUiPrewarmPromise = warmSettings
      .then(() => yieldToNextTick())
      .then(() => Promise.resolve()
        .then(() => ensurePlanningLibraryModalLoaded(scene))
        .catch((error: unknown) => {
          console.warn("Failed to prewarm PlanningScene library modal:", error);
          return null;
        }))
      .finally(() => {
        scene._deferredUiPrewarmPromise = null;
        scene._deferredUiPrewarmDone = true;
      });

    return scene._deferredUiPrewarmPromise as Promise<void>;
}

export function schedulePlanningDeferredUiPrewarm(scene: PlanningSettingsScene): void {
    if (scene._deferredUiPrewarmDone || scene._deferredUiPrewarmScheduled || scene._deferredUiPrewarmPromise) return;

    const run = () => {
      scene._deferredUiPrewarmIdleId = null;
      scene._deferredUiPrewarmTimer = null;
      scene._deferredUiPrewarmTimeoutId = null;
      scene._deferredUiPrewarmScheduled = false;
      void prewarmPlanningDeferredUiModules(scene);
    };

    scene._deferredUiPrewarmScheduled = true;
    if (typeof globalThis.requestIdleCallback === "function") {
      scene._deferredUiPrewarmIdleId = globalThis.requestIdleCallback(run, { timeout: 800 });
      return;
    }
    if (scene.time?.delayedCall) {
      scene._deferredUiPrewarmTimer = scene.time.delayedCall(0, run);
      return;
    }
    if (typeof globalThis.setTimeout === "function") {
      scene._deferredUiPrewarmTimeoutId = globalThis.setTimeout(run, 0) as unknown as number;
      return;
    }
    run();
}

export function togglePlanningLibraryModal(scene: PlanningSettingsScene): void {
    if (!scene.libraryModal?.isOpen?.() && guardPlanningTutorialAction(scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0], "open_library") === false) {
      return;
    }
    scene.tooltip?.hide?.();
    if (scene.libraryModal) {
      scene.libraryModal.toggle();
      return;
    }
    void ensurePlanningLibraryModalLoaded(scene).then((modal: LibraryModalLike) => modal.toggle());
}

export function openPlanningLibraryRecipeDetail(scene: PlanningSettingsScene, recipeId: string): void {
    if (!recipeId) return;
    if (guardPlanningTutorialAction(scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0], "open_library") === false) return;
    scene.tooltip?.hide?.();
    if (scene.libraryModal) {
      scene.libraryModal.setDetailRecipe(recipeId);
      scene.libraryModal.show();
      return;
    }
    void ensurePlanningLibraryModalLoaded(scene).then((modal: LibraryModalLike) => {
      modal.setDetailRecipe(recipeId);
      modal.show();
    });
}

export function showPlanningLibraryUnitDetail(scene: PlanningSettingsScene, baseId: string): void {
    if (!baseId) return;
    if (guardPlanningTutorialAction(scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0], "open_library") === false) return;
    scene.tooltip?.hide?.();
    if (scene.libraryModal) {
      scene.libraryModal.setDetailUnit(baseId);
      scene.libraryModal.show();
      return;
    }
    void ensurePlanningLibraryModalLoaded(scene).then((modal: LibraryModalLike) => {
      modal.setDetailUnit(baseId);
      modal.show();
    });
}
