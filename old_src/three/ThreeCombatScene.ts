/**
 * ============================================================================
 * 1. IMPORTS & DEPENDENCIES
 * ============================================================================
 */

import * as THREE from "three";
import { t } from "../i18n/index.js";
import {
  BATTLEFIELD_COLS,
  BATTLEFIELD_ROWS,
  BOARD_ROWS,
  PLAYER_COLS,
  RIGHT_COL_START,
  RIGHT_COL_END,
  type Unit3DConfig
} from "./types.js";
import { ThreeApp, type ThreeAppScene } from "./ThreeApp.js";
import { gridToWorld } from "./ThreeBoard.js";
import { createUnit3D, type Unit3DHandle } from "./ThreeUnitFactory.js";
import { resolveDamageAmount } from "../core/damageResolver.js";
import { checkCombatEnd, type ResolutionState, type ResolutionUnit } from "../systems/combat/combatResolutionRuntime.js";
import type { PlayerState, OwnedUnit } from "../core/runState.js";
import type { Board, BoardUnit } from "../systems/BoardSystem.js";

/**
 * ============================================================================
 * 2. INTERFACES & STRUCTURAL TYPES
 * ============================================================================
 */

export interface CombatUnitRecord {
  id: string;
  uid: string;
  baseId: string;
  name: string;
  star: number;
  side: "LEFT" | "RIGHT";
  row: number;
  col: number;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  atk: number;
  def: number;
  mdef: number;
  alive: boolean;
  handle?: Unit3DHandle;
  statuses: Record<string, unknown>;
  mods: Record<string, unknown>;
}

export interface TurnQueueEntry {
  row: number;
  col: number;
  side: "LEFT" | "RIGHT";
  unit: CombatUnitRecord | null;
}

export interface ThreeCombatResult {
  outcome: "win" | "lose" | "draw";
  round: number;
  goldEarned: number;
  xpEarned: number;
}

export interface ThreeCombatCallbacks {
  onNextRound?: (updatedPlayer: PlayerState) => void;
  onRetry?: () => void;
  onExitToMenu?: () => void;
}

export interface ThreeCombatSceneData {
  player?: PlayerState;
  board?: Board;
  bench?: (BoardUnit | null)[];
  enemyUnits?: BoardUnit[];
  round?: number;
  callbacks?: ThreeCombatCallbacks;
}

/**
 * ============================================================================
 * 3. CONSTANTS, ENUMS & MODULE STATE
 * ============================================================================
 */

const MAX_TURN_CYCLES = 20;

/**
 * ============================================================================
 * 4. PRIVATE HELPERS & TYPE GUARDS
 * ============================================================================
 */

/**
 * Generate standard enemy wave units based on current round.
 */
function generateEnemyWave(round: number): CombatUnitRecord[] {
  const count = Math.min(6, 1 + Math.floor(round / 2));
  const enemies: CombatUnitRecord[] = [];

  for (let i = 0; i < count; i += 1) {
    const row = i % BATTLEFIELD_ROWS;
    const col = RIGHT_COL_START + Math.floor(i / BATTLEFIELD_ROWS);
    enemies.push({
      id: `enemy_${round}_${i}`,
      uid: `enemy_uid_${round}_${i}`,
      baseId: "monster_goblin",
      name: `Monster ${i + 1}`,
      star: round > 4 ? 2 : 1,
      side: "RIGHT",
      row,
      col,
      hp: 80 + round * 25,
      maxHp: 80 + round * 25,
      mana: 0,
      maxMana: 100,
      atk: 15 + round * 4,
      def: 10 + round * 2,
      mdef: 8 + round * 2,
      alive: true,
      statuses: {},
      mods: {}
    });
  }
  return enemies;
}

/**
 * ============================================================================
 * 5. PUBLIC EXPORTS & LIFECYCLE METHODS
 * ============================================================================
 */

/**
 * ThreeCombatScene: 3D Tactical Auto-Battler Combat Execution
 * Rationale: Drives the 5x10 battlefield combat queue, attack animations, damage resolution,
 * turn cycling (max 20 before draw), win/loss state resolution, and outcome modals.
 */
