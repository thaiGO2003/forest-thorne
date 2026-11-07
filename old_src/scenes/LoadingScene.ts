import Phaser from "phaser";
import { queueSharedAssets } from "../core/sharedAssetLoader.js";
import {
  destroyLoadingBubbleMinigame,
  installLoadingBubbleMinigame,
  setLoadingBubbleMinigameStatus,
  updateLoadingBubbleMinigame
} from "./shared/loadingBubbleMinigameRuntime.js";

type LoadingSceneCopy = {
  title: string;
  progressText: string;
  detailText: string;
};

const LOADING_SCENE_COPY: LoadingSceneCopy = {
  title: "BÁ CHỦ KHU RỪNG",
  progressText: "Đang tải: 0%",
  detailText: "Bắn emoji để đập bong bóng trong lúc chờ tải."
};

const MIN_LOADING_SCREEN_MS = 1400;
const MIN_TRANSITION_DELAY_MS = 120;

export class LoadingScene extends Phaser.Scene {
  loadingScreenStartedAt = 0;
  loadingCompletionScheduled = false;

  constructor() {
    super("LoadingScene");
    this.loadingScreenStartedAt = 0;
    this.loadingCompletionScheduled = false;
  }

  init(): void {
    this.loadingScreenStartedAt = 0;
    this.loadingCompletionScheduled = false;
  }

  preload(): void {}

  create(): void {
    this.loadingScreenStartedAt = Date.now();
    this.installLoadingUi();
    this.bindLoaderEvents();
    this.bindShutdownCleanup();
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
    this.load.on("progress", (value: number) => {
      const pct = Math.max(0, Math.min(100, Math.round((Number(value) || 0) * 100)));
      setLoadingBubbleMinigameStatus(minigameScene, {
        progress: pct / 100,
        progressText: `Đang tải: ${pct}%`
      });
    });

    this.load.on("fileprogress", (file: { key?: string; type?: string }) => {
      const key = file?.key ?? "unknown";
      const type = file?.type ?? "asset";
      setLoadingBubbleMinigameStatus(minigameScene, {
        detailText: `Đang tải ${type}: ${key}`
      });
    });

    this.load.on("loaderror", (file: { key?: string }) => {
      const key = file?.key ?? "unknown";
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
   * Phaser's preload() auto-starts the loader, so we defer queue/start to create()
   * to keep the bubble minigame on screen before the first byte downloads.
   */
  beginAssetLoading(): void {
    const hasQueuedAssets = queueSharedAssets(this);
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
}
