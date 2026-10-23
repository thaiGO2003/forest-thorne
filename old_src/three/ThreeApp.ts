import * as THREE from "three";
import { t } from "../i18n/index.js";
import { buildBoard, type BuiltBoard, gridToWorld } from "./ThreeBoard.js";
import { createUnit3D, type Unit3DHandle } from "./ThreeUnitFactory.js";
import { disposeProps, scatterForestProps } from "./ThreeForestProps.js";
import { ThreeSceneManager, type ThreeSceneConfig } from "./ThreeSceneManager.js";
import type { CameraPreset, GraphicsQuality, Unit3DConfig } from "./types.js";

/**
 * Runtime options for the standalone Three.js application.
 */
export interface ThreeAppOptions {
  container: HTMLElement;
  quality?: GraphicsQuality;
  backgroundColor?: number;
  enableFog?: boolean;
  showDemoUnits?: boolean;
}

/**
 * Minimal scene contract used by the standalone Three.js application.
 */
export interface ThreeAppScene {
  mount(app: ThreeApp): void;
  update(delta: number, elapsed: number): void;
  unmount(): void;
}

/**
 * Owns the production Three.js viewport, forest board, props, units, HUD, and
 * scene transitions. It intentionally contains no Phaser dependency.
 */
export class ThreeApp {
  public readonly manager: ThreeSceneManager;
  public readonly board: BuiltBoard;
  public readonly props: THREE.Group;
  public readonly units: Unit3DHandle[] = [];

  private activeScene: ThreeAppScene | null = null;
  private sceneUnsubscribe: (() => void) | null = null;
  private hud: HTMLDivElement;
  private disposed = false;

  constructor(options: ThreeAppOptions) {
    const config: ThreeSceneConfig = {
      container: options.container,
      quality: options.quality ?? "high",
      backgroundColor: options.backgroundColor ?? 0x111625,
      enableFog: options.enableFog ?? true
    };
    this.manager = new ThreeSceneManager(config);
    this.board = buildBoard();
    this.props = scatterForestProps({ count: 28, minRadius: 12, maxRadius: 25 });
    this.manager.scene.add(this.board.group, this.props);
    this.hud = createHud(options.container);
    this.mountCoreDemo(options.showDemoUnits !== false);
    this.manager.start();
  }

  /**
   * Replace the current Three.js scene without tearing down the renderer.
   */
  public setScene(scene: ThreeAppScene): void {
    this.activeScene?.unmount();
    this.sceneUnsubscribe?.();
    this.activeScene = scene;
    this.activeScene.mount(this);
  }

  /**
   * Set the active tactical camera preset.
   */
  public setCameraPreset(preset: CameraPreset): void {
    this.manager.cameraManager.setPreset(preset);
  }

  /**
   * Add a unit at a board coordinate and return its animation handle.
   */
  public addUnit(config: Unit3DConfig): Unit3DHandle {
    const unit = createUnit3D(config);
    const position = gridToWorld(config.gridRow, config.gridCol);
    unit.group.position.set(position.x, position.y, position.z);
    this.manager.scene.add(unit.group);
    this.units.push(unit);
    return unit;
  }

  /**
   * Remove a unit and release its resources.
   */
  public removeUnit(unit: Unit3DHandle): void {
    const index = this.units.indexOf(unit);
    if (index < 0) return;
    this.units.splice(index, 1);
    this.manager.scene.remove(unit.group);
    unit.dispose();
  }

  /**
   * Get the DOM HUD root used by the Three.js application.
   */
  public getHud(): HTMLDivElement {
    return this.hud;
  }

  /**
   * Dispose the complete Three.js application and all owned resources.
   */
  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.activeScene?.unmount();
    this.activeScene = null;
    this.sceneUnsubscribe?.();
    this.sceneUnsubscribe = null;
    this.units.forEach((unit) => {
      this.manager.scene.remove(unit.group);
      unit.dispose();
    });
    this.units.length = 0;
    this.board.dispose();
    disposeProps(this.props);
    this.hud.remove();
    this.manager.dispose();
  }

  private mountCoreDemo(showDemoUnits: boolean): void {
    if (showDemoUnits) {
      this.addUnit({
        id: "demo-player",
        baseId: "demo_player",
        name: "Demo Player",
        star: 3,
        side: "player",
        gridRow: 4,
        gridCol: 2,
        hp: 850,
        maxHp: 1000,
        mana: 30,
        maxMana: 100,
        primaryColor: 0x3b82f6,
        secondaryColor: 0xf5e6c8
      });
      this.addUnit({
        id: "demo-enemy",
        baseId: "demo_enemy",
        name: "Demo Enemy",
        star: 2,
        side: "enemy",
        gridRow: 1,
        gridCol: 5,
        hp: 620,
        maxHp: 800,
        mana: 60,
        maxMana: 100,
        primaryColor: 0xdc2626,
        secondaryColor: 0xead7c0
      });
    }
    this.sceneUnsubscribe = this.manager.onFrame((delta, elapsed) => {
      this.units.forEach((unit) => unit.update(delta, elapsed));
      this.activeScene?.update(delta, elapsed);
    });
  }
}

function createHud(container: HTMLElement): HTMLDivElement {
  const hud = document.createElement("div");
  hud.className = "three-pixel-hud";
  hud.setAttribute("aria-label", t("three.hud.accessibility.label"));
  hud.style.position = "absolute";
  hud.style.inset = "0";
  hud.style.pointerEvents = "none";
  hud.style.zIndex = "20";
  hud.style.fontFamily = "monospace";
  hud.style.imageRendering = "pixelated";
  hud.style.color = "#f8e9b0";
  container.appendChild(hud);
  return hud;
}

export default ThreeApp;
