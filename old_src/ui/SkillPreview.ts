/**
 * SkillPreview - Hiển thị preview kỹ năng với grid màu và blink animation
 *
 * Layout grid 5x4:
 *   Col 0-1 = bên ta (xanh lá đậm nếu trống)
 *   Col 2-3 = bên địch (đỏ nếu trống)
 *
 * Ô ảnh hưởng bởi skill: nhấp nháy (blink tween).
 */

import type { Scene as PhaserScene } from "phaser";
import { getUnitVisual } from "../data/unitVisuals.js";
import { UI_FONT, EMOJI_FONT } from "../core/uiTheme.js";
import { scaleFontPx } from "../core/uiResponsive.js";

// ─── Màu sắc ─────────────────────────────────────────────────────────────
const COLOR = {
  ALLY_EMPTY: 0x0d3d1a,  // xanh lá đậm — ô trống bên ta
  ENEMY_EMPTY: 0x3d0d0d,  // đỏ đậm — ô trống bên địch
  CELL_STROKE_ALLY: 0x1a6632,
  CELL_STROKE_ENEMY: 0x662222,
  HIGHLIGHT_ENEMY: 0xff3333,  // màu blink ô địch bị ảnh hưởng
  HIGHLIGHT_ALLY: 0x33ff88,  // màu blink ô ta bị ảnh hưởng (buff/heal)
  STROKE_ENEMY_HIT: 0xff8888,
  STROKE_ALLY_HIT: 0x88ffbb,
};

interface SkillPreviewSceneLike extends PhaserScene, Record<string, unknown> {}

interface SkillPreviewUnitLike {
  id?: string;
  classType?: string;
  star?: number;
  stats?: { range?: number };
}

interface SkillPreviewCell {
  row: number;
  col: number;
  side: string;
}

interface PreviewSkillLike {
  previewCells?: unknown;
  id?: string;
  effect?: string;
  name?: string;
  actionPattern?: string;
  damageType?: string;
  targetTextVi?: string;
  targetTextEn?: string;
  targetText?: string;
  effectLabelVi?: string;
  effectLabelEn?: string;
  nameVi?: string;
  nameEn?: string;
}

// ─── Skill pattern → danh sách ô bị ảnh hưởng ────────────────────────────
// Grid layout: 5 hàng x 4 cột. Cột 0-1 = ta, cột 2-3 = địch.
// Mỗi ô: { row, col, side: 'ally'|'enemy' }
function getAffectedCells(skill: PreviewSkillLike | null | undefined, unit: SkillPreviewUnitLike | null, star = 1): SkillPreviewCell[] {
  // ─── Data-first: read previewCells from unit skill data ──────────────
  if (skill?.previewCells) {
    if (typeof skill.previewCells === "function") {
      try {
        const cells = skill.previewCells({ attacker: unit, star, ROWS: 5, COLS: 4, allies: [] });
        if (Array.isArray(cells) && cells.length) return cells as SkillPreviewCell[];
      } catch {
        // Fall back to static previewCells handling below.
      }
    }
    const cells = !Array.isArray(skill.previewCells)
      ? (skill.previewCells as Record<number, unknown> | undefined)?.[star] ?? (skill.previewCells as Record<number, unknown> | undefined)?.[1] ?? skill.previewCells
      : skill.previewCells;
    if (Array.isArray(cells) && cells.length) return cells as SkillPreviewCell[];
  }
  // No fallback — log warning if missing previewCells
  console.warn(`[Missing previewCells] skill "${skill?.id || skill?.effect}" has no previewCells`);
  return [];
}

export class SkillPreview {
  scene: SkillPreviewSceneLike;
  unit: SkillPreviewUnitLike;
  skill: PreviewSkillLike | null;
  width: number;
  height: number;
  container: Phaser.GameObjects.Container;
  tweens: Phaser.Tweens.Tween[];
  cellSize!: number;
  gridX!: number;
  gridY!: number;
  cellRects!: Record<string, Phaser.GameObjects.Rectangle>;
  blinkRects!: Phaser.GameObjects.Rectangle[];
  attackerIcon!: Phaser.GameObjects.Text;
  _attackerStartY!: number;
  targetCenters!: Array<{ x: number; y: number; side: string }>;
  enemyIcons!: Array<{ icon: Phaser.GameObjects.Text; row: number; col: number; key: string }>;
  _attackerStartX!: number;

