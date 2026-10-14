// Recovered persistence/combat seam over current core owners. Current planning screens
// call core transactions, then checkpoint here; combat always uses the canonical simulator.
import { getUnit } from "../content/catalog";
import {
  applyRoundResult, benchCap, benchToBench, benchToBoard, boardToBench, boardToBoard, buy as buyUnit,
  buyXp as buyRunXp, chooseAugment as chooseRunAugment, consumeWeatherBlessings, craftRunItem, createModeRun, deployLimit,
  enemyPreview, equipItem, playerCombatBonus, refresh, research as researchTech, runSynergies,
  sell as sellUnit, stageRunCraftItem, startCombat as beginCombat, toggleLock as toggleShopLock,
  unequipItem, type RoundResultInput, type RoundResultSummary, type RunState,
} from "../core/run";
import { applyFinishFast } from "../core/combatFast";
import {
  EXPORT_FILENAME, exportSaveJson, importSaveJson, inspectSave, clearRunProgress, saveRun,
  loadAchievementProfile, saveAchievementProfile, loadCollectionProfile, saveCollectionProfile,
  type RunPayload,
} from "../core/save";
import { MODE_CONFIG, normalizeAvailableMode, type GameMode } from "../core/modes";
import { AI_PROFILE, normalizeAiMode } from "../core/encounter";
import { environmentFor, type EnvironmentId } from "../core/environment";
import { cloneFighter, makeFighter, simulate, sumSideBonuses, type CombatEvent, type Fighter, type Placement, type SideBonus } from "../core/combat";
import {
  currentTutorialStep, dismissTutorialStep, recordTutorialEvent, skipTutorial as skipTutorialState,
  tutorialActionAllowed, type TutorialAction, type TutorialActionContext, type TutorialInspectionContext,
  type TutorialStep,
} from "../core/tutorial";
import { rollEquipmentLoot, rollMaterialLoot } from "../core/loot";
import { createPlanningHistory, pushPlanningHistory, type HistoryCategory, type PlanningHistoryState } from "../core/history";
import { setLocale } from "../core/i18n";
import { createSettingsStore, type SettingsStore, type KV } from "../core/settings";
import {
  ACHIEVEMENT_COMPLETION_CLAIM_ID, ACHIEVEMENT_REWARDS, claimAchievementCompletionSkin,
  claimSkinReward, equipCollectionSkin as equipOwnedCollectionSkin, recordEndlessAchievementEvent,
  type AchievementProfile, type CollectionProfile, type EndlessAchievementEvent,
} from "../core/achievements";
import type { EnemyPreviewResult } from "../core/preview";
export type SaveSummary =
  | { kind: "none" | "corrupt" }
  | { kind: "valid"; mode: GameMode; round: number; level: number; hearts: number; gold: number; playable: boolean; resumable: boolean };
import type { RosterEntry } from "../units/combatPlayer";

/**
 * One resolved battle handed to presentation (A16, A121). Logic resolves canonically up front;
 * presentation either replays `events` then calls `finish()`, or skips presentation through
 * `finishFast()`. Both paths commit the same canonical round result exactly once.
 */
export interface CombatSession {
  /** Every combatant at battle start (both sides), with starting HP/rage/shield. */
  roster: RosterEntry[];
  events: CombatEvent[];
  /** Full resolved snapshots for every combatant, including dead units; detached from simulator-owned objects. */
  fighters: readonly Fighter[];
  /** Applies the result once (idempotent by combat id) and returns the normalized summary. */
  finish(): RoundResultSummary | null;
  /** Charges Finish Fast and applies the same canonical result; null when unavailable or already applied. */
  finishFast(): RoundResultSummary | null;
}
export interface CombatDiagnosticSnapshot {
  environment: EnvironmentId;
  enemySource: EnemyPreviewResult["source"];
  fighters: readonly Fighter[];
}