export class ThreeCombatScene implements ThreeAppScene {
  private app: ThreeApp | null = null;
  private readonly round: number;
  private readonly player: PlayerState;
  private readonly rawBoard: Board | null;
  private readonly callbacks: ThreeCombatCallbacks;

  private combatUnits: CombatUnitRecord[] = [];
  private turnQueue: TurnQueueEntry[] = [];
  private turnIndex: number = 0;
  private turnCycleIndex: number = 1;
  private isActing: boolean = false;
  private autoCombat: boolean = true;
  private speedMultiplier: number = 1;
  private stepAccumulator: number = 0;
  private finished: boolean = false;
  private result: ThreeCombatResult | null = null;

  // DOM HUD & Modal elements
  private hudRoot: HTMLDivElement | null = null;
  private statusLabel: HTMLDivElement | null = null;
  private controlsPanel: HTMLDivElement | null = null;
  private resultModal: HTMLDivElement | null = null;

  constructor(data: ThreeCombatSceneData = {}) {
    this.round = data.round ?? data.player?.round ?? 1;
    this.player = (data.player ?? {
      hp: 100,
      gold: 20,
      xp: 0,
      level: 1,
      round: this.round
    }) as unknown as PlayerState;
    this.rawBoard = data.board ?? null;
    this.callbacks = data.callbacks ?? {};

    this.initCombatFormation(data.enemyUnits);
    this.buildTurnQueue();
  }

  /**
   * Mount 3D combat units and HUD controls.
   */
  public mount(app: ThreeApp): void {
    this.app = app;
    app.setCameraPreset("topdown");

    const hud = app.getHud();
    this.hudRoot = document.createElement("div");
    this.hudRoot.className = "three-combat-hud-root";
    this.hudRoot.style.position = "absolute";
    this.hudRoot.style.inset = "0";
    this.hudRoot.style.pointerEvents = "none";
    this.hudRoot.style.display = "flex";
    this.hudRoot.style.flexDirection = "column";
    this.hudRoot.style.justifyContent = "space-between";
    this.hudRoot.style.padding = "16px";
    hud.appendChild(this.hudRoot);

    this.renderTopHud();
    this.renderCombatControls();
    this.spawn3DCombatUnits();
  }

  /**
   * Per-frame update for combat simulation, timers, and 3D unit meshes.
   */
  public update(delta: number, elapsed: number): void {
    this.combatUnits.forEach((unit) => {
      if (unit.handle) unit.handle.update(delta, elapsed);
    });

    if (this.finished || !this.autoCombat || this.isActing) return;

    this.stepAccumulator += delta * this.speedMultiplier;
    const stepInterval = 0.55; // base step timing in seconds

    if (this.stepAccumulator >= stepInterval) {
      this.stepAccumulator = 0;
      void this.stepCombat();
    }
  }

  /**
   * Unmount and clean up combat meshes and HUD.
   */
  public unmount(): void {
    this.combatUnits.forEach((unit) => {
      if (unit.handle) {
        this.app?.manager.scene.remove(unit.handle.group);
        unit.handle.dispose();
      }
    });
    this.combatUnits.length = 0;

    if (this.hudRoot && this.hudRoot.parentElement) {
      this.hudRoot.parentElement.removeChild(this.hudRoot);
    }
    this.hudRoot = null;
    this.app = null;
  }

  /**
   * Get terminal combat result if finished.
   */
  public getResult(): ThreeCombatResult | null {
    return this.result;
  }

