/**
 * ThreeLoadingScene.ts
 *
 * Preloader and asset initialization scene for Three.js.
 * Displays loading progress, bubble minigame, and transitions to MainMenuScene.
 */

import { queueSharedAssets } from "../core/sharedAssetLoader.js";
import {
  destroyLoadingBubbleMinigame,
  installLoadingBubbleMinigame,
  setLoadingBubbleMinigameStatus,
  updateLoadingBubbleMinigame
} from "../scenes/shared/loadingBubbleMinigameRuntime.js";

export type LoadingSceneCopy = {
  title: string;
  progressText: string;
  detailText: string;
};

export const LOADING_SCENE_COPY: LoadingSceneCopy = Object.freeze({
  title: "BÁ CHỦ KHU RỪNG",
  progressText: "Đang tải: 0%",
  detailText: "Bắn emoji để đập bong bóng trong lúc chờ tải."
});

export const MIN_LOADING_SCREEN_MS = 1400;
export const MIN_TRANSITION_DELAY_MS = 120;

type EventHandler = (...args: unknown[]) => void;

export interface ThreeLoadingSceneEvents {
  once(event: string, handler: EventHandler): void;
  on?(event: string, handler: EventHandler): void;
  emit?(event: string, ...args: unknown[]): void;
}

export interface ThreeLoadingSceneLoader {
  on(event: string, handler: EventHandler): void;
  once(event: string, handler: EventHandler): void;
  start(): void;
  progress?: number;
}

export interface ThreeLoadingSceneTime {
  delayedCall(delayMs: number, callback: () => void): unknown;
}

export interface ThreeLoadingSceneManager {
  start(sceneKey: string, data?: unknown): void;
}

export class ThreeLoadingScene {
  loadingScreenStartedAt: number = 0;
  loadingCompletionScheduled: boolean = false;
  sys: Record<string, unknown> = {};

  events: ThreeLoadingSceneEvents;
  load: ThreeLoadingSceneLoader;
  time: ThreeLoadingSceneTime;
  scene: ThreeLoadingSceneManager;

  private eventHandlers: Map<string, Set<EventHandler>> = new Map();
  private loaderEventHandlers: Map<string, Set<EventHandler>> = new Map();
  private loaderOnceHandlers: Map<string, Set<EventHandler>> = new Map();

  constructor() {
    this.events = {
      once: (event: string, handler: EventHandler) => {
        let handlers = this.eventHandlers.get(event);
        if (!handlers) {
          handlers = new Set();
          this.eventHandlers.set(event, handlers);
        }
        const wrapped: EventHandler = (...args: unknown[]) => {
          handlers?.delete(wrapped);
          handler(...args);
        };
        handlers.add(wrapped);
      },
      emit: (event: string, ...args: unknown[]) => {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
          Array.from(handlers).forEach((fn) => fn(...args));
        }
      }
    };

    this.load = {
      on: (event: string, handler: EventHandler) => {
        let handlers = this.loaderEventHandlers.get(event);
        if (!handlers) {
          handlers = new Set();
          this.loaderEventHandlers.set(event, handlers);
        }
        handlers.add(handler);
      },
      once: (event: string, handler: EventHandler) => {
        let handlers = this.loaderOnceHandlers.get(event);
        if (!handlers) {
          handlers = new Set();
          this.loaderOnceHandlers.set(event, handlers);
        }
        const wrapped: EventHandler = (...args: unknown[]) => {
          handlers?.delete(wrapped);
          handler(...args);
        };
        handlers.add(wrapped);
      },
      start: () => {
        // Trigger complete immediately or let mock/loader drive
        setTimeout(() => {
          const completeHandlers = this.loaderOnceHandlers.get("complete");
          if (completeHandlers) {
            Array.from(completeHandlers).forEach((fn) => fn());
          }
        }, 0);
      }
    };

