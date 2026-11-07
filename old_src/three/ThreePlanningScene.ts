/**
 * ============================================================================
 * 1. IMPORTS & DEPENDENCIES
 * ============================================================================
 */

import * as THREE from "three";
import { t } from "../i18n/index.js";
import {
  createEmptyBoard,
  moveUnit,
  placeUnit,
  removeUnit,
  getDeployCount,
  type Board,
  type BoardUnit
} from "../systems/BoardSystem.js";
import {
  placeBenchUnitOnBoard,
  moveBoardUnitToBench,
  moveBenchUnit
} from "../systems/BoardBenchOps.js";
import { ThreeApp, type ThreeAppScene } from "./ThreeApp.js";
import { applyHighlight, clearAllHighlights, gridToWorld, benchToWorld } from "./ThreeBoard.js";
import { createUnit3D, type Unit3DHandle } from "./ThreeUnitFactory.js";
import {
  BENCH_DEFAULT_CAP,
  BENCH_MAX_SLOTS,
  BOARD_COLS,
  BOARD_ROWS,
  SHOP_CARD_COUNT,
  type Unit3DConfig
} from "./types.js";
import type { PlayerState, OwnedUnit } from "../core/runState.js";

/**
 * ============================================================================
 * 2. INTERFACES & STRUCTURAL TYPES
 * ============================================================================
 */

export interface ThreeShopItem {
  id: string;
  name: string;
  cost: number;
  star: number;
  tribe?: string;
  classType?: string;
}

export interface ThreePlanningCallbacks {
  onStartCombat?: (combatData: {
    player: PlayerState;
    board: Board;
    bench: (BoardUnit | null)[];
    round: number;
  }) => void;
  onOpenSettings?: () => void;
  onOpenLibrary?: () => void;
}

export interface ThreePlanningSceneData {
  player?: PlayerState;
  board?: Board;
  bench?: (BoardUnit | null)[];
  deployLimit?: number;
  round?: number;
  callbacks?: ThreePlanningCallbacks;
}

/**
 * ============================================================================
 * 3. CONSTANTS, ENUMS & MODULE STATE
 * ============================================================================
 */

const DEFAULT_SHOP_OFFERS: ThreeShopItem[] = [
  { id: "hero_fighter", name: "Ranger", cost: 1, star: 1, classType: "FIGHTER" },
  { id: "hero_mage", name: "Mage", cost: 2, star: 1, classType: "MAGE" },
  { id: "hero_tanker", name: "Guardian", cost: 2, star: 1, classType: "TANKER" },
  { id: "hero_assassin", name: "Assassin", cost: 3, star: 1, classType: "ASSASSIN" },
  { id: "hero_archer", name: "Sharpshooter", cost: 3, star: 1, classType: "ARCHER" }
];

/**
 * ============================================================================
 * 4. PRIVATE HELPERS & TYPE GUARDS
 * ============================================================================
 */

function makeDefaultPlayerState(round = 1): PlayerState {
  return {
    hp: 100,
    gold: 25,
    xp: 0,
    level: 1,
    round,
    benchBonus: 0,
    deployCapBonus: 0,
    board: [] as unknown as OwnedUnit[][],
    bench: [] as unknown as OwnedUnit[]
  } as unknown as PlayerState;
}

/**
 * ============================================================================
 * 5. PUBLIC EXPORTS & LIFECYCLE METHODS
 * ============================================================================
 */

/**
 * ThreePlanningScene: Tactical Planning Phase View
 * Rationale: Manages the 5x5 board placement, 12-slot visual bench (active slots clamped to
 * 9+benchBonus), shop offers, and transitions to combat.
 */
export class ThreePlanningScene implements ThreeAppScene {
  private app: ThreeApp | null = null;
  private board: Board;
  private bench: (BoardUnit | null)[];
  private player: PlayerState;
  private readonly deployLimit: number;
  private readonly round: number;
  private readonly callbacks: ThreePlanningCallbacks;

  private selectedTile: { row: number; col: number } | null = null;
  private selectedBenchIndex: number | null = null;
  private shopOffers: (ThreeShopItem | null)[] = [];
  private shopLocked: boolean = false;

  private readonly boardUnits = new Map<string, Unit3DHandle>();
  private readonly benchUnits = new Map<string, Unit3DHandle>();

  // HUD Elements
  private hudRoot: HTMLDivElement | null = null;
  private topBar: HTMLDivElement | null = null;
  private shopBar: HTMLDivElement | null = null;
  private actionPanel: HTMLDivElement | null = null;

