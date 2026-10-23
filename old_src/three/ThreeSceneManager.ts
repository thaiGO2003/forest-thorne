import * as THREE from "three";
import { ThreeCameraManager } from "./ThreeCameraManager.js";
import { ThreeLighting } from "./ThreeLighting.js";
import { COLOR_PALETTE, type GraphicsQuality } from "./types.js";

/**
 * ============================================================================
 * 1. INTERFACES & TYPES
 * ============================================================================
 */

/**
 * Configuration for Three.js scene engine
 */
export interface ThreeSceneConfig {
  container: HTMLElement;
  quality?: GraphicsQuality;
  backgroundColor?: number;
  enableFog?: boolean;
  renderer?: THREE.WebGLRenderer;
}

/**
 * Render-frame callback signature
 */
export type FrameCallback = (delta: number, elapsed: number) => void;

/**
 * ============================================================================
 * 2. CONSTANTS & VARIABLES
 * ============================================================================
 */

const DEFAULT_BACKGROUND = COLOR_PALETTE.fogColor;
const MAX_PIXEL_RATIO = 2;
const LOW_QUALITY_PIXEL_RATIO = 1;

/**
 * ============================================================================
 * 3. CLASS / CONSTRUCTOR / LIFECYCLE
 * ============================================================================
 */

/**
 * Owns scene, renderer, camera manager, lighting, resize, and render loop.
 * Pure Three.js — no plugin wrappers.
 */
export class ThreeSceneManager {
  public scene: THREE.Scene;
  public renderer: THREE.WebGLRenderer;
  public cameraManager: ThreeCameraManager;
  public lighting: ThreeLighting;

  private clock: THREE.Clock;
  private frameCallbacks: Set<FrameCallback>;
  private animationId: number = 0;
  private running: boolean = false;
  private onResizeBound: () => void;

  /**
   * Boot WebGL renderer, scene, camera, and lighting.
   *
   * @param config - Scene engine configuration
   */
  constructor(config: ThreeSceneConfig) {
    const { container, quality = "high", backgroundColor = DEFAULT_BACKGROUND, enableFog = true } = config;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(backgroundColor);

    // 2. Renderer — WebGL2, soft shadows, capped pixel ratio
    this.renderer = config.renderer ?? new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setSize(container.clientWidth || 800, container.clientHeight || 600);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    this.renderer.shadowMap.enabled = quality !== "low";
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (this.renderer.domElement.parentElement !== container) {
      container.appendChild(this.renderer.domElement);
    }

    // 3. Camera + controls
    this.cameraManager = new ThreeCameraManager(
      this.renderer.domElement,
      container.clientWidth / container.clientHeight
    );

    // 4. Lighting (low-poly warm palette)
    this.lighting = new ThreeLighting(this.scene, { quality, enableFog });

    // 5. Loop state
    this.clock = new THREE.Clock();
    this.frameCallbacks = new Set();
    this.onResizeBound = () => this.handleResize(container);
    window.addEventListener("resize", this.onResizeBound);
  }

  /**
   * ============================================================================
   * 4. PUBLIC METHODS
   * ============================================================================
   */

  /**
   * Start the render loop.
   */
  public start(): void {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    this.tick();
  }

  /**
   * Stop the render loop.
   */
  public stop(): void {
    this.running = false;
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.animationId = 0;
  }

  /**
   * Register a per-frame callback (units, effects, tweens).
   *
   * @param callback - Frame handler receiving (delta, elapsed)
   * @returns Unsubscribe function
   */
  public onFrame(callback: FrameCallback): () => void {
    this.frameCallbacks.add(callback);
    return () => {
      this.frameCallbacks.delete(callback);
    };
  }

  /**
   * Downgrade / upgrade pixel ratio + shadows for perf tiers.
   *
   * @param quality - Graphics quality tier
   */
  public setQuality(quality: GraphicsQuality): void {
    if (quality === "low") {
      this.renderer.setPixelRatio(LOW_QUALITY_PIXEL_RATIO);
      this.renderer.shadowMap.enabled = false;
    } else {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
      this.renderer.shadowMap.enabled = true;
    }
    this.lighting.setQuality(quality);
  }

  /**
   * Tear down renderer, controls, lighting, listeners. Call on scene exit.
   */
  public dispose(): void {
    this.stop();
    window.removeEventListener("resize", this.onResizeBound);
    this.cameraManager.dispose();
    this.lighting.dispose();
    this.frameCallbacks.clear();
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[];
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material?.dispose();
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  /**
   * ============================================================================
   * 5. PRIVATE METHODS
   * ============================================================================
   */

  /**
   * Drive camera update, frame callbacks, and final render.
   */
  private tick = (): void => {
    if (!this.running) return;
    this.animationId = requestAnimationFrame(this.tick);
    const delta = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.elapsedTime;
    this.cameraManager.update(delta);
    this.frameCallbacks.forEach((callback) => callback(delta, elapsed));
    this.renderer.render(this.scene, this.cameraManager.camera);
  };

  /**
   * Sync renderer + camera to container size.
   */
  private handleResize(container: HTMLElement): void {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;
    this.renderer.setSize(width, height);
    this.cameraManager.resize(width, height);
  }
}

/**
 * ============================================================================
 * 6. EXPORTS
 * ============================================================================
 */

export default ThreeSceneManager;
