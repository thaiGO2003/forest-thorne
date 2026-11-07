import { RIGHT_COL_START } from "../core/boardConstants.js";

export const PVP_FORTRESS_SESSION_TYPE = "pvp_fortress";
export const PVP_FORTRESS_SNAPSHOT_INTERVAL_MS = 5000;
export const PVP_FORTRESS_START_KIND = "pvp_fortress_start";
export const PVP_FORTRESS_REPORT_KIND = "pvp_fortress_report";
export const PVP_FORTRESS_RESOLUTION_KIND = "pvp_fortress_resolution";
export const PVP_FORTRESS_COMBAT_SNAPSHOT_KIND = "pvp_fortress_combat_snapshot";
export const PVP_FORTRESS_COMBAT_SNAPSHOT_STALE_MS = 10000;
export const PVP_FORTRESS_WIN_GOLD = 3;

export type PvpSlot = string;
export type PvpMatchupType = "real" | "ghost";
export type PvpSide = "LEFT" | "RIGHT";
export type PvpWinnerSide = PvpSide | "DRAW";
export type PvpAiDifficulty = string;

export interface PvpEnemyPreviewEntry {
  baseId: string;
  star: number;
  equips: string[];
  row: number;
  col: number;
}

export interface PvpEnemyPreviewRow {
  [col: number]: unknown;
}

export interface PvpEnemyPreviewBoard {
  [row: number]: PvpEnemyPreviewRow | unknown[];
}

export interface PvpEnemyPreviewUnitLike {
  baseId?: unknown;
  star?: unknown;
  equips?: unknown;
}

export interface PvpPlayerBoardLike {
  [key: string]: unknown;
  board?: unknown;
}

export interface PvpPlayerSlotMap<T> {
  [slot: string]: T;
}

export interface PvpFortressStateInit {
  slots?: unknown;
  startingHp?: unknown;
}

export interface PvpFortressRawState {
  aliveSlots?: unknown;
  eliminatedSlots?: unknown;
  castleHpBySlot?: unknown;
  readyBySlot?: unknown;
  currentMatchups?: unknown;
  expectedPairIds?: unknown;
  reportByPairId?: unknown;
  lastOpponents?: unknown;
  championSlot?: unknown;
  revision?: unknown;
}

export interface PvpFortressMatchupBase {
  type: PvpMatchupType;
  pairId: string;
  reporterSlot: PvpSlot;
}

export interface PvpFortressRealMatchup extends PvpFortressMatchupBase {
  type: "real";
  slotA: PvpSlot;
  slotB: PvpSlot;
}

export interface PvpFortressGhostMatchup extends PvpFortressMatchupBase {
  type: "ghost";
  fighterSlot: PvpSlot;
  ghostOwnerSlot: PvpSlot;
}

export type PvpFortressMatchup = PvpFortressRealMatchup | PvpFortressGhostMatchup;

export interface PvpFortressState {
  sessionType: typeof PVP_FORTRESS_SESSION_TYPE;
  phase: "planning" | "combat" | "finished";
  round: number;
  readyBySlot: Record<PvpSlot, boolean>;
  castleHpBySlot: Record<PvpSlot, number>;
  aliveSlots: PvpSlot[];
  eliminatedSlots: PvpSlot[];
  currentMatchups: PvpFortressMatchup[];
  expectedPairIds: string[];
  reportByPairId: Record<string, unknown>;
  lastOpponents: Record<PvpSlot, PvpSlot | null>;
  championSlot: PvpSlot | null;
  revision: number;
}

export interface PvpFortressRoomCombatMetaBase {
  sessionType: typeof PVP_FORTRESS_SESSION_TYPE;
  type: PvpMatchupType;
  round: number;
  pairId: string;
  localSlot: PvpSlot;
  reporterSlot: PvpSlot;
}

export interface PvpFortressRoomCombatMetaReal extends PvpFortressRoomCombatMetaBase {
  type: "real";
  opponentSlot: PvpSlot;
}

export interface PvpFortressRoomCombatMetaGhost extends PvpFortressRoomCombatMetaBase {
  type: "ghost";
  opponentSlot: PvpSlot;
  ghostOwnerSlot: PvpSlot;
  ghost: true;
}

export type PvpFortressRoomCombatMeta =
  | PvpFortressRoomCombatMetaReal
  | PvpFortressRoomCombatMetaGhost;

export interface PvpFortressCombatStartPayloadPerSlot {
  runState: { aiMode: PvpAiDifficulty; audioEnabled: boolean; player: Record<string, unknown> };
  roomCombatMeta: PvpFortressRoomCombatMeta;
}

export interface PvpFortressStartPayload {
  kind: typeof PVP_FORTRESS_START_KIND;
  payloadsBySlot: Record<PvpSlot, PvpFortressCombatStartPayloadPerSlot>;
  pvpState: PvpFortressState;
}

export interface PvpFortressCombatReportResult {
  winnerSide: PvpWinnerSide;
  round: number;
  leftAlive: number;
  leftTotal: number;
  rightAlive: number;
  rightTotal: number;
}

export interface PvpFortressReportPayload {
  kind: typeof PVP_FORTRESS_REPORT_KIND;
  slot: PvpSlot;
  pairId: string | undefined;
  round: number | undefined;
  matchupType: PvpMatchupType;
  opponentSlot: PvpSlot | null;
  ghostOwnerSlot: PvpSlot | null;
  result: PvpFortressCombatReportResult;
}

