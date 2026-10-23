import Phaser from "phaser";
import { t } from "../i18n/index.js";
import { buildBoard, gridToWorld, type BuiltBoard } from "../three/ThreeBoard.js";
import { createUnit3D, type Unit3DHandle } from "../three/ThreeUnitFactory.js";
import { scatterForestProps, disposeProps } from "../three/ThreeForestProps.js";
import { ThreeSceneManager } from "../three/ThreeSceneManager.js";
import type { CameraPreset, Unit3DConfig } from "../three/types.js";

/**
 * ============================================================================
 * 1. INTERFACES & TYPES
 * ============================================================================
 */

/**
 * Optional data passed when opening the standalone 3D demo.
 */
export interface ThreeDemoSceneData {
  quality?: "high" | "medium" | "low";
}

/**
 * ============================================================================
 * 2. CONSTANTS & VARIABLES
 * ============================================================================
 */

const DEMO_CONTAINER_ID = "three-demo-viewport";
const DEMO_BACKGROUND = "#111625";

/**
 * ============================================================================
 * 3. SCENE CLASS / CONSTRUCTOR / LIFECYCLE
 * ============================================================================
 */

/**
 * Standalone low-poly Three.js demo hosted inside the Phaser scene lifecycle.
 *
 * This scene is intentionally not registered in the production scene list yet.
 * Start it explicitly when the 3D demo route is ready.
 */
export class ThreeDemoScene extends Phaser.Scene {
  private threeManager: ThreeSceneManager | null = null;
  private viewport: HTMLDivElement | null = null;
  private units: Unit3DHandle[] = [];
  private board: BuiltBoard | null = null;
  private props: { dispose?: () => void } | null = null;
  private frameUnsubscribe: (() => void) | null = null;
  private hudOverlay: HTMLDivElement | null = null;
  private cleanedUp = false;
  /**
   * Create the Phaser scene with a stable route key.
   */
  constructor() {
    super("ThreeDemoScene");
  }

  /**
   * Initialize transient scene state before each start.
   *
   * @param data - Optional graphics quality selected by the caller
   */
  init(data?: ThreeDemoSceneData): void {
    this.cleanedUp = false;
    this.threeManager = null;
    this.viewport = null;
    this.units = [];
    this.frameUnsubscribe = null;
    this.registry.set("threeDemoQuality", data?.quality ?? "high");
  }

