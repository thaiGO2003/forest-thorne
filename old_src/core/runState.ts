import { UNIT_BY_ID } from "../data/unitCatalog.js";
import { createUnitUid } from "./gameUtils.js";
import { DEFAULT_LOSE_CONDITION, normalizeLoseCondition, type LoseConditionType } from "./gameRules.js";
import { getCoopPlayerCapacity, getCoopPlayerSlots, isCoopAiMode, normalizeAiMode } from "./aiModes.js";
import { normalizeOwnedUnitTraits } from "./variantTraits.js";
import { normalizePlayerSlot } from "./boardProfiles.js";
import { createDefaultFortressMeta, normalizeFortressMeta } from "./fortressMode.js";

type UnitBase = (typeof UNIT_BY_ID)[string];
interface FortressMeta {
  actIndex: number;
  stepIndex: number;
  mapSeed: number;
  graph: {
    actIndex: number;
    seed: number;
    nodes: Array<{ id: string; type: string; layer: number; lane: number; nextIds: string[] }>;
    layers: Array<{ index: number; nodeIds: string[] }>;
  } | null;
  currentNodeId: string | null;
  visitedNodeIds: string[];
  pendingNodeType: string | null;
  pendingNodePayload: UnknownRecord | null;
}
type UnknownRecord = Record<string, unknown>;

interface OwnedUnitOptions {
  skillVariant?: unknown;
  variantTraits?: unknown;
  variantSeeds?: unknown;
  variantSeed?: unknown;
  rollTrait?: boolean;
  randomFn?: () => number;
}

export interface OwnedUnit {
  uid: string;
  baseId: string;
  star: number;
  base: UnitBase;
  equips: string[];
  variantTraits: string[];
  variantSeeds: number[];
}

interface OwnedUnitLike {
  uid?: unknown;
  baseId?: unknown;
  star?: unknown;
  equips?: unknown;
  variantTraits?: unknown;
  variantSeeds?: unknown;
}

interface CreativeSandboxUnit extends OwnedUnit {
  side: "LEFT" | "RIGHT";
  row: number;
  col: number;
  sandbox: true;
  sourceUid: string | null;
}

interface CreativeSandboxUnitLike extends OwnedUnitLike {
  side?: unknown;
  row?: unknown;
  col?: unknown;
  sourceUid?: unknown;
}

interface TutorialState {
  completed: boolean;
  currentRound: number;
  shopVariant: number;
  preparedRounds: number[];
  roundEventCounts: UnknownRecord;
  markers: UnknownRecord;
}

interface ShopOffer {
  slot: number;
  baseId: string;
}

type OwnedBoard = Array<Array<OwnedUnit | null>>;

export interface PlayerState extends UnknownRecord {
  hp: number;
  gold: number;
  xp: number;
  level: number;
  round: number;
  gameMode: string;
  winStreak: number;
  loseStreak: number;
  shopLocked: boolean;
  augments: unknown[];
  augmentRoundsTaken: unknown[];
  augmentBonuses: UnknownRecord;
  deployCapBonus: number;
  benchBonus: number;
  benchUpgradeLevel: number;
  inventoryUpgradeLevel: number;
  interestCapBonus: number;
  interestRateBonus: number;
  winGoldBonus: number;
  rollCostDelta: number;
  xpCostDelta: number;
  startingRage: number;
  startingShield: number;
  teamAtkPct: number;
  teamMatkPct: number;
  teamDefPct: number;
  teamMdefPct: number;
  teamHpPct: number;
  lifestealPct: number;
  hpLossReduce: number;
  rageGainPct: number;
  extraClassCount: number;
  extraTribeCount: number;
  inventoryBonus: number;
  craftTableLevel: number;
  teamCritPct: number;
  fixedIncome: number;
  unequipDiscount: number;
  speedLevel: number;
  techLevels: UnknownRecord;
  itemBag: unknown[];
  craftedItems: unknown[];
  enemyPreview: unknown[];
  enemyPreviewRound: number;
  enemyBudget: number;
  creativeSandboxUnits: CreativeSandboxUnit[];
  fortressMeta: FortressMeta;
  tutorialSkipped: boolean;
  tutorialState: TutorialState;
  loseCondition: LoseConditionType;
  board: OwnedBoard;
  bench: OwnedUnit[];
  shop: Array<ShopOffer | null>;
}