export interface PvpFortressCombatSnapshotState {
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

export interface PvpFortressCombatSnapshotPayload {
  kind: typeof PVP_FORTRESS_COMBAT_SNAPSHOT_KIND;
  slot: PvpSlot;
  pairId: string | null;
  round: number;
  matchupType: PvpMatchupType;
  opponentSlot: PvpSlot | null;
  ghostOwnerSlot: PvpSlot | null;
  ghost: boolean;
  state: PvpFortressCombatSnapshotState;
}

export interface PvpFortressHudSideData {
  label: string;
  alive: number | null;
  hpTotal: number | null;
  timestamp: number | null;
  ageMs: number | null;
  hasData: boolean;
  stale: boolean;
  isLeading: boolean;
  text: string;
}

export interface PvpFortressRemoteHudModel {
  pairId: string | null;
  matchupType: PvpMatchupType;
  pairLabel: string;
  waiting: boolean;
  stale: boolean;
  sides: PvpFortressHudSideData[];
  progressText: string;
  freshnessText: string;
}

export interface PvpFortressRoundResultBase {
  round: number;
  goldBase: number;
  goldStarBonus: number;
  goldDelta: number;
  damage: number;
  lootDrops: unknown[];
  lootDropDetails: unknown[];
  creativeMode: boolean;
  creativePassiveXpSuppressed: boolean;
  creativeIgnoreDefeat: boolean;
  fortressHpAfter?: number;
  matchEnded?: boolean;
  winnerSlot?: PvpSlot;
  winnerSide?: PvpWinnerSide;
  leftAlive?: number;
  leftTotal?: number;
  rightAlive?: number;
  rightTotal?: number;
}

export interface PvpFortressResolutionPayload {
  kind: typeof PVP_FORTRESS_RESOLUTION_KIND;
  resultBySlot: Record<PvpSlot, PvpFortressRoundResultBase>;
  pvpState: PvpFortressState;
}

export interface PvpFortressMatchupRandomOptions {
  aliveSlots?: unknown;
  lastOpponents?: unknown;
  round?: unknown;
  randomFn?: () => number;
}

export interface PvpFortressCombatStartOptions {
  players?: unknown;
  pvpState?: unknown;
  audioEnabled?: unknown;
  aiMode?: unknown;
  randomFn?: () => number;
}

export interface PvpFortressSnapshotBuildOptions {
  combatState?: unknown;
  roomCombatMeta?: unknown;
  slot?: unknown;
}

export interface PvpFortressResolveOptions {
  pvpState?: unknown;
  players?: unknown;
}

export interface PvpFortressRemoteHudModelOptions {
  modeId?: unknown;
  currentPairId?: unknown;
  currentMatchups?: unknown;
  combatSnapshotsBySlot?: unknown;
  now?: number;
}

function cloneValue<T>(value: T): T {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function buildSlotMap<T>(slots: unknown, createValue: ((slot: PvpSlot) => T) | T): Record<PvpSlot, T> {
  const map: Record<PvpSlot, T> = {};
  if (!Array.isArray(slots)) return map;
  slots.forEach((slot) => {
    if (typeof slot === "string") {
      map[slot] = typeof createValue === "function" ? (createValue as (slot: PvpSlot) => T)(slot) : createValue;
    }
  });
  return map;
}

export function createInitialPvpFortressState(
  { slots = [], startingHp = 100 }: PvpFortressStateInit = {}
): PvpFortressState {
  const aliveSlots: PvpSlot[] = (Array.isArray(slots) ? slots : [])
    .filter((slot): slot is PvpSlot => typeof slot === "string");
  return {
    sessionType: PVP_FORTRESS_SESSION_TYPE,
    phase: "planning",
    round: 1,
    readyBySlot: buildSlotMap<boolean>(aliveSlots, false),
    castleHpBySlot: buildSlotMap<number>(aliveSlots, typeof startingHp === "number" ? startingHp : 100),
    aliveSlots: [...aliveSlots],
    eliminatedSlots: [],
    currentMatchups: [],
    expectedPairIds: [],
    reportByPairId: {},
    lastOpponents: buildSlotMap<PvpSlot | null>(aliveSlots, null),
    championSlot: aliveSlots.length === 1 ? aliveSlots[0] : null,
    revision: 1,
  };
}

export function normalizePvpFortressState(
  rawState: unknown,
  { slots = [], startingHp = 100 }: PvpFortressStateInit = {}
): PvpFortressState {
  const baseState = createInitialPvpFortressState({ slots, startingHp });
  const source = (rawState && typeof rawState === "object" ? rawState : {}) as PvpFortressRawState;
  const aliveSet = new Set<PvpSlot>(
    (Array.isArray(source.aliveSlots) ? source.aliveSlots : baseState.aliveSlots)
      .filter((slot): slot is PvpSlot => typeof slot === "string" && baseState.castleHpBySlot[slot as PvpSlot] != null)
  );
  const eliminatedSet = new Set<PvpSlot>(
    (Array.isArray(source.eliminatedSlots) ? source.eliminatedSlots : [])
      .filter((slot): slot is PvpSlot => typeof slot === "string" && baseState.castleHpBySlot[slot as PvpSlot] != null && !aliveSet.has(slot as PvpSlot))
  );
  const castleHpBySlot: Record<PvpSlot, number> = { ...baseState.castleHpBySlot };
  Object.keys(castleHpBySlot).forEach((slotRaw) => {
    const slot = slotRaw as PvpSlot;
    const rawValue = (source.castleHpBySlot as Record<string, unknown> | undefined)?.[slot];
    castleHpBySlot[slot] = Number.isFinite(rawValue)
      ? Math.max(0, Math.floor(rawValue as number))
      : castleHpBySlot[slot];
    if (castleHpBySlot[slot] <= 0) {
      aliveSet.delete(slot);
      eliminatedSet.add(slot);
    }
  });
  return {
    ...baseState,
    ...source,
    readyBySlot: {
      ...baseState.readyBySlot,
      ...((source.readyBySlot as Record<PvpSlot, boolean> | undefined) ?? {})
    },
    castleHpBySlot,
    aliveSlots: baseState.aliveSlots.filter((slot) => aliveSet.has(slot)),
    eliminatedSlots: baseState.aliveSlots.filter((slot) => eliminatedSet.has(slot)),
    currentMatchups: Array.isArray(source.currentMatchups)
      ? (source.currentMatchups as unknown[]).map((entry) => {
          const base = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
          const matchup: PvpFortressMatchup =
            base.type === "ghost"
              ? ({ ...base } as unknown as PvpFortressGhostMatchup)
              : ({ ...base } as unknown as PvpFortressRealMatchup);
          return matchup;
        })
      : [],
    expectedPairIds: Array.isArray(source.expectedPairIds)
      ? (source.expectedPairIds as unknown[]).filter((pairId): pairId is string => typeof pairId === "string")
      : [],
    reportByPairId: source.reportByPairId && typeof source.reportByPairId === "object"
      ? Object.fromEntries(
          Object.entries(source.reportByPairId as Record<string, unknown>)
            .filter(([pairId]) => typeof pairId === "string")
            .map(([pairId, report]) => [pairId, cloneValue(report)])
        )
      : {},
    lastOpponents: {
      ...baseState.lastOpponents,
      ...((source.lastOpponents as Record<PvpSlot, PvpSlot | null> | undefined) ?? {})
    },
    championSlot: typeof source.championSlot === "string" ? source.championSlot : baseState.championSlot,
    revision: Number.isFinite(source.revision) ? Math.max(1, Math.floor(source.revision as number)) : baseState.revision
  };
}

export function isPvpFortressStartPayload(payload: unknown): boolean {
  return (payload as { kind?: unknown } | null)?.kind === PVP_FORTRESS_START_KIND;
}

export function isPvpFortressReportPayload(payload: unknown): boolean {
  return (payload as { kind?: unknown } | null)?.kind === PVP_FORTRESS_REPORT_KIND;
}

export function isPvpFortressResolutionPayload(payload: unknown): boolean {
  return (payload as { kind?: unknown } | null)?.kind === PVP_FORTRESS_RESOLUTION_KIND;
}

export function isPvpFortressCombatSnapshotPayload(payload: unknown): boolean {
  return (payload as { kind?: unknown } | null)?.kind === PVP_FORTRESS_COMBAT_SNAPSHOT_KIND;
}

export function buildEnemyPreviewFromBoard(board: unknown): PvpEnemyPreviewEntry[] {
  if (!Array.isArray(board)) return [];
  const preview: PvpEnemyPreviewEntry[] = [];
  board.forEach((row, rowIndex) => {
    if (!Array.isArray(row)) return;
    row.forEach((unitRaw, colIndex) => {
      const unit = unitRaw as PvpEnemyPreviewUnitLike | null;
      if (!unit?.baseId) return;
      preview.push({
        baseId: unit.baseId as string,
        star: Number.isFinite(unit.star) ? Math.max(1, Math.floor(unit.star as number)) : 1,
        equips: Array.isArray(unit.equips) ? (unit.equips as unknown[]).filter((equipId): equipId is string => typeof equipId === "string") : [],
        row: rowIndex,
        col: RIGHT_COL_START + colIndex
      });
    });
  });
  return preview;
}

export function clonePvpPlayersForSnapshot(
  players: unknown = {},
  slots: unknown = []
): Record<PvpSlot, unknown> {
  const snapshot: Record<PvpSlot, unknown> = {};
  const source = (players && typeof players === "object" ? players : {}) as Record<PvpSlot, unknown>;
  if (!Array.isArray(slots)) return snapshot;
  slots.forEach((slot) => {
    if (typeof slot !== "string") return;
    if (!source?.[slot]) return;
    snapshot[slot] = cloneValue(source[slot]);
  });
  return snapshot;
}

function buildRealPairId(round: unknown, slotA: unknown, slotB: unknown): string {
  const sorted = [slotA, slotB]
    .map((value) => String(value ?? ""))
    .sort();
  const [left, right] = sorted;
  const roundText = Number.isFinite(round) ? Math.floor(round as number) : 1;
  return `round:${roundText}:pair:${left}:${right}`;
}

function buildGhostPairId(round: unknown, fighterSlot: unknown, ghostOwnerSlot: unknown): string {
  const roundText = Number.isFinite(round) ? Math.floor(round as number) : 1;
  return `round:${roundText}:ghost:${String(fighterSlot ?? "")}:${String(ghostOwnerSlot ?? "")}`;
}

function shuffleArray<T>(values: T[], randomFn: () => number = Math.random): T[] {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(randomFn() * (index + 1));
    const swap = copy[swapIndex];
    copy[swapIndex] = copy[index];
    copy[index] = swap;
  }
  return copy;
}

function getOpponentPenalty(slotA: PvpSlot, slotB: PvpSlot, lastOpponents: unknown = {}): number {
  const opponents = (lastOpponents && typeof lastOpponents === "object" ? lastOpponents : {}) as Record<string, unknown>;
  let penalty = 0;
  if (opponents?.[slotA] === slotB) penalty += 2;
  if (opponents?.[slotB] === slotA) penalty += 2;
  return penalty;
}

function pickOpponentIndex(
  slots: PvpSlot[],
  baseSlot: PvpSlot,
  lastOpponents: unknown,
  randomFn: () => number
): number {
  let bestPenalty = Number.POSITIVE_INFINITY;
  let candidateIndexes: number[] = [];
  for (let index = 1; index < slots.length; index += 1) {
    const penalty = getOpponentPenalty(baseSlot, slots[index], lastOpponents);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      candidateIndexes = [index];
      continue;
    }
    if (penalty === bestPenalty) {
      candidateIndexes.push(index);
    }
  }
  if (!candidateIndexes.length) return 1;
  return candidateIndexes[Math.floor(randomFn() * candidateIndexes.length)];
}

