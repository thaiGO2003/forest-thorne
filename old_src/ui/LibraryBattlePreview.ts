import { COLS, PLAYER_COLS, ROWS } from "../core/boardConstants.js";
import { getUnitVisual } from "../data/unitVisuals.js";
import { t } from "../i18n/index.js";
import { UI_FONT, EMOJI_FONT } from "../core/uiTheme.js";
import type { Scene as PhaserScene } from "phaser";
import { resolveLibraryPreviewPlan } from "./libraryPreviewRuntime.js";
import type { PreviewPlan, PreviewActor, PreviewBadge } from "./libraryPreviewRuntime.js";
import {
  getBasicAttackProfile,
  isMeleeAssassinUnit,
  resolveSkillAttackStyle,
  resolveBasicAttackVisualMode
} from "../core/damageResolver.js";

const BG_FILL = 0x0a1520;

const BOARD_FILL_ALLY = 0x204830;
const BOARD_FILL_ENEMY = 0x233f57;
const BOARD_STROKE = 0x6db2d4;

interface LibraryBattlePreviewScene extends PhaserScene {}
interface LibraryBattlePreviewUnit {
  id: string;
  classType: string;
  star?: number;
  stats?: { range?: number };
  skillId?: string;
  description?: string;
  descriptionEn?: string;
  descriptionVi?: string;
  name?: string;
  nameEn?: string;
  nameVi?: string;
  icon?: string;
  tier?: number;
  tribe?: string;
  visual?: unknown;
}

interface LibraryBattlePreviewSkill {
  id?: string;
  damageType?: string;
  actionPattern?: string;
  effect?: string;
  targetTextVi?: string;
  targetTextEn?: string;
  targetText?: string;
}

interface LibraryBattlePreviewOptions {
  mode?: "attack" | "skill";
  star?: number;
  collectionProfile?: unknown;
}

interface TileLookupEntry {
  x: number;
  y: number;
  row: number;
  col: number;
}

interface ActorToken {
  actor: PreviewActor;
  token: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Arc;
  text: Phaser.GameObjects.Text;
  startX: number;
  startY: number;
}

interface ImpactEntry {
  row: number;
  col: number;
  icon: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function damageTint(damageType: string | undefined): number {
  if (damageType === "magic") return 0xc59bff;
  if (damageType === "true") return 0xf4f7ff;
  return 0xffd56a;
}

export class LibraryBattlePreview {
  scene: LibraryBattlePreviewScene;
  unit: LibraryBattlePreviewUnit;
  skill: LibraryBattlePreviewSkill | null;
  options: LibraryBattlePreviewOptions;
  width: number;
  height: number;
  mode: "attack" | "skill";
  star: number;
  container: Phaser.GameObjects.Container;
  tweens: Phaser.Tweens.Tween[];
  timers: Phaser.Time.TimerEvent[];
  tileLookup: Map<string, TileLookupEntry>;
  actorTokens: ActorToken[];
  badges: Phaser.GameObjects.GameObject[];
  plan!: PreviewPlan;
  tileW!: number;
  tileH!: number;
  constructor(
    scene: LibraryBattlePreviewScene,
    x: number,
    y: number,
    width: number,
    height: number,
    unit: LibraryBattlePreviewUnit,
    skill: LibraryBattlePreviewSkill | null,
    options: LibraryBattlePreviewOptions = {}
  ) {
    this.scene = scene;
    this.unit = unit;
    this.skill = skill;
    this.options = options;
    this.width = width;
    this.height = height;
    this.mode = options.mode ?? "attack";
    this.star = clamp(Number(options.star) || 1, 1, 3);
    this.container = scene.add.container(x, y);
    this.tweens = [];
    this.timers = [];
    this.tileLookup = new Map();
    this.actorTokens = [];
    this.badges = [];
    this.build();
    this.startLoop();
  }

  build(): void {
    const scene = this.scene;
    const plan = resolveLibraryPreviewPlan(this.unit, this.skill, { mode: this.mode, star: this.star });
    this.plan = plan;

    const bg = scene.add.rectangle(0, 0, this.width, this.height, BG_FILL, 0.92).setOrigin(0, 0);
    bg.setStrokeStyle(1, 0x3a5070, 0.9);
    this.container.add(bg);

    const titleText = this.mode === "attack" ? t("library.previewAttackTitle") : t("library.previewSkillTitle");
    const title = scene.add.text(10, 8, `${titleText} • ${this.star}★`, {
      fontFamily: UI_FONT,
      fontSize: "13px",
      color: "#ffd580",
      fontStyle: "bold"
    });
    this.container.add(title);

    const subtitle = scene.add.text(10, 24, t("library.previewSubtitle"), {
      fontFamily: UI_FONT,
      fontSize: "10px",
      color: "#8ab4d4"
    });
    this.container.add(subtitle);

    const tileW = clamp(Math.floor((this.width - 44) / 7.2), 22, 38);
    const tileH = Math.floor(tileW * 0.52);
    this.tileW = tileW;
    this.tileH = tileH;
    const rawCenters: Array<{ row: number; col: number; cx: number; cy: number }> = [];
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const cx = (col + row) * tileW * 0.5;
        const cy = (row - col) * tileH * 0.5;
        rawCenters.push({ row, col, cx, cy });
        minX = Math.min(minX, cx - tileW * 0.5);
        maxX = Math.max(maxX, cx + tileW * 0.5);
        minY = Math.min(minY, cy - tileH * 0.5);
        maxY = Math.max(maxY, cy + tileH * 0.5);
      }
    }

