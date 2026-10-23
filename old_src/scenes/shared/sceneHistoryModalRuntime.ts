interface HistoryModalScene {
  historyModalParts?: unknown[];
  _historyModalPromise?: Promise<unknown[]> | null;
  _refreshHistoryContent?: (...args: unknown[]) => unknown;
  historyFilterButtons?: unknown[];
  historyListContainer?: unknown;
  historyListViewport?: unknown;
  historyModalTitle?: unknown;
  historyCloseBg?: unknown;
  historyCloseText?: unknown;
}

interface HistoryModalModule {
  refreshHistoryContent: (...args: unknown[]) => unknown;
  buildHistoryModal: (
    scene: HistoryModalScene,
    filters: unknown
  ) => {
    parts: unknown[];
    filterButtons: unknown[];
    listContainer: unknown;
    listViewport: unknown;
    title?: unknown;
    closeBg?: unknown;
    closeText?: unknown;
  };
}

export function ensureSharedHistoryModalLoaded(
  scene: HistoryModalScene,
  filters: unknown,
  loadModule: () => Promise<HistoryModalModule>
): Promise<unknown[]> {
  if (scene.historyModalParts?.length) {
    return Promise.resolve(scene.historyModalParts);
  }
  if (!scene._historyModalPromise) {
    scene._historyModalPromise = loadModule()
      .then((module) => {
        scene._refreshHistoryContent = module.refreshHistoryContent;
        if (!scene.historyModalParts?.length) {
          const result = module.buildHistoryModal(scene, filters);
          scene.historyModalParts = result.parts;
          scene.historyFilterButtons = result.filterButtons;
          scene.historyListContainer = result.listContainer;
          scene.historyListViewport = result.listViewport;
          scene.historyModalTitle = result.title ?? null;
          scene.historyCloseBg = result.closeBg ?? null;
          scene.historyCloseText = result.closeText ?? null;
        }
        return scene.historyModalParts;
      })
      .finally(() => {
        scene._historyModalPromise = null;
      });
  }
  return scene._historyModalPromise;
}
