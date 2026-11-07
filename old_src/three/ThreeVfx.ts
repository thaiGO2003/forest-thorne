/**
 * ThreeVfx.ts
 *
 * 3D combat visual effect controller for Three.js (pulses, slashes, damage floaters).
 * Mirrors VfxController with full pooling support.
 */

import * as THREE from "three";
import { BATTLE_TEXT_FONT } from "../core/uiTheme.js";
import { type ThreeFxPool } from "./ThreeFxPool.js";

type AnyObj = Record<string, unknown>;

export interface ThreeVfxSceneLike {
  add?: {
    circle?: (x: number, y: number, radius: number, color?: number, alpha?: number) => unknown;
    graphics?: () => unknown;
    text?: (x: number, y: number, text: string, style?: AnyObj) => unknown;
  };
  tweens?: {
    add?: (config: AnyObj) => unknown;
  };
  fxPool?: ThreeFxPool | null;
  threeScene?: THREE.Scene | THREE.Group;
}

export class ThreeVfxController {
  scene: ThreeVfxSceneLike;
  pool: ThreeFxPool | null;

  constructor(scene: ThreeVfxSceneLike) {
    this.scene = scene;
    this.pool = scene?.fxPool ?? null;
  }

  /**
   * Spawns an expanding pulse ring at the specified coordinates.
   */
  pulseAt(x: number, y: number, color: number = 0xffd17b, radius: number = 18, duration: number = 220): void {
    const pool = this.pool;
    if (pool) {
      const ring = pool.acquireCircle(x, y, radius, color, 0.24);
      if (!ring) return;
      pool.tween(ring, {
        scale: radius * 1.9,
        alpha: 0,
        duration: duration / 1000
      }, "circle");
      return;
    }

    if (typeof this.scene?.add?.circle === "function") {
      const ring = this.scene.add.circle(x, y, radius, color, 0.24) as AnyObj;
      if (typeof ring.setDepth === "function") ring.setDepth(8500);
      this.scene.tweens?.add?.({
        targets: ring,
        scaleX: 1.9,
        scaleY: 1.9,
        alpha: 0,
        duration,
        ease: "Cubic.easeOut",
        onComplete: () => {
          if (typeof ring.destroy === "function") ring.destroy();
        }
      });
      return;
    }

    // Direct Three.js fallback
    const geometry = new THREE.RingGeometry(radius * 0.7, radius, 16);
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.24, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, 0.05);
    mesh.renderOrder = 8500;

    const targetScene = this.scene?.threeScene;
    if (targetScene) targetScene.add(mesh);

    const startTime = performance.now();
    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      const scale = 1 + progress * 0.9;
      mesh.scale.set(scale, scale, 1);
      material.opacity = 0.24 * (1 - progress);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        if (targetScene) targetScene.remove(mesh);
        geometry.dispose();
        material.dispose();
      }
    };
    requestAnimationFrame(animate);
  }

  /**
   * Spawns a sword slash / impact line between two points.
   */
  slash(x1: number, y1: number, x2: number, y2: number, color: number = 0xff9a9a, duration: number = 180): void {
    const pool = this.pool;
    if (pool) {
      const g = pool.acquireGraphics();
      if (!g) return;
      const points = [new THREE.Vector3(x1, y1, 0.05), new THREE.Vector3(x2, y2, 0.05)];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1 });
      const line = new THREE.Line(geometry, material);
      g.add(line);

      pool.tween(g, {
        alpha: 0,
        duration: duration / 1000
      }, "graphics");
      return;
    }

    if (typeof this.scene?.add?.graphics === "function") {
      const g = this.scene.add.graphics() as AnyObj;
      if (typeof g.setDepth === "function") g.setDepth(8500);
      if (typeof g.lineStyle === "function") g.lineStyle(4, color, 1);
      if (typeof g.beginPath === "function") g.beginPath();
      if (typeof g.moveTo === "function") g.moveTo(x1, y1);
      if (typeof g.lineTo === "function") g.lineTo(x2, y2);
      if (typeof g.strokePath === "function") g.strokePath();

      this.scene.tweens?.add?.({
        targets: g,
        alpha: 0,
        duration,
        onComplete: () => {
          if (typeof g.destroy === "function") g.destroy();
        }
      });
      return;
    }

    // Direct Three.js fallback
    const points = [new THREE.Vector3(x1, y1, 0.05), new THREE.Vector3(x2, y2, 0.05)];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1 });
    const line = new THREE.Line(geometry, material);
    line.renderOrder = 8500;

    const targetScene = this.scene?.threeScene;
    if (targetScene) targetScene.add(line);

    const startTime = performance.now();
    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      material.opacity = 1 - progress;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        if (targetScene) targetScene.remove(line);
        geometry.dispose();
        material.dispose();
      }
    };
    requestAnimationFrame(animate);
  }

  /**
   * Spawns a floating combat text callout.
   */
  textPop(x: number, y: number, text: string, color: string = "#ffffff"): void {
    const pool = this.pool;
    if (pool) {
      const label = pool.acquireText(x - 8, y, text, color);
      if (!label) return;
      pool.tween(label, {
        y: y - 30,
        alpha: 0,
        duration: 2.6
      }, "text");
      return;
    }

    if (typeof this.scene?.add?.text === "function") {
      const t = this.scene.add.text(x - 8, y, text, {
        fontFamily: BATTLE_TEXT_FONT,
        fontSize: "14px",
        fontStyle: "bold",
        color,
        stroke: "#000000",
        strokeThickness: 4
      }) as AnyObj;
      if (typeof t.setDepth === "function") t.setDepth(8600);
      this.scene.tweens?.add?.({
        targets: t,
        y: y - 30,
        alpha: 0,
        duration: 2600,
        hold: 500,
        ease: "Sine.easeIn",
        onComplete: () => {
          if (typeof t.destroy === "function") t.destroy();
        }
      });
      return;
    }

    // Direct Three.js fallback
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 48;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, 128, 48);
      ctx.font = `bold 24px ${BATTLE_TEXT_FONT}, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = color;
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 4;
      ctx.strokeText(text, 64, 24);
      ctx.fillText(text, 64, 24);
    }
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 1 });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(x - 8, y, 0.06);
    sprite.scale.set(32, 12, 1);
    sprite.renderOrder = 8600;

    const targetScene = this.scene?.threeScene;
    if (targetScene) targetScene.add(sprite);

    const startTime = performance.now();
    const duration = 2600;
    const initialY = y;
    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      sprite.position.y = initialY - progress * 30;
      material.opacity = Math.max(0, 1 - progress);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        if (targetScene) targetScene.remove(sprite);
        texture.dispose();
        material.dispose();
      }
    };
    requestAnimationFrame(animate);
  }
}

export const VfxController = ThreeVfxController;

export default { ThreeVfxController, VfxController };