    const boardW = maxX - minX;
    const boardH = maxY - minY;
    const boardOffsetX = Math.floor((this.width - boardW) * 0.5 - minX);
    const boardOffsetY = Math.floor(38 + Math.max(0, (this.height - 92 - boardH) * 0.4) - minY);

    const boardLayer = scene.add.graphics();
    this.container.add(boardLayer);

    rawCenters.forEach(({ row, col, cx, cy }) => {
      const centerX = Math.round(cx + boardOffsetX);
      const centerY = Math.round(cy + boardOffsetY);
      const isAllyCell = col < PLAYER_COLS;
      boardLayer.fillStyle(isAllyCell ? BOARD_FILL_ALLY : BOARD_FILL_ENEMY, 0.86);
      boardLayer.lineStyle(1, BOARD_STROKE, 0.45);
      this.drawDiamond(boardLayer, centerX, centerY, tileW, tileH);
      this.tileLookup.set(`${row},${col}`, { x: centerX, y: centerY, row, col });
    });

    const divider = scene.add.graphics();
    divider.lineStyle(2, 0x6fc2ff, 0.42);
    let lastMid: { x: number; y: number } | null = null;
    for (let row = 0; row < ROWS; row += 1) {
      const leftTile = this.tileLookup.get(`${row},${PLAYER_COLS - 1}`);
      const rightTile = this.tileLookup.get(`${row},${PLAYER_COLS}`);
      if (!leftTile || !rightTile) continue;
      const mid = {
        x: Math.round((leftTile.x + rightTile.x) * 0.5),
        y: Math.round((leftTile.y + rightTile.y) * 0.5)
      };
      if (lastMid) {
        divider.beginPath();
        divider.moveTo(lastMid.x, lastMid.y);
        divider.lineTo(mid.x, mid.y);
        divider.strokePath();
      }
      lastMid = mid;
    }
    this.container.add(divider);

    this.renderImpact(plan);
    this.renderActors(plan);

