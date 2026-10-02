// PvP Fortress pairing, combat payloads and authoritative round resolution (mega prompt A48).
import { RIGHT_COL_START } from "../core/creative";
import { BOARD_SIZE, type RunState } from "../core/run";
import type { AiMode } from "../core/encounter";
import type { Placement } from "../core/combat";

export const PVP_FORTRESS_SESSION_TYPE = "pvp_fortress" as const;
export const PVP_FORTRESS_MESSAGE_TYPES = [
  "pvp_fortress_start",
  "pvp_fortress_report",
  "pvp_fortress_resolution",
  "pvp_fortress_combat_snapshot",
] as const;
export type PvpFortressMessageType = (typeof PVP_FORTRESS_MESSAGE_TYPES)[number];

export const PVP_FORTRESS_SNAPSHOT_INTERVAL_MS = 5_000;
export const PVP_FORTRESS_SNAPSHOT_STALE_MS = 10_000;
export const PVP_FORTRESS_WIN_GOLD = 3;
export const DEFAULT_PVP_FORTRESS_HP = 100;

export type PvpFortressPhase = "planning" | "combat" | "finished";
export type PvpWinnerSide = "LEFT" | "RIGHT" | "DRAW";

export interface PvpFortressRealMatchup {
  type: "real";
  pairId: string;
  round: number;
  slotA: string;
  slotB: string;
  reporterSlot: string;
}

export interface PvpFortressGhostMatchup {
  type: "ghost";
  pairId: string;
  round: number;
  fighterSlot: string;
  ghostOwnerSlot: string;
  reporterSlot: string;
}

export type PvpFortressMatchup = PvpFortressRealMatchup | PvpFortressGhostMatchup;

export interface PvpCombatResult {
  winnerSide: PvpWinnerSide;
  round: number;
  leftAlive: number;
  leftTotal: number;
  rightAlive: number;
  rightTotal: number;
}

export interface PvpFortressReport {
  slot: string;
  pairId: string;
  round: number;
  matchupType: "real" | "ghost";
  opponentSlot: string;
  ghostOwnerSlot: string | null;
  result: PvpCombatResult;
}

export interface PvpFortressState {
  sessionType: typeof PVP_FORTRESS_SESSION_TYPE;
  phase: PvpFortressPhase;
  round: number;
  readyBySlot: Record<string, boolean>;
  castleHpBySlot: Record<string, number>;
  aliveSlots: string[];
  eliminatedSlots: string[];
  currentMatchups: PvpFortressMatchup[];
  expectedPairIds: string[];
  reportByPairId: Record<string, PvpFortressReport>;
  lastOpponents: Record<string, string | null>;
  championSlot: string | null;
  revision: number;
}

export interface PvpCombatMetadata {
  pairId: string;
  round: number;
  localSlot: string;
  opponentSlot: string;
  reporterSlot: string;
  matchupType: "real" | "ghost";
  ghost: boolean;
  ghostOwnerSlot?: string;
}

export interface PvpCombatPayload {
  run: RunState;
  audioEnabled: boolean;
  metadata: PvpCombatMetadata;
}

export interface PvpPlayerRoundResult extends PvpCombatResult {
  pairId: string;
  opponentSlot: string;
  matchupType: "real" | "ghost";
  fortressHpAfter: number;
  goldBonus: number;
  matchEnded: boolean;
  winnerSlot: string | null;
}

export interface PvpFortressResolution {
  round: number;
  resultBySlot: Record<string, PvpPlayerRoundResult>;
  championSlot: string | null;
  castleHpBySlot: Record<string, number>;
}

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const nonNegativeInt = (value: unknown): number => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
};

const randomIndex = (length: number, rng: () => number): number => {
  if (length <= 1) return 0;
  const value = rng();
  const normalized = Number.isFinite(value) ? Math.min(0.999999999999, Math.max(0, value)) : 0;
  return Math.floor(normalized * length);
};

const uniqueSlots = (slots: readonly string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const slot of slots) {
    const normalized = slot.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
};

function fisherYates(values: readonly string[], rng: () => number): string[] {
  const out = [...values];
  for (let index = out.length - 1; index > 0; index--) {
    const other = randomIndex(index + 1, rng);
    [out[index], out[other]] = [out[other]!, out[index]!];
  }
  return out;
}

export function pvpRealPairId(round: number, slotA: string, slotB: string): string {
  const [first, second] = [slotA, slotB].sort((a, b) => a.localeCompare(b));
  return `round:${Math.max(1, Math.floor(round))}:pair:${first}:${second}`;
}

