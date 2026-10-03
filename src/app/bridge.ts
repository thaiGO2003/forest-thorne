// Presentation ↔ logic seam. The visual layer (src/ui, src/world, src/units) only talks to this
// interface. `createPlaceholderBridge` wires what already exists in src/core and marks every
// unimplemented intent with `LOGIC:` so the logic owner can fill it in without touching visuals.
import { getUnit } from "../content/catalog";
import {
  applyRoundResult, benchCap, benchToBench, benchToBoard, boardToBench, boardToBoard, buy as buyUnit,
  buyXp as buyRunXp, combatStartRejection, createModeRun, deployLimit, enemyPreview, playerCombatBonus, refresh, research as researchTech,
  runSynergies, sell as sellUnit, startCombat as beginCombat, toggleLock as toggleShopLock,
  type RoundResultSummary, type RunState,
  chooseAugment as chooseRunAugment, craftRunItem, equipItem as equipRunItem, expandBench as expandRunBench,
  sellItem as sellRunItem, stageRunCraftItem, unequipAll as unequipRunAll, unequipItem as unequipRunItem,
} from "../core/run";
import { inspectSave, clearRunProgress, persistPlanningProgress, loadAchievementProfile, saveAchievementProfile } from "../core/save";
import { recordEndlessAchievementEvent, type AchievementProfile, type EndlessAchievementEvent } from "../core/achievements";
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
import {
  executePlanningContextAction, inspectPlanningSelection, resolvePlanningSelection,
  selectBenchUnit, selectBoardUnit, selectShopOffer,
  type PlanningContextAction, type PlanningContextResult, type PlanningSelection, type PlanningUnitInspection,
} from "../core/planningInspection";
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
  expandBench(): boolean;
  /** Craft staging is external to RunState and never consumes inventory before commit. */
  craftStaging(): readonly (string | null)[];
  stageCraftItem(index: number, itemId: string | null): boolean;
  clearCraftStaging(): void;
  craft(): string | null;
  equip(itemId: string, where: "bench" | "board", index: number): boolean;
  unequip(where: "bench" | "board", index: number, equippedIndex: number): boolean;
  unequipAll(where: "bench" | "board", index: number): boolean;
  sellItem(bagIndex: number): boolean;
  chooseAugment(id: string): boolean;
  selectUnit(source: "bench" | "board" | "shop", index: number): boolean;
  selection(): PlanningSelection | null;
  selectedUnit(): PlanningUnitInspection | null;
  contextAction(action: PlanningContextAction): PlanningContextResult;
  achievements(): AchievementProfile;
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
  let craftStaging: (string | null)[] = Array(9).fill(null);
  let selection: PlanningSelection | null = null;
  const resolveSelection = () => {
    if (!state) return null;
    const resolved = resolvePlanningSelection(state, selection);
    selection = resolved?.selection ?? null;
    return resolved;
  };

  const resetCraftStaging = () => { craftStaging = Array(9).fill(null); };
  const reconcileCraftStaging = () => {
    const copies = new Map<string, number>();
    for (const item of state?.itemBag ?? []) copies.set(item, (copies.get(item) ?? 0) + 1);
    craftStaging = craftStaging.map((item) => {
      if (item === null) return null;
      const remaining = copies.get(item) ?? 0;
      if (!remaining) return null;
      copies.set(item, remaining - 1);
      return item;
    });
  };

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
  const trackAchievements = (events: readonly EndlessAchievementEvent[] = []) => {
    if (!state || state.mode !== "EndlessPvEClassic") return;
    const profile = loadAchievementProfile(store);
    for (const event of events) recordEndlessAchievementEvent(profile, state.mode, event);
    recordEndlessAchievementEvent(profile, state.mode, {
      type: "snapshot", round: state.round, gold: state.gold, level: state.level, winStreak: state.winStreak,
    });
    // Storage failure cannot undo or interrupt an already accepted gameplay transaction.
    try { saveAchievementProfile(store, profile); } catch { /* best-effort persistence */ }
  };
  const commit = (category: HistoryCategory, message: string, details?: string[], events: readonly EndlessAchievementEvent[] = []) => {
    reconcileCraftStaging();
    resolveSelection();
    trackAchievements(events);
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
      selection = null;
      resetCraftStaging();
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
      selection = null;
      resetCraftStaging();
      resetHistory();
      trackAchievements([{ type: "run_started" }]);
      persist();
      emit();
      return state;
    },
    clearBrokenRun() { clearRunProgress(store); emit(); },
    buy(slot) {
      if (!state) return false;
      const ownedBefore = state.bench.length + state.board.filter(Boolean).length;
      const id = state.shop[slot];
      if (!id || !buyUnit(state, slot)) return false;
      const ownedAfter = state.bench.length + state.board.filter(Boolean).length;
      const merges = Math.max(0, Math.floor((ownedBefore + 1 - ownedAfter) / 2));
      commit("SHOP", `Mua ${getUnit(id).nameVi}`, undefined, [
        { type: "unit_bought" }, ...(merges > 0 ? [{ type: "merge" as const, count: merges }] : []),
      ]);
      return true;
    },
    reroll() {
      if (!state || !refresh(state)) return false;
      commit("SHOP", "Làm mới cửa hàng", undefined, [{ type: "shop_refresh" }]);
      return true;
    },
    buyXp() {
      if (!state || !buyRunXp(state)) return false;
      commit("SHOP", "Mua 4 XP", undefined, [{ type: "xp_purchase" }]);
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
      if (combatStartRejection(s)) return null;
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
        randomTargetChance: ai.randomTarget,
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
          // New Game/Continue/clear replace the owner; late replay completion cannot commit into another run.
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
          resetCraftStaging();
          commit("COMBAT", `Kết thúc giao tranh vòng ${round}: ${summary.winner}`, undefined, [{
            type: "round_result", round, won: summary.winner === "LEFT", lost: summary.winner === "RIGHT",
            itemsLooted: summary.acceptedDrops.length, gold: s.gold, level: s.level, winStreak: s.winStreak,
          }]);
          return summary;
        },
      };
    },
    research(id) {
      if (!state || !researchTech(state, id)) return false;
      commit("EVENT", `Nghiên cứu ${id}`);
      return true;
    },
    expandBench() {
      if (!state || !expandRunBench(state)) return false;
      commit("EVENT", "Mở rộng hàng chờ");
      return true;
    },
    craftStaging: () => [...craftStaging],
    stageCraftItem(index, itemId) {
      if (!state) return false;
      const next = stageRunCraftItem(state, craftStaging, index, itemId);
      if (!next) return false;
      craftStaging = next;
      persist();
      emit();
      return true;
    },
    clearCraftStaging() {
      if (craftStaging.every((item) => item === null)) return;
      resetCraftStaging();
      emit();
    },
    craft() {
      if (!state) return null;
      const item = craftRunItem(state, craftStaging);
      if (!item) return null;
      resetCraftStaging();
      commit("CRAFT", `Chế tạo ${item}`, undefined, [{ type: "crafted" }]);
      return item;
    },
    equip(itemId, where, index) {
      if (!state || !equipRunItem(state, itemId, where, index)) return false;
      commit("EVENT", `Trang bị ${itemId}`);
      return true;
    },
    unequip(where, index, equippedIndex) {
      if (!state || !unequipRunItem(state, where, index, equippedIndex)) return false;
      commit("EVENT", "Tháo trang bị");
      return true;
    },
    unequipAll(where, index) {
      if (!state || !unequipRunAll(state, where, index)) return false;
      commit("EVENT", "Tháo toàn bộ trang bị");
      return true;
    },
    sellItem(bagIndex) {
      if (!state || !sellRunItem(state, bagIndex)) return false;
      commit("SHOP", "Bán vật phẩm");
      return true;
    },
    chooseAugment(id) {
      if (!state || !chooseRunAugment(state, id)) return false;
      commit("EVENT", `Chọn nâng cấp ${id}`, undefined, [{ type: "augment_chosen" }]);
      return true;
    },
    selectUnit(source, index) {
      if (!state || !Number.isInteger(index) || index < 0) return false;
      const selected = source === "bench" ? selectBenchUnit(state, index)
        : source === "board" ? selectBoardUnit(state, Math.floor(index / 5), index % 5)
          : selectShopOffer(state, index);
      if (!selected) return false;
      selection = selected;
      emit();
      return true;
    },
    selection: () => {
      const selected = resolveSelection()?.selection;
      return selected ? { ...selected } : null;
    },
    selectedUnit() {
      const resolved = resolveSelection();
      return state && resolved ? inspectPlanningSelection(state, resolved) : null;
    },
    contextAction(action) {
      const resolved = resolveSelection();
      if (!state || !resolved) return { ok: false, mutated: false, selection: null, feedback: "action_unavailable" };
      const result = executePlanningContextAction(state, resolved, action);
      selection = result.selection;
      if (result.mutated) commit("EVENT", action === "SELL" ? "Bán đơn vị đã chọn" : "Thu hồi đơn vị đã chọn");
      return result;
    },
    achievements: () => loadAchievementProfile(store),
    history: () => history,
    settings,
    clearRun() { clearRunProgress(store); state = null; selection = null; resetCraftStaging(); emit(); },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}

/** Read-only view helpers the HUD needs; thin over core so formulas stay canonical. */
export const runView = {
  benchCap, deployLimit, synergies: runSynergies,
  unit: getUnit,
};
