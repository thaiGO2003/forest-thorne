/**
 * ThreeSceneLazyRouting.ts
 *
 * Lazy scene loader and routing manager for Three.js.
 * Dynamically loads heavy scene chunks (PlanningScene, CombatScene, FortressMapScene, CoopLobbyScene)
 * on first navigation to minimize initial bundle size and memory pressure.
 */

export const LAZY_SCENE_LOADER_KEY = "LazySceneLoaderScene";

export type LazySceneKey = "PlanningScene" | "CombatScene" | "FortressMapScene" | "CoopLobbyScene";

export type LazySceneClass = new (...args: unknown[]) => unknown;

export type LazySceneModuleLoader = () => Promise<LazySceneClass>;

export type LazySceneModuleLoaders = Record<LazySceneKey, LazySceneModuleLoader>;

export interface SceneRoutingContextLike {
  scene: {
    start: (sceneKey: string, data?: unknown) => void;
    manager?: {
      keys?: Record<string, unknown>;
    };
  };
}

const LAZY_SCENE_MODULE_LOADERS: LazySceneModuleLoaders = {
  PlanningScene: () => import("./ThreePlanningScene.js").then((module) => module.ThreePlanningScene as unknown as LazySceneClass),
  CombatScene: () => import("./ThreeCombatScene.js").then((module) => module.ThreeCombatScene as unknown as LazySceneClass),
  FortressMapScene: () => import("../scenes/FortressMapScene.js").then((module) => module.FortressMapScene as unknown as LazySceneClass),
  CoopLobbyScene: () => import("../scenes/CoopLobbyScene.js").then((module) => module.CoopLobbyScene as unknown as LazySceneClass)
};

const LAZY_SCENE_CLASS_PROMISES: Map<LazySceneKey, Promise<LazySceneClass>> = new Map();

/**
 * Check if a scene key belongs to the lazy loaded scene registry.
 */
export function isLazySceneKey(sceneKey: string): sceneKey is LazySceneKey {
  return typeof LAZY_SCENE_MODULE_LOADERS[sceneKey as LazySceneKey] === "function";
}

/**
 * Check if a scene is already registered in the active scene manager.
 */
export function isSceneRegistered(
  sceneContext: SceneRoutingContextLike | { scene?: { manager?: { keys?: Record<string, unknown> } } } | null | undefined,
  sceneKey: string
): boolean {
  const manager = (sceneContext as { scene?: { manager?: { keys?: Record<string, unknown> } } } | null | undefined)?.scene?.manager;
  return Boolean(manager?.keys?.[sceneKey]);
}

/**
 * Load the scene class dynamically.
 */
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

/**
 * Preload a scene chunk in the background without switching scenes.
 */
export function prewarmLazyScene(sceneKey: string): Promise<LazySceneClass | null> {
  if (!isLazySceneKey(sceneKey)) return Promise.resolve(null);
  return loadLazySceneClass(sceneKey).catch(() => null);
}

/**
 * Navigate to a scene, routing through LazySceneLoaderScene if not yet loaded.
 */
export function startManagedScene(
  sceneContext: SceneRoutingContextLike,
  sceneKey: string,
  sceneData: object | unknown = undefined
): "direct" | "lazy" {
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

/**
 * Reset lazy scene cache for testing purposes.
 */
export function resetLazySceneRegistry(): void {
  LAZY_SCENE_CLASS_PROMISES.clear();
}

export default {
  LAZY_SCENE_LOADER_KEY,
  isLazySceneKey,
  isSceneRegistered,
  loadLazySceneClass,
  prewarmLazyScene,
  startManagedScene,
  resetLazySceneRegistry
};