export function pvpGhostPairId(round: number, fighterSlot: string, ghostOwnerSlot: string): string {
  return `round:${Math.max(1, Math.floor(round))}:ghost:${fighterSlot}:${ghostOwnerSlot}`;
}

export function createPvpFortressState(
  slots: readonly string[],
  startingHp = DEFAULT_PVP_FORTRESS_HP,
): PvpFortressState {
  const normalizedSlots = uniqueSlots(slots);
  const hp = Math.max(0, Math.floor(startingHp));
  const readyBySlot: Record<string, boolean> = {};
  const castleHpBySlot: Record<string, number> = {};
  const lastOpponents: Record<string, string | null> = {};
  for (const slot of normalizedSlots) {
    readyBySlot[slot] = false;
    castleHpBySlot[slot] = hp;
    lastOpponents[slot] = null;
  }
  const aliveSlots = normalizedSlots.filter((slot) => castleHpBySlot[slot]! > 0);
  return {
    sessionType: PVP_FORTRESS_SESSION_TYPE,
    phase: aliveSlots.length === 1 ? "finished" : "planning",
    round: 1,
    readyBySlot,
    castleHpBySlot,
    aliveSlots,
    eliminatedSlots: normalizedSlots.filter((slot) => castleHpBySlot[slot] === 0),
    currentMatchups: [],
    expectedPairIds: [],
    reportByPairId: {},
    lastOpponents,
    championSlot: aliveSlots.length === 1 ? aliveSlots[0]! : null,
    revision: 1,
  };
}

export function normalizePvpFortressState(
  value: unknown,
  slots: readonly string[],
  startingHp = DEFAULT_PVP_FORTRESS_HP,
): PvpFortressState {
  const normalizedSlots = uniqueSlots(slots);
  const raw = record(value);
  const base = createPvpFortressState(normalizedSlots, startingHp);
  if (!raw) return base;
  const rawHp = record(raw.castleHpBySlot) ?? {};
  const rawReady = record(raw.readyBySlot) ?? {};
  const rawLast = record(raw.lastOpponents) ?? {};
  for (const slot of normalizedSlots) {
    const candidateHp = Number(rawHp[slot]);
    base.castleHpBySlot[slot] = Number.isFinite(candidateHp)
      ? Math.max(0, Math.floor(candidateHp))
      : base.castleHpBySlot[slot]!;
    base.readyBySlot[slot] = rawReady[slot] === true;
    base.lastOpponents[slot] = typeof rawLast[slot] === "string" && normalizedSlots.includes(rawLast[slot] as string)
      ? rawLast[slot] as string
      : null;
  }
  base.round = Math.max(1, Math.floor(Number(raw.round) || 1));
  base.revision = Math.max(1, Math.floor(Number(raw.revision) || 1));
  base.aliveSlots = normalizedSlots.filter((slot) => base.castleHpBySlot[slot]! > 0);
  base.eliminatedSlots = normalizedSlots.filter((slot) => base.castleHpBySlot[slot] === 0);
  base.championSlot = base.aliveSlots.length === 1 ? base.aliveSlots[0]! : null;
  const phase = raw.phase;
  base.phase = base.championSlot
    ? "finished"
    : phase === "combat" || phase === "finished" ? phase : "planning";
  base.currentMatchups = Array.isArray(raw.currentMatchups)
    ? (raw.currentMatchups as PvpFortressMatchup[]).filter((matchup) => {
      if (!matchup || typeof matchup !== "object" || typeof matchup.pairId !== "string") return false;
      return matchup.round === base.round && (matchup.type === "real" || matchup.type === "ghost");
    }).map((matchup) => structuredClone(matchup))
    : [];
  base.expectedPairIds = Array.isArray(raw.expectedPairIds)
    ? raw.expectedPairIds.filter((id): id is string => typeof id === "string")
    : base.currentMatchups.map((matchup) => matchup.pairId);
  const rawReports = record(raw.reportByPairId) ?? {};
  for (const pairId of base.expectedPairIds) {
    const report = normalizePvpFortressReport(rawReports[pairId]);
    if (report && report.round === base.round) base.reportByPairId[pairId] = report;
  }
  return base;
}

function immediateRematchPenalty(slotA: string, slotB: string, last: Record<string, string | null>): number {
  return (last[slotA] === slotB ? 2 : 0) + (last[slotB] === slotA ? 2 : 0);
}

