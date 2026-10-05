// Recovered persistence/combat seam over current core owners. Current planning screens
// call core transactions, then checkpoint here; combat always uses the canonical simulator.
import { getUnit } from "../content/catalog";
import {
  applyRoundResult, benchCap, benchToBench, benchToBoard, boardToBench, boardToBoard, buy as buyUnit,
  buyXp as buyRunXp, createModeRun, deployLimit, enemyPreview, playerCombatBonus, refresh, research as researchTech,
  runSynergies, sell as sellUnit, startCombat as beginCombat, toggleLock as toggleShopLock,
  type RoundResultSummary, type RunState,
} from "../core/run";
import { inspectSave, clearRunProgress, saveRun } from "../core/save";
import { MODE_CONFIG, normalizeAvailableMode, type GameMode } from "../core/modes";
import { AI_PROFILE, normalizeAiMode } from "../core/encounter";
import { environmentFor } from "../core/environment";
import { makeFighter, simulate, type CombatEvent, type Placement, type SideBonus } from "../core/combat";
import { tutorialActionAllowed } from "../core/tutorial";
import { rollLoot } from "../core/loot";
import { createPlanningHistory, pushPlanningHistory, type HistoryCategory, type PlanningHistoryState } from "../core/history";
import { setLocale } from "../core/i18n";
import { createSettingsStore, type SettingsStore, type KV } from "../core/settings";
export type SaveSummary =
  | { kind: "none" | "corrupt" }
  | { kind: "valid"; mode: GameMode; round: number; level: number; hearts: number; gold: number; playable: boolean };
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
  /** Current canonical run. Planning screens mutate only through core transactions. */
  run(): RunState | null;
  saveSummary(): SaveSummary;
  continueRun(): boolean;
  newRun(mode: GameMode, ai: string): RunState;
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
  /** Persist accepted mutations made by the current planning screens. */
  checkpoint(category: HistoryCategory, message: string): void;
  /** Canonical persisted UI settings owner (A35, A110.2). */
  settings: SettingsStore;
  /** Drop an in-memory run after settings imports or clears persisted progress. */
  forgetRun(): void;
  /** Run-only clear (A57/A60.5); never touches settings, collection or achievements. */
  clearRun(): void;
  /** Fires after any state change so HUDs repaint. */
  onChange(fn: () => void): () => void;
}

export function createBridge(store: KV = localStorage): Bridge {
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
    if (state) saveRun(store, { player: state });
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

  const addBonus = (...parts: SideBonus[]): SideBonus => {
    const out: SideBonus = {};
    for (const part of parts) {
      for (const [rawKey, rawValue] of Object.entries(part)) {
        if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) continue;
        const key = rawKey as keyof SideBonus;
        out[key] = (out[key] ?? 0) + rawValue;
      }
    }
    return out;
  };
  const synergyBonus = (s: RunState): SideBonus =>
    addBonus(...runSynergies(s).map((line) => line.bonus));
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
      const saved = s.envelope.payload.player;
      if (!MODE_CONFIG[saved.mode].available || saved.phase === "GAME_OVER") return false;
      state = saved;
      if (state.phase === "COMBAT") state.phase = "PLANNING"; // Replay the persisted deterministic encounter after interruption.
      persist();
      resetHistory();
      emit();
      return true;
    },
    newRun(mode, ai) {
      const selectedMode = normalizeAvailableMode(mode);
      const config = MODE_CONFIG[selectedMode];
      const requestedAi = normalizeAiMode(ai, config.ai.def);
      state = createModeRun(Date.now() | 0, selectedMode);
      state.aiMode = config.ai.allowed.includes(requestedAi) ? requestedAi : config.ai.def;
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
      if (s.phase !== "PLANNING" || !tutorialActionAllowed(s, "begin_combat")) return null;
      const left = boardPlacements(s);
      if (!left.length) return null;
      const preview = enemyPreview(s);
      if (!preview?.units.length) return null;
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
      const playerBonus = addBonus(playerCombatBonus(s), synergyBonus(s));
      const ai = AI_PROFILE[s.aiMode];
      const configuredScale = preview.source === "creative" ? 1 : MODE_CONFIG[s.mode].enemyScale(round);
      const scale = Number.isFinite(configuredScale) && configuredScale > 0 ? configuredScale : 1;
      const enemyBonus: SideBonus = {
        hpPct: (ai.hp * scale - 1) * 100,
        atkPct: (ai.atk * scale - 1) * 100,
        matkPct: (ai.matk * scale - 1) * 100,
      };

      if (beginCombat(s) !== null) return null;
      const roster: RosterEntry[] = [
        ...left.map((placement) => makeFighter(placement, "L", playerBonus, environment)),
        ...right.map((placement) => makeFighter(placement, "R", enemyBonus, environment)),
      ].map((fighter) => ({
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
      const result = simulate(left, right, {
        seed: combatSeed,
        gold: { L: s.gold },
        bonus: { L: playerBonus, R: enemyBonus },
        rageGain: { R: ai.rageGain },
        environment,
        rightRandomTargetChance: ai.randomTarget,
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
          if (state !== s) return null;
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
    checkpoint: commit,
    history: () => history,
    settings,
    forgetRun() { state = null; resetHistory(); emit(); },
    clearRun() { clearRunProgress(store); state = null; emit(); },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}

/** Read-only view helpers the HUD needs; thin over core so formulas stay canonical. */
export const runView = {
  benchCap, deployLimit, synergies: runSynergies,
  unit: getUnit,
};
