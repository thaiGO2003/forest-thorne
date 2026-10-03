// Persistent Fortress route graph + service formulas (spec A20, A117). Pure gameplay data; no rendering.
import { NORMAL_UNITS } from "../content/catalog";

export type FortressNodeType = "battle" | "elite" | "boss" | "shop" | "pharmacy" | "beast_den" | "blacksmith";

export interface FortressNode {
  id: string;
  type: FortressNodeType;
  layer: number;
  index: number;
  next: string[];
}

export interface FortressGraph {
  actIndex: number;
  layers: FortressNode[][];
}

export interface PharmacyServiceResult {
  kind: "pharmacy";
  optionId: "restore" | "stimulant" | "supplies" | "skip";
  hpDelta: number;
  goldDelta: number;
  xpDelta: number;
  levelsGained: number;
}

export interface BeastDenServiceResult {
  kind: "beast_den";
  baseId: string;
  uid: string;
}

export type BlacksmithServiceId = "craft" | "upgrade" | "temper";

export const isBlacksmithServiceId = (value: unknown): value is BlacksmithServiceId =>
  value === "craft" || value === "upgrade" || value === "temper";

export interface BlacksmithServiceResult {
  kind: "blacksmith";
  forgeTier: number;
  serviceId?: BlacksmithServiceId;
}

export type FortressServiceResult = PharmacyServiceResult | BeastDenServiceResult | BlacksmithServiceResult;

export interface FortressPendingNode {
  nodeId: string;
  type: FortressNodeType;
  serviceOffers?: string[];
  serviceResult?: FortressServiceResult;
}

export interface FortressState {
  graphSeed: number;
  actIndex: number;
  stepIndex: number;
  currentNodeId: string | null;
  visitedNodeIds: string[];
  pendingNode: FortressPendingNode | null;
  graph: FortressGraph;
}

const LAYER_TYPES: readonly (readonly FortressNodeType[])[] = [
  ["battle", "shop", "beast_den"],
  ["battle", "pharmacy", "blacksmith"],
  ["battle", "battle", "shop"],
  ["elite", "pharmacy", "blacksmith"],
  ["battle", "beast_den", "shop"],
  ["elite", "battle", "blacksmith"],
  ["boss"],
];

export const FORTRESS_BUDGET_MULTIPLIER: Readonly<Record<FortressNodeType, number>> = {
  battle: 1,
  shop: 1,
  pharmacy: 1,
  beast_den: 1,
  blacksmith: 1.05,
  elite: 1.25,
  boss: 1.6,
};