    this.time = {
      delayedCall: (delayMs: number, callback: () => void) => {
        return setTimeout(callback, delayMs);
      }
    };

    this.scene = {
      start: (_sceneKey: string, _data?: unknown) => {
        // Scene navigation hook
      }
    };
  }

  init(): void {
    this.loadingScreenStartedAt = Date.now();
    this.loadingCompletionScheduled = false;
  }

  preload(): void {}

  create(): void {
    this.installLoadingUi();
    this.bindShutdownCleanup();
    this.bindLoaderEvents();
    this.beginAssetLoading();
  }

  update(_time: number, delta: number): void {
    updateLoadingBubbleMinigame(this as unknown as Parameters<typeof updateLoadingBubbleMinigame>[0], delta);
  }

  installLoadingUi(): void {
    installLoadingBubbleMinigame(this as unknown as Parameters<typeof installLoadingBubbleMinigame>[0], LOADING_SCENE_COPY);
  }

  bindShutdownCleanup(): void {
    const cleanup = () => destroyLoadingBubbleMinigame(this as unknown as Parameters<typeof destroyLoadingBubbleMinigame>[0]);
    this.events.once("shutdown", cleanup);
    this.events.once("destroy", cleanup);
  }

  bindLoaderEvents(): void {
    const minigameScene = this as unknown as Parameters<typeof setLoadingBubbleMinigameStatus>[0];
    this.load.on("progress", (value: unknown) => {
      const pct = Math.max(0, Math.min(100, Math.round((Number(value) || 0) * 100)));
      setLoadingBubbleMinigameStatus(minigameScene, {
        progress: pct / 100,
        progressText: `Đang tải: ${pct}%`
      });
    });

    this.load.on("fileprogress", (file: unknown) => {
      const f = file as { key?: string; type?: string } | null;
      const key = f?.key ?? "unknown";
      const type = f?.type ?? "asset";
      setLoadingBubbleMinigameStatus(minigameScene, {
        detailText: `Đang tải ${type}: ${key}`
      });
    });

    this.load.on("loaderror", (file: unknown) => {
      const f = file as { key?: string } | null;
      const key = f?.key ?? "unknown";
      setLoadingBubbleMinigameStatus(minigameScene, {
        detailText: `Lỗi tải: ${key}`
      });
    });

    this.load.once("complete", () => {
      setLoadingBubbleMinigameStatus(minigameScene, {
        progress: 1,
        progressText: "Đang tải: 100%",
        detailText: "Hoàn tất tải tài nguyên. Chuẩn bị vào menu..."
      });
      this.scheduleMainMenuTransition();
    });
  }

  /**
   * Queue boot assets after the loading UI is visible.
   */
  beginAssetLoading(): void {
    const hasQueuedAssets = queueSharedAssets(this as never);
    if (hasQueuedAssets) {
      this.load.start();
      return;
    }

    setLoadingBubbleMinigameStatus(this as unknown as Parameters<typeof setLoadingBubbleMinigameStatus>[0], {
      progress: 1,
      progressText: "Đang tải: 100%",
      detailText: "Tài nguyên đã sẵn sàng. Chuẩn bị vào menu..."
    });
    this.scheduleMainMenuTransition();
  }

  scheduleMainMenuTransition(): void {
    if (this.loadingCompletionScheduled) return;
    this.loadingCompletionScheduled = true;

    const elapsed = Math.max(0, Date.now() - this.loadingScreenStartedAt);
    const delayMs = Math.max(MIN_TRANSITION_DELAY_MS, MIN_LOADING_SCREEN_MS - elapsed);
    this.time.delayedCall(delayMs, () => {
      this.scene.start("MainMenuScene");
    });
  }

  destroy(): void {
    destroyLoadingBubbleMinigame(this as unknown as Parameters<typeof destroyLoadingBubbleMinigame>[0]);
  }
}

export const LoadingScene = ThreeLoadingScene;

export default { ThreeLoadingScene, LoadingScene };