    const legend = scene.add.text(10, this.height - 34, plan.legend.join(" • "), {
      fontFamily: UI_FONT,
      fontSize: "10px",
      color: "#c0ddf5",
      wordWrap: { width: this.width - 20 }
    });
    this.container.add(legend);
  }

  drawDiamond(graphics: { beginPath: () => void; moveTo: (x: number, y: number) => void; lineTo: (x: number, y: number) => void; closePath: () => void; fillPath: () => void; strokePath: () => void }, centerX: number, centerY: number, tileW: number, tileH: number): void {
    graphics.beginPath();
    graphics.moveTo(centerX, centerY - tileH * 0.5);
    graphics.lineTo(centerX + tileW * 0.5, centerY);
    graphics.lineTo(centerX, centerY + tileH * 0.5);
    graphics.lineTo(centerX - tileW * 0.5, centerY);
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();
  }

  renderImpact(plan: PreviewPlan): void {
    const layer = this.scene.add.graphics();
    this.container.add(layer);

    plan.badges.forEach((badge: PreviewBadge) => {
      const tile = this.tileLookup.get(`${badge.row},${badge.col}`);
      if (!tile) return;
      const fillColor = badge.primary
        ? 0xffcc6a
        : badge.side === "ally"
          ? 0x59d38f
          : 0x6fd6ff;
      const lineColor = badge.primary
        ? 0xffefb5
        : badge.side === "ally"
          ? 0xc6ffe0
          : 0xb8ebff;
      layer.fillStyle(fillColor, badge.primary ? 0.28 : 0.18);
      layer.lineStyle(badge.primary ? 3 : 2, lineColor, 0.95);
      this.drawDiamond(layer, tile.x, tile.y, this.tileW, this.tileH);

      const badgeBg = this.scene.add.circle(tile.x, tile.y - 10, 10, 0x0b1724, 0.94);
      badgeBg.setStrokeStyle(1.2, lineColor, 1);
      const badgeIcon = this.scene.add.text(tile.x, tile.y - 10, badge.icon, {
        fontFamily: EMOJI_FONT,
        fontSize: "12px"
      }).setOrigin(0.5);
      this.container.add([badgeBg, badgeIcon]);
      this.badges.push(badgeBg, badgeIcon);

      if (badge.primary) {
        const pulse = this.scene.tweens.add({
          targets: [badgeBg, badgeIcon],
          scaleX: 1.1,
          scaleY: 1.1,
          duration: 650,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut"
        });
        this.tweens.push(pulse);
      }
    });
  }

  renderActors(plan: PreviewPlan): void {
    const attackerVisual = getUnitVisual(this.unit.id, this.unit.classType, this.star, {
      ownerKind: "LIBRARY",
      collectionProfile: this.options?.collectionProfile ?? null
    });
    const allActors: Array<{ actor: PreviewActor; side: string; icon: string }> = [
      ...plan.allies.map((actor) => ({ actor, side: "LEFT", icon: actor.uid === plan.attacker.uid ? attackerVisual.icon : "🐾" })),
      ...plan.enemies.map((actor) => ({ actor, side: "RIGHT", icon: "👹" }))
    ];

    allActors.forEach(({ actor, side, icon }) => {
      const tile = this.tileLookup.get(`${actor.row},${actor.col}`);
      if (!tile) return;
      const token = this.scene.add.container(tile.x, tile.y - 2);
      const bgColor = actor.uid === plan.attacker.uid ? 0x12263a : side === "LEFT" ? 0x23455f : 0x5b2430;
      const strokeColor = actor.uid === plan.attacker.uid ? 0xffe39a : side === "LEFT" ? 0x9ad6ff : 0xffb2bf;
      const bg = this.scene.add.circle(0, 0, actor.uid === plan.attacker.uid ? 14 : 11, bgColor, 0);
      bg.setStrokeStyle(1.2, strokeColor, 0);
      const text = this.scene.add.text(0, 0, icon, {
        fontFamily: EMOJI_FONT,
        fontSize: actor.uid === plan.attacker.uid ? "16px" : "13px"
      }).setOrigin(0.5);
      token.add([bg, text]);
      this.container.add(token);
      this.actorTokens.push({ actor, token, bg, text, startX: tile.x, startY: tile.y - 2 });
    });
  }

  startLoop(): void {
    this.playCycle();
  }

  scheduleNext(delay = 1100): void {
    const timer = this.scene.time.delayedCall(delay, () => this.playCycle());
    this.timers.push(timer);
  }

  playCycle(): void {
    if (!this.container.active) return;
    const attackerToken = this.actorTokens.find((entry) => entry.actor.uid === this.plan.attacker.uid);
    if (!attackerToken) return;
    const primary = this.plan.primary ? this.tileLookup.get(`${this.plan.primary.row},${this.plan.primary.col}`) : null;
    const attackMode = resolveBasicAttackVisualMode(
      this.unit as unknown as Parameters<typeof resolveBasicAttackVisualMode>[0],
      this.unit.visual as unknown as Parameters<typeof resolveBasicAttackVisualMode>[1]
    );
    const meleeAssassinSkillStyle = this.mode === "skill" && isMeleeAssassinUnit(this.unit)
      ? resolveSkillAttackStyle(
          this.unit as unknown as Parameters<typeof resolveSkillAttackStyle>[0],
          this.unit.visual as unknown as Parameters<typeof resolveSkillAttackStyle>[1]
        )
      : null;
    const rangedPattern = this.skill?.actionPattern === "RANGED_STATIC" || this.skill?.actionPattern === "RANGED_CHAIN";
    const allyTargetingText = `${this.skill?.targetTextVi ?? ""} ${this.skill?.targetTextEn ?? ""} ${this.skill?.targetText ?? ""}`.toLowerCase();
    const isAllyTargetingSkill = allyTargetingText.includes("đồng minh") || allyTargetingText.includes("ally");
    const shouldLaunch = this.mode === "attack"
      ? attackMode === "projectile"
      : meleeAssassinSkillStyle
        ? false
      : this.skill?.actionPattern === "SELF" || isAllyTargetingSkill
        ? false
        : rangedPattern || this.plan.attacker.range >= 2 || ["ARCHER", "MAGE", "SUPPORT"].includes(this.unit.classType);
    const shouldBeam = this.mode === "attack" && attackMode === "beam";

    const castTween = this.scene.tweens.add({
      targets: attackerToken.token,
      scaleX: 1.08,
      scaleY: 0.92,
      duration: 170,
      yoyo: true,
      onComplete: () => {
        if (!this.container.active) return;
        if (!primary || (this.mode === "skill" && this.skill?.actionPattern === "SELF")) {
          this.showHits();
          this.scheduleNext();
          return;
        }
        if (shouldBeam) {
          this.fireBeam(attackerToken, primary);
        } else if (shouldLaunch) {
          this.fireProjectile(attackerToken, primary);
        } else {
          this.dashToTarget(attackerToken, primary);
        }
      }
    });
    this.tweens.push(castTween);
  }

  fireProjectile(attackerToken: ActorToken, primary: TileLookupEntry): void {
    const basicAttack = getBasicAttackProfile(this.unit as unknown as Parameters<typeof getBasicAttackProfile>[0]);
    const projectile = this.scene.add.circle(attackerToken.startX + 8, attackerToken.startY - 4, 4, damageTint(this.mode === "attack" ? basicAttack.damageType : this.skill?.damageType), 1);
    this.container.add(projectile);
    const startX = attackerToken.startX + 8;
    const startY = attackerToken.startY - 4;
    const arc = Math.max(12, Math.min(44, Math.abs(primary.x - startX) * 0.14));
    const tween = this.scene.tweens.add({
      targets: projectile,
      x: primary.x,
      duration: this.mode === "attack" ? 320 : 360,
      ease: "Sine.easeInOut",
      onUpdate: (tw: { progress?: number }) => {
        const t = tw.progress ?? 1;
        projectile.y = startY + (primary.y - 4 - startY) * t - Math.sin(Math.PI * t) * arc;
      },
      onComplete: () => {
        projectile.destroy();
        this.showHits();
        this.scheduleNext();
      }
    });
    this.tweens.push(tween);
  }

  fireBeam(attackerToken: ActorToken, primary: TileLookupEntry): void {
    const beam = this.scene.add.rectangle(
      (attackerToken.startX + primary.x) * 0.5,
      (attackerToken.startY + primary.y - 4) * 0.5,
      Math.max(24, Math.abs(primary.x - attackerToken.startX)),
      4,
      0xbef7ff,
      0.7
    ).setAngle(Math.atan2((primary.y - 4) - attackerToken.startY, primary.x - attackerToken.startX) * (180 / Math.PI));
    this.container.add(beam);
    const tween = this.scene.tweens.add({
      targets: beam,
      alpha: 0,
      scaleX: 1.08,
      duration: 180,
      ease: "Cubic.out",
      onComplete: () => {
        beam.destroy();
        this.showHits();
        this.scheduleNext();
      }
    });
    this.tweens.push(tween);
  }

  dashToTarget(attackerToken: ActorToken, primary: TileLookupEntry): void {
    const tween = this.scene.tweens.add({
      targets: attackerToken.token,
      x: primary.x - 14,
      y: primary.y - 6,
      duration: 220,
      ease: "Power2",
      onComplete: () => {
        this.showHits();
        const backTween = this.scene.tweens.add({
          targets: attackerToken.token,
          x: attackerToken.startX,
          y: attackerToken.startY,
          duration: 220,
          delay: 180,
          ease: "Power2",
          onComplete: () => this.scheduleNext()
        });
        this.tweens.push(backTween);
      }
    });
    this.tweens.push(tween);
  }

  showHits(): void {
    const impacts: ImpactEntry[] = this.mode === "attack"
      ? [{ row: this.plan.primary?.row ?? 0, col: this.plan.primary?.col ?? 0, icon: "💥" }].filter((entry) => entry.row != null)
      : this.plan.badges.map((badge: PreviewBadge) => ({
          row: badge.row,
          col: badge.col,
          icon: badge.side === "ally"
            ? (/heal|regen|cleanse|peace|spring|rebirth|revive|purify/i.test(String(this.skill?.effect ?? "")) ? "💚" : "✨")
            : "💥"
        }));

    impacts.forEach((impact, index) => {
      const tile = this.tileLookup.get(`${impact.row},${impact.col}`);
      if (!tile) return;
      const timer = this.scene.time.delayedCall(index * 70, () => {
        if (!this.container.active) return;
        const text = this.scene.add.text(tile.x, tile.y - 18, impact.icon, {
          fontFamily: EMOJI_FONT,
          fontSize: "14px"
        }).setOrigin(0.5);
        this.container.add(text);
        const tween = this.scene.tweens.add({
          targets: text,
          y: text.y - 10,
          alpha: 0,
          duration: 420,
          onComplete: () => text.destroy()
        });
        this.tweens.push(tween);
      });
      this.timers.push(timer);
    });
  }

  destroy(): void {
    this.tweens.forEach((tween) => tween?.stop?.());
    this.timers.forEach((timer) => timer?.destroy?.());
    this.container.destroy();
  }
}
