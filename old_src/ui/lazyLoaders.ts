type LibraryModalModule = typeof import("./LibraryModal.js");
type TechTreeModalModule = typeof import("./TechTreeModal.js");
type SettingsOverlayModule = typeof import("./SettingsOverlay.js");
type HistoryModalModule = typeof import("./HistoryModal.js");
type VersionInfoModalModule = typeof import("./VersionInfoModal.js");
type SettingsPanelModule = typeof import("./SettingsPanel.js");

let libraryModalModulePromise: Promise<LibraryModalModule> | null = null;
let techTreeModalModulePromise: Promise<TechTreeModalModule> | null = null;
let planningSettingsOverlayModulePromise: Promise<SettingsOverlayModule> | null = null;
let historyModalModulePromise: Promise<HistoryModalModule> | null = null;
let versionInfoModalModulePromise: Promise<VersionInfoModalModule> | null = null;
let combatSettingsPanelModulePromise: Promise<SettingsPanelModule> | null = null;

export function loadLibraryModalModule(): Promise<LibraryModalModule> {
  if (!libraryModalModulePromise) {
    libraryModalModulePromise = import("./LibraryModal.js");
  }
  return libraryModalModulePromise;
}

export function loadTechTreeModalModule(): Promise<TechTreeModalModule> {
  if (!techTreeModalModulePromise) {
    techTreeModalModulePromise = import("./TechTreeModal.js");
  }
  return techTreeModalModulePromise;
}

export function loadPlanningSettingsOverlayModule(): Promise<SettingsOverlayModule> {
  if (!planningSettingsOverlayModulePromise) {
    planningSettingsOverlayModulePromise = import("./SettingsOverlay.js");
  }
  return planningSettingsOverlayModulePromise;
}

export function loadHistoryModalModule(): Promise<HistoryModalModule> {
  if (!historyModalModulePromise) {
    historyModalModulePromise = import("./HistoryModal.js");
  }
  return historyModalModulePromise;
}

export function loadVersionInfoModalModule(): Promise<VersionInfoModalModule> {
  if (!versionInfoModalModulePromise) {
    versionInfoModalModulePromise = import("./VersionInfoModal.js");
  }
  return versionInfoModalModulePromise;
}

export function loadCombatSettingsPanelModule(): Promise<SettingsPanelModule> {
  if (!combatSettingsPanelModulePromise) {
    combatSettingsPanelModulePromise = import("./SettingsPanel.js");
  }
  return combatSettingsPanelModulePromise;
}