export function buildRandomPvpFortressMatchups(
  { aliveSlots = [], lastOpponents = {}, round = 1, randomFn = Math.random }: PvpFortressMatchupRandomOptions = {}
): PvpFortressMatchup[] {
  const pendingSlots: PvpSlot[] = shuffleArray(
    (Array.isArray(aliveSlots) ? aliveSlots : []).filter((slot): slot is PvpSlot => typeof slot === "string"),
    randomFn
  );
  const matchups: PvpFortressMatchup[] = [];
  let ghostFighterSlot: PvpSlot | null = null;

  if (pendingSlots.length % 2 === 1 && pendingSlots.length > 1) {
    const popped = pendingSlots.pop();
    if (popped) ghostFighterSlot = popped;
  }

  while (pendingSlots.length >= 2) {
    const baseSlot = pendingSlots[0];
    const opponentIndex = pickOpponentIndex(pendingSlots, baseSlot, lastOpponents, randomFn);
    const opponentSlot = pendingSlots[opponentIndex];
    pendingSlots.splice(opponentIndex, 1);
    pendingSlots.shift();
    matchups.push({
      type: "real",
      pairId: buildRealPairId(round, baseSlot, opponentSlot),
      slotA: baseSlot,
      slotB: opponentSlot,
      reporterSlot: baseSlot
    });
  }

  if (ghostFighterSlot) {
    const realSlots: PvpSlot[] = matchups.flatMap((matchup) =>
      matchup.type === "real" ? [matchup.slotA, matchup.slotB] : []
    );
    const ghostCandidates: PvpSlot[] = realSlots.length
      ? realSlots
      : (Array.isArray(aliveSlots) ? aliveSlots : []).filter(
          (slot): slot is PvpSlot => typeof slot === "string" && slot !== ghostFighterSlot
        );
    const opponents = (lastOpponents && typeof lastOpponents === "object" ? lastOpponents : {}) as Record<string, unknown>;
    const preferredCandidates = ghostCandidates.filter((slot) => opponents?.[ghostFighterSlot] !== slot);
    const ghostPool = preferredCandidates.length ? preferredCandidates : ghostCandidates;
    const ghostOwnerSlot = ghostPool[Math.floor(randomFn() * ghostPool.length)];
    matchups.push({
      type: "ghost",
      pairId: buildGhostPairId(round, ghostFighterSlot, ghostOwnerSlot),
      fighterSlot: ghostFighterSlot,
      ghostOwnerSlot,
      reporterSlot: ghostFighterSlot
    });
  }

  return matchups;
}