  constructor(data: ThreePlanningSceneData = {}) {
    this.round = data.round ?? data.player?.round ?? 1;
    this.player = data.player ?? makeDefaultPlayerState(this.round);
    this.board = data.board ?? createEmptyBoard();
    const activeBenchCap = BENCH_DEFAULT_CAP + (this.player.benchBonus ?? 0);
    this.bench = data.bench ?? Array.from({ length: activeBenchCap }, () => null);
    this.deployLimit = (data.deployLimit ?? 3) + (this.player.deployCapBonus ?? 0);
    this.callbacks = data.callbacks ?? {};

    this.initDefaultShop();
    this.ensureStartingUnits();
  }

  /**
   * Mount 3D units, setup board handles and DOM HUD overlay.
   */
  public mount(app: ThreeApp): void {
    this.app = app;
    app.setCameraPreset("isometric");

    const hud = app.getHud();
    this.hudRoot = document.createElement("div");
    this.hudRoot.className = "three-planning-hud-root";
    this.hudRoot.style.position = "absolute";
    this.hudRoot.style.inset = "0";
    this.hudRoot.style.pointerEvents = "none";
    this.hudRoot.style.display = "flex";
    this.hudRoot.style.flexDirection = "column";
    this.hudRoot.style.justifyContent = "space-between";
    this.hudRoot.style.padding = "16px";
    hud.appendChild(this.hudRoot);

    this.renderTopBar();
    this.renderShopAndActions();
    this.refreshAllUnits3D();
  }

  /**
   * Per-frame update for idle bob and animations.
   */
  public update(delta: number, elapsed: number): void {
    this.boardUnits.forEach((unit) => unit.update(delta, elapsed));
    this.benchUnits.forEach((unit) => unit.update(delta, elapsed));
  }

  /**
   * Unmount and dispose all created resources and DOM nodes.
   */
  public unmount(): void {
    this.boardUnits.forEach((unit) => unit.dispose());
    this.boardUnits.clear();

    this.benchUnits.forEach((unit) => unit.dispose());
    this.benchUnits.clear();

    if (this.hudRoot && this.hudRoot.parentElement) {
      this.hudRoot.parentElement.removeChild(this.hudRoot);
    }
    this.hudRoot = null;
    this.app = null;
  }

  /**
   * Handle board tile click/selection.
   */
  public onTileClick(row: number, col: number): void {
    if (!this.app) return;
    clearAllHighlights(this.app.board);

    // If a bench unit was selected, attempt to deploy to this board tile
    if (this.selectedBenchIndex !== null) {
      const benchUnit = this.bench[this.selectedBenchIndex];
      if (benchUnit) {
        const res = placeBenchUnitOnBoard(
          this.board,
          this.bench as unknown as Parameters<typeof placeBenchUnitOnBoard>[1],
          this.selectedBenchIndex,
          row,
          col,
          this.deployLimit
        );
        if (res.success) {
          this.selectedBenchIndex = null;
          this.refreshAllUnits3D();
          this.updateHudState();
          return;
        }
      }
      this.selectedBenchIndex = null;
    }

    // If a board unit was previously selected, move/swap it
    if (this.selectedTile !== null) {
      if (this.selectedTile.row !== row || this.selectedTile.col !== col) {
        moveUnit(this.board, this.selectedTile.row, this.selectedTile.col, row, col);
      }
      this.selectedTile = null;
      this.refreshAllUnits3D();
      this.updateHudState();
      return;
    }

    // Otherwise select this tile if occupied
    if (this.board[row]?.[col]) {
      this.selectedTile = { row, col };
      const tileMesh = this.app.board.tiles[row]?.[col];
      if (tileMesh) applyHighlight(tileMesh);
    }
  }

  /**
   * Handle bench slot click/selection.
   */
  public onBenchClick(index: number): void {
    if (!this.app) return;
    clearAllHighlights(this.app.board);

    // If a board unit is selected, recall it to bench
    if (this.selectedTile !== null) {
      const activeCap = BENCH_DEFAULT_CAP + (this.player.benchBonus ?? 0);
      moveBoardUnitToBench(
        this.board,
        this.bench as unknown as Parameters<typeof moveBoardUnitToBench>[1],
        this.selectedTile.row,
        this.selectedTile.col,
        index,
        activeCap
      );
      this.selectedTile = null;
      this.refreshAllUnits3D();
      this.updateHudState();
      return;
    }

    // If a bench unit was already selected, move/swap within bench
    if (this.selectedBenchIndex !== null) {
      if (this.selectedBenchIndex !== index) {
        moveBenchUnit(
          this.bench as unknown as Parameters<typeof moveBenchUnit>[0],
          this.selectedBenchIndex,
          index
        );
      }
      this.selectedBenchIndex = null;
      this.refreshAllUnits3D();
      this.updateHudState();
      return;
    }

    // Select bench slot if it contains a unit
    if (this.bench[index]) {
      this.selectedBenchIndex = index;
      const benchMesh = this.app.board.benchTiles[index];
      if (benchMesh) applyHighlight(benchMesh);
    }
  }