export function pairPvpFortressRound(
  aliveSlots: readonly string[],
  round: number,
  lastOpponents: Record<string, string | null>,
  rng: () => number,
): PvpFortressMatchup[] {
  const shuffled = fisherYates(uniqueSlots(aliveSlots), rng);
  if (shuffled.length <= 1) return [];
  const ghostFighter = shuffled.length % 2 === 1 ? shuffled.pop()! : null;
  const remaining = [...shuffled];
  const realMatches: PvpFortressRealMatchup[] = [];
  while (remaining.length >= 2) {
    const slotA = remaining.shift()!;
    let lowest = Number.POSITIVE_INFINITY;
    let candidates: string[] = [];
    for (const candidate of remaining) {
      const penalty = immediateRematchPenalty(slotA, candidate, lastOpponents);
      if (penalty < lowest) {
        lowest = penalty;
        candidates = [candidate];
      } else if (penalty === lowest) {
        candidates.push(candidate);
      }
    }
    const slotB = candidates[randomIndex(candidates.length, rng)]!;
    remaining.splice(remaining.indexOf(slotB), 1);
    const sorted = [slotA, slotB].sort((a, b) => a.localeCompare(b));
    realMatches.push({
      type: "real",
      pairId: pvpRealPairId(round, slotA, slotB),
      round,
      slotA,
      slotB,
      reporterSlot: sorted[0]!,
    });
  }
  if (!ghostFighter) return realMatches;
  const candidates = realMatches.flatMap((matchup) => [matchup.slotA, matchup.slotB]);
  const preferred = candidates.filter((slot) => lastOpponents[ghostFighter] !== slot);
  const pool = preferred.length ? preferred : candidates;
  const ghostOwnerSlot = pool[randomIndex(pool.length, rng)]!;
  return [
    ...realMatches,
    {
      type: "ghost",
      pairId: pvpGhostPairId(round, ghostFighter, ghostOwnerSlot),
      round,
      fighterSlot: ghostFighter,
      ghostOwnerSlot,
      reporterSlot: ghostFighter,
    },
  ];
}

export function pvpEnemyPreview(player: Pick<RunState, "board">): Placement[] {
  const preview: Placement[] = [];
  for (let index = 0; index < player.board.length; index++) {
    const unit = player.board[index];
    if (!unit) continue;
    const row = Math.floor(index / BOARD_SIZE);
    const col = index % BOARD_SIZE;
    preview.push({
      uid: `pvp:${unit.uid}`,
      baseId: unit.baseId,
      star: Math.max(1, Math.floor(unit.star)),
      equips: [...unit.equips],
      traits: unit.traits ? structuredClone(unit.traits) : undefined,
      row,
      col: col + RIGHT_COL_START,
    });
  }
  return preview;
}

export function buildPvpCombatRun(
  player: RunState,
  opponent: RunState,
  aiMode: AiMode = "MEDIUM",
): RunState {
  const run = structuredClone(player);
  run.enemyPreview = pvpEnemyPreview(opponent);
  run.enemyPreviewRound = Math.max(1, Math.floor(player.round || 1));
  run.enemyBudget = run.enemyPreview.length;
  run.aiMode = aiMode;
  return run;
}

export interface StartPvpFortressResult {
  state: PvpFortressState;
  payloadBySlot: Record<string, PvpCombatPayload>;
}

