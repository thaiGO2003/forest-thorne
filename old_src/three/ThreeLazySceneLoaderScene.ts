/**
 * ThreeLazySceneLoaderScene.ts
 *
 * Intermediate transition and preloading scene for Three.js.
 * Displays backdrop and status while dynamic scene chunks are fetched over the network.
 */

import {
  loadLazySceneClass,
  isSceneRegistered
} from "./ThreeSceneLazyRouting.js";

type AnyObj = Record<string, unknown>;

export interface ThreeLazySceneStatusText {
  setText: (text: string) => void;
  setOrigin?: (x: number, y?: number) => unknown;
}

export class ThreeLazySceneLoaderScene {
  targetKey: string | null = null;
  targetData: object | undefined = undefined;
  statusText: ThreeLazySceneStatusText | null = null;

  scale = {
    width: 1600,
    height: 900
  };

  cameras = {
    main: {
      setBackgroundColor: (_color: string) => {}
    }
  };

  add = {
    rectangle: (
      _x: number,
      _y: number,
      _w: number,
      _h: number,
      _color: number,
      _alpha?: number
    ) => ({}),
    text: (
      _x: number,
      _y: number,
      text: string,
      _style?: AnyObj
    ): ThreeLazySceneStatusText => {
      let currentText = text;
      const textNode: ThreeLazySceneStatusText = {
        setText: (newText: string) => {
          currentText = newText;
        },
        setOrigin: () => textNode
      };
      return textNode;
    }
  };

  scene = {
    add: (_key: string, _sceneClass: unknown, _autoStart: boolean = false) => {},
    start: (_key: string, _data?: unknown) => {}
  };

  input = {
    once: (_event: string, _fn: () => void) => {}
  };

  constructor() {}

  init(data?: { targetKey?: string; targetData?: object }): void {
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
    });
    this.statusText?.setOrigin?.(0.5);
    void this.loadAndStartTarget();
  }

  async loadAndStartTarget(): Promise<void> {
    try {
      if (!this.targetKey) {
        throw new Error("Missing lazy scene target.");
      }
      if (!isSceneRegistered(this as never, this.targetKey)) {
        const SceneClass = await loadLazySceneClass(this.targetKey);
        if (!isSceneRegistered(this as never, this.targetKey)) {
          this.scene.add(this.targetKey, SceneClass, false);
        }
      }
      this.scene.start(this.targetKey, this.targetData);
    } catch (error) {
      console.error("[ThreeLazySceneLoaderScene] Failed to load scene:", error);
      if (typeof this.statusText?.setText === "function") {
        this.statusText.setText("Không thể tải scene. Bấm để quay lại menu.");
      }
      this.input.once("pointerdown", () => {
        this.scene.start("MainMenuScene");
      });
    }
  }
}

export const LazySceneLoaderScene = ThreeLazySceneLoaderScene;

export default { ThreeLazySceneLoaderScene, LazySceneLoaderScene };