function createCombatRunState(
  playerState: unknown,
  enemyPreview: PvpEnemyPreviewEntry[],
  aiMode: PvpAiDifficulty = "MEDIUM",
  audioEnabled: boolean = true
): { aiMode: PvpAiDifficulty; audioEnabled: boolean; player: Record<string, unknown> } {
  const playerSource = (playerState && typeof playerState === "object" ? playerState : {}) as Record<string, unknown>;
  const player: Record<string, unknown> = cloneValue(playerSource);
  player.enemyPreview = enemyPreview;
  player.enemyPreviewRound = player.round ?? 1;
  player.enemyBudget = enemyPreview.length;
  return {
    aiMode,
    audioEnabled,
    player
  };
}

export function buildPvpFortressCombatStartPayload({
  players = {},
  pvpState,
  audioEnabled = true,
  aiMode = "MEDIUM",
  randomFn = Math.random
}: PvpFortressCombatStartOptions = {}): PvpFortressStartPayload {
  const source = (players && typeof players === "object" ? players : {}) as Record<PvpSlot, PvpPlayerBoardLike>;
  const slots = Object.keys(source);
  const state = normalizePvpFortressState(pvpState, {
    slots,
    startingHp: 100
  });
  const aliveSlots: PvpSlot[] = state.aliveSlots.filter((slot) => source?.[slot]);
  const currentMatchups: PvpFortressMatchup[] = buildRandomPvpFortressMatchups({
    aliveSlots,
    lastOpponents: state.lastOpponents,
    round: state.round,
    randomFn
  });
  const payloadsBySlot: Record<PvpSlot, PvpFortressCombatStartPayloadPerSlot> = {};

  currentMatchups.forEach((matchup) => {
    if (matchup.type === "real") {
      const playerA = source?.[matchup.slotA];
      const playerB = source?.[matchup.slotB];
      if (playerA) {
        payloadsBySlot[matchup.slotA] = {
          runState: createCombatRunState(playerA, buildEnemyPreviewFromBoard(playerB?.board), aiMode as PvpAiDifficulty, !!audioEnabled),
          roomCombatMeta: {
            sessionType: PVP_FORTRESS_SESSION_TYPE,
            type: "real",
            round: state.round,
            pairId: matchup.pairId,
            localSlot: matchup.slotA,
            opponentSlot: matchup.slotB,
            reporterSlot: matchup.reporterSlot
          }
        };
      }
      if (playerB) {
        payloadsBySlot[matchup.slotB] = {
          runState: createCombatRunState(playerB, buildEnemyPreviewFromBoard(playerA?.board), aiMode as PvpAiDifficulty, !!audioEnabled),
          roomCombatMeta: {
            sessionType: PVP_FORTRESS_SESSION_TYPE,
            type: "real",
            round: state.round,
            pairId: matchup.pairId,
            localSlot: matchup.slotB,
            opponentSlot: matchup.slotA,
            reporterSlot: matchup.reporterSlot
          }
        };
      }
      return;
    }

    const fighter = source?.[matchup.fighterSlot];
    const ghostOwner = source?.[matchup.ghostOwnerSlot];
    if (!fighter) return;
    payloadsBySlot[matchup.fighterSlot] = {
      runState: createCombatRunState(fighter, buildEnemyPreviewFromBoard(ghostOwner?.board), aiMode as PvpAiDifficulty, !!audioEnabled),
      roomCombatMeta: {
        sessionType: PVP_FORTRESS_SESSION_TYPE,
        type: "ghost",
        round: state.round,
        pairId: matchup.pairId,
        localSlot: matchup.fighterSlot,
        opponentSlot: matchup.ghostOwnerSlot,
        ghostOwnerSlot: matchup.ghostOwnerSlot,
        reporterSlot: matchup.reporterSlot,
        ghost: true
      }
    };
  });

  const nextReadyBySlot: Record<PvpSlot, boolean> = { ...state.readyBySlot };
  aliveSlots.forEach((slot) => {
    nextReadyBySlot[slot] = false;
  });
  const nextState: PvpFortressState = {
    ...state,
    phase: "combat",
    readyBySlot: nextReadyBySlot,
    currentMatchups,
    expectedPairIds: currentMatchups.map((matchup) => matchup.pairId),
    reportByPairId: {},
    revision: state.revision + 1
  };

  return {
    kind: PVP_FORTRESS_START_KIND,
    payloadsBySlot,
    pvpState: nextState
  };
}