export interface Bridge {
  /** Current canonical run. Planning screens mutate only through core transactions. */
  run(): RunState | null;
  saveSummary(): SaveSummary;
  continueRun(): boolean;
  newRun(mode: GameMode, ai: string): RunState;
  importRun(text: string): boolean;
  clearBrokenRun(): void;
  /** Current authored tutorial instruction; null when tutorial is inactive or this round is complete. */
  tutorialStep(context?: TutorialInspectionContext): TutorialStep | null;
  /** Canonical tutorial gate for presentation-only interactions. */
  tutorialAllows(action: TutorialAction, context?: TutorialActionContext): boolean;
  /** Advance an authored dismiss step and persist/repaint. */
  dismissTutorial(stepId: string): boolean;
  /** Leave Tutorial mode through the canonical handoff and persist/repaint. */
  skipTutorial(): boolean;
  /** Record a presentation-only tutorial event after its canonical action gate accepts it. */
  tutorialEvent(action: TutorialAction, key: string, context?: TutorialActionContext): boolean;
  /** Planning intents; return false (and leave state untouched) when illegal. */
  buy(slot: number): boolean;
  reroll(): boolean;
  buyXp(): boolean;
  toggleLock(): void;
  sell(from: "bench" | "board", index: number): boolean;
  move(from: { kind: "bench" | "board"; index: number }, to: { kind: "bench" | "board"; index: number }): boolean;
  equip(itemId: string, where: "bench" | "board", index: number): boolean;
  unequip(where: "bench" | "board", index: number, equippedIndex: number): boolean;
  craftStaging(): readonly (string | null)[];
  stageCraft(index: number, itemId: string | null): boolean;
  craft(): string | null;
  chooseAugment(id: string): boolean;
  /** Ensure the canonical Planning encounter preview exists and is persisted before presentation syncs. */
  prepareEnemyPreview(): EnemyPreviewResult | null;
  /** Resolve a battle from the current formation; null when illegal (phase/tutorial/empty board). */
  startCombat(): CombatSession | null;
  /** Read-only diagnostic projection for the currently presented combat, if one exists. */
  combatSnapshot(): CombatDiagnosticSnapshot | null;
  /** Research a tech node through the canonical transaction (A8, A111.5); false = no change. */
  research(id: string): boolean;
  /** Planning history (A38); views filter/read only. */
  history(): PlanningHistoryState;
  /** Persist accepted mutations made by the current planning screens. */
  checkpoint(category: HistoryCategory, message: string): void;
  /** Canonical persisted UI settings owner (A35, A110.2). */
  settings: SettingsStore;
  /** Read account achievement progress through the bridge-owned store. */
  achievementProfile(): AchievementProfile;
  /** Read collection ownership/equips through the bridge-owned store. */
  collectionProfile(): CollectionProfile;
  /** Claim one eligible catalog reward or the all-100 completion reward, idempotently. */
  claimAchievement(achievementId: string): boolean;
  /** Equip an owned authored skin (or base look) and persist it. */
  equipCollectionSkin(unitId: string, skinId: string | null): boolean;
  /** Drop an in-memory run after settings imports or clears persisted progress. */
  forgetRun(): void;
  /** Run-only clear (A57/A60.5); never touches settings, collection or achievements. */
  clearRun(): void;
  /** Export the persisted canonical envelope without exposing storage to UI code. */
  exportRun(): { filename: string; text: string } | null;
  /** Fires after any state change so HUDs repaint. */
  onChange(fn: () => void): () => void;
}

const synergyCombatBonus = (s: RunState): SideBonus =>
  sumSideBonuses(...runSynergies(s).map((line) => line.bonus));

const playerSideBonus = (s: RunState): SideBonus =>
  sumSideBonuses(playerCombatBonus(s), synergyCombatBonus(s));

