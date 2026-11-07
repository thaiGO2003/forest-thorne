import * as THREE from "three";
import { COLOR_PALETTE, type GraphicsQuality } from "./types.js";

/**
 * ============================================================================
 * 1. INTERFACES & TYPES
 * ============================================================================
 */

export interface LightingOptions {
  quality?: GraphicsQuality;
  shadowMapSize?: number;
  enableFog?: boolean;
}

/**
 * ============================================================================
 * 2. CONSTANTS & VARIABLES
 * ============================================================================
 */

const SHADOW_MAP_SIZES: Record<GraphicsQuality, number> = {
  high: 2048,
  medium: 1024,
  low: 512
};

/**
 * ============================================================================
 * 3. CLASS / CONSTRUCTOR / LIFECYCLE
 * ============================================================================
 */

/**
 * Manages low-poly 3D lighting, ambient atmosphere, directional sun shadows, and fog.
 */
export class ThreeLighting {
  private ambientLight: THREE.AmbientLight;
  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private quality: GraphicsQuality;

  /**
   * Initializes scene lighting setup with low-poly optimization.
   *
   * @param scene - Three.js target scene
   * @param options - Lighting options
   */
  constructor(private scene: THREE.Scene, options: LightingOptions = {}) {
    this.quality = options.quality ?? "high";

    // 1. Hemisphere Light (Sky vs Ground bounce)
    this.hemiLight = new THREE.HemisphereLight(0xb1e1ff, 0x3d6622, 0.45);
    this.hemiLight.position.set(0, 50, 0);
    this.scene.add(this.hemiLight);

    // 2. Ambient Light (Soft Forest Ambient)
    this.ambientLight = new THREE.AmbientLight(COLOR_PALETTE.ambientLight, 0.4);
    this.scene.add(this.ambientLight);

    // 3. Directional Sun Light (Shadows)
    this.sunLight = new THREE.DirectionalLight(COLOR_PALETTE.sunLight, 1.2);
    this.sunLight.position.set(15, 25, 15);
    this.sunLight.castShadow = this.quality !== "low";

    this.configureShadows(this.sunLight);
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
    this.sunLight.target.position.set(0, 0, 0);

    // 4. Low-Poly Forest Fog
    if (options.enableFog !== false) {
      this.scene.fog = new THREE.FogExp2(COLOR_PALETTE.fogColor, 0.015);
    }
  }

  /**
   * ============================================================================
   * 4. PUBLIC METHODS
   * ============================================================================
   */

  /**
   * Update graphics quality and adjust shadow map resolution
   *
   * @param quality - New graphics quality tier
   */
  public setQuality(quality: GraphicsQuality): void {
    this.quality = quality;
    if (this.quality === "low") {
      this.sunLight.castShadow = false;
    } else {
      this.sunLight.castShadow = true;
      const mapSize = SHADOW_MAP_SIZES[this.quality];
      this.sunLight.shadow.mapSize.width = mapSize;
      this.sunLight.shadow.mapSize.height = mapSize;
    }
  }

  /**
   * Clean up and dispose all lights and shadows from scene
   */
  public dispose(): void {
    this.scene.remove(this.ambientLight);
    this.scene.remove(this.sunLight);
    this.scene.remove(this.sunLight.target);
    this.scene.remove(this.hemiLight);

    this.sunLight.shadow.map?.dispose();
    this.ambientLight.dispose();
    this.sunLight.dispose();
    this.hemiLight.dispose();
  }

  /**
   * ============================================================================
   * 5. PRIVATE METHODS
   * ============================================================================
   */

  /**
   * Configures shadow camera bounds and filter resolution
   */
  private configureShadows(light: THREE.DirectionalLight): void {
    const mapSize = SHADOW_MAP_SIZES[this.quality];
    light.shadow.mapSize.width = mapSize;
    light.shadow.mapSize.height = mapSize;
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = 60;
    light.shadow.bias = -0.0005;

    // Bounds covering the tactical 5x5 / 6x8 board
    const d = 16;
    light.shadow.camera.left = -d;
    light.shadow.camera.right = d;
    light.shadow.camera.top = d;
    light.shadow.camera.bottom = -d;
  }
}

/**
 * ============================================================================
 * 6. EXPORTS
 * ============================================================================
 */

export default ThreeLighting;