export function buildPvpFortressCombatReport(
  result: unknown,
  roomCombatMeta: unknown,
  slot: PvpSlot
): PvpFortressReportPayload {
  const meta = (roomCombatMeta && typeof roomCombatMeta === "object" ? roomCombatMeta : {}) as Record<string, unknown>;
  const source = (result && typeof result === "object" ? result : {}) as Record<string, unknown>;
  return {
    kind: PVP_FORTRESS_REPORT_KIND,
    slot,
    pairId: meta.pairId as string | undefined,
    round: meta.round as number | undefined,
    matchupType: meta.type === "ghost" ? "ghost" : "real",
    opponentSlot: typeof meta.opponentSlot === "string" ? meta.opponentSlot : null,
    ghostOwnerSlot: typeof meta.ghostOwnerSlot === "string" ? meta.ghostOwnerSlot : null,
    result: {
      winnerSide: (source.winnerSide as PvpWinnerSide | undefined) ?? "DRAW",
      round: Number.isFinite(source.round) ? (source.round as number) : ((meta.round as number | undefined) ?? 1),
      leftAlive: Number.isFinite(source.leftAlive) ? Math.max(0, Math.floor(source.leftAlive as number)) : 0,
      leftTotal: Number.isFinite(source.leftTotal) ? Math.max(0, Math.floor(source.leftTotal as number)) : 0,
      rightAlive: Number.isFinite(source.rightAlive) ? Math.max(0, Math.floor(source.rightAlive as number)) : 0,
      rightTotal: Number.isFinite(source.rightTotal) ? Math.max(0, Math.floor(source.rightTotal as number)) : 0
    }
  };
}

function normalizeSnapshotCount(value: unknown): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value as number)) : 0;
}

function normalizeSnapshotHp(value: unknown): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value as number)) : 0;
}

export function buildPvpFortressCombatSnapshot(
  combatState: unknown,
  roomCombatMeta: unknown,
  slot: PvpSlot
): PvpFortressCombatSnapshotPayload {
  const source = (combatState && typeof combatState === "object" ? combatState : {}) as Record<string, unknown>;
  const meta = (roomCombatMeta && typeof roomCombatMeta === "object" ? roomCombatMeta : {}) as Record<string, unknown>;
  const round = Number.isFinite(source.round)
    ? Math.max(1, Math.floor(source.round as number))
    : ((meta.round as number | undefined) ?? 1);
  const turnCycleIndex = normalizeSnapshotCount(source.turnCycleIndex ?? source.combatRound);
  return {
    kind: PVP_FORTRESS_COMBAT_SNAPSHOT_KIND,
    slot,
    pairId: typeof meta.pairId === "string" ? meta.pairId : null,
    round,
    matchupType: meta.type === "ghost" ? "ghost" : "real",
    opponentSlot: typeof meta.opponentSlot === "string" ? meta.opponentSlot : null,
    ghostOwnerSlot: typeof meta.ghostOwnerSlot === "string" ? meta.ghostOwnerSlot : null,
    ghost: meta.ghost === true,
    state: {
      phase: typeof source.phase === "string" ? source.phase : "combat",
      turnCycleIndex,
      combatRound: turnCycleIndex,
      actionCount: normalizeSnapshotCount(source.actionCount),
      turnIndex: normalizeSnapshotCount(source.turnIndex),
      queueRemaining: normalizeSnapshotCount(source.queueRemaining),
      leftAlive: normalizeSnapshotCount(source.leftAlive),
      rightAlive: normalizeSnapshotCount(source.rightAlive),
      leftHpTotal: normalizeSnapshotHp(source.leftHpTotal),
      rightHpTotal: normalizeSnapshotHp(source.rightHpTotal),
      playerHp: normalizeSnapshotHp(source.playerHp),
      timestamp: Number.isFinite(source.timestamp)
        ? Math.max(0, Math.floor(source.timestamp as number))
        : Date.now()
    }
  };
}

function getSnapshotForPair(
  combatSnapshotsBySlot: unknown = {},
  slot: unknown,
  pairId: unknown
): PvpFortressCombatSnapshotPayload | null {
  if (!slot || !pairId) return null;
  const map = (combatSnapshotsBySlot && typeof combatSnapshotsBySlot === "object" ? combatSnapshotsBySlot : {}) as Record<PvpSlot, PvpFortressCombatSnapshotPayload | undefined>;
  const snapshot = map?.[slot as PvpSlot];
  return snapshot?.pairId === pairId ? snapshot : null;
}

function getSnapshotTimestamp(snapshot: unknown): number | null {
  const timestamp = (snapshot as { state?: { timestamp?: unknown } } | null)?.state?.timestamp;
  return Number.isFinite(timestamp) ? Math.max(0, Math.floor(timestamp as number)) : null;
}

function getLatestSnapshot(
  snapshots: Array<PvpFortressCombatSnapshotPayload | null | undefined>
): PvpFortressCombatSnapshotPayload | null {
  return snapshots.reduce<PvpFortressCombatSnapshotPayload | null>((latest, snapshot) => {
    if (!snapshot) return latest;
    if (!latest) return snapshot;
    const latestTimestamp = getSnapshotTimestamp(latest) ?? 0;
    const currentTimestamp = getSnapshotTimestamp(snapshot) ?? 0;
    return currentTimestamp >= latestTimestamp ? snapshot : latest;
  }, null);
}