export function startPvpFortressCombat(
  current: PvpFortressState,
  players: Record<string, RunState>,
  rng: () => number,
  aiMode: AiMode = "MEDIUM",
  audioEnabled = true,
): StartPvpFortressResult {
  const slots = Object.keys(players);
  const state = normalizePvpFortressState(current, slots);
  if (state.championSlot) return { state, payloadBySlot: {} };
  const alive = state.aliveSlots.filter((slot) => players[slot] !== undefined);
  const currentMatchups = pairPvpFortressRound(alive, state.round, state.lastOpponents, rng);
  const payloadBySlot: Record<string, PvpCombatPayload> = {};

  for (const matchup of currentMatchups) {
    if (matchup.type === "real") {
      const playerA = players[matchup.slotA]!;
      const playerB = players[matchup.slotB]!;
      payloadBySlot[matchup.slotA] = {
        run: buildPvpCombatRun(playerA, playerB, aiMode),
        audioEnabled,
        metadata: {
          pairId: matchup.pairId,
          round: state.round,
          localSlot: matchup.slotA,
          opponentSlot: matchup.slotB,
          reporterSlot: matchup.reporterSlot,
          matchupType: "real",
          ghost: false,
        },
      };
      payloadBySlot[matchup.slotB] = {
        run: buildPvpCombatRun(playerB, playerA, aiMode),
        audioEnabled,
        metadata: {
          pairId: matchup.pairId,
          round: state.round,
          localSlot: matchup.slotB,
          opponentSlot: matchup.slotA,
          reporterSlot: matchup.reporterSlot,
          matchupType: "real",
          ghost: false,
        },
      };
    } else {
      const fighter = players[matchup.fighterSlot]!;
      const owner = players[matchup.ghostOwnerSlot]!;
      payloadBySlot[matchup.fighterSlot] = {
        run: buildPvpCombatRun(fighter, owner, aiMode),
        audioEnabled,
        metadata: {
          pairId: matchup.pairId,
          round: state.round,
          localSlot: matchup.fighterSlot,
          opponentSlot: matchup.ghostOwnerSlot,
          reporterSlot: matchup.reporterSlot,
          matchupType: "ghost",
          ghost: true,
          ghostOwnerSlot: matchup.ghostOwnerSlot,
        },
      };
    }
  }

  for (const slot of alive) state.readyBySlot[slot] = false;
  state.phase = currentMatchups.length ? "combat" : "planning";
  state.currentMatchups = currentMatchups;
  state.expectedPairIds = currentMatchups.map((matchup) => matchup.pairId);
  state.reportByPairId = {};
  state.revision += 1;
  return { state, payloadBySlot };
}

function normalizeWinner(value: unknown): PvpWinnerSide {
  if (value === "LEFT" || value === "L") return "LEFT";
  if (value === "RIGHT" || value === "R") return "RIGHT";
  return "DRAW";
}

export function normalizePvpCombatResult(value: unknown, fallbackRound = 1): PvpCombatResult {
  const raw = record(value) ?? {};
  return {
    winnerSide: normalizeWinner(raw.winnerSide),
    round: Math.max(1, Math.floor(Number(raw.round) || fallbackRound)),
    leftAlive: nonNegativeInt(raw.leftAlive),
    leftTotal: nonNegativeInt(raw.leftTotal),
    rightAlive: nonNegativeInt(raw.rightAlive),
    rightTotal: nonNegativeInt(raw.rightTotal),
  };
}

export function normalizePvpFortressReport(value: unknown): PvpFortressReport | null {
  const raw = record(value);
  if (!raw || typeof raw.slot !== "string" || !raw.slot.trim()) return null;
  if (typeof raw.pairId !== "string" || !raw.pairId.trim()) return null;
  const round = Math.max(1, Math.floor(Number(raw.round) || 1));
  return {
    slot: raw.slot,
    pairId: raw.pairId,
    round,
    matchupType: raw.matchupType === "ghost" ? "ghost" : "real",
    opponentSlot: typeof raw.opponentSlot === "string" ? raw.opponentSlot : "",
    ghostOwnerSlot: typeof raw.ghostOwnerSlot === "string" ? raw.ghostOwnerSlot : null,
    result: normalizePvpCombatResult(raw.result, round),
  };
}

function mirrorPvpResult(result: PvpCombatResult): PvpCombatResult {
  return {
    winnerSide: result.winnerSide === "LEFT" ? "RIGHT" : result.winnerSide === "RIGHT" ? "LEFT" : "DRAW",
    round: result.round,
    leftAlive: result.rightAlive,
    leftTotal: result.rightTotal,
    rightAlive: result.leftAlive,
    rightTotal: result.leftTotal,
  };
}

function validReportForMatchup(report: PvpFortressReport, matchup: PvpFortressMatchup): boolean {
  if (report.pairId !== matchup.pairId || report.round !== matchup.round || report.slot !== matchup.reporterSlot) return false;
  if (report.matchupType !== matchup.type) return false;
  if (matchup.type === "real") {
    const opponent = report.slot === matchup.slotA ? matchup.slotB : matchup.slotA;
    return report.opponentSlot === opponent && report.ghostOwnerSlot === null;
  }
  return report.opponentSlot === matchup.ghostOwnerSlot && report.ghostOwnerSlot === matchup.ghostOwnerSlot;
}

export interface SubmitPvpFortressReportResult {
  accepted: boolean;
  resolved: boolean;
  state: PvpFortressState;
  players: Record<string, RunState>;
  resolution: PvpFortressResolution | null;
}