  /**
   * Build the DOM viewport, Three.js engine, forest arena, and sample units.
   */
  create(): void {
    this.viewport = this.createViewport();
    this.threeManager = new ThreeSceneManager({
      container: this.viewport,
      quality: this.registry.get("threeDemoQuality") ?? "high",
      backgroundColor: 0x111625,
      enableFog: true
    });

    this.board = buildBoard();
    this.threeManager.scene.add(this.board.group);
    const forestProps = scatterForestProps({ count: 18, minRadius: 13, maxRadius: 22 });
    this.props = { dispose: () => disposeProps(forestProps) };
    this.threeManager.scene.add(forestProps);
    this.addDemoUnit({
      id: "demo-player",
      baseId: "demo_player",
      name: "Demo Player",
      star: 2,
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
    this.addDemoUnit({
      id: "demo-enemy",
      baseId: "demo_enemy",
      name: "Demo Enemy",
      star: 1,
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

    this.frameUnsubscribe = this.threeManager.onFrame((delta, elapsed) => {
      this.units.forEach((unit) => unit.update(delta, elapsed));
    });
    this.threeManager.cameraManager.setPreset("isometric", { duration: 0 });
    this.createCameraControlsOverlay();
    this.bindKeyboardShortcuts();
    this.threeManager.start();
    this.bindCleanup();

  }

  /**
   * Phaser update hook reserved for future scene-level input/state integration.
   */
  update(): void {
    // ThreeSceneManager owns its render loop; Phaser remains the host lifecycle.
  }

  /**
   * ============================================================================
   * 4. PUBLIC METHODS
   * ============================================================================
   */

  /**
   * Return the active Three.js manager for external demo controls.
   */
  public getThreeManager(): ThreeSceneManager | null {
    return this.threeManager;
  }

  /**
   * Switch camera preset with smooth transition.
   *
   * @param preset - Target preset ("isometric", "topdown", "free", "cinematic")
   * @param duration - Transition time in seconds (default 0.75s)
   */
  public setCameraPreset(preset: CameraPreset, duration: number = 0.75): void {
    this.threeManager?.cameraManager.setPreset(preset, { duration });
  }

  /**
   * Cycle through available camera presets in order.
   *
   * @returns The newly active preset
   */
  public cycleCameraPreset(): CameraPreset {
    const presets: CameraPreset[] = ["isometric", "topdown", "free", "cinematic"];
    const current = this.threeManager?.cameraManager.getPreset() ?? "isometric";
    const nextIndex = (presets.indexOf(current) + 1) % presets.length;
    const nextPreset = presets[nextIndex];
    this.setCameraPreset(nextPreset);
    return nextPreset;
  }
  /**
   * ============================================================================
   * 5. PRIVATE METHODS
   * ============================================================================
   */

  /**
   * Create an absolutely positioned viewport over the Phaser canvas.
   */
  private createViewport(): HTMLDivElement {
    const existing = document.getElementById(DEMO_CONTAINER_ID);
    existing?.remove();

    const viewport = document.createElement("div");
    viewport.id = DEMO_CONTAINER_ID;
    viewport.style.position = "absolute";
    viewport.style.inset = "0";
    viewport.style.width = "100%";
    viewport.style.height = "100%";
    viewport.style.background = DEMO_BACKGROUND;
    viewport.style.touchAction = "none";
    viewport.style.zIndex = "10";

    const parent = this.game.canvas.parentElement ?? document.body;
    if (getComputedStyle(parent).position === "static") parent.style.position = "relative";
    parent.appendChild(viewport);
    return viewport;
  }

  /**
   * Add one sample unit at a board grid position.
   */
  private addDemoUnit(config: Unit3DConfig): void {
    if (!this.threeManager) return;
    const unit = createUnit3D(config);
    const position = gridToWorld(config.gridRow, config.gridCol);
    unit.group.position.set(position.x, position.y, position.z);
    this.threeManager.scene.add(unit.group);
    this.units.push(unit);
  }

  /**
   * Register idempotent cleanup for Phaser shutdown and destruction.
   */
  private bindCleanup(): void {
    const cleanup = (): void => this.cleanupThreeScene();
    this.events.once("shutdown", cleanup);
    this.events.once("destroy", cleanup);
  }

  /**
   * Release Three.js resources and remove the DOM viewport.
   */
  private cleanupThreeScene(): void {
    if (this.cleanedUp) return;
    this.cleanedUp = true;
    this.frameUnsubscribe?.();
    this.frameUnsubscribe = null;
    this.units.forEach((unit) => unit.dispose());
    this.units = [];
    this.board?.dispose();
    this.board = null;
    this.props?.dispose?.();
    this.props = null;
    this.threeManager?.dispose();
    this.threeManager = null;
    this.hudOverlay?.remove();
    this.viewport = null;
  }

  /**
   * Create HUD overlay buttons for camera preset selection.
   */
  private createCameraControlsOverlay(): void {
    if (!this.viewport) return;

    const hud = document.createElement("div");
    hud.style.position = "absolute";
    hud.style.bottom = "20px";
    hud.style.left = "50%";
    hud.style.transform = "translateX(-50%)";
    hud.style.display = "flex";
    hud.style.gap = "10px";
    hud.style.zIndex = "20";
    hud.style.pointerEvents = "auto";

    const presets: Array<{ key: CameraPreset; label: string }> = [
      { key: "isometric", label: t("three.camera.preset.isometric") },
      { key: "topdown", label: t("three.camera.preset.topdown") },
      { key: "free", label: t("three.camera.preset.free") },
      { key: "cinematic", label: t("three.camera.preset.cinematic") }
    ];

    presets.forEach(({ key, label }) => {
      const btn = document.createElement("button");
      btn.textContent = label;
      btn.style.padding = "8px 14px";
      btn.style.borderRadius = "6px";
      btn.style.border = "1px solid #4d6b8a";
      btn.style.background = "rgba(15, 24, 38, 0.85)";
      btn.style.color = "#d7efff";
      btn.style.fontFamily = "sans-serif";
      btn.style.fontSize = "13px";
      btn.style.fontWeight = "bold";
      btn.style.cursor = "pointer";
      btn.style.backdropFilter = "blur(4px)";
      btn.style.transition = "all 0.2s ease";

      btn.onmouseenter = () => {
        btn.style.background = "rgba(46, 92, 138, 0.95)";
      };
      btn.onmouseleave = () => {
        btn.style.background = "rgba(15, 24, 38, 0.85)";
      };
      btn.onclick = (e) => {
        e.stopPropagation();
        this.setCameraPreset(key);
      };
      hud.appendChild(btn);
    });

    this.viewport.appendChild(hud);
    this.hudOverlay = hud;
  }

  /**
   * Bind number keys 1-4 and C/R for instant camera preset switching.
   */
  private bindKeyboardShortcuts(): void {
    this.input.keyboard?.on("keydown-ONE", () => this.setCameraPreset("isometric"));
    this.input.keyboard?.on("keydown-TWO", () => this.setCameraPreset("topdown"));
    this.input.keyboard?.on("keydown-THREE", () => this.setCameraPreset("free"));
    this.input.keyboard?.on("keydown-FOUR", () => this.setCameraPreset("cinematic"));
    this.input.keyboard?.on("keydown-C", () => this.cycleCameraPreset());
    this.input.keyboard?.on("keydown-R", () => this.setCameraPreset("isometric"));
  }
}
/**
 * ============================================================================
 * 6. EXPORTS
 * ============================================================================
 */

export default ThreeDemoScene;
