// Presentation ↔ logic seam. The visual layer (src/ui, src/world, src/units) only talks to this
// interface. `createPlaceholderBridge` wires what already exists in src/core and marks every
// unimplemented intent with `LOGIC:` so the logic owner can fill it in without touching visuals.
import { getUnit } from "../content/catalog";
import {
  applyRoundResult, benchCap, benchToBench, benchToBoard, boardToBench, boardToBoard, buy as buyUnit,
  buyXp as buyRunXp, createModeRun, deployLimit, enemyPreview, playerCombatBonus, refresh, research as researchTech,
  runSynergies, sell as sellUnit, startCombat as beginCombat, toggleLock as toggleShopLock,
  type RoundResultSummary, type RunState,
} from "../core/run";
import { inspectSave, clearRunProgress, persistPlanningProgress } from "../core/save";
import { MODE_CONFIG, type GameMode } from "../core/modes";
import { resolveContinueRoute, resolveNewRunRoute } from "../core/menuRouting";
import { AI_PROFILE } from "../core/encounter";
import { environmentFor } from "../core/environment";
import { materializeCombatFormation, simulateMaterialized, type CombatEvent, type Placement } from "../core/combat";
import { computeSynergies } from "../core/synergy";
import { rollLoot } from "../core/loot";
import { createPlanningHistory, pushPlanningHistory, type HistoryCategory, type PlanningHistoryState } from "../core/history";
import { setLocale } from "../core/i18n";
import { createSettingsStore, type SettingsStore } from "../core/settings";
import type { SaveSummary } from "../ui/menu";
import type { RosterEntry } from "../units/combatPlayer";

/**
 * One resolved battle handed to presentation (A16, A121). Logic resolves canonically up front;
 * presentation replays `events` in order, then calls `finish()` exactly once to apply the result.
 */
export interface CombatSession {
  /** Every combatant at battle start (both sides), with starting HP/rage/shield. */
  roster: RosterEntry[];
  events: CombatEvent[];
  /** Applies the result once (idempotent by combat id) and returns the normalized summary. */
  finish(): RoundResultSummary | null;
}

export interface Bridge {
  /** Current canonical run, or null on menu. Views read; never mutate. */
  run(): RunState | null;
  saveSummary(): SaveSummary;
  continueRun(): boolean;
  newRun(mode: GameMode, ai: string): RunState | null;
  clearBrokenRun(): void;
  /** Planning intents; return false (and leave state untouched) when illegal. */
  buy(slot: number): boolean;
  reroll(): boolean;
  buyXp(): boolean;
  toggleLock(): void;
  sell(from: "bench" | "board", index: number): boolean;
  move(from: { kind: "bench" | "board"; index: number }, to: { kind: "bench" | "board"; index: number }): boolean;
  /** Resolve a battle from the current formation; null when illegal (phase/tutorial/empty board). */
  startCombat(): CombatSession | null;
  /** Research a tech node through the canonical transaction (A8, A111.5); false = no change. */
  research(id: string): boolean;
  /** Planning history (A38); views filter/read only. */
  history(): PlanningHistoryState;
  /** Canonical persisted UI settings owner (A35, A110.2). */
  settings: SettingsStore;
  /** Run-only clear (A57/A60.5); never touches settings, collection or achievements. */
  clearRun(): void;
  /** Fires after any state change so HUDs repaint. */
  onChange(fn: () => void): () => void;
}