function buildHudSideData(
  label: string,
  data: { alive?: unknown; hpTotal?: unknown; timestamp?: unknown } | null,
  now: number = Date.now()
): PvpFortressHudSideData {
  const alive = Number.isFinite(data?.alive) ? Math.max(0, Math.floor(data!.alive as number)) : null;
  const hpTotal = Number.isFinite(data?.hpTotal) ? Math.max(0, Math.round(data!.hpTotal as number)) : null;
  const timestamp = Number.isFinite(data?.timestamp) ? Math.max(0, Math.floor(data!.timestamp as number)) : null;
  const hasData = alive != null && hpTotal != null;
  const ageMs = timestamp != null ? Math.max(0, now - timestamp) : null;
  const stale = ageMs != null && ageMs > PVP_FORTRESS_COMBAT_SNAPSHOT_STALE_MS;
  return {
    label,
    alive,
    hpTotal,
    timestamp,
    ageMs,
    hasData,
    stale,
    isLeading: false,
    text: hasData
      ? `${label}: ${alive} quân • ${hpTotal} HP${stale ? " (trễ)" : ""}`
      : `${label}: --`
  };
}

function compareHudSides(
  sideA: PvpFortressHudSideData | null,
  sideB: PvpFortressHudSideData | null
): "A" | "B" | null {
  if (!sideA?.hasData || !sideB?.hasData) return null;
  if (sideA.alive !== sideB.alive) {
    return (sideA.alive ?? 0) > (sideB.alive ?? 0) ? "A" : "B";
  }
  if (sideA.hpTotal !== sideB.hpTotal) {
    return (sideA.hpTotal ?? 0) > (sideB.hpTotal ?? 0) ? "A" : "B";
  }
  return null;
}

function buildHudProgressText(snapshot: PvpFortressCombatSnapshotPayload | null | undefined): string {
  if (!snapshot?.state) return "Chưa có dữ liệu combat";
  const turnCycleIndex = normalizeSnapshotCount(snapshot.state.turnCycleIndex ?? snapshot.state.combatRound);
  return [
    `Chu kỳ ${turnCycleIndex}`,
    `Hành động ${normalizeSnapshotCount(snapshot.state.actionCount)}`,
    `Còn ${normalizeSnapshotCount(snapshot.state.queueRemaining)} lượt`
  ].join(" • ");
}

function buildHudFreshnessText(
  snapshot: PvpFortressCombatSnapshotPayload | null | undefined,
  now: number = Date.now()
): string {
  const timestamp = getSnapshotTimestamp(snapshot);
  if (timestamp == null) return "Đang chờ snapshot...";
  const ageMs = Math.max(0, now - timestamp);
  const ageSeconds = Math.max(0, Math.floor(ageMs / 1000));
  const stale = ageMs > PVP_FORTRESS_COMBAT_SNAPSHOT_STALE_MS;
  return `Cập nhật ${ageSeconds}s trước${stale ? " (trễ)" : ""}`;
}

function finalizeRemoteHudModel(
  matchup: PvpFortressMatchup | null | undefined,
  sideA: PvpFortressHudSideData,
  sideB: PvpFortressHudSideData,
  latestSnapshot: PvpFortressCombatSnapshotPayload | null,
  now: number = Date.now()
): PvpFortressRemoteHudModel {
  const leadingSide = compareHudSides(sideA, sideB);
  if (leadingSide === "A") sideA.isLeading = true;
  if (leadingSide === "B") sideB.isLeading = true;
  const matchupType: PvpMatchupType = matchup?.type ?? "real";
  const pairLabel =
    matchup?.type === "ghost"
      ? `${matchup.fighterSlot} vs Bóng Ma (${matchup.ghostOwnerSlot})`
      : matchup?.type === "real"
        ? `${matchup.slotA} vs ${matchup.slotB}`
        : "P? vs P?";
  return {
    pairId: matchup?.pairId ?? null,
    matchupType,
    pairLabel,
    waiting: !latestSnapshot,
    stale: latestSnapshot
      ? Math.max(0, now - (getSnapshotTimestamp(latestSnapshot) ?? now)) > PVP_FORTRESS_COMBAT_SNAPSHOT_STALE_MS
      : false,
    sides: [sideA, sideB],
    progressText: latestSnapshot ? buildHudProgressText(latestSnapshot) : "Chưa có dữ liệu combat",
    freshnessText: buildHudFreshnessText(latestSnapshot, now)
  };
}

function buildRealRemoteHudModel(
  matchup: PvpFortressRealMatchup | null | undefined,
  combatSnapshotsBySlot: unknown = {},
  now: number = Date.now()
): PvpFortressRemoteHudModel {
  const snapshotA = getSnapshotForPair(combatSnapshotsBySlot, matchup?.slotA, matchup?.pairId);
  const snapshotB = getSnapshotForPair(combatSnapshotsBySlot, matchup?.slotB, matchup?.pairId);
  const sideA = buildHudSideData(
    matchup?.slotA ?? "P?",
    snapshotA?.state
      ? {
          alive: snapshotA.state.leftAlive,
          hpTotal: snapshotA.state.leftHpTotal,
          timestamp: snapshotA.state.timestamp
        }
      : (snapshotB?.state
        ? {
            alive: snapshotB.state.rightAlive,
            hpTotal: snapshotB.state.rightHpTotal,
            timestamp: snapshotB.state.timestamp
          }
        : null),
    now
  );
  const sideB = buildHudSideData(
    matchup?.slotB ?? "P?",
    snapshotB?.state
      ? {
          alive: snapshotB.state.leftAlive,
          hpTotal: snapshotB.state.leftHpTotal,
          timestamp: snapshotB.state.timestamp
        }
      : (snapshotA?.state
        ? {
            alive: snapshotA.state.rightAlive,
            hpTotal: snapshotA.state.rightHpTotal,
            timestamp: snapshotA.state.timestamp
          }
        : null),
    now
  );
  return finalizeRemoteHudModel(matchup ?? null, sideA, sideB, getLatestSnapshot([snapshotA, snapshotB]), now);
}