  constructor(scene: SkillPreviewSceneLike, x: number, y: number, width: number, height: number, unit: SkillPreviewUnitLike, skill: PreviewSkillLike | null) {
    this.scene = scene;
    this.unit = unit;
    this.skill = skill;
    this.width = width;
    this.height = height;
    this.container = scene.add.container(x, y);
    this.tweens = [];
    this.build();
    this.startAnimation();
  }

  build() {
    const { width: W, height: H } = this;

    // Background
    const bg = this.scene.add.rectangle(0, 0, W, H, 0x0a1520, 0.9).setOrigin(0, 0);
    bg.setStrokeStyle(1, 0x3a5070, 0.8);
    this.container.add(bg);

    // Title
    const skillName = this.skill?.name || "Kỹ năng";
    const title = this.scene.add.text(8, 6, `⚡ ${skillName}`, {
      fontFamily: UI_FONT,
      fontSize: scaleFontPx(this.scene, 12, "label"),
      color: "#8df2ff",
      fontStyle: "bold"
    });
    this.container.add(title);

    // Grid setup: 5 rows × 4 cols
    const ROWS = 5, COLS = 4;
    const cellSize = Math.floor(Math.min((W - 16) / COLS, (H - 56) / ROWS));
    const gridW = cellSize * COLS;
    const gridH = cellSize * ROWS;
    const gridX = Math.floor((W - gridW) / 2);
    const gridY = 30;

    this.cellSize = cellSize;
    this.gridX = gridX;
    this.gridY = gridY;

    // Affected cells set
    const affected = getAffectedCells(this.skill, this.unit, this.unit?.star ?? 1);
    const affectedSet = new Set(affected.map(c => `${c.row},${c.col}`));
    const affectedMap: Record<string, string> = {};
    for (const c of affected) affectedMap[`${c.row},${c.col}`] = c.side ?? (c.col <= 1 ? "ally" : "enemy");

    // Draw grid cells
    this.cellRects = {};
    this.blinkRects = [];

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const isAlly = col <= 1;
        const cellKey = `${row},${col}`;
        const isAffected = affectedSet.has(cellKey);
        const side = affectedMap[cellKey] ?? (isAlly ? "ally" : "enemy");

        const cx = gridX + col * cellSize;
        const cy = gridY + row * cellSize;

        // Base cell fill: màu theo bên
        const baseFill = isAlly ? COLOR.ALLY_EMPTY : COLOR.ENEMY_EMPTY;
        const baseStroke = isAlly ? COLOR.CELL_STROKE_ALLY : COLOR.CELL_STROKE_ENEMY;

        const cell = this.scene.add.rectangle(
          cx + 1, cy + 1, cellSize - 2, cellSize - 2, baseFill, 0.7
        ).setOrigin(0, 0);
        cell.setStrokeStyle(1, baseStroke, 0.8);
        this.container.add(cell);
        this.cellRects[cellKey] = cell;

        // Blink overlay cho ô bị ảnh hưởng
        if (isAffected) {
          const blinkColor = side === "ally" ? COLOR.HIGHLIGHT_ALLY : COLOR.HIGHLIGHT_ENEMY;
          const blinkStroke = side === "ally" ? COLOR.STROKE_ALLY_HIT : COLOR.STROKE_ENEMY_HIT;
          const blink = this.scene.add.rectangle(
            cx + 1, cy + 1, cellSize - 2, cellSize - 2, blinkColor, 0.0
          ).setOrigin(0, 0);
          blink.setStrokeStyle(2, blinkStroke, 0.9);
          this.container.add(blink);
          this.blinkRects.push(blink);
        }
      }
    }

    // Divider line between sides (between col 1 and 2)
    const divX = gridX + 2 * cellSize;
    const divLine = this.scene.add.graphics();
    divLine.lineStyle(2, 0x6fc2ff, 0.42);
    divLine.beginPath();
    divLine.moveTo(divX, gridY);
    divLine.lineTo(divX, gridY + gridH);
    divLine.strokePath();
    this.container.add(divLine);

    // Unit icon (bên ta, hàng giữa)
    const visual = getUnitVisual(this.unit?.id ?? "", this.unit?.classType, this.unit?.star ?? 1);
    const attackerCol = this.unit?.classType === "ASSASSIN" ? 1 : 0;
    const attackerRow = 2;
    const attackerX = gridX + attackerCol * cellSize + cellSize / 2;
    const attackerY = gridY + attackerRow * cellSize + cellSize / 2;
    this.attackerIcon = this.scene.add.text(attackerX, attackerY, visual.icon, {
      fontFamily: EMOJI_FONT,
      fontSize: scaleFontPx(this.scene, Math.floor(cellSize * 0.65), "body")
    }).setOrigin(0.5) as Phaser.GameObjects.Text;
    this.container.add(this.attackerIcon);
    this._attackerStartX = attackerX;
    this._attackerStartY = attackerY;

    // Enemy icons — chỉ đặt ở ô KHÔNG bị affect để tránh che blink
    const allEnemySlots = [
      { row: 0, col: 2 }, { row: 1, col: 3 }, { row: 2, col: 2 }
    ];
    this.enemyIcons = [];
    allEnemySlots.forEach(({ row, col }) => {
      const key = `${row},${col}`;
      const ex = gridX + col * cellSize + cellSize / 2;
      const ey = gridY + row * cellSize + cellSize / 2;
      const icon = this.scene.add.text(ex, ey, "👹", {
        fontFamily: EMOJI_FONT,
        fontSize: scaleFontPx(this.scene, Math.floor(cellSize * 0.55), "body")
      }).setOrigin(0.5) as Phaser.GameObjects.Text;
      this.container.add(icon);
      this.enemyIcons.push({ icon, row, col, key });
    });

    // Target center list (for hit effects)
    this.targetCenters = affected.map(c => ({
      x: gridX + c.col * cellSize + cellSize / 2,
      y: gridY + c.row * cellSize + cellSize / 2,
      side: c.side ?? (c.col <= 1 ? "ally" : "enemy"),
    }));

    // Info bar
    const areaCount = affected.length;
    const areaLabel = areaCount === 1 ? "Đơn mục tiêu"
      : areaCount <= 3 ? `${areaCount} mục tiêu`
        : "Diện rộng";
    const info = this.scene.add.text(8, H - 20, areaLabel, {
      fontFamily: UI_FONT,
      fontSize: scaleFontPx(this.scene, 11, "caption"),
      color: "#8ab4d4"
    });
    this.container.add(info);
  }

  startAnimation() {
    // Blink animation: ô ảnh hưởng nhấp nháy 0 → 0.65 → 0, repeat
    if (this.blinkRects.length > 0) {
      const t = this.scene.tweens.add({
        targets: this.blinkRects,
        alpha: { from: 0, to: 0.65 },
        duration: 550,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      });
      this.tweens.push(t);
    }

    this.playSkillLoop();
  }

  playSkillLoop() {
    if (!this.scene || !this.container?.active) return;

    const classType = this.unit?.classType ?? "";
    const actionPattern = this.skill?.actionPattern ?? "";
    const range = this.unit?.stats?.range ?? 1;

    // Attacker animation
    if (actionPattern === "ASSASSIN_BACK" || classType === "ASSASSIN") {
      // Dash tới ô đích rồi quay về
      const target = this.targetCenters[0];
      if (!target) { this.scene.time.delayedCall(1500, () => this.playSkillLoop()); return; }
      const t = this.scene.tweens.add({
        targets: this.attackerIcon,
        x: target.x - this.cellSize * 0.4,
        y: target.y,
        duration: 200,
        ease: "Power2",
        onComplete: () => {
          if (!this.container?.active) return;
          this.showSkillEffect();
          const t2 = this.scene.tweens.add({
            targets: this.attackerIcon,
            x: this._attackerStartX,
            y: this._attackerStartY,
            duration: 220,
            ease: "Power2",
            delay: 250,
            onComplete: () => {
              this.scene.time.delayedCall(900, () => this.playSkillLoop());
            }
          });
          this.tweens.push(t2);
        }
      });
      this.tweens.push(t);

    } else if (range >= 2 || actionPattern === "RANGED_STATIC" ||
      classType === "ARCHER" || classType === "MAGE" || classType === "SUPPORT") {
      // Ranged: co người lại → bắn projectile
      const t = this.scene.tweens.add({
        targets: this.attackerIcon,
        scaleX: 1.25, scaleY: 0.85,
        duration: 180,
        yoyo: true,
        onComplete: () => {
          if (!this.container?.active) return;
          // Spawn projectile tới từng target
          this.targetCenters.forEach((tc, i) => {
            this.scene.time.delayedCall(i * 60, () => {
              if (!this.container?.active) return;
              const proj = this.scene.add.circle(
                this._attackerStartX + this.cellSize * 0.6,
                this._attackerStartY, 4,
                tc.side === "ally" ? 0x44ffaa : 0xffdd44
              );
              this.container.add(proj);
              const tp = this.scene.tweens.add({
                targets: proj, x: tc.x, y: tc.y, duration: 220,
                ease: "Power1",
                onComplete: () => { proj.destroy(); this.showHitAt(tc); }
              });
              this.tweens.push(tp);
            });
          });
          this.scene.time.delayedCall(500, () => this.playSkillLoop());
        }
      });
      this.tweens.push(t);

    } else {
      // Melee: nhún người → dash sang địch rồi quay về
      const target = this.targetCenters[0];
      if (!target) { this.scene.time.delayedCall(1500, () => this.playSkillLoop()); return; }
      const t = this.scene.tweens.add({
        targets: this.attackerIcon,
        x: target.x - this.cellSize * 0.5,
        y: target.y,
        duration: 220,
        ease: "Power2",
        onComplete: () => {
          if (!this.container?.active) return;
          this.showSkillEffect();
          const t2 = this.scene.tweens.add({
            targets: this.attackerIcon,
            x: this._attackerStartX, y: this._attackerStartY,
            duration: 220, ease: "Power2", delay: 250,
            onComplete: () => {
              this.scene.time.delayedCall(900, () => this.playSkillLoop());
            }
          });
          this.tweens.push(t2);
        }
      });
      this.tweens.push(t);
    }
  }

  showSkillEffect() {
    if (!this.container?.active) return;
    this.targetCenters.forEach(tc => this.showHitAt(tc));
  }

  showHitAt({ x, y, side }: { x: number; y: number; side?: string }) {
    if (!this.container?.active) return;

    // Context-aware icon based on skill effect + target side
    let emoji = "💥"; // default enemy hit
    if (side === "ally") {
      const fx = String(this.skill?.effect ?? "").toLowerCase();
      if (/shield|taunt|reflect|armor|protect|fortif|immune|pangolin|turtle|resilient/.test(fx)) {
        emoji = "🛡️";
      } else if (/heal|regen|cleanse|peace|soul_link|spring|rebirth|revive|phoenix/.test(fx)) {
        emoji = "💚";
      } else {
        emoji = "✨"; // buff (ATK, DEF, evade, rage, etc.)
      }
    }

    const hit = this.scene.add.text(x, y - 8, emoji, { fontSize: scaleFontPx(this.scene, 16, "body") }).setOrigin(0.5);
    this.container.add(hit);
    const t = this.scene.tweens.add({
      targets: hit, y: y - 22, alpha: 0, duration: 420,
      onComplete: () => hit.destroy()
    });
    this.tweens.push(t);

    // Shake affected unit icons
    const iconList = side === "ally" ? [] : this.enemyIcons;
    iconList.forEach(({ icon, row, col }) => {
      const affected = this.targetCenters.some(
        tc => Math.abs(tc.x - (this.gridX + col * this.cellSize + this.cellSize / 2)) < 5
          && Math.abs(tc.y - (this.gridY + row * this.cellSize + this.cellSize / 2)) < 5
      );
      if (affected) {
        const origX = icon.x;
        const ts = this.scene.tweens.add({
          targets: icon, x: origX + 5, duration: 40, yoyo: true, repeat: 2,
          onComplete: () => icon.setX(origX)
        });
        this.tweens.push(ts);
      }
    });
  }

  destroy() {
    this.tweens.forEach(t => t?.stop?.());
    this.container.destroy();
  }
}