const enemySideBonus = (s: RunState, source: EnemyPreviewResult["source"]): SideBonus => {
  const ai = AI_PROFILE[s.aiMode];
  const configuredScale = source === "creative" ? 1 : MODE_CONFIG[s.mode].enemyScale(s.round);
  const scale = Number.isFinite(configuredScale) && configuredScale > 0 ? configuredScale : 1;
  return {
    hpPct: (ai.hp * scale - 1) * 100,
    atkPct: (ai.atk * scale - 1) * 100,
    matkPct: (ai.matk * scale - 1) * 100,
  };
};

export function createBridge(store: KV = localStorage): Bridge {
  let state: RunState | null = null;
  let combatDiagnostics: CombatDiagnosticSnapshot | null = null;
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
  const achievementSnapshot = (): EndlessAchievementEvent | null => state ? {
    type: "snapshot",
    round: state.round,
    gold: state.gold,
    level: state.level,
    winStreak: state.winStreak,
  } : null;
  const recordAchievements = (events: readonly EndlessAchievementEvent[] = []) => {
    if (!state) return false;
    const profile = loadAchievementProfile(store);
    let changed = false;
    for (const event of events) changed = recordEndlessAchievementEvent(profile, state.mode, event) || changed;
    const snapshot = achievementSnapshot();
    if (snapshot) changed = recordEndlessAchievementEvent(profile, state.mode, snapshot) || changed;
    if (changed) saveAchievementProfile(store, profile);
    return changed;
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
  const commit = (
    category: HistoryCategory,
    message: string,
    details?: string[],
    achievementEvents: readonly EndlessAchievementEvent[] = [],
  ) => {
    recordAchievements(achievementEvents);
    record(category, message, details);
    persist();
    emit();
  };
  let craftStaging: (string | null)[] = Array<string | null>(9).fill(null);
  let craftResetObserved = false;
  const resetExternalPlanningState = () => {
    combatDiagnostics = null;
    craftStaging = Array<string | null>(9).fill(null);
    craftResetObserved = Boolean(state?.tutorial.markers.clearCraftStaging);
  };
  const syncCraftStaging = () => {
    const resetRequested = Boolean(state?.tutorial.markers.clearCraftStaging);
    if (resetRequested && !craftResetObserved) craftStaging = Array<string | null>(9).fill(null);
    craftResetObserved = resetRequested;
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

  const resumeRun = (payload: RunPayload) => {
    const saved = payload.player;
    if (!saved || !MODE_CONFIG[saved.mode].available || saved.phase === "GAME_OVER") return false;
    state = saved;
    if (state.phase === "COMBAT") state.phase = "PLANNING"; // Replay the persisted deterministic encounter after interruption.
    resetExternalPlanningState();
    saveRun(store, payload);
    resetHistory();
    emit();
    return true;
  };

  return {
    run: () => state,
    saveSummary() {
      const s = inspectSave(store);
      if (s.status === "empty") return { kind: "none" };
      if (s.status !== "valid") return { kind: "corrupt" };
      const p = s.envelope.payload.player;
      if (!p) return { kind: "none" };
      return { kind: "valid", mode: p.mode, round: p.round, level: p.level, hearts: p.hp, gold: p.gold, playable: MODE_CONFIG[p.mode].available, resumable: p.phase !== "GAME_OVER" };
    },
    continueRun() {
      const s = inspectSave(store);
      return s.status === "valid" ? resumeRun(s.envelope.payload) : false;
    },
    importRun(text) {
      const imported = importSaveJson(store, text, false);
      const candidate = imported?.player;
      if (!candidate || !MODE_CONFIG[candidate.mode].available || candidate.phase === "GAME_OVER") return false;
      const persisted = importSaveJson(store, text, true);
      return persisted ? resumeRun(persisted) : false;
    },
    newRun(mode, ai) {
      const selectedMode = normalizeAvailableMode(mode);
      const config = MODE_CONFIG[selectedMode];
      const requestedAi = normalizeAiMode(ai, config.ai.def);
      state = createModeRun(Date.now() | 0, selectedMode);
      state.aiMode = config.ai.allowed.includes(requestedAi) ? requestedAi : config.ai.def;
      resetExternalPlanningState();
      resetHistory();
      recordAchievements([{ type: "run_started" }]);
      persist();
      emit();
      return state;
    },
    clearBrokenRun() { clearRunProgress(store); emit(); },
    tutorialStep(context) {
      return state ? currentTutorialStep(state, context) : null;
    },
    tutorialAllows(action, context) {
      return state ? tutorialActionAllowed(state, action, context) : false;
    },
    dismissTutorial(stepId) {
      if (!state || !dismissTutorialStep(state, stepId)) return false;
      commit("EVENT", "Tiếp tục hướng dẫn");
      return true;
    },
    skipTutorial() {
      if (!state || !skipTutorialState(state)) return false;
      commit("EVENT", "Bỏ qua hướng dẫn");
      return true;
    },
    tutorialEvent(action, key, context) {
      if (!state || !tutorialActionAllowed(state, action, context)) return false;
      recordTutorialEvent(state, key);
      commit("EVENT", `Hướng dẫn: ${key}`);
      return true;
    },
    buy(slot) {
      if (!state) return false;
      const id = state.shop[slot];
      const purchase = id ? buyUnit(state, slot) : null;
      if (!id || !purchase) return false;
      const achievementEvents: EndlessAchievementEvent[] = [{ type: "unit_bought" }];
      if (purchase.merges > 0) achievementEvents.push({ type: "merge", count: purchase.merges });
      commit("SHOP", `Mua ${getUnit(id).nameVi}`, undefined, achievementEvents);
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
    equip(itemId, where, index) {
      if (!state || !equipItem(state, itemId, where, index)) return false;
      commit("EVENT", `Trang bị ${itemId}`);
      return true;
    },
    unequip(where, index, equippedIndex) {
      if (!state) return false;
      const unit = where === "bench" ? state.bench[index] : state.board[index];
      const itemId = unit?.equips[equippedIndex];
      if (!itemId || !unequipItem(state, where, index, equippedIndex)) return false;
      commit("EVENT", `Tháo trang bị ${itemId}`);
      return true;
    },
    craftStaging() {
      syncCraftStaging();
      return craftStaging.slice();
    },
    stageCraft(index, itemId) {
      if (!state) return false;
      syncCraftStaging();
      const next = stageRunCraftItem(state, craftStaging, index, itemId);
      if (!next) return false;
      craftStaging = next;
      commit("EVENT", itemId ? `Đặt ${itemId} vào bàn chế tạo` : `Dọn ô chế tạo ${index + 1}`);
      return true;
    },
    craft() {
      if (!state) return null;
      syncCraftStaging();
      const crafted = craftRunItem(state, craftStaging);
      if (!crafted) return null;
      craftStaging = Array<string | null>(9).fill(null);
      commit("EVENT", `Chế tạo ${crafted}`, undefined, [{ type: "crafted" }]);
      return crafted;
    },
    chooseAugment(id) {
      if (!state || !chooseRunAugment(state, id)) return false;
      commit("EVENT", `Chọn nâng cấp ${id}`, undefined, [{ type: "augment_chosen" }]);
      return true;
    },
    prepareEnemyPreview() {
      if (!state || state.phase !== "PLANNING") return null;
      const preview = enemyPreview(state);
      if (preview && preview.source !== "saved") persist();
      return preview;
    },
    combatSnapshot() {
      if (!combatDiagnostics) return null;
      return {
        environment: combatDiagnostics.environment,
        enemySource: combatDiagnostics.enemySource,
        fighters: combatDiagnostics.fighters.map(cloneFighter),
      };
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
      const playerBonus = playerSideBonus(s);
      const ai = AI_PROFILE[s.aiMode];
      const enemyBonus = enemySideBonus(s, preview.source);

      if (beginCombat(s) !== null) return null;
      // The charged heart must survive a reload even if simulation/presentation is interrupted.
      persist();
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
        orderedBlessings: [...s.blessingQueue],
        rightRandomTargetChance: ai.randomTarget,
      });
      if (result.consumedBlessings.length) {
        if (!consumeWeatherBlessings(s, result.consumedBlessings)) throw new Error("combat blessing queue diverged");
        persist();
      }
      const sessionFighters = result.fighters.map(cloneFighter);
      combatDiagnostics = {
        environment,
        enemySource: preview.source,
        fighters: sessionFighters.map(cloneFighter),
      };
      const survivors = new Set(result.survivors.filter((fighter) => fighter.side === "R").map((fighter) => fighter.uid));
      const lootRng = seededRng(combatSeed ^ 0x51ed270b);
      const drops = right
        .filter((unit) => !survivors.has(unit.uid))
        .flatMap((unit) => [
          ...rollMaterialLoot(unit.baseId, lootRng),
          ...rollEquipmentLoot(unit.star, lootRng),
        ]);
      const winner = result.winner === "L" ? "LEFT" : result.winner === "R" ? "RIGHT" : "DRAW";
      const roundResultInput: RoundResultInput = {
        combatId,
        winner,
        enemySurvivors: result.alive.R,
        enemyStars: right.map((unit) => unit.star),
        bounty: result.bounty.L,
        drops,
      };
      commit("COMBAT", `Bắt đầu giao tranh vòng ${round}`);

      const publishResult = (summary: RoundResultSummary | null) => {
        if (!summary) return null;
        commit("COMBAT", `Kết thúc giao tranh vòng ${round}: ${summary.winner}`, undefined, [{
          type: "round_result",
          round,
          won: summary.winner === "LEFT",
          lost: summary.winner === "RIGHT",
          itemsLooted: summary.acceptedDrops.length,
          gold: s.gold,
          level: s.level,
          winStreak: s.winStreak,
        }]);
        combatDiagnostics = null;
        return summary;
      };
      return {
        roster,
        fighters: sessionFighters.map(cloneFighter),
        events: result.events,
        finish() {
          if (state !== s) return null;
          return publishResult(applyRoundResult(s, roundResultInput));
        },
        finishFast() {
          if (state !== s) return null;
          return publishResult(applyFinishFast(s, roundResultInput));
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
    achievementProfile: () => loadAchievementProfile(store),
    collectionProfile: () => loadCollectionProfile(store),
    claimAchievement(achievementId) {
      const achievements = loadAchievementProfile(store);
      const collection = loadCollectionProfile(store);
      if (achievementId === ACHIEVEMENT_COMPLETION_CLAIM_ID) {
        if (!claimAchievementCompletionSkin(achievements, collection)) return false;
      } else {
        const mapping = ACHIEVEMENT_REWARDS.find((candidate) => candidate.achievementId === achievementId);
        if (!mapping || !claimSkinReward(achievements, collection, mapping)) return false;
      }
      saveAchievementProfile(store, achievements);
      saveCollectionProfile(store, collection);
      emit();
      return true;
    },
    equipCollectionSkin(unitId, skinId) {
      const collection = loadCollectionProfile(store);
      if (!equipOwnedCollectionSkin(collection, unitId, skinId)) return false;
      saveCollectionProfile(store, collection);
      emit();
      return true;
    },
    forgetRun() { state = null; resetExternalPlanningState(); resetHistory(); emit(); },
    clearRun() { clearRunProgress(store); state = null; resetExternalPlanningState(); emit(); },
    exportRun() {
      const saved = inspectSave(store);
      return saved.status === "valid" ? { filename: EXPORT_FILENAME, text: exportSaveJson(saved.envelope) } : null;
    },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}

/** Read-only view helpers the HUD needs; thin over core so formulas stay canonical. */
export const runView = {
  benchCap, deployLimit, synergies: runSynergies,
  unit: getUnit,
  playerSideBonus,
  enemySideBonus,
};