function buildGhostRemoteHudModel(
  matchup: PvpFortressGhostMatchup | null | undefined,
  combatSnapshotsBySlot: unknown = {},
  now: number = Date.now()
): PvpFortressRemoteHudModel {
  const snapshot = getSnapshotForPair(combatSnapshotsBySlot, matchup?.fighterSlot, matchup?.pairId);
  const sideA = buildHudSideData(
    matchup?.fighterSlot ?? "P?",
    snapshot?.state
      ? {
          alive: snapshot.state.leftAlive,
          hpTotal: snapshot.state.leftHpTotal,
          timestamp: snapshot.state.timestamp
        }
      : null,
    now
  );
  const sideB = buildHudSideData(
    `Bóng Ma (${matchup?.ghostOwnerSlot ?? "P?"})`,
    snapshot?.state
      ? {
          alive: snapshot.state.rightAlive,
          hpTotal: snapshot.state.rightHpTotal,
          timestamp: snapshot.state.timestamp
        }
      : null,
    now
  );
  return finalizeRemoteHudModel(matchup ?? null, sideA, sideB, snapshot, now);
}

export function buildPvpFortressRemoteMatchHudModel({
  modeId = null,
  currentPairId = null,
  currentMatchups = [],
  combatSnapshotsBySlot = {},
  now = Date.now()
}: PvpFortressRemoteHudModelOptions = {}): PvpFortressRemoteHudModel | null {
  if (modeId !== "PVP4Fortress") return null;
  if (!currentPairId) return null;
  if (!Array.isArray(currentMatchups) || currentMatchups.length <= 1) return null;
  const remoteMatchup = (currentMatchups as unknown[]).find(
    (matchup): matchup is PvpFortressMatchup => {
      const candidate = matchup as { pairId?: unknown } | null;
      return !!candidate?.pairId && candidate.pairId !== currentPairId;
    }
  );
  if (!remoteMatchup) return null;
  if (remoteMatchup.type === "ghost") {
    return buildGhostRemoteHudModel(remoteMatchup, combatSnapshotsBySlot, now);
  }
  return buildRealRemoteHudModel(remoteMatchup, combatSnapshotsBySlot, now);
}

function createBaseRoundResult(round: unknown): PvpFortressRoundResultBase {
  const safeRound = Number.isFinite(round) ? Math.floor(round as number) : 1;
  return {
    round: safeRound,
    goldBase: 0,
    goldStarBonus: 0,
    goldDelta: 0,
    damage: 0,
    lootDrops: [],
    lootDropDetails: [],
    creativeMode: false,
    creativePassiveXpSuppressed: false,
    creativeIgnoreDefeat: false
  };
}

function invertWinnerSide(winnerSide: unknown): PvpWinnerSide {
  if (winnerSide === "LEFT") return "RIGHT";
  if (winnerSide === "RIGHT") return "LEFT";
  return "DRAW";
}

function buildMirroredRoundResult(
  reportPayload: unknown,
  winnerSide: PvpWinnerSide,
  damage: number = 0
): PvpFortressRoundResultBase {
  const source = ((reportPayload as { result?: unknown } | null)?.result ?? {}) as Record<string, unknown>;
  const round = Number.isFinite(source.round) ? (source.round as number) : 1;
  return {
    ...createBaseRoundResult(round),
    winnerSide,
    leftAlive: (source.rightAlive as number | undefined) ?? 0,
    leftTotal: (source.rightTotal as number | undefined) ?? 0,
    rightAlive: (source.leftAlive as number | undefined) ?? 0,
    rightTotal: (source.leftTotal as number | undefined) ?? 0,
    damage
  };
}

function buildLocalRoundResult(reportPayload: unknown, damage: number = 0): PvpFortressRoundResultBase {
  const source = ((reportPayload as { result?: unknown } | null)?.result ?? {}) as Record<string, unknown>;
  const round = Number.isFinite(source.round) ? (source.round as number) : 1;
  return {
    ...createBaseRoundResult(round),
    winnerSide: (source.winnerSide as PvpWinnerSide | undefined) ?? "DRAW",
    leftAlive: (source.leftAlive as number | undefined) ?? 0,
    leftTotal: (source.leftTotal as number | undefined) ?? 0,
    rightAlive: (source.rightAlive as number | undefined) ?? 0,
    rightTotal: (source.rightTotal as number | undefined) ?? 0,
    damage
  };
}

function applyCombatOutcomeToCastle(
  hpMap: Record<PvpSlot, number>,
  slot: PvpSlot,
  damage: unknown
): void {
  if (!slot || hpMap[slot] == null) return;
  const numericDamage = Number.isFinite(damage) ? Math.max(0, damage as number) : 0;
  hpMap[slot] = Math.max(0, Math.floor(hpMap[slot] - numericDamage));
}