  /**
   * Execute single combat step action.
   */
  public async stepCombat(): Promise<void> {
    if (this.finished || this.isActing) return;
    this.isActing = true;

    try {
      // 1. Check if combat already reached terminal state
      if (this.checkResolution()) {
        this.isActing = false;
        return;
      }

      // 2. Advance queue or start next cycle
      if (this.turnIndex >= this.turnQueue.length) {
        if (this.turnCycleIndex >= MAX_TURN_CYCLES) {
          this.finishCombat("draw");
          this.isActing = false;
          return;
        }
        this.turnCycleIndex += 1;
        this.buildTurnQueue();
        this.updateTopHud();
      }

      const entry = this.turnQueue[this.turnIndex];
      this.turnIndex += 1;

      if (!entry || !entry.unit || !entry.unit.alive) {
        this.isActing = false;
        return;
      }

      const actor = entry.unit;
      const target = this.findTarget(actor);

      if (!target) {
        this.checkResolution();
        this.isActing = false;
        return;
      }

      // 3. Perform attack action
      actor.handle?.playAttack();

      const damageResult = resolveDamageAmount({
        attacker: actor as unknown as Parameters<typeof resolveDamageAmount>[0]["attacker"],
        defender: target as unknown as Parameters<typeof resolveDamageAmount>[0]["defender"],
        rawDamage: actor.atk,
        damageType: "physical",
        attackKind: "basic",
        randomFn: () => Math.random()
      });

      const finalDmg = damageResult.finalDamage ?? Math.max(1, actor.atk - target.def);
      target.hp = Math.max(0, target.hp - finalDmg);
      target.handle?.playHit();
      target.handle?.setHp(target.hp, target.maxHp);

      // Mana gain on hit
      actor.mana = Math.min(actor.maxMana, actor.mana + 20);
      actor.handle?.setMana(actor.mana, actor.maxMana);

      // 4. Handle unit death
      if (target.hp <= 0) {
        target.alive = false;
        if (target.handle) {
          target.handle.group.position.y = -5; // move off-screen
        }
      }

      this.checkResolution();
    } finally {
      this.isActing = false;
    }
  }

  // ==========================================================================
  // Private Combat Mechanics
  // ==========================================================================

  private initCombatFormation(customEnemies?: BoardUnit[]): void {
    this.combatUnits = [];

    // Player units on Left (cols 0..4)
    if (this.rawBoard) {
      for (let r = 0; r < BOARD_ROWS; r += 1) {
        for (let c = 0; c < PLAYER_COLS; c += 1) {
          const unit = this.rawBoard[r]?.[c];
          if (!unit) continue;
          const stats = (unit.stats as Record<string, unknown> | undefined) ?? {};
          this.combatUnits.push({
            id: `player_${unit.uid ?? `${r}_${c}`}`,
            uid: String(unit.uid ?? `p_${r}_${c}`),
            baseId: String(unit.baseId ?? "hero"),
            name: typeof unit.name === "string" ? unit.name : String(unit.baseId ?? "Ally"),
            star: Number(unit.star ?? 1),
            side: "LEFT",
            row: r,
            col: c,
            hp: Number(stats.hp ?? 100),
            maxHp: Number(stats.maxHp ?? 100),
            mana: Number(stats.mana ?? 0),
            maxMana: Number(stats.maxMana ?? 100),
            atk: Number(stats.atk ?? 25),
            def: Number(stats.def ?? 12),
            mdef: Number(stats.mdef ?? 10),
            alive: true,
            statuses: {},
            mods: {}
          });
        }
      }
    }

    // Default starter player if board was empty
    if (this.combatUnits.length === 0) {
      this.combatUnits.push({
        id: "starter_ally",
        uid: "starter_ally_uid",
        baseId: "hero_ranger",
        name: "Forest Ranger",
        star: 1,
        side: "LEFT",
        row: 2,
        col: 2,
        hp: 120,
        maxHp: 120,
        mana: 0,
        maxMana: 100,
        atk: 30,
        def: 15,
        mdef: 10,
        alive: true,
        statuses: {},
        mods: {}
      });
    }

    // Enemy units on Right (cols 5..9)
    const enemies: CombatUnitRecord[] = customEnemies && customEnemies.length > 0
      ? customEnemies.map((e, idx) => {
          const stats = (e.stats as Record<string, unknown> | undefined) ?? {};
          return {
            id: `enemy_${idx}`,
            uid: String(e.uid ?? `e_${idx}`),
            baseId: String(e.baseId ?? "monster"),
            name: typeof e.name === "string" ? e.name : "Enemy",
            star: Number(e.star ?? 1),
            side: "RIGHT" as const,
            row: idx % BATTLEFIELD_ROWS,
            col: RIGHT_COL_START + Math.floor(idx / BATTLEFIELD_ROWS),
            hp: Number(stats.hp ?? 100),
            maxHp: Number(stats.maxHp ?? 100),
            mana: Number(stats.mana ?? 0),
            maxMana: Number(stats.maxMana ?? 100),
            atk: Number(stats.atk ?? 20),
            def: Number(stats.def ?? 10),
            mdef: Number(stats.mdef ?? 10),
            alive: true,
            statuses: {},
            mods: {}
          };
        })
      : generateEnemyWave(this.round);

    this.combatUnits.push(...enemies);
  }

