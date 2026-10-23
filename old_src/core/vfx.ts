import type Phaser from "phaser";
import { BATTLE_TEXT_FONT } from "./uiTheme.js";
import { type FxPool } from "./fxPool.js";

export class VfxController {
  scene: Phaser.Scene;
  pool: FxPool | null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.pool = (scene as Phaser.Scene & { fxPool?: FxPool }).fxPool ?? null;
  }

  pulseAt(x: number, y: number, color: number = 0xffd17b, radius: number = 18, duration: number = 220): void {
    const pool = this.pool;
    if (pool) {
      const ring = pool.acquireCircle(x, y, radius, color, 0.24, 8500);
      if (!ring) return;
      const config = {
        scaleX: 1.9,
        scaleY: 1.9,
        alpha: 0,
        duration,
        ease: "Cubic.easeOut"
      };
      pool.tween(ring, (config as unknown) as Phaser.Types.Tweens.TweenBuilderConfig, "circle");
      return;
    }

    const ring = this.scene.add.circle(x, y, radius, color, 0.24);
    ring.setDepth(8500);
    this.scene.tweens.add({
      targets: ring,
      scaleX: 1.9,
      scaleY: 1.9,
      alpha: 0,
      duration,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy()
    });
  }

  slash(x1: number, y1: number, x2: number, y2: number, color: number = 0xff9a9a, duration: number = 180): void {
    const pool = this.pool;
    if (pool) {
      const g = pool.acquireGraphics(8500);
      if (!g) return;
      g.lineStyle(4, color, 1);
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.strokePath();
      const config = { alpha: 0, duration };
      pool.tween(g, (config as unknown) as Phaser.Types.Tweens.TweenBuilderConfig, "graphics");
      return;
    }

    const g = this.scene.add.graphics();
    g.setDepth(8500);
    g.lineStyle(4, color, 1);
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.strokePath();
    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      duration,
      onComplete: () => g.destroy()
    });
  }

  textPop(x: number, y: number, text: string, color: string = "#ffffff"): void {
    const pool = this.pool;
    if (pool) {
      const label = pool.acquireText(x - 8, y, text, {
        fontFamily: BATTLE_TEXT_FONT,
        fontSize: "14px",
        fontStyle: "bold",
        color,
        stroke: "#000000",
        strokeThickness: 4
      }, 8600);
      if (!label) return;
      const config = {
        y: y - 30,
        alpha: 0,
        duration: 2600,
        hold: 500,
        ease: "Sine.easeIn"
      };
      pool.tween(label, (config as unknown) as Phaser.Types.Tweens.TweenBuilderConfig, "text");
      return;
    }

    const t = this.scene.add.text(x - 8, y, text, {
      fontFamily: BATTLE_TEXT_FONT,
      fontSize: "14px",
      fontStyle: "bold",
      color,
      stroke: "#000000",
      strokeThickness: 4
    });
    t.setDepth(8600);
    this.scene.tweens.add({
      targets: t,
      y: y - 30,
      alpha: 0,
      duration: 2600,
      hold: 500,
      ease: "Sine.easeIn",
      onComplete: () => t.destroy()
    });
  }
}
