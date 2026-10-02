// Presentation ↔ logic seam. The visual layer (src/ui, src/world, src/units) only talks to this
// interface. `createPlaceholderBridge` wires what already exists in src/core and marks every
// unimplemented intent with `LOGIC:` so the logic owner can fill it in without touching visuals.
import { getUnit } from "../content/catalog";
import { benchCap, createModeRun, deployLimit, runSynergies, type RunState } from "../core/run";
import { inspectSave, clearRunProgress } from "../core/save";
import { MODE_CONFIG, type GameMode } from "../core/modes";
import type { SaveSummary } from "../ui/menu";

export interface Bridge {
  /** Current canonical run, or null on menu. Views read; never mutate. */
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
  startCombat(): boolean;
  /** Fires after any state change so HUDs repaint. */
  onChange(fn: () => void): () => void;
}

export function createPlaceholderBridge(store: Storage = localStorage): Bridge {
  let state: RunState | null = null;
  const listeners = new Set<() => void>();
  const emit = () => { for (const fn of listeners) fn(); };

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
      // LOGIC: hydrate through the canonical A114 path (normalize + tutorial sync) instead of raw payload.
      if (s.status !== "valid" || !s.envelope.payload.player) return false;
      state = s.envelope.payload.player;
      emit();
      return true;
    },
    newRun(mode, ai) {
      // LOGIC: seed source, aiMode application and A116 route selection (fortress/coop) belong to logic.
      state = createModeRun(Date.now() | 0, mode);
      void ai;
      emit();
      return state;
    },
    clearBrokenRun() { clearRunProgress(store); emit(); },
    // LOGIC: wire each intent to src/core/run.ts mutations + history/log + save cadence.
    buy: () => false,
    reroll: () => false,
    buyXp: () => false,
    toggleLock: () => {},
    sell: () => false,
    move: () => false,
    startCombat: () => false,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}

/** Read-only view helpers the HUD needs; thin over core so formulas stay canonical. */
export const runView = {
  benchCap, deployLimit, synergies: runSynergies,
  unit: getUnit,
};