  private buildTurnQueue(): void {
    // Frontline-first ordering:
    // LEFT: col 4 down to 0, row 0..4
    // RIGHT: col 5 up to 9, row 0..4
    const leftCells: TurnQueueEntry[] = [];
    for (let c = PLAYER_COLS - 1; c >= 0; c -= 1) {
      for (let r = 0; r < BATTLEFIELD_ROWS; r += 1) {
        const u = this.combatUnits.find((unit) => unit.alive && unit.side === "LEFT" && unit.row === r && unit.col === c);
        leftCells.push({ row: r, col: c, side: "LEFT", unit: u ?? null });
      }
    }

    const rightCells: TurnQueueEntry[] = [];
    for (let c = RIGHT_COL_START; c <= RIGHT_COL_END; c += 1) {
      for (let r = 0; r < BATTLEFIELD_ROWS; r += 1) {
        const u = this.combatUnits.find((unit) => unit.alive && unit.side === "RIGHT" && unit.row === r && unit.col === c);
        rightCells.push({ row: r, col: c, side: "RIGHT", unit: u ?? null });
      }
    }

    // Chunk grouping & interleave
    const toChunks = (cells: TurnQueueEntry[]) => {
      const chunks: TurnQueueEntry[][] = [];
      let current: TurnQueueEntry[] = [];
      for (const cell of cells) {
        current.push(cell);
        if (cell.unit && cell.unit.alive) {
          chunks.push(current);
          current = [];
        }
      }
      if (current.length) chunks.push(current);
      return chunks;
    };

    const leftChunks = toChunks(leftCells);
    const rightChunks = toChunks(rightCells);
    const maxChunks = Math.max(leftChunks.length, rightChunks.length);
    const queue: TurnQueueEntry[] = [];

    for (let i = 0; i < maxChunks; i += 1) {
      if (i < leftChunks.length) queue.push(...leftChunks[i]);
      if (i < rightChunks.length) queue.push(...rightChunks[i]);
    }

    this.turnQueue = queue;
    this.turnIndex = 0;
  }

  private findTarget(actor: CombatUnitRecord): CombatUnitRecord | null {
    const opposingSide = actor.side === "LEFT" ? "RIGHT" : "LEFT";
    const aliveEnemies = this.combatUnits.filter((u) => u.alive && u.side === opposingSide);
    if (aliveEnemies.length === 0) return null;

    // Pick closest enemy
    let closest: CombatUnitRecord = aliveEnemies[0];
    let minDist = Infinity;

    aliveEnemies.forEach((enemy) => {
      const dist = Math.hypot(enemy.row - actor.row, enemy.col - actor.col);
      if (dist < minDist) {
        minDist = dist;
        closest = enemy;
      }
    });
    return closest;
  }

  private checkResolution(): boolean {
    const playerAlive = this.combatUnits.some((u) => u.alive && u.side === "LEFT");
    const enemyAlive = this.combatUnits.some((u) => u.alive && u.side === "RIGHT");

    if (!playerAlive && !enemyAlive) {
      this.finishCombat("draw");
      return true;
    }
    if (!enemyAlive) {
      this.finishCombat("win");
      return true;
    }
    if (!playerAlive) {
      this.finishCombat("lose");
      return true;
    }
    return false;
  }

