import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { DEFAULT_CAMERA_POSITIONS, type CameraPreset } from "./types.js";

/**
 * ============================================================================
 * 1. INTERFACES & TYPES
 * ============================================================================
 */

export interface CameraTransitionOptions {
  duration?: number;
  onComplete?: () => void;
}

/**
 * ============================================================================
 * 2. CONSTANTS & VARIABLES
 * ============================================================================
 */

const DEFAULT_FOV = 45;
const DEFAULT_NEAR = 0.1;
const DEFAULT_FAR = 1000;

/**
 * ============================================================================
 * 3. CLASS / CONSTRUCTOR / LIFECYCLE
 * ============================================================================
 */

/**
 * Controls 3D camera positioning, free orbit controls, and smooth preset transitions.
 */
export class ThreeCameraManager {
  public camera: THREE.PerspectiveCamera;
  public controls: OrbitControls;

  private currentPreset: CameraPreset = "isometric";
  private isTransitioning: boolean = false;
  private transitionElapsed: number = 0;
  private transitionDuration: number = 0.8;
  private startPos: THREE.Vector3 = new THREE.Vector3();
  private targetPos: THREE.Vector3 = new THREE.Vector3();
  private startLookAt: THREE.Vector3 = new THREE.Vector3();
  private targetLookAt: THREE.Vector3 = new THREE.Vector3();
  private onTransitionComplete?: () => void;

  /**
   * Initializes the perspective camera and orbit controls.
   *
   * @param domElement - Canvas DOM element for mouse & touch input
   * @param aspect - Initial aspect ratio (width / height)
   */
  constructor(private domElement: HTMLElement, aspect: number = window.innerWidth / window.innerHeight) {
    // 1. Perspective Camera
    this.camera = new THREE.PerspectiveCamera(DEFAULT_FOV, aspect, DEFAULT_NEAR, DEFAULT_FAR);
    const initial = DEFAULT_CAMERA_POSITIONS.isometric;
    this.camera.position.set(...initial.pos);

    // 2. Orbit Controls
    this.controls = new OrbitControls(this.camera, this.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.target.set(...initial.target);

    // 3. Tactical Orbit Limits
    this.controls.minDistance = 6;
    this.controls.maxDistance = 50;
    this.controls.minPolarAngle = 0; // Allow topdown tactical view
    this.controls.maxPolarAngle = Math.PI / 2.05; // Prevent clipping underground

    // 4. Touch Gestures Optimization (Mobile friendly)
    this.controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN
    };

    this.controls.update();
  }

  /**
   * ============================================================================
   * 4. PUBLIC METHODS
   * ============================================================================
   */

  /**
   * Update camera and controls every frame
   *
   * @param delta - Frame delta time in seconds
   */
  public update(delta: number): void {
    if (this.isTransitioning) {
      this.updateTransition(delta);
    } else {
      this.controls.update();
    }
  }

  /**
   * Handle window resize
   *
   * @param width - New viewport width
   * @param height - New viewport height
   */
  public resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Switch camera to a preset view with smooth interpolation
   *
   * @param preset - Preset key ("isometric", "topdown", "free", "cinematic")
   * @param options - Transition options
   */
  public setPreset(preset: CameraPreset, options: CameraTransitionOptions = {}): void {
    this.currentPreset = preset;
    const config = DEFAULT_CAMERA_POSITIONS[preset];

    this.startPos.copy(this.camera.position);
    this.targetPos.set(...config.pos);

    this.startLookAt.copy(this.controls.target);
    this.targetLookAt.set(...config.target);

    this.transitionDuration = Math.max(0.001, options.duration ?? 0.75);
    this.transitionElapsed = 0;
    this.onTransitionComplete = options.onComplete;
    this.isTransitioning = true;
  }

  /**
   * Get the current active camera preset
   */
  public getPreset(): CameraPreset {
    return this.currentPreset;
  }

  /**
   * Reset camera to default initial position
   */
  public reset(): void {
    this.setPreset("isometric");
  }

  /**
   * Clean up controls and references
   */
  public dispose(): void {
    this.controls.dispose();
  }

  /**
   * ============================================================================
   * 5. PRIVATE METHODS
   * ============================================================================
   */

  /**
   * Smoothly interpolate camera position and look-at target
   */
  private updateTransition(delta: number): void {
    this.transitionElapsed += Math.max(0, delta);
    const progress = Math.min(1.0, this.transitionElapsed / this.transitionDuration);

    // Smooth step easing
    const t = progress * progress * (3 - 2 * progress);

    this.camera.position.lerpVectors(this.startPos, this.targetPos, t);
    this.controls.target.lerpVectors(this.startLookAt, this.targetLookAt, t);

    if (progress >= 1.0) {
      this.isTransitioning = false;
      this.camera.position.copy(this.targetPos);
      this.controls.target.copy(this.targetLookAt);
      this.controls.update();
      if (this.onTransitionComplete) {
        this.onTransitionComplete();
        this.onTransitionComplete = undefined;
      }
    }
  }
}

/**
 * 6. EXPORTS
 * ============================================================================
 */

export default ThreeCameraManager;