export function createPlaceholderBridge(store: Storage = localStorage): Bridge {
  let state: RunState | null = null;
  const listeners = new Set<() => void>();
  const emit = () => { for (const fn of listeners) fn(); };
  const settings = createSettingsStore(store, (lang) => setLocale(lang));
  setLocale(settings.get().language);
  const history = createPlanningHistory();

  const resetHistory = () => {
    history.recent = [];
    history.entries = [];
  };
  const persist = () => {
    if (state) persistPlanningProgress({
      authority: "solo", store, payload: { player: state, audioEnabled: settings.get().audioEnabled },
    });
  };
  const record = (category: HistoryCategory, message: string, details?: string[]) => {
    pushPlanningHistory(history, {
      category,
      message,
      details,
      timestamp: Date.now(),
      round: state?.round,
    });
  };
  const commit = (category: HistoryCategory, message: string, details?: string[]) => {
    record(category, message, details);
    persist();
    emit();
  };

  const boardPlacements = (s: RunState): Placement[] => s.board.flatMap((unit, index) => unit ? [{
    uid: unit.uid,
    baseId: unit.baseId,
    star: unit.star,
    row: Math.floor(index / 5),
    col: index % 5,
    equips: [...unit.equips],
    traits: [...(unit.traits ?? [])],
  }] : []);
  const seededRng = (seed: number) => {
    let value = seed | 0;
    return () => {
      value = (value + 0x6d2b79f5) | 0;
      let t = Math.imul(value ^ (value >>> 15), value | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  return {
    run: () => state,
    saveSummary() {
      const s = inspectSave(store);
      if (s.status === "empty") return { kind: "none" };
      if (s.status !== "valid") return { kind: "corrupt" };
      const p = s.envelope.payload.player;
      if (!p) return { kind: "none" };
      return { kind: "valid", mode: p.mode, round: p.round, level: p.level, hearts: p.hp, gold: p.gold, playable: MODE_CONFIG[p.mode].available };
    },
    continueRun() {
      const s = inspectSave(store);
      if (s.status !== "valid" || !s.envelope.payload.player) return false;
      const route = resolveContinueRoute(s.envelope.payload.player);
      if (route.kind === "blocked" || route.destination !== "planning") return false;
      state = s.envelope.payload.player;
      if (typeof s.envelope.payload.audioEnabled === "boolean") {
        settings.save({ audioEnabled: s.envelope.payload.audioEnabled });
      }
      resetHistory();
      emit();
      return true;
    },
    newRun(mode, ai) {
      const route = resolveNewRunRoute(mode, ai);
      if (route.kind === "blocked" || route.destination !== "planning") return null;
      settings.save({
        aiMode: route.aiMode,
        aiModeByGameMode: { ...settings.get().aiModeByGameMode, [route.mode]: route.aiMode },
      });
      clearRunProgress(store);
      state = createModeRun(Date.now() | 0, route.mode);
      state.aiMode = route.aiMode;
      resetHistory();
      persist();
      emit();
      return state;
    },
    clearBrokenRun() { clearRunProgress(store); emit(); },
    buy(slot) {
      if (!state) return false;
      const id = state.shop[slot];
      if (!id || !buyUnit(state, slot)) return false;
      commit("SHOP", `Mua ${getUnit(id).nameVi}`);
      return true;
    },
    reroll() {
      if (!state || !refresh(state)) return false;
      commit("SHOP", "Làm mới cửa hàng");
      return true;
    },
    buyXp() {
      if (!state || !buyRunXp(state)) return false;
      commit("SHOP", "Mua 4 XP");
      return true;
    },
    toggleLock() {
      if (!state) return;
      const before = state.shopLocked;
      toggleShopLock(state);
      if (state.shopLocked === before) return;
      commit("SHOP", state.shopLocked ? "Khóa cửa hàng" : "Mở khóa cửa hàng");
    },
    sell(from, index) {
      if (!state) return false;
      const unit = from === "bench" ? state.bench[index] : state.board[index];
      if (!unit || !sellUnit(state, from, index)) return false;
      commit("SHOP", `Bán ${getUnit(unit.baseId).nameVi}`);
      return true;
    },
    move(from, to) {
      if (!state) return false;
      const moved = from.kind === "bench" && to.kind === "board"
        ? benchToBoard(state, from.index, to.index)
        : from.kind === "board" && to.kind === "bench"
          ? boardToBench(state, from.index, to.index)
          : from.kind === "board" && to.kind === "board"
            ? boardToBoard(state, from.index, to.index)
            : benchToBench(state, from.index, to.index);
      if (!moved) return false;
      commit("EVENT", "Di chuyển đơn vị");
      return true;
    },
    startCombat() {
      if (!state) return null;
      const s = state;
      const preview = enemyPreview(s);
      if (!preview?.units.length) return null;
      const left = boardPlacements(s);
      if (!left.length) return null;
      const right = preview.units.map((unit) => ({
        ...unit,
        equips: unit.equips ? [...unit.equips] : undefined,
        traits: unit.traits ? [...unit.traits] : undefined,
      }));
      const round = s.round;
      const baseSeed = s.rngSeed | 0;
      const combatSeed = (baseSeed ^ Math.imul(round, 0x45d9f3b)) | 0;
      const combatId = `solo:${round}:${combatSeed >>> 0}`;
      const environment = environmentFor(round);
      const playerBonus = playerCombatBonus(s);
      const ai = AI_PROFILE[s.aiMode];
      const configuredScale = preview.source === "creative" ? 1 : MODE_CONFIG[s.mode].enemyScale(round);
      const scale = Number.isFinite(configuredScale) && configuredScale > 0 ? configuredScale : 1;

      if (beginCombat(s) !== null) return null;
      const formation = materializeCombatFormation(left, right, {
        bonus: { L: playerBonus },
        synergy: {
          L: runSynergies(s),
          R: computeSynergies(right.map((placement) => placement.baseId)),
        },
        scale: {
          R: {
            hp: ai.hp,
            atk: ai.atk,
            matk: ai.matk,
            roundScale: scale,
            tutorialHpHalf: s.aiMode === "TUTORIAL" && round >= 1 && round <= 8,
          },
        },
        environment,
      });
      const roster: RosterEntry[] = formation.map((fighter) => ({
        uid: fighter.uid,
        baseId: fighter.baseId,
        star: fighter.star,
        side: fighter.side,
        hp: fighter.hp,
        maxHp: fighter.maxHp,
        rage: fighter.rage,
        rageMax: fighter.rageMax,
        shield: fighter.shield,
      }));
      const result = simulateMaterialized(formation, {
        seed: combatSeed,
        gold: { L: s.gold },
        rageGain: { R: ai.rageGain },
      });
      const survivors = new Set(result.survivors.filter((fighter) => fighter.side === "R").map((fighter) => fighter.uid));
      const lootRng = seededRng(combatSeed ^ 0x51ed270b);
      const drops = right
        .filter((unit) => !survivors.has(unit.uid))
        .flatMap((unit) => rollLoot(unit.baseId, unit.star, lootRng));
      const winner = result.winner === "L" ? "LEFT" : result.winner === "R" ? "RIGHT" : "DRAW";
      commit("COMBAT", `Bắt đầu giao tranh vòng ${round}`);

      return {
        roster,
        events: result.events,
        finish() {
          const summary = applyRoundResult(s, {
            combatId,
            winner,
            enemySurvivors: result.alive.R,
            enemyStars: right.map((unit) => unit.star),
            bounty: result.bounty.L,
            drops,
          });
          if (!summary) return null;
          commit("COMBAT", `Kết thúc giao tranh vòng ${round}: ${summary.winner}`);
          return summary;
        },
      };
    },
    research(id) {
      if (!state || !researchTech(state, id)) return false;
      commit("EVENT", `Nghiên cứu ${id}`);
      return true;
    },
    history: () => history,
    settings,
    clearRun() { clearRunProgress(store); state = null; emit(); },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}

/** Read-only view helpers the HUD needs; thin over core so formulas stay canonical. */
export const runView = {
  benchCap, deployLimit, synergies: runSynergies,
  unit: getUnit,
};