export function resolvePvpFortressRound(
  { pvpState, players = {} }: PvpFortressResolveOptions = {}
): PvpFortressResolutionPayload {
  const source = (players && typeof players === "object" ? players : {}) as Record<PvpSlot, unknown>;
  const slots = Object.keys(source);
  const state = normalizePvpFortressState(pvpState, {
    slots,
    startingHp: 100
  });
  const castleHpBySlot: Record<PvpSlot, number> = { ...state.castleHpBySlot };
  const resultBySlot: Record<PvpSlot, PvpFortressRoundResultBase> = {};
  const lastOpponents: Record<PvpSlot, PvpSlot | null> = { ...state.lastOpponents };
  const reports = (state.reportByPairId && typeof state.reportByPairId === "object" ? state.reportByPairId : {}) as Record<string, unknown>;

  state.currentMatchups.forEach((matchup) => {
    const report = reports?.[matchup.pairId];
    if (!report) return;

    if (matchup.type === "ghost") {
      const fighterSlot = matchup.fighterSlot;
      lastOpponents[fighterSlot] = matchup.ghostOwnerSlot;
      if ((report as { result?: { winnerSide?: unknown } } | null)?.result?.winnerSide === "RIGHT") {
        const damage = Math.max(0, Math.floor(((report as { result?: { rightAlive?: unknown } } | null)?.result?.rightAlive as number | undefined) ?? 0));
        applyCombatOutcomeToCastle(castleHpBySlot, fighterSlot, damage);
        resultBySlot[fighterSlot] = buildLocalRoundResult(report, damage);
      } else {
        resultBySlot[fighterSlot] = buildLocalRoundResult(report, 0);
        if (resultBySlot[fighterSlot].winnerSide === "LEFT") {
          resultBySlot[fighterSlot].goldBase = PVP_FORTRESS_WIN_GOLD;
          resultBySlot[fighterSlot].goldDelta = PVP_FORTRESS_WIN_GOLD;
        }
      }
      return;
    }

    const slotA = matchup.slotA;
    const slotB = matchup.slotB;
    lastOpponents[slotA] = slotB;
    lastOpponents[slotB] = slotA;
    const winnerSide: PvpWinnerSide = ((report as { result?: { winnerSide?: unknown } } | null)?.result?.winnerSide as PvpWinnerSide | undefined) ?? "DRAW";

    if (winnerSide === "DRAW") {
      resultBySlot[slotA] = buildLocalRoundResult(report, 0);
      resultBySlot[slotB] = buildMirroredRoundResult(report, "DRAW", 0);
      return;
    }

    if ((report as { slot?: unknown } | null)?.slot === slotA) {
      if (winnerSide === "LEFT") {
        const damageToB = Math.max(0, Math.floor(((report as { result?: { leftAlive?: unknown } } | null)?.result?.leftAlive as number | undefined) ?? 0));
        applyCombatOutcomeToCastle(castleHpBySlot, slotB, damageToB);
        resultBySlot[slotA] = buildLocalRoundResult(report, 0);
        resultBySlot[slotA].goldBase = PVP_FORTRESS_WIN_GOLD;
        resultBySlot[slotA].goldDelta = PVP_FORTRESS_WIN_GOLD;
        resultBySlot[slotB] = buildMirroredRoundResult(report, "RIGHT", damageToB);
      } else {
        const damageToA = Math.max(0, Math.floor(((report as { result?: { rightAlive?: unknown } } | null)?.result?.rightAlive as number | undefined) ?? 0));
        applyCombatOutcomeToCastle(castleHpBySlot, slotA, damageToA);
        resultBySlot[slotA] = buildLocalRoundResult(report, damageToA);
        resultBySlot[slotB] = buildMirroredRoundResult(report, "LEFT", 0);
        resultBySlot[slotB].goldBase = PVP_FORTRESS_WIN_GOLD;
        resultBySlot[slotB].goldDelta = PVP_FORTRESS_WIN_GOLD;
      }
      return;
    }

    if (winnerSide === "LEFT") {
      const damageToA = Math.max(0, Math.floor(((report as { result?: { rightAlive?: unknown } } | null)?.result?.rightAlive as number | undefined) ?? 0));
      applyCombatOutcomeToCastle(castleHpBySlot, slotA, damageToA);
      resultBySlot[slotB] = buildLocalRoundResult(report, 0);
      resultBySlot[slotB].goldBase = PVP_FORTRESS_WIN_GOLD;
      resultBySlot[slotB].goldDelta = PVP_FORTRESS_WIN_GOLD;
      resultBySlot[slotA] = buildMirroredRoundResult(report, "RIGHT", damageToA);
      return;
    }

    const damageToB = Math.max(0, Math.floor(((report as { result?: { leftAlive?: unknown } } | null)?.result?.leftAlive as number | undefined) ?? 0));
    applyCombatOutcomeToCastle(castleHpBySlot, slotB, damageToB);
    resultBySlot[slotB] = buildLocalRoundResult(report, damageToB);
    resultBySlot[slotA] = buildMirroredRoundResult(report, "LEFT", 0);
    resultBySlot[slotA].goldBase = PVP_FORTRESS_WIN_GOLD;
    resultBySlot[slotA].goldDelta = PVP_FORTRESS_WIN_GOLD;
  });

  const aliveSlots: PvpSlot[] = state.aliveSlots.filter((slot) => (castleHpBySlot[slot] ?? 0) > 0);
  const eliminatedSlots: PvpSlot[] = Object.keys(castleHpBySlot).filter((slot) => !aliveSlots.includes(slot as PvpSlot)) as PvpSlot[];
  const championSlot: PvpSlot | null = aliveSlots.length === 1 ? aliveSlots[0] : null;
  Object.entries(resultBySlot).forEach(([slot, result]) => {
    result.fortressHpAfter = castleHpBySlot[slot as PvpSlot] ?? 0;
    if (championSlot) {
      result.matchEnded = true;
      result.winnerSlot = championSlot;
    }
  });

  const readyBySlot: Record<PvpSlot, boolean> = { ...state.readyBySlot };
  Object.keys(readyBySlot).forEach((slot) => {
    readyBySlot[slot as PvpSlot] = false;
  });

  const nextState: PvpFortressState = {
    ...state,
    phase: championSlot ? "finished" : "planning",
    round: championSlot ? state.round : state.round + 1,
    readyBySlot,
    castleHpBySlot,
    aliveSlots,
    eliminatedSlots,
    currentMatchups: [],
    expectedPairIds: [],
    reportByPairId: {},
    lastOpponents,
    championSlot,
    revision: state.revision + 1
  };

  return {
    kind: PVP_FORTRESS_RESOLUTION_KIND,
    resultBySlot,
    pvpState: nextState
  };
}