  private finishCombat(outcome: ThreeCombatResult["outcome"]): void {
    if (this.finished) return;
    this.finished = true;

    const goldEarned = outcome === "win" ? 5 + this.round : 2;
    const xpEarned = outcome === "win" ? 2 : 1;
    this.result = { outcome, round: this.round, goldEarned, xpEarned };

    this.player.gold += goldEarned;
    this.player.xp += xpEarned;
    if (outcome === "lose") {
      this.player.hp = Math.max(0, this.player.hp - 15);
    }

    this.showResultModal(outcome, goldEarned, xpEarned);
  }

  private spawn3DCombatUnits(): void {
    if (!this.app) return;

    this.combatUnits.forEach((unit) => {
      const config: Unit3DConfig = {
        id: unit.id,
        baseId: unit.baseId,
        name: unit.name,
        star: unit.star,
        side: unit.side === "LEFT" ? "player" : "enemy",
        gridRow: unit.row,
        gridCol: unit.col,
        hp: unit.hp,
        maxHp: unit.maxHp,
        mana: unit.mana,
        maxMana: unit.maxMana,
        primaryColor: unit.side === "LEFT" ? 0x45f0a0 : 0xff627f
      };
      const handle = createUnit3D(config);
      const pos = gridToWorld(unit.row, unit.col, "combat");
      handle.group.position.set(pos.x, pos.y, pos.z);
      this.app?.manager.scene.add(handle.group);
      unit.handle = handle;
    });
  }

  // ==========================================================================
  // HUD & UI Elements
  // ==========================================================================

  private renderTopHud(): void {
    if (!this.hudRoot) return;
    this.statusLabel = document.createElement("div");
    this.statusLabel.className = "three-combat-top-status";
    this.statusLabel.style.display = "flex";
    this.statusLabel.style.justifyContent = "space-between";
    this.statusLabel.style.background = "rgba(19, 26, 41, 0.88)";
    this.statusLabel.style.padding = "10px 18px";
    this.statusLabel.style.border = "3px solid #f6d889";
    this.statusLabel.style.color = "#ffe9a6";
    this.statusLabel.style.fontFamily = "monospace";
    this.statusLabel.style.fontSize = "16px";
    this.statusLabel.style.fontWeight = "bold";
    this.hudRoot.appendChild(this.statusLabel);
    this.updateTopHud();
  }

  private updateTopHud(): void {
    if (!this.statusLabel) return;
    const playerAliveCount = this.combatUnits.filter((u) => u.alive && u.side === "LEFT").length;
    const enemyAliveCount = this.combatUnits.filter((u) => u.alive && u.side === "RIGHT").length;

    this.statusLabel.innerHTML = `
      <span>🏰 ${t("three.combat.hud.round", { round: this.round })}</span>
      <span>⏱️ ${t("three.combat.hud.cycle", { cycle: this.turnCycleIndex })}</span>
      <span>💚 ${playerAliveCount} Allies vs ${enemyAliveCount} Enemies ❤️</span>
    `;
  }