export function submitPvpFortressReport(
  current: PvpFortressState,
  input: unknown,
  players: Record<string, RunState>,
): SubmitPvpFortressReportResult {
  const report = normalizePvpFortressReport(input);
  if (!report || current.phase !== "combat" || report.round !== current.round) {
    return { accepted: false, resolved: false, state: current, players, resolution: null };
  }
  const matchup = current.currentMatchups.find((item) => item.pairId === report.pairId);
  if (!matchup || !current.expectedPairIds.includes(report.pairId) || current.reportByPairId[report.pairId]) {
    return { accepted: false, resolved: false, state: current, players, resolution: null };
  }
  if (!validReportForMatchup(report, matchup)) {
    return { accepted: false, resolved: false, state: current, players, resolution: null };
  }

  const state = structuredClone(current);
  const nextPlayers = structuredClone(players);
  state.reportByPairId[report.pairId] = report;
  if (!state.expectedPairIds.every((pairId) => state.reportByPairId[pairId] !== undefined)) {
    return { accepted: true, resolved: false, state, players: nextPlayers, resolution: null };
  }

  const resultBySlot: Record<string, PvpPlayerRoundResult> = {};
  for (const resolvedMatchup of state.currentMatchups) {
    const resolvedReport = state.reportByPairId[resolvedMatchup.pairId]!;
    if (resolvedMatchup.type === "real") {
      const localSlot = resolvedReport.slot;
      const opponentSlot = localSlot === resolvedMatchup.slotA ? resolvedMatchup.slotB : resolvedMatchup.slotA;
      let localBonus = 0;
      let opponentBonus = 0;
      if (resolvedReport.result.winnerSide === "LEFT") {
        state.castleHpBySlot[opponentSlot] = Math.max(
          0,
          state.castleHpBySlot[opponentSlot]! - resolvedReport.result.leftAlive,
        );
        localBonus = PVP_FORTRESS_WIN_GOLD;
        if (nextPlayers[localSlot]) nextPlayers[localSlot]!.gold += localBonus;
      } else if (resolvedReport.result.winnerSide === "RIGHT") {
        state.castleHpBySlot[localSlot] = Math.max(
          0,
          state.castleHpBySlot[localSlot]! - resolvedReport.result.rightAlive,
        );
        opponentBonus = PVP_FORTRESS_WIN_GOLD;
        if (nextPlayers[opponentSlot]) nextPlayers[opponentSlot]!.gold += opponentBonus;
      }
      state.lastOpponents[localSlot] = opponentSlot;
      state.lastOpponents[opponentSlot] = localSlot;
      resultBySlot[localSlot] = {
        ...resolvedReport.result,
        pairId: resolvedMatchup.pairId,
        opponentSlot,
        matchupType: "real",
        fortressHpAfter: state.castleHpBySlot[localSlot]!,
        goldBonus: localBonus,
        matchEnded: false,
        winnerSlot: null,
      };
      resultBySlot[opponentSlot] = {
        ...mirrorPvpResult(resolvedReport.result),
        pairId: resolvedMatchup.pairId,
        opponentSlot: localSlot,
        matchupType: "real",
        fortressHpAfter: state.castleHpBySlot[opponentSlot]!,
        goldBonus: opponentBonus,
        matchEnded: false,
        winnerSlot: null,
      };
    } else {
      const fighter = resolvedMatchup.fighterSlot;
      let fighterBonus = 0;
      if (resolvedReport.result.winnerSide === "RIGHT") {
        state.castleHpBySlot[fighter] = Math.max(
          0,
          state.castleHpBySlot[fighter]! - resolvedReport.result.rightAlive,
        );
      } else if (resolvedReport.result.winnerSide === "LEFT") {
        fighterBonus = PVP_FORTRESS_WIN_GOLD;
        if (nextPlayers[fighter]) nextPlayers[fighter]!.gold += fighterBonus;
      }
      state.lastOpponents[fighter] = resolvedMatchup.ghostOwnerSlot;
      resultBySlot[fighter] = {
        ...resolvedReport.result,
        pairId: resolvedMatchup.pairId,
        opponentSlot: resolvedMatchup.ghostOwnerSlot,
        matchupType: "ghost",
        fortressHpAfter: state.castleHpBySlot[fighter]!,
        goldBonus: fighterBonus,
        matchEnded: false,
        winnerSlot: null,
      };
    }
  }

  const slots = Object.keys(state.castleHpBySlot);
  state.aliveSlots = slots.filter((slot) => state.castleHpBySlot[slot]! > 0);
  state.eliminatedSlots = slots.filter((slot) => state.castleHpBySlot[slot] === 0);
  state.championSlot = state.aliveSlots.length === 1 ? state.aliveSlots[0]! : null;
  for (const slot of slots) state.readyBySlot[slot] = false;
  for (const result of Object.values(resultBySlot)) {
    result.matchEnded = state.championSlot !== null;
    result.winnerSlot = state.championSlot;
  }
  const resolvedRound = state.round;
  state.currentMatchups = [];
  state.expectedPairIds = [];
  state.reportByPairId = {};
  state.phase = state.championSlot ? "finished" : "planning";
  if (!state.championSlot) state.round += 1;
  state.revision += 1;

  return {
    accepted: true,
    resolved: true,
    state,
    players: nextPlayers,
    resolution: {
      round: resolvedRound,
      resultBySlot,
      championSlot: state.championSlot,
      castleHpBySlot: structuredClone(state.castleHpBySlot),
    },
  };
}