interface CoopSharedState extends UnknownRecord {
  round: number;
}

type CoopPlayersStateMap = Record<string, PlayerState>;

export interface SoloRunState {
  aiMode: string;
  audioEnabled: boolean;
  player: PlayerState;
  players?: undefined;
}

export interface CoopRunState {
  aiMode: string;
  audioEnabled: boolean;
  roomCode: string;
  localSlot: string;
  hostSlot: string;
  coopDifficulty: string;
  playerCapacity: number;
  shared: CoopSharedState;
  players: CoopPlayersStateMap;
  player?: undefined;
}

export type RunState = SoloRunState | CoopRunState;

function readObject(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function isInteger(value: unknown): value is number {
  return Number.isInteger(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

const PLAYER_TEMPLATE = {
  hp: 3,
  gold: 10,
  xp: 0,
  level: 1,
  round: 1,
  gameMode: "EndlessPvEClassic",
  winStreak: 0,
  loseStreak: 0,
  shopLocked: false,
  augments: [] as unknown[],
  augmentRoundsTaken: [] as unknown[],
  augmentBonuses: {} as UnknownRecord,
  deployCapBonus: 0,
  benchBonus: 0,
  benchUpgradeLevel: 0,
  inventoryUpgradeLevel: 0,
  interestCapBonus: 0,
  interestRateBonus: 0,
  winGoldBonus: 0,
  rollCostDelta: 0,
  xpCostDelta: 0,
  startingRage: 0,
  startingShield: 0,
  teamAtkPct: 0,
  teamMatkPct: 0,
  teamDefPct: 0,
  teamMdefPct: 0,
  teamHpPct: 0,
  lifestealPct: 0,
  hpLossReduce: 0,
  rageGainPct: 0,
  extraClassCount: 0,
  extraTribeCount: 0,
  inventoryBonus: 0,
  craftTableLevel: 0,
  teamCritPct: 0,
  fixedIncome: 0,
  unequipDiscount: 0,
  speedLevel: 0,
  techLevels: {} as UnknownRecord,
  itemBag: [] as unknown[],
  craftedItems: [] as unknown[],
  enemyPreview: [] as unknown[],
  enemyPreviewRound: 0,
  enemyBudget: 0,
  creativeSandboxUnits: [] as CreativeSandboxUnit[],
  fortressMeta: null,
  tutorialSkipped: false,
  tutorialState: null,
  loseCondition: DEFAULT_LOSE_CONDITION
};

export function createDefaultTutorialState(): TutorialState {
  return {
    completed: false,
    currentRound: 0,
    shopVariant: 0,
    preparedRounds: [],
    roundEventCounts: {},
    markers: {}
  };
}

export function createEmptyBoard(rows = 5, cols = 5): OwnedBoard {
  return Array.from({ length: rows }, () => Array.from<OwnedUnit | null>({ length: cols }).fill(null));
}

export function createOwnedUnit(baseId: string, star = 1, uid: string | null = null, equips: unknown = [], options: OwnedUnitOptions = {}): OwnedUnit | null {
  const base = UNIT_BY_ID[baseId];
  if (!base) return null;
  const ownedUnit = {
    uid: uid ?? createUnitUid(),
    baseId,
    star,
    base,
    equips: Array.isArray(equips) ? equips.filter((value): value is string => typeof value === "string") : []
  };
  const traitPayload = normalizeOwnedUnitTraits({
    ...ownedUnit,
    skillVariant: options.skillVariant,
    variantTraits: options.variantTraits,
    variantSeeds: options.variantSeeds,
    variantSeed: options.variantSeed
  }, base, {
    rollTrait: options.rollTrait !== false,
    randomFn: options.randomFn
  });
  return {
    ...ownedUnit,
    variantTraits: traitPayload.variantTraits,
    variantSeeds: traitPayload.variantSeeds
  };
}

function serializeOwnedUnit(unit: OwnedUnitLike | null | undefined) {
  if (!unit) return null;
  return {
    uid: unit.uid,
    baseId: unit.baseId,
    star: unit.star,
    equips: Array.isArray(unit.equips) ? unit.equips.filter((value): value is string => typeof value === "string") : [],
    variantTraits: Array.isArray(unit.variantTraits) ? unit.variantTraits.filter((value): value is string => typeof value === "string") : [],
    variantSeeds: Array.isArray(unit.variantSeeds) ? unit.variantSeeds.filter(isInteger) : []
  };
}

function serializeCreativeSandboxUnit(unit: CreativeSandboxUnitLike | null | undefined) {
  if (!unit) return null;
  const owned = serializeOwnedUnit(unit);
  if (!owned) return null;
  return {
    ...owned,
    side: unit.side === "RIGHT" ? "RIGHT" : "LEFT",
    row: isInteger(unit.row) ? unit.row : 0,
    col: isInteger(unit.col) ? unit.col : 0,
    sandbox: true,
    sourceUid: typeof unit.sourceUid === "string" ? unit.sourceUid : null
  };
}

function hydrateOwnedUnit(raw: unknown): OwnedUnit | null {
  const source = readObject(raw);
  const baseId = readString(source?.baseId, "");
  if (!UNIT_BY_ID[baseId]) return null;
  return createOwnedUnit(
    baseId,
    readNumber(source?.star, 1),
    typeof source?.uid === "string" ? source.uid : null,
    source?.equips ?? [],
    {
      variantTraits: source?.variantTraits,
      variantSeeds: source?.variantSeeds,
      skillVariant: source?.skillVariant,
      variantSeed: source?.variantSeed,
      rollTrait: false
    }
  );
}

function hydrateCreativeSandboxUnit(raw: unknown): CreativeSandboxUnit | null {
  const source = readObject(raw);
  const owned = hydrateOwnedUnit(source);
  if (!owned) return null;
  return {
    ...owned,
    side: source?.side === "RIGHT" ? "RIGHT" : "LEFT",
    row: isInteger(source?.row) ? source.row : 0,
    col: isInteger(source?.col) ? source.col : 0,
    sandbox: true,
    sourceUid: typeof source?.sourceUid === "string" ? source.sourceUid : null
  };
}

function createDefaultPlayerState(): PlayerState {
  return {
    ...PLAYER_TEMPLATE,
    augments: [],
    augmentRoundsTaken: [],
    itemBag: [],
    craftedItems: [],
    enemyPreview: [],
    creativeSandboxUnits: [],
    fortressMeta: createDefaultFortressMeta(),
    tutorialState: createDefaultTutorialState(),
    board: createEmptyBoard(),
    bench: [],
    shop: []
  };
}

function serializePlayerState(player: unknown): UnknownRecord {
  const source = readObject(player);
  const rawBoard = source?.board;
  const board = Array.isArray(rawBoard)
    ? rawBoard.map((rawRow) => Array.isArray(rawRow)
      ? rawRow.map((unit) => serializeOwnedUnit(readObject(unit)))
      : [])
    : createEmptyBoard().map((row) => row.map((unit) => serializeOwnedUnit(unit)));

  const rawBench = source?.bench;
  const rawCreativeUnits = source?.creativeSandboxUnits;
  const rawShop = source?.shop;
  return {
    ...(source ?? {}),
    loseCondition: normalizeLoseCondition(source?.loseCondition),
    board,
    bench: Array.isArray(rawBench)
      ? rawBench.map((unit) => serializeOwnedUnit(readObject(unit)))
      : [],
    creativeSandboxUnits: Array.isArray(rawCreativeUnits)
      ? rawCreativeUnits
        .map((unit) => serializeCreativeSandboxUnit(readObject(unit)))
        .filter(isPresent)
      : [],
    fortressMeta: normalizeFortressMeta(readObject(source?.fortressMeta), {
      round: isInteger(source?.round) ? source.round : 1
    }),
    shop: Array.isArray(rawShop)
      ? rawShop.map((rawOffer) => {
        const offer = readObject(rawOffer);
        return offer ? { slot: offer.slot, baseId: offer.baseId } : null;
      })
      : []
  };
}

function hydratePlayerState(raw: unknown): PlayerState {
  const source = readObject(raw) ?? {};
  const defaults = createDefaultPlayerState();

  const board = createEmptyBoard();
  const rawBoard = source.board;
  if (Array.isArray(rawBoard)) {
    for (let rowIndex = 0; rowIndex < 5; rowIndex += 1) {
      const rawRow = rawBoard[rowIndex];
      for (let colIndex = 0; colIndex < 5; colIndex += 1) {
        board[rowIndex][colIndex] = hydrateOwnedUnit(Array.isArray(rawRow) ? rawRow[colIndex] : null);
      }
    }
  }

  const bench = Array.isArray(source.bench)
    ? source.bench.map(hydrateOwnedUnit).filter(isPresent)
    : [];
  const creativeSandboxUnits = Array.isArray(source.creativeSandboxUnits)
    ? source.creativeSandboxUnits.map(hydrateCreativeSandboxUnit).filter(isPresent)
    : [];
  const round = Math.max(1, readNumber(source.round, defaults.round));
  const fortressMeta = normalizeFortressMeta(readObject(source.fortressMeta), { round });
  const shop = Array.isArray(source.shop)
    ? source.shop.map((rawOffer, index): ShopOffer | null => {
      const offer = readObject(rawOffer);
      const baseId = readString(offer?.baseId, "");
      if (!offer || !UNIT_BY_ID[baseId]) return null;
      return { slot: isInteger(offer.slot) ? offer.slot : index, baseId };
    })
    : [];

  const tutorialSource = readObject(source.tutorialState) ?? {};
  const tutorialState: TutorialState = {
    ...createDefaultTutorialState(),
    ...tutorialSource,
    completed: tutorialSource.completed === true,
    currentRound: isInteger(tutorialSource.currentRound) ? Math.max(0, tutorialSource.currentRound) : 0,
    shopVariant: isInteger(tutorialSource.shopVariant) ? Math.max(0, tutorialSource.shopVariant) : 0,
    preparedRounds: Array.isArray(tutorialSource.preparedRounds)
      ? tutorialSource.preparedRounds.filter((preparedRound): preparedRound is number => isInteger(preparedRound) && preparedRound > 0)
      : [],
    roundEventCounts: readObject(tutorialSource.roundEventCounts) ?? {},
    markers: readObject(tutorialSource.markers) ?? {}
  };

  return {
    ...defaults,
    ...source,
    hp: Math.max(0, readNumber(source.hp, defaults.hp)),
    gold: Math.max(0, readNumber(source.gold, defaults.gold)),
    xp: readNumber(source.xp, defaults.xp),
    level: Math.max(1, Math.min(25, readNumber(source.level, defaults.level))),
    round,
    gameMode: readString(source.gameMode, defaults.gameMode),
    winStreak: readNumber(source.winStreak, defaults.winStreak),
    loseStreak: readNumber(source.loseStreak, defaults.loseStreak),
    shopLocked: readBoolean(source.shopLocked, defaults.shopLocked),
    augments: Array.isArray(source.augments) ? source.augments : [],
    augmentRoundsTaken: Array.isArray(source.augmentRoundsTaken) ? source.augmentRoundsTaken : [],
    augmentBonuses: readObject(source.augmentBonuses) ?? {},
    deployCapBonus: readNumber(source.deployCapBonus, defaults.deployCapBonus),
    benchBonus: readNumber(source.benchBonus, defaults.benchBonus),
    benchUpgradeLevel: isFiniteNumber(source.benchUpgradeLevel)
      ? Math.max(0, Math.min(1, Math.floor(source.benchUpgradeLevel)))
      : 0,
    inventoryUpgradeLevel: isFiniteNumber(source.inventoryUpgradeLevel)
      ? Math.max(0, Math.min(1, Math.floor(source.inventoryUpgradeLevel)))
      : 0,
    interestCapBonus: readNumber(source.interestCapBonus, defaults.interestCapBonus),
    interestRateBonus: readNumber(source.interestRateBonus, defaults.interestRateBonus),
    winGoldBonus: readNumber(source.winGoldBonus, defaults.winGoldBonus),
    rollCostDelta: readNumber(source.rollCostDelta, defaults.rollCostDelta),
    xpCostDelta: readNumber(source.xpCostDelta, defaults.xpCostDelta),
    startingRage: readNumber(source.startingRage, defaults.startingRage),
    startingShield: readNumber(source.startingShield, defaults.startingShield),
    teamAtkPct: readNumber(source.teamAtkPct, defaults.teamAtkPct),
    teamMatkPct: readNumber(source.teamMatkPct, defaults.teamMatkPct),
    teamDefPct: readNumber(source.teamDefPct, defaults.teamDefPct),
    teamMdefPct: readNumber(source.teamMdefPct, defaults.teamMdefPct),
    teamHpPct: readNumber(source.teamHpPct, defaults.teamHpPct),
    lifestealPct: readNumber(source.lifestealPct, defaults.lifestealPct),
    hpLossReduce: readNumber(source.hpLossReduce, defaults.hpLossReduce),
    rageGainPct: readNumber(source.rageGainPct, defaults.rageGainPct),
    extraClassCount: readNumber(source.extraClassCount, defaults.extraClassCount),
    extraTribeCount: readNumber(source.extraTribeCount, defaults.extraTribeCount),
    inventoryBonus: readNumber(source.inventoryBonus, defaults.inventoryBonus),
    craftTableLevel: isFiniteNumber(source.craftTableLevel)
      ? Math.max(0, Math.min(3, Math.floor(source.craftTableLevel)))
      : 0,
    teamCritPct: readNumber(source.teamCritPct, defaults.teamCritPct),
    fixedIncome: readNumber(source.fixedIncome, defaults.fixedIncome),
    unequipDiscount: readNumber(source.unequipDiscount, defaults.unequipDiscount),
    speedLevel: readNumber(source.speedLevel, defaults.speedLevel),
    techLevels: readObject(source.techLevels) ?? {},
    itemBag: Array.isArray(source.itemBag) ? source.itemBag : [],
    craftedItems: Array.isArray(source.craftedItems) ? source.craftedItems : [],
    enemyPreview: Array.isArray(source.enemyPreview) ? source.enemyPreview : [],
    enemyPreviewRound: isInteger(source.enemyPreviewRound) ? source.enemyPreviewRound : 0,
    enemyBudget: isFiniteNumber(source.enemyBudget) ? source.enemyBudget : 0,
    creativeSandboxUnits,
    fortressMeta,
    tutorialSkipped: source.tutorialSkipped === true,
    tutorialState,
    loseCondition: normalizeLoseCondition(source.loseCondition),
    board,
    bench,
    shop
  };
}

function createDefaultCoopSharedState(): CoopSharedState {
  return {
    round: 1
  };
}

function normalizeCoopSlot(slot: unknown, aiMode: string, fallback = "P1"): string {
  const allowedSlots = getCoopPlayerSlots(aiMode);
  const normalized = normalizePlayerSlot(readString(slot, "P1"));
  if (allowedSlots.includes(normalized)) return normalized;
  const normalizedFallback = normalizePlayerSlot(fallback);
  return allowedSlots.includes(normalizedFallback) ? normalizedFallback : "P1";
}

function createCoopPlayersStateMap(aiMode = "COOP_MEDIUM"): CoopPlayersStateMap {
  const players: CoopPlayersStateMap = {};
  getCoopPlayerSlots(aiMode).forEach((slot) => {
    players[slot] = createDefaultCoopPlayerState();
  });
  return players;
}

function serializeCoopPlayersStateMap(players: UnknownRecord | null, aiMode: string): Record<string, UnknownRecord> {
  const serialized: Record<string, UnknownRecord> = {};
  getCoopPlayerSlots(aiMode).forEach((slot) => {
    serialized[slot] = serializePlayerState(players?.[slot]);
  });
  return serialized;
}

function hydrateCoopPlayersStateMap(players: UnknownRecord | null, aiMode: string): CoopPlayersStateMap {
  const hydrated: CoopPlayersStateMap = {};
  getCoopPlayerSlots(aiMode).forEach((slot) => {
    hydrated[slot] = hydratePlayerState(players?.[slot]);
  });
  return hydrated;
}

export function createDefaultRunState(): SoloRunState {
  return {
    aiMode: "TUTORIAL",
    audioEnabled: true,
    player: createDefaultPlayerState()
  };
}

export function createDefaultCoopPlayerState(): PlayerState {
  return createDefaultPlayerState();
}

export function createDefaultCoopRunState(aiMode = "COOP_MEDIUM"): CoopRunState {
  const resolvedAiMode = normalizeAiMode(aiMode, "COOP_MEDIUM");
  return {
    aiMode: resolvedAiMode,
    audioEnabled: true,
    roomCode: "",
    localSlot: "P1",
    hostSlot: "P1",
    coopDifficulty: resolvedAiMode,
    playerCapacity: getCoopPlayerCapacity(resolvedAiMode),
    shared: createDefaultCoopSharedState(),
    players: createCoopPlayersStateMap(resolvedAiMode)
  };
}

export function serializeRunState(state: unknown) {
  const source = readObject(state) ?? {};
  const players = readObject(source.players);
  if (players) {
    const resolvedCoopDifficulty = normalizeAiMode(
      readString(source.coopDifficulty, readString(source.aiMode, "COOP_MEDIUM")),
      "COOP_MEDIUM"
    );
    const rawAiMode = readString(source.aiMode, resolvedCoopDifficulty);
    const resolvedAiMode = isCoopAiMode(rawAiMode)
      ? normalizeAiMode(rawAiMode, resolvedCoopDifficulty)
      : resolvedCoopDifficulty;
    const shared = readObject(source.shared);
    return {
      aiMode: resolvedAiMode,
      audioEnabled: Boolean(source.audioEnabled),
      roomCode: readString(source.roomCode, ""),
      localSlot: normalizeCoopSlot(source.localSlot, resolvedCoopDifficulty),
      hostSlot: normalizeCoopSlot(source.hostSlot, resolvedCoopDifficulty, "P1"),
      coopDifficulty: resolvedCoopDifficulty,
      playerCapacity: getCoopPlayerCapacity(resolvedCoopDifficulty),
      shared: shared ? { ...createDefaultCoopSharedState(), ...shared } : createDefaultCoopSharedState(),
      players: serializeCoopPlayersStateMap(players, resolvedCoopDifficulty)
    };
  }

  return {
    aiMode: normalizeAiMode(readString(source.aiMode, "TUTORIAL"), "TUTORIAL"),
    audioEnabled: Boolean(source.audioEnabled),
    player: serializePlayerState(source.player)
  };
}

export function hydrateRunState(raw: unknown): RunState | null {
  const source = readObject(raw);
  if (!source) return null;
  const players = readObject(source.players);
  if (players) {
    const resolvedCoopDifficulty = normalizeAiMode(
      readString(source.coopDifficulty, readString(source.aiMode, "COOP_MEDIUM")),
      "COOP_MEDIUM"
    );
    const state = createDefaultCoopRunState(resolvedCoopDifficulty);
    const rawAiMode = readString(source.aiMode, resolvedCoopDifficulty);
    state.aiMode = isCoopAiMode(rawAiMode)
      ? normalizeAiMode(rawAiMode, resolvedCoopDifficulty)
      : resolvedCoopDifficulty;
    state.audioEnabled = source.audioEnabled !== false;
    state.roomCode = readString(source.roomCode, "");
    state.localSlot = normalizeCoopSlot(source.localSlot, resolvedCoopDifficulty);
    state.hostSlot = normalizeCoopSlot(source.hostSlot, resolvedCoopDifficulty, "P1");
    state.coopDifficulty = resolvedCoopDifficulty;
    state.playerCapacity = getCoopPlayerCapacity(resolvedCoopDifficulty);
    const shared = readObject(source.shared);
    state.shared = shared
      ? { ...createDefaultCoopSharedState(), ...shared, round: readNumber(shared.round, 1) }
      : createDefaultCoopSharedState();
    state.players = hydrateCoopPlayersStateMap(players, resolvedCoopDifficulty);
    return state;
  }

  if (!readObject(source.player)) return null;
  const state = createDefaultRunState();
  state.aiMode = normalizeAiMode(readString(source.aiMode, "TUTORIAL"), "TUTORIAL");
  state.audioEnabled = source.audioEnabled !== false;
  state.player = hydratePlayerState(source.player);
  return state;
}