  /**
   * Auto deploy units from bench to empty board positions up to deploy limit.
   */
  public autoDeploy(): void {
    let currentDeployed = getDeployCount(this.board);
    if (currentDeployed >= this.deployLimit) return;

    for (let bIndex = 0; bIndex < this.bench.length; bIndex += 1) {
      if (!this.bench[bIndex] || currentDeployed >= this.deployLimit) continue;
      // Find first empty cell on player rows
      for (let r = 0; r < BOARD_ROWS; r += 1) {
        for (let c = 0; c < BOARD_COLS; c += 1) {
          if (!this.board[r][c] && currentDeployed < this.deployLimit) {
            const res = placeBenchUnitOnBoard(
              this.board,
              this.bench as unknown as Parameters<typeof placeBenchUnitOnBoard>[1],
              bIndex,
              r,
              c,
              this.deployLimit
            );
            if (res.success) {
              currentDeployed += 1;
              break;
            }
          }
        }
        if (this.bench[bIndex] === null) break;
      }
    }

    this.refreshAllUnits3D();
    this.updateHudState();
  }

  /**
   * Buy a unit card from the shop.
   */
  public buyShopCard(index: number): boolean {
    const item = this.shopOffers[index];
    if (!item) return false;
    if (this.player.gold < item.cost) return false;

    // Find first empty bench slot
    const activeCap = BENCH_DEFAULT_CAP + (this.player.benchBonus ?? 0);
    let emptyBenchIndex = -1;
    for (let i = 0; i < activeCap; i += 1) {
      if (!this.bench[i]) {
        emptyBenchIndex = i;
        break;
      }
    }
    if (emptyBenchIndex === -1) return false; // Bench full

    this.player.gold -= item.cost;
    const newUnit: BoardUnit = {
      uid: `unit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      id: item.id,
      baseId: item.id,
      name: item.name,
      star: item.star,
      cost: item.cost,
      tribe: item.tribe ?? "FOREST",
      classType: item.classType ?? "FIGHTER",
      stats: { hp: 120, maxHp: 120, atk: 25, def: 15, mdef: 10, mana: 0, maxMana: 100 }
    };
    this.bench[emptyBenchIndex] = newUnit;
    this.shopOffers[index] = null;

    this.refreshAllUnits3D();
    this.updateHudState();
    return true;
  }

  /**
   * Reroll the shop for 2 gold.
   */
  public rerollShop(): boolean {
    if (this.player.gold < 2) return false;
    this.player.gold -= 2;
    this.initDefaultShop();
    this.updateHudState();
    return true;
  }

  /**
   * Start combat transition.
   */
  public startCombat(): void {
    if (this.callbacks.onStartCombat) {
      this.callbacks.onStartCombat({
        player: this.player,
        board: this.board,
        bench: this.bench,
        round: this.round
      });
    }
  }

  // ==========================================================================
  // Private View & HUD Methods
  // ==========================================================================

  private initDefaultShop(): void {
    this.shopOffers = DEFAULT_SHOP_OFFERS.slice(0, SHOP_CARD_COUNT).map((item) => ({ ...item }));
  }

  private ensureStartingUnits(): void {
    let hasUnits = false;
    for (let r = 0; r < BOARD_ROWS; r += 1) {
      for (let c = 0; c < BOARD_COLS; c += 1) {
        if (this.board[r][c]) {
          hasUnits = true;
          break;
        }
      }
    }
    for (let b = 0; b < this.bench.length; b += 1) {
      if (this.bench[b]) hasUnits = true;
    }

    if (!hasUnits) {
      // Grant starter unit on board
      const starter: BoardUnit = {
        uid: "starter_hero",
        id: "hero_ranger",
        baseId: "hero_ranger",
        name: "Forest Ranger",
        star: 1,
        cost: 1,
        tribe: "FOREST",
        classType: "ARCHER",
        stats: { hp: 100, maxHp: 100, atk: 20, def: 10, mdef: 10, mana: 0, maxMana: 100 }
      };
      this.board[2][2] = starter;
    }
  }

  private renderTopBar(): void {
    if (!this.hudRoot) return;
    this.topBar = document.createElement("div");
    this.topBar.className = "three-planning-top-bar";
    this.topBar.style.display = "flex";
    this.topBar.style.justifyContent = "space-between";
    this.topBar.style.alignItems = "center";
    this.topBar.style.background = "rgba(19, 26, 41, 0.88)";
    this.topBar.style.padding = "10px 18px";
    this.topBar.style.border = "3px solid #f6d889";
    this.topBar.style.color = "#ffe9a6";
    this.topBar.style.fontFamily = "monospace";
    this.topBar.style.fontSize = "16px";
    this.topBar.style.fontWeight = "bold";
    this.topBar.style.pointerEvents = "auto";
    this.hudRoot.appendChild(this.topBar);
    this.updateTopBarText();
  }

  private updateTopBarText(): void {
    if (!this.topBar) return;
    const deployed = getDeployCount(this.board);
    this.topBar.innerHTML = `
      <span>🏰 ${t("three.combat.hud.round", { round: this.round })}</span>
      <span>💰 ${this.player.gold} Gold</span>
      <span>⚔️ ${deployed}/${this.deployLimit} Units</span>
      <span>❤️ ${this.player.hp} HP</span>
    `;
  }

  private renderShopAndActions(): void {
    if (!this.hudRoot) return;
    const bottomWrapper = document.createElement("div");
    bottomWrapper.style.display = "flex";
    bottomWrapper.style.flexDirection = "column";
    bottomWrapper.style.gap = "10px";
    bottomWrapper.style.pointerEvents = "auto";

    // Shop Bar (5 unit cards)
    this.shopBar = document.createElement("div");
    this.shopBar.className = "three-planning-shop-bar";
    this.shopBar.style.display = "grid";
    this.shopBar.style.gridTemplateColumns = "repeat(5, 1fr)";
    this.shopBar.style.gap = "8px";
    this.shopBar.style.background = "rgba(19, 26, 41, 0.92)";
    this.shopBar.style.padding = "10px";
    this.shopBar.style.border = "3px solid #4a6fa5";
    bottomWrapper.appendChild(this.shopBar);

    // Actions panel: Reroll, Auto, Start Combat
    this.actionPanel = document.createElement("div");
    this.actionPanel.className = "three-planning-action-panel";
    this.actionPanel.style.display = "flex";
    this.actionPanel.style.gap = "12px";
    this.actionPanel.style.justifyContent = "center";
    bottomWrapper.appendChild(this.actionPanel);

    this.hudRoot.appendChild(bottomWrapper);
    this.updateShopCards();
    this.updateActionButtons();
  }

  private updateShopCards(): void {
    if (!this.shopBar) return;
    this.shopBar.innerHTML = "";

    this.shopOffers.forEach((offer, index) => {
      const card = document.createElement("button");
      card.type = "button";
      card.style.minHeight = "48px";
      card.style.padding = "8px";
      card.style.fontFamily = "monospace";
      card.style.fontWeight = "bold";
      card.style.cursor = offer ? "pointer" : "default";

      if (offer) {
        card.style.background = "#24334d";
        card.style.border = "2px solid #f6d889";
        card.style.color = "#fff";
        card.innerHTML = `<div>${offer.name}</div><div style="color: #ffd700;">★${offer.star} - ${offer.cost}G</div>`;
        card.addEventListener("click", () => this.buyShopCard(index));
      } else {
        card.style.background = "#131a29";
        card.style.border = "2px dashed #445";
        card.style.color = "#778";
        card.textContent = "—";
        card.disabled = true;
      }
      this.shopBar?.appendChild(card);
    });
  }

  private updateActionButtons(): void {
    if (!this.actionPanel) return;
    this.actionPanel.innerHTML = "";

    // Reroll button
    const rerollBtn = document.createElement("button");
    rerollBtn.type = "button";
    rerollBtn.textContent = t("three.shop.action.reroll", { cost: 2 });
    rerollBtn.style.minHeight = "48px";
    rerollBtn.style.padding = "10px 18px";
    rerollBtn.style.fontFamily = "monospace";
    rerollBtn.style.fontWeight = "bold";
    rerollBtn.style.background = "#3b4d6e";
    rerollBtn.style.color = "#ffd700";
    rerollBtn.style.border = "2px solid #5a739e";
    rerollBtn.style.cursor = "pointer";
    rerollBtn.addEventListener("click", () => this.rerollShop());
    this.actionPanel.appendChild(rerollBtn);

    // Auto deploy button
    const autoBtn = document.createElement("button");
    autoBtn.type = "button";
    autoBtn.textContent = t("three.planning.action.auto");
    autoBtn.style.minHeight = "48px";
    autoBtn.style.padding = "10px 18px";
    autoBtn.style.fontFamily = "monospace";
    autoBtn.style.fontWeight = "bold";
    autoBtn.style.background = "#2b5940";
    autoBtn.style.color = "#a4ffd5";
    autoBtn.style.border = "2px solid #45f0a0";
    autoBtn.style.cursor = "pointer";
    autoBtn.addEventListener("click", () => this.autoDeploy());
    this.actionPanel.appendChild(autoBtn);

    // Start combat button
    const startBtn = document.createElement("button");
    startBtn.type = "button";
    startBtn.textContent = t("three.planning.action.start");
    startBtn.style.minHeight = "48px";
    startBtn.style.padding = "10px 24px";
    startBtn.style.fontFamily = "monospace";
    startBtn.style.fontWeight = "bold";
    startBtn.style.fontSize = "16px";
    startBtn.style.background = "#e67e22";
    startBtn.style.color = "#fff";
    startBtn.style.border = "3px solid #f39c12";
    startBtn.style.cursor = "pointer";
    startBtn.addEventListener("click", () => this.startCombat());
    this.actionPanel.appendChild(startBtn);
  }

  private updateHudState(): void {
    this.updateTopBarText();
    this.updateShopCards();
  }

  private refreshAllUnits3D(): void {
    if (!this.app) return;

    // Clear old handles
    this.boardUnits.forEach((unit) => {
      this.app?.manager.scene.remove(unit.group);
      unit.dispose();
    });
    this.boardUnits.clear();

    this.benchUnits.forEach((unit) => {
      this.app?.manager.scene.remove(unit.group);
      unit.dispose();
    });
    this.benchUnits.clear();

    // Spawn 3D units for board cells (5x5)
    for (let r = 0; r < BOARD_ROWS; r += 1) {
      for (let c = 0; c < BOARD_COLS; c += 1) {
        const unit = this.board[r]?.[c];
        if (!unit) continue;
        const stats = (unit.stats as Record<string, unknown> | undefined) ?? {};
        const config: Unit3DConfig = {
          id: `board-${unit.uid ?? `${r}-${c}`}`,
          baseId: String(unit.baseId ?? "unit"),
          name: typeof unit.name === "string" ? unit.name : "Unit",
          star: Number(unit.star ?? 1),
          side: "player",
          gridRow: r,
          gridCol: c,
          hp: Number(stats.hp ?? 100),
          maxHp: Number(stats.maxHp ?? 100),
          mana: Number(stats.mana ?? 0),
          maxMana: Number(stats.maxMana ?? 100),
          primaryColor: 0x45f0a0
        };
        const handle = createUnit3D(config);
        const pos = gridToWorld(r, c, "planning");
        handle.group.position.set(pos.x, pos.y, pos.z);
        this.app.manager.scene.add(handle.group);
        this.boardUnits.set(config.id, handle);
      }
    }

    // Spawn 3D units for active bench slots
    for (let b = 0; b < this.bench.length; b += 1) {
      const unit = this.bench[b];
      if (!unit) continue;
      const stats = (unit.stats as Record<string, unknown> | undefined) ?? {};
      const config: Unit3DConfig = {
        id: `bench-${unit.uid ?? b}`,
        baseId: String(unit.baseId ?? "unit"),
        name: typeof unit.name === "string" ? unit.name : "Unit",
        star: Number(unit.star ?? 1),
        side: "player",
        gridRow: 0,
        gridCol: b,
        hp: Number(stats.hp ?? 100),
        maxHp: Number(stats.maxHp ?? 100),
        mana: Number(stats.mana ?? 0),
        maxMana: Number(stats.maxMana ?? 100),
        primaryColor: 0x8fd8ff
      };
      const handle = createUnit3D(config);
      const pos = benchToWorld(b, "planning");
      handle.group.position.set(pos.x, pos.y, pos.z);
      this.app.manager.scene.add(handle.group);
      this.benchUnits.set(config.id, handle);
    }
  }
}

export default ThreePlanningScene;