function mix32(seed: number): number {
  let x = seed >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15; x = Math.imul(x, 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
}

export function fortressRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(values: readonly T[], rng: () => number): T[] {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function generateFortressGraph(graphSeed: number, actIndex = 1): FortressGraph {
  const act = Math.max(1, Math.floor(actIndex));
  const rng = fortressRng(mix32((graphSeed >>> 0) ^ Math.imul(act, 0x9e3779b1)));
  const layers: FortressNode[][] = LAYER_TYPES.map((types, layerIndex) => {
    const ordered = types.length > 1 ? shuffle(types, rng) : [...types];
    return ordered.map((type, index) => ({
      id: `act${act}-layer${layerIndex + 1}-node${index + 1}`,
      type,
      layer: layerIndex + 1,
      index,
      next: [],
    }));
  });
  for (let i = 0; i < layers.length - 1; i++) {
    const next = layers[i + 1]!.map((node) => node.id);
    for (const node of layers[i]!) node.next = [...next];
  }
  return { actIndex: act, layers };
}

export function createFortressState(seed: number): FortressState {
  const graphSeed = seed >>> 0;
  return {
    graphSeed,
    actIndex: 1,
    stepIndex: 0,
    currentNodeId: null,
    visitedNodeIds: [],
    pendingNode: null,
    graph: generateFortressGraph(graphSeed, 1),
  };
}

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

function normalizeServiceResult(value: unknown): FortressServiceResult | undefined {
  const raw = record(value);
  if (!raw || typeof raw.kind !== "string") return undefined;
  if (raw.kind === "pharmacy") {
    const optionId = raw.optionId;
    if (optionId !== "restore" && optionId !== "stimulant" && optionId !== "supplies" && optionId !== "skip") return undefined;
    return {
      kind: "pharmacy",
      optionId,
      hpDelta: Math.max(0, Math.floor(Number(raw.hpDelta) || 0)),
      goldDelta: Math.max(0, Math.floor(Number(raw.goldDelta) || 0)),
      xpDelta: Math.max(0, Math.floor(Number(raw.xpDelta) || 0)),
      levelsGained: Math.max(0, Math.floor(Number(raw.levelsGained) || 0)),
    };
  }
  if (raw.kind === "beast_den" && typeof raw.baseId === "string" && typeof raw.uid === "string") {
    return { kind: "beast_den", baseId: raw.baseId, uid: raw.uid };
  }
  if (raw.kind === "blacksmith") {
    const serviceId = raw.serviceId;
    return {
      kind: "blacksmith",
      forgeTier: Math.min(5, Math.max(1, Math.floor(Number(raw.forgeTier) || 1))),
      serviceId: isBlacksmithServiceId(serviceId) ? serviceId : undefined,
    };
  }
  return undefined;
}

/** Save hydration keeps canonical progress but regenerates graph topology from seed+act. */
export function normalizeFortressState(value: unknown, fallbackSeed: number): FortressState {
  const raw = record(value);
  if (!raw) return createFortressState(fallbackSeed);
  const graphSeed = Number.isFinite(Number(raw.graphSeed)) ? Number(raw.graphSeed) >>> 0 : fallbackSeed >>> 0;
  const actIndex = Math.max(1, Math.floor(Number(raw.actIndex) || 1));
  const graph = generateFortressGraph(graphSeed, actIndex);
  const all = graph.layers.flat();
  const ids = new Set(all.map((node) => node.id));
  const visitedNodeIds = Array.isArray(raw.visitedNodeIds)
    ? raw.visitedNodeIds.filter((id): id is string => typeof id === "string" && ids.has(id))
    : [];
  const stepIndex = Math.min(7, Math.max(0, Math.floor(Number(raw.stepIndex) || 0)));
  const currentNodeId = typeof raw.currentNodeId === "string" && ids.has(raw.currentNodeId) ? raw.currentNodeId : null;
  let pendingNode: FortressPendingNode | null = null;
  const pending = record(raw.pendingNode);
  if (pending && typeof pending.nodeId === "string") {
    const node = all.find((candidate) => candidate.id === pending.nodeId);
    if (node) {
      pendingNode = {
        nodeId: node.id,
        type: node.type,
        serviceOffers: Array.isArray(pending.serviceOffers)
          ? pending.serviceOffers.filter((id): id is string => typeof id === "string") : undefined,
        serviceResult: normalizeServiceResult(pending.serviceResult),
      };
    }
  }
  return { graphSeed, actIndex, stepIndex, currentNodeId, visitedNodeIds, pendingNode, graph };
}

export function fortressNode(state: FortressState, nodeId: string): FortressNode | null {
  return state.graph.layers.flat().find((node) => node.id === nodeId) ?? null;
}

/** Select exactly one legal node in the next layer; pending selection latches until completed. */
export function selectFortressNode(state: FortressState, nodeId: string): FortressPendingNode | null {
  if (state.pendingNode) return null;
  const node = fortressNode(state, nodeId);
  if (!node || node.layer !== state.stepIndex + 1) return null;
  if (state.currentNodeId) {
    const current = fortressNode(state, state.currentNodeId);
    if (!current?.next.includes(nodeId)) return null;
  }
  if (state.visitedNodeIds.includes(nodeId)) return null;
  state.stepIndex = node.layer;
  state.currentNodeId = node.id;
  state.visitedNodeIds.push(node.id);
  state.pendingNode = { nodeId: node.id, type: node.type };
  return state.pendingNode;
}

/** Clears the selected node once its service/battle has resolved; finishing layer 7 starts the next act. */
export function completeFortressNode(state: FortressState): boolean {
  if (!state.pendingNode) return false;
  state.pendingNode = null;
  if (state.stepIndex >= LAYER_TYPES.length) {
    state.actIndex++;
    state.stepIndex = 0;
    state.currentNodeId = null;
    state.visitedNodeIds = [];
    state.graph = generateFortressGraph(state.graphSeed, state.actIndex);
  }
  return true;
}

export interface PharmacyOption {
  id: "restore" | "stimulant" | "supplies";
  kind: "heal" | "heal_xp" | "heal_gold";
  hpDelta: number;
  xpDelta: number;
  goldDelta: number;
}

export function pharmacyOptions(round: number, actIndex: number): PharmacyOption[] {
  const r = Math.max(1, Math.floor(round));
  const act = Math.max(1, Math.floor(actIndex));
  const base = 10 + Math.max(0, Math.floor((r - 1) / 2)) * 3 + Math.max(0, act - 1) * 4;
  return [
    { id: "restore", kind: "heal", hpDelta: base + 16, xpDelta: 0, goldDelta: 0 },
    {
      id: "stimulant", kind: "heal_xp", hpDelta: base + 8,
      xpDelta: Math.max(2, 2 + Math.floor((r - 1) / 4) + Math.floor((act - 1) / 2)), goldDelta: 0,
    },
    {
      id: "supplies", kind: "heal_gold", hpDelta: base + 4, xpDelta: 0,
      goldDelta: Math.max(2, 2 + Math.floor((r - 1) / 5) + Math.floor((act - 1) / 2)),
    },
  ];
}

export function beastDenMaxTier(round: number, actIndex: number): number {
  return Math.min(5, Math.max(1, 1 + Math.floor((Math.max(1, round) - 1) / 4) + Math.floor((Math.max(1, actIndex) - 1) / 2)));
}

export function beastDenOffers(round: number, actIndex: number, rng: () => number): string[] {
  const maxTier = beastDenMaxTier(round, actIndex);
  const pool = NORMAL_UNITS.filter((unit) => unit.tier <= maxTier).map((unit) => unit.id).sort();
  const out: string[] = [];
  while (out.length < 3 && pool.length) {
    const index = Math.min(pool.length - 1, Math.floor(Math.max(0, Math.min(0.999999999, rng())) * pool.length));
    out.push(pool.splice(index, 1)[0]!);
  }
  return out;
}

export function blacksmithForgeTier(round: number, actIndex: number): number {
  return Math.min(5, 1 + Math.floor((Math.max(1, round) - 1) / 4) + Math.floor((Math.max(1, actIndex) - 1) / 2));
}