export interface PvpFortressCombatSnapshot {
  kind: "pvp_fortress_combat_snapshot";
  pairId: string;
  slot: string;
  opponentSlot: string;
  matchupType: "real" | "ghost";
  ghostOwnerSlot: string | null;
  phase: string;
  turnCycleIndex: number;
  combatRound: number;
  actionCount: number;
  turnIndex: number;
  queueRemaining: number;
  leftAlive: number;
  rightAlive: number;
  leftHpTotal: number;
  rightHpTotal: number;
  playerHp: number;
  timestamp: number;
}

export function normalizePvpFortressCombatSnapshot(value: unknown): PvpFortressCombatSnapshot | null {
  const raw = record(value);
  if (!raw || typeof raw.pairId !== "string" || !raw.pairId.trim()) return null;
  if (typeof raw.slot !== "string" || !raw.slot.trim()) return null;
  const turnCycleIndex = nonNegativeInt(raw.turnCycleIndex ?? raw.combatRound);
  return {
    kind: "pvp_fortress_combat_snapshot",
    pairId: raw.pairId,
    slot: raw.slot,
    opponentSlot: typeof raw.opponentSlot === "string" ? raw.opponentSlot : "",
    matchupType: raw.matchupType === "ghost" ? "ghost" : "real",
    ghostOwnerSlot: typeof raw.ghostOwnerSlot === "string" ? raw.ghostOwnerSlot : null,
    phase: typeof raw.phase === "string" ? raw.phase : "combat",
    turnCycleIndex,
    combatRound: turnCycleIndex,
    actionCount: nonNegativeInt(raw.actionCount),
    turnIndex: nonNegativeInt(raw.turnIndex),
    queueRemaining: nonNegativeInt(raw.queueRemaining),
    leftAlive: nonNegativeInt(raw.leftAlive),
    rightAlive: nonNegativeInt(raw.rightAlive),
    leftHpTotal: nonNegativeInt(raw.leftHpTotal),
    rightHpTotal: nonNegativeInt(raw.rightHpTotal),
    playerHp: nonNegativeInt(raw.playerHp),
    timestamp: Math.max(0, Number(raw.timestamp) || 0),
  };
}

export function isPvpFortressSnapshotStale(snapshot: Pick<PvpFortressCombatSnapshot, "timestamp">, now: number): boolean {
  return Math.max(0, now - snapshot.timestamp) > PVP_FORTRESS_SNAPSHOT_STALE_MS;
}

export function freshestPvpFortressSnapshot(
  values: readonly unknown[],
  pairId?: string,
): PvpFortressCombatSnapshot | null {
  let freshest: PvpFortressCombatSnapshot | null = null;
  for (const value of values) {
    const snapshot = normalizePvpFortressCombatSnapshot(value);
    if (!snapshot || (pairId && snapshot.pairId !== pairId)) continue;
    if (!freshest || snapshot.timestamp > freshest.timestamp) freshest = snapshot;
  }
  return freshest;
}

export function pvpSnapshotLeader(snapshot: PvpFortressCombatSnapshot): "LEFT" | "RIGHT" | null {
  if (snapshot.leftAlive !== snapshot.rightAlive) return snapshot.leftAlive > snapshot.rightAlive ? "LEFT" : "RIGHT";
  if (snapshot.leftHpTotal !== snapshot.rightHpTotal) return snapshot.leftHpTotal > snapshot.rightHpTotal ? "LEFT" : "RIGHT";
  return null;
}
