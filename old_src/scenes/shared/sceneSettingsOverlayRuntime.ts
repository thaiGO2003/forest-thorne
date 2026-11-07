import { safeSetVisible } from "../../ui/displayObjectGuards.js";

type OptionalFn = (() => void) | undefined;
type EnsureLoadedFn = (() => Promise<unknown[]>) | undefined;
type ClearReferencesFn = (() => void) | undefined;
type OnShowFn = (() => void) | undefined;

interface SettingsOverlayScene {
  settingsOverlay?: unknown[];
  settingsVisible?: boolean;
  _settingsOverlayPromise?: Promise<unknown[]> | null;
  _settingsCloseShortcutsView?: OptionalFn;
  _settingsRefresh?: (settings: unknown, audioFx: unknown) => void;
  _refreshSettingsOverlayLabels?: (settings: unknown, force: boolean) => void;
  modalButtons?: Record<string, unknown>;
  _settingsPanelObj?: unknown;
  tooltip?: { hide?: () => void };
  [key: string]: unknown;
}

export function ensureSharedSettingsOverlayLoaded(
  scene: SettingsOverlayScene,
  loadOverlay: () => Promise<unknown>
): Promise<unknown[]> {
  if (Array.isArray(scene?.settingsOverlay) && scene.settingsOverlay.length) {
    return Promise.resolve(scene.settingsOverlay);
  }
  if (!scene._settingsOverlayPromise) {
    const existingOverlay = (scene as { settingsOverlay?: unknown[] }).settingsOverlay;
    const loadPromise = Promise.resolve(loadOverlay?.());
    const overlayPromise: Promise<unknown[]> = loadPromise.then(
      (overlay) => (overlay as unknown[] | undefined) ?? existingOverlay ?? []
    );
    const finalPromise = overlayPromise.finally(() => {
      scene._settingsOverlayPromise = null;
    }) as unknown as Promise<unknown[]>;
    scene._settingsOverlayPromise = finalPromise;
  }
  return scene._settingsOverlayPromise ?? Promise.resolve([]);
}

export function toggleSharedSettingsOverlay(
  scene: SettingsOverlayScene,
  force: boolean | null = null,
  options: { ensureLoaded?: EnsureLoadedFn; onShow?: OnShowFn; onHide?: OnShowFn } = {}
): void {
  const { ensureLoaded, onShow, onHide } = options;
  const wasVisible = scene.settingsVisible === true;
  const next = typeof force === "boolean" ? force : !wasVisible;
  scene.settingsVisible = next;
  scene.tooltip?.hide?.();
  if (!next) {
    if (wasVisible) {
      onHide?.();
    }
    (scene.settingsOverlay ?? []).forEach((entry: unknown) => safeSetVisible(entry, false));
    return;
  }

  if (wasVisible && Array.isArray(scene.settingsOverlay) && scene.settingsOverlay.length) {
    onShow?.();
    scene.settingsOverlay.forEach((entry: unknown) => safeSetVisible(entry, true));
    scene._settingsCloseShortcutsView?.();
    return;
  }

  void ensureLoaded?.().then(() => {
    if (!scene.settingsVisible) return;
    onShow?.();
    (scene.settingsOverlay ?? []).forEach((entry: unknown) => safeSetVisible(entry, true));
    scene._settingsCloseShortcutsView?.();
  });
}

export function clearSharedSettingsOverlayLayoutReferences(
  scene: SettingsOverlayScene,
  options: { resetPanelObject?: boolean } = {}
): void {
  const resetPanelObject = options.resetPanelObject === true;
  scene.settingsOverlay = [];
  scene.modalButtons = {};
  scene._settingsRefresh = undefined;
  scene._refreshSettingsOverlayLabels = undefined;
  if (resetPanelObject) {
    scene._settingsPanelObj = null;
  }
  scene._settingsOverlayPromise = null;
}

export function rebuildSharedSettingsOverlayAfterResolutionChange(
  scene: SettingsOverlayScene,
  preserveVisible: boolean = false,
  options: { ensureLoaded?: EnsureLoadedFn; clearReferences?: ClearReferencesFn; onShow?: OnShowFn } = {}
): Promise<unknown[]> {
  const { ensureLoaded, clearReferences, onShow } = options;
  const shouldShow = preserveVisible === true;
  const oldOverlay = Array.isArray(scene.settingsOverlay) ? [...scene.settingsOverlay] : [];
  clearReferences?.();
  if (!shouldShow) {
    oldOverlay.forEach((entry) => (entry as { destroy?: () => void })?.destroy?.());
    return Promise.resolve([]);
  }
  const ensurePromise = Promise.resolve(ensureLoaded?.());
  return ensurePromise
    .then(() => {
      if (!scene.settingsVisible) return scene.settingsOverlay ?? [];
      onShow?.();
      (scene.settingsOverlay ?? []).forEach((entry: unknown) => safeSetVisible(entry, true));
      scene._settingsCloseShortcutsView?.();
      return scene.settingsOverlay ?? [];
    })
    .finally(() => {
      oldOverlay.forEach((entry) => (entry as { destroy?: () => void })?.destroy?.());
    });
}
