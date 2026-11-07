import type Phaser from "phaser";

export const LAZY_SCENE_LOADER_KEY = "LazySceneLoaderScene";

type LazySceneKey = "PlanningScene" | "CombatScene" | "FortressMapScene" | "CoopLobbyScene";

type LazySceneClass = new (config?: string | Phaser.Types.Scenes.SettingsConfig) => Phaser.Scene;

type LazySceneModuleLoader = () => Promise<LazySceneClass>;

type LazySceneModuleLoaders = Record<LazySceneKey, LazySceneModuleLoader>;

const LAZY_SCENE_MODULE_LOADERS: LazySceneModuleLoaders = {
  PlanningScene: () => import("./PlanningScene.js").then((module) => module.PlanningScene),
  CombatScene: () => import("./CombatScene.js").then((module) => module.CombatScene),
  FortressMapScene: () => import("./FortressMapScene.js").then((module) => module.FortressMapScene),
  CoopLobbyScene: () => import("./CoopLobbyScene.js").then((module) => module.CoopLobbyScene)
};
const LAZY_SCENE_CLASS_PROMISES: Map<LazySceneKey, Promise<LazySceneClass>> = new Map();

export function isLazySceneKey(sceneKey: string): sceneKey is LazySceneKey {
  return typeof LAZY_SCENE_MODULE_LOADERS[sceneKey as LazySceneKey] === "function";
}

export function isSceneRegistered(sceneContext: Phaser.Scene | { scene?: Phaser.Scene } | null | undefined, sceneKey: string): boolean {
  const manager = (sceneContext as { scene?: { manager?: { keys?: Record<string, unknown> } } } | null | undefined)?.scene?.manager;
  return Boolean(manager?.keys?.[sceneKey]);
}

export async function loadLazySceneClass(sceneKey: string): Promise<LazySceneClass> {
  if (!isLazySceneKey(sceneKey)) {
    throw new Error(`Unsupported lazy scene key: ${sceneKey}`);
  }
  const loader = LAZY_SCENE_MODULE_LOADERS[sceneKey];
  let promise = LAZY_SCENE_CLASS_PROMISES.get(sceneKey);
  if (!promise) {
    promise = Promise.resolve()
      .then(() => loader())
      .catch((error: unknown) => {
        LAZY_SCENE_CLASS_PROMISES.delete(sceneKey);
        throw error;
      });
    LAZY_SCENE_CLASS_PROMISES.set(sceneKey, promise);
  }
  return promise;
}

export function prewarmLazyScene(sceneKey: string): Promise<LazySceneClass | null> {
  if (!isLazySceneKey(sceneKey)) return Promise.resolve(null);
  return loadLazySceneClass(sceneKey).catch(() => null);
}

export function startManagedScene(sceneContext: Phaser.Scene, sceneKey: string, sceneData: object | unknown = undefined): "direct" | "lazy" {
  const data: object | undefined = sceneData === undefined ? undefined : (sceneData as object);
  if (!isLazySceneKey(sceneKey) || isSceneRegistered(sceneContext, sceneKey)) {
    sceneContext.scene.start(sceneKey, data);
    return "direct";
  }

  sceneContext.scene.start(LAZY_SCENE_LOADER_KEY, {
    targetKey: sceneKey,
    targetData: data
  });
  return "lazy";
}
