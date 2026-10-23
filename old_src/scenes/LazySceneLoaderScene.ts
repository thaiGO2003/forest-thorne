import Phaser from "phaser";
import {
  loadLazySceneClass,
  isSceneRegistered
} from "./sceneLazyRouting.js";

export class LazySceneLoaderScene extends Phaser.Scene {
  targetKey: string | null = null;
  targetData: object | undefined = undefined;
  statusText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super("LazySceneLoaderScene");
  }

  init(data: { targetKey?: string; targetData?: object }): void {
    this.targetKey = data?.targetKey ?? null;
    this.targetData = data?.targetData;
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor("#09131f");
    this.add.rectangle(width * 0.5, height * 0.5, width, height, 0x09131f, 0.94);
    this.statusText = this.add.text(width * 0.5, height * 0.5, "Đang tải trận đấu...", {
      fontFamily: "Consolas",
      fontSize: "28px",
      color: "#c8e6ff"
    }).setOrigin(0.5);
    void this.loadAndStartTarget();
  }

  async loadAndStartTarget(): Promise<void> {
    try {
      if (!this.targetKey) {
        throw new Error("Missing lazy scene target.");
      }
      if (!isSceneRegistered(this, this.targetKey)) {
        const SceneClass = await loadLazySceneClass(this.targetKey);
        if (!isSceneRegistered(this, this.targetKey)) {
          this.scene.add(this.targetKey, SceneClass, false);
        }
      }
      this.scene.start(this.targetKey, this.targetData);
    } catch (error) {
      console.error("[LazySceneLoaderScene] Failed to load scene:", error);
      if (this.statusText) {
        this.statusText.setText("Không thể tải scene. Bấm để quay lại menu.");
      }
      this.input.once("pointerdown", () => {
        this.scene.start("MainMenuScene");
      });
    }
  }
}