  private renderCombatControls(): void {
    if (!this.hudRoot) return;
    this.controlsPanel = document.createElement("div");
    this.controlsPanel.className = "three-combat-controls-panel";
    this.controlsPanel.style.display = "flex";
    this.controlsPanel.style.gap = "12px";
    this.controlsPanel.style.justifyContent = "center";
    this.controlsPanel.style.pointerEvents = "auto";

    // Step button
    const stepBtn = document.createElement("button");
    stepBtn.type = "button";
    stepBtn.textContent = t("three.combat.action.step");
    stepBtn.style.minHeight = "48px";
    stepBtn.style.padding = "10px 18px";
    stepBtn.style.fontFamily = "monospace";
    stepBtn.style.fontWeight = "bold";
    stepBtn.style.background = "#2b5940";
    stepBtn.style.color = "#a4ffd5";
    stepBtn.style.border = "2px solid #45f0a0";
    stepBtn.style.cursor = "pointer";
    stepBtn.addEventListener("click", () => void this.stepCombat());
    this.controlsPanel.appendChild(stepBtn);

    // Auto Toggle
    const autoBtn = document.createElement("button");
    autoBtn.type = "button";
    autoBtn.textContent = this.autoCombat ? "Auto: ON" : "Auto: OFF";
    autoBtn.style.minHeight = "48px";
    autoBtn.style.padding = "10px 18px";
    autoBtn.style.fontFamily = "monospace";
    autoBtn.style.fontWeight = "bold";
    autoBtn.style.background = "#3b4d6e";
    autoBtn.style.color = "#ffd700";
    autoBtn.style.border = "2px solid #5a739e";
    autoBtn.style.cursor = "pointer";
    autoBtn.addEventListener("click", () => {
      this.autoCombat = !this.autoCombat;
      autoBtn.textContent = this.autoCombat ? "Auto: ON" : "Auto: OFF";
    });
    this.controlsPanel.appendChild(autoBtn);

    // Speed multiplier button
    const speedBtn = document.createElement("button");
    speedBtn.type = "button";
    speedBtn.textContent = t("three.combat.action.speed", { speed: this.speedMultiplier });
    speedBtn.style.minHeight = "48px";
    speedBtn.style.padding = "10px 18px";
    speedBtn.style.fontFamily = "monospace";
    speedBtn.style.fontWeight = "bold";
    speedBtn.style.background = "#4a3c5a";
    speedBtn.style.color = "#dfb4ff";
    speedBtn.style.border = "2px solid #9b72cf";
    speedBtn.style.cursor = "pointer";
    speedBtn.addEventListener("click", () => {
      this.speedMultiplier = this.speedMultiplier === 1 ? 2 : this.speedMultiplier === 2 ? 3 : 1;
      speedBtn.textContent = t("three.combat.action.speed", { speed: this.speedMultiplier });
    });
    this.controlsPanel.appendChild(speedBtn);

    this.hudRoot.appendChild(this.controlsPanel);
  }

  private showResultModal(outcome: ThreeCombatResult["outcome"], gold: number, xp: number): void {
    if (!this.hudRoot) return;

    this.resultModal = document.createElement("div");
    this.resultModal.className = "three-combat-result-modal";
    this.resultModal.style.position = "absolute";
    this.resultModal.style.inset = "0";
    this.resultModal.style.display = "grid";
    this.resultModal.style.placeItems = "center";
    this.resultModal.style.background = "rgba(10, 15, 25, 0.85)";
    this.resultModal.style.pointerEvents = "auto";
    this.resultModal.style.zIndex = "50";

    const box = document.createElement("div");
    box.style.width = "min(90vw, 480px)";
    box.style.padding = "28px";
    box.style.border = "4px solid #f6d889";
    box.style.background = "#1b2438";
    box.style.textAlign = "center";
    box.style.color = "#ffe9a6";
    box.style.fontFamily = "monospace";

    const outcomeTitle = outcome === "win"
      ? t("three.combat.result.victory")
      : outcome === "lose"
        ? t("three.combat.result.defeat")
        : t("three.combat.result.draw");

    box.innerHTML = `
      <h2 style="font-size: 32px; margin: 0 0 16px; color: ${outcome === "win" ? "#45f0a0" : "#ff627f"};">${outcomeTitle}</h2>
      <p style="font-size: 18px; margin: 8px 0;">+${gold} Gold • +${xp} XP</p>
      <p style="font-size: 16px; color: #b7d5e8;">Player HP: ${this.player.hp}</p>
    `;

    const continueBtn = document.createElement("button");
    continueBtn.type = "button";
    continueBtn.textContent = t("three.modal.button.confirm");
    continueBtn.style.minHeight = "48px";
    continueBtn.style.margin = "18px 0 0";
    continueBtn.style.padding = "12px 28px";
    continueBtn.style.fontSize = "18px";
    continueBtn.style.fontWeight = "bold";
    continueBtn.style.fontFamily = "monospace";
    continueBtn.style.background = "#f4c653";
    continueBtn.style.color = "#131a29";
    continueBtn.style.border = "3px solid #201a09";
    continueBtn.style.cursor = "pointer";

    continueBtn.addEventListener("click", () => {
      this.resultModal?.remove();
      if (this.callbacks.onNextRound) {
        this.callbacks.onNextRound(this.player);
      }
    });

    box.appendChild(continueBtn);
    this.resultModal.appendChild(box);
    this.hudRoot.appendChild(this.resultModal);
  }
}

export default ThreeCombatScene;
