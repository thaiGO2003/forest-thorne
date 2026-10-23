import { UNIT_CATALOG } from "../data/unitCatalog.js";

export const FORTRESS_NODE_TYPES = Object.freeze({
  BATTLE: "battle",
  SHOP: "shop",
  PHARMACY: "pharmacy",
  BEAST_DEN: "beast_den",
  BLACKSMITH: "blacksmith",
  ELITE: "elite",
  BOSS: "boss"
});

type FortressNodeType = (typeof FORTRESS_NODE_TYPES)[keyof typeof FORTRESS_NODE_TYPES];

const FORTRESS_LAYER_TEMPLATES = Object.freeze([
  [FORTRESS_NODE_TYPES.BATTLE, FORTRESS_NODE_TYPES.SHOP, FORTRESS_NODE_TYPES.BEAST_DEN],
  [FORTRESS_NODE_TYPES.BATTLE, FORTRESS_NODE_TYPES.PHARMACY, FORTRESS_NODE_TYPES.BLACKSMITH],
  [FORTRESS_NODE_TYPES.BATTLE, FORTRESS_NODE_TYPES.BATTLE, FORTRESS_NODE_TYPES.SHOP],
  [FORTRESS_NODE_TYPES.ELITE, FORTRESS_NODE_TYPES.PHARMACY, FORTRESS_NODE_TYPES.BLACKSMITH],
  [FORTRESS_NODE_TYPES.BATTLE, FORTRESS_NODE_TYPES.BEAST_DEN, FORTRESS_NODE_TYPES.SHOP],
  [FORTRESS_NODE_TYPES.ELITE, FORTRESS_NODE_TYPES.BATTLE, FORTRESS_NODE_TYPES.BLACKSMITH],
  [FORTRESS_NODE_TYPES.BOSS]
]);

const FORTRESS_NODE_I18N_KEYS: Record<FortressNodeType, string> = {
  [FORTRESS_NODE_TYPES.BATTLE]: "fortress.node.battle",
  [FORTRESS_NODE_TYPES.SHOP]: "fortress.node.shop",
  [FORTRESS_NODE_TYPES.PHARMACY]: "fortress.node.pharmacy",
  [FORTRESS_NODE_TYPES.BEAST_DEN]: "fortress.node.beastDen",
  [FORTRESS_NODE_TYPES.BLACKSMITH]: "fortress.node.blacksmith",
  [FORTRESS_NODE_TYPES.ELITE]: "fortress.node.elite",
  [FORTRESS_NODE_TYPES.BOSS]: "fortress.node.boss"
};

type RandomFn = () => number;

interface FortNode {
  id: string;
  type: FortressNodeType;
  layer: number;
  lane: number;
  nextIds: string[];
}

interface FortLayer {
  index: number;
  nodeIds: string[];
}

interface FortGraph {
  actIndex: number;
  seed: number;
  nodes: FortNode[];
  layers: FortLayer[];
}

interface FortMeta {
  actIndex: number;
  stepIndex: number;
  mapSeed: number;
  graph: FortGraph | null;
  currentNodeId: string | null;
  visitedNodeIds: string[];
  pendingNodeType: string | null;
  pendingNodePayload: Record<string, unknown> | null;
}

type FortRawNode = Record<string, unknown>;
type FortRawLayer = Record<string, unknown>;
type FortRawGraph = Record<string, unknown>;

function createSeededRandom(seed: number = 1): RandomFn {
  let state = Math.abs(Math.floor(seed)) % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function shuffle(values: string[], randomFn: RandomFn): string[] {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(randomFn() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function sampleUnique(values: string[], count: number, randomFn: RandomFn): string[] {
  if (!Array.isArray(values) || values.length === 0 || count <= 0) return [];
  return shuffle(values, randomFn).slice(0, Math.min(count, values.length));
}

function createFortressSeed(actIndex: number, round: number): number {
  return Math.max(1, actIndex * 997 + round * 131);
}

function readInt(value: unknown, fallback: number): number {
  return Number.isInteger(value) ? (value as number) : fallback;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
}

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function normalizeNode(raw: FortRawNode): FortNode | null {
  if (!raw || typeof raw !== "object") return null;
  const typeValue = raw.type;
  return {
    id: readString(raw.id, ""),
    type: (typeof typeValue === "string" ? typeValue : FORTRESS_NODE_TYPES.BATTLE) as FortressNodeType,
    layer: readInt(raw.layer, 0),
    lane: readInt(raw.lane, 0),
    nextIds: readStringArray(raw.nextIds)
  };
}

function normalizeGraph(raw: FortRawGraph): FortGraph | null {
  if (!raw || typeof raw !== "object") return null;
  const nodes = Array.isArray(raw.nodes)
    ? raw.nodes.map((node: FortRawNode) => normalizeNode(node)).filter((n): n is FortNode => n !== null)
    : [];
  const layers = Array.isArray(raw.layers)
    ? raw.layers.map((layer: FortRawLayer, index: number): FortLayer => ({
        index: readInt(layer?.index, index),
        nodeIds: readStringArray(layer?.nodeIds)
      }))
    : [];
  if (!nodes.length || !layers.length) return null;
  return {
    actIndex: readInt(raw.actIndex, 1),
    seed: readInt(raw.seed, createFortressSeed(1, 1)),
    nodes,
    layers
  };
}

function buildBeastDenPayload(round: number, actIndex: number, randomFn: RandomFn): Record<string, unknown> {
  const maxTier = Math.min(5, Math.max(1, 1 + Math.floor((round - 1) / 4) + Math.floor((actIndex - 1) / 2)));
  const pool = UNIT_CATALOG
    .filter((unit) => Boolean(unit?.id) && Number(unit?.tier) <= maxTier)
    .map((unit) => String(unit.id));
  return {
    recruitOptions: sampleUnique(pool, 3, randomFn),
    maxTier
  };
}

function buildPharmacyPayload(round: number, actIndex: number): Record<string, unknown> {
  const base = 10 + Math.max(0, Math.floor((round - 1) / 2)) * 3 + Math.max(0, actIndex - 1) * 4;
  return {
    serviceChoices: [
      {
        id: "restore",
        kind: "heal",
        hpDelta: base + 16,
        labelKey: "fortress.pharmacy.choice.restore",
        detailKey: "fortress.pharmacy.choiceDetail.restore"
      },
      {
        id: "stimulant",
        kind: "heal_xp",
        hpDelta: base + 8,
        xpDelta: Math.max(2, 2 + Math.floor((round - 1) / 4) + Math.floor((actIndex - 1) / 2)),
        labelKey: "fortress.pharmacy.choice.stimulant",
        detailKey: "fortress.pharmacy.choiceDetail.stimulant"
      },
      {
        id: "supplies",
        kind: "heal_gold",
        hpDelta: base + 4,
        goldDelta: Math.max(2, 2 + Math.floor((round - 1) / 5) + Math.floor((actIndex - 1) / 2)),
        labelKey: "fortress.pharmacy.choice.supplies",
        detailKey: "fortress.pharmacy.choiceDetail.supplies"
      }
    ],
    serviceLabelKey: "fortress.serviceLabel.pharmacy"
  };
}

function buildBlacksmithPayload(round: number, actIndex: number): Record<string, unknown> {
  return {
    serviceLabelKey: "fortress.serviceLabel.blacksmith",
    forgeTier: Math.min(5, 1 + Math.floor((round - 1) / 4) + Math.floor((actIndex - 1) / 2)),
    forgeServices: ["craft", "upgrade", "temper"]
  };
}

export function isEndlessFortressMode(gameModeId: string): boolean {
  return gameModeId === "EndlessPvEFortress";
}

export function createDefaultFortressMeta(round: number = 1): FortMeta {
  return {
    actIndex: 1,
    stepIndex: 0,
    mapSeed: createFortressSeed(1, round),
    graph: null,
    currentNodeId: null,
    visitedNodeIds: [],
    pendingNodeType: null,
    pendingNodePayload: null
  };
}

export function normalizeFortressMeta(raw: Record<string, unknown> | null | undefined, options: { round?: number } = {}): FortMeta {
  const { round = 1 } = options;
  const source = raw && typeof raw === "object" ? raw : {};
  const base = createDefaultFortressMeta(round);
  return {
    ...base,
    ...source,
    actIndex: readInt(source.actIndex, base.actIndex) > 0 ? readInt(source.actIndex, base.actIndex) : base.actIndex,
    stepIndex: readInt(source.stepIndex, base.stepIndex) >= 0 ? readInt(source.stepIndex, base.stepIndex) : base.stepIndex,
    mapSeed: readInt(source.mapSeed, base.mapSeed) > 0 ? readInt(source.mapSeed, base.mapSeed) : base.mapSeed,
    graph: normalizeGraph(readObject(source.graph) ?? {}),
    currentNodeId: readString(source.currentNodeId, ""),
    visitedNodeIds: readStringArray(source.visitedNodeIds),
    pendingNodeType: readString(source.pendingNodeType, "") || null,
    pendingNodePayload: readObject(source.pendingNodePayload)
  };
}

export function generateFortressGraph(options: { actIndex?: number; round?: number; seed?: number | null } = {}): FortGraph {
  const { actIndex = 1, round = 1, seed = null } = options;
  const resolvedSeed = seed !== null && Number.isInteger(seed) && seed > 0 ? seed : createFortressSeed(actIndex, round);
  const randomFn = createSeededRandom(resolvedSeed);
  const nodes: FortNode[] = [];
  const layers: FortLayer[] = [];

  FORTRESS_LAYER_TEMPLATES.forEach((template, layerIndex) => {
    const types: FortressNodeType[] = layerIndex === FORTRESS_LAYER_TEMPLATES.length - 1
      ? [...template]
      : shuffle([...template] as string[], randomFn) as FortressNodeType[];
    const nodeIds: string[] = [];
    types.forEach((type, laneIndex) => {
      const nodeId = `fortress_act_${actIndex}_layer_${layerIndex}_${laneIndex}`;
      nodes.push({
        id: nodeId,
        type,
        layer: layerIndex,
        lane: laneIndex,
        nextIds: []
      });
      nodeIds.push(nodeId);
    });
    layers.push({ index: layerIndex, nodeIds });
  });

  nodes.forEach((node) => {
    const nextLayer = layers[node.layer + 1];
    node.nextIds = nextLayer ? [...nextLayer.nodeIds] : [];
  });

  return {
    actIndex,
    seed: resolvedSeed,
    nodes,
    layers
  };
}

export function ensureFortressGraph(meta: Record<string, unknown> | null | undefined, options: { round?: number } = {}): FortMeta {
  const { round = 1 } = options;
  let next = normalizeFortressMeta(meta, { round });
  const graphMissing = !next.graph?.layers?.length || !next.graph?.nodes?.length;
  const exhausted = !graphMissing && next.graph && next.stepIndex >= next.graph.layers.length;
  if (!graphMissing && !exhausted) return next;

  const actIndex = exhausted ? next.actIndex + 1 : next.actIndex;
  const graph = generateFortressGraph({ actIndex, round });
  return {
    ...next,
    actIndex,
    stepIndex: 0,
    mapSeed: graph.seed,
    graph,
    currentNodeId: null,
    visitedNodeIds: [],
    pendingNodeType: null,
    pendingNodePayload: null
  };
}

export function getFortressAvailableNodes(meta: Record<string, unknown> | null | undefined): FortNode[] {
  const normalized = normalizeFortressMeta(meta);
  const layer = normalized.graph?.layers?.[normalized.stepIndex];
  if (!layer) return [];
  const nodeMap = new Map((normalized.graph?.nodes ?? []).map((node) => [node.id, node]));
  return layer.nodeIds.map((id) => nodeMap.get(id)).filter((n): n is FortNode => n !== undefined);
}

export function getFortressPendingNode(source: Record<string, unknown> | null | undefined): { type: string; payload: unknown } | null {
  const fortMeta = (source?.fortressMeta ?? source) as Record<string, unknown> | null | undefined;
  const meta = normalizeFortressMeta(fortMeta);
  if (!meta.pendingNodeType) return null;
  return {
    type: meta.pendingNodeType,
    payload: meta.pendingNodePayload ?? null
  };
}

export function buildFortressNodePayload(node: FortNode | null | undefined, options: { round?: number; actIndex?: number } = {}): Record<string, unknown> {
  const { round = 1, actIndex = 1 } = options;
  const seed = createFortressSeed(actIndex + (node?.layer ?? 0) + 1, round + (node?.lane ?? 0) + 1);
  const randomFn = createSeededRandom(seed);
  switch (node?.type) {
    case FORTRESS_NODE_TYPES.SHOP:
      return { service: FORTRESS_NODE_TYPES.SHOP, enemyBudgetMult: 1 };
    case FORTRESS_NODE_TYPES.BLACKSMITH:
      return {
        service: FORTRESS_NODE_TYPES.BLACKSMITH,
        enemyBudgetMult: 1.05,
        ...buildBlacksmithPayload(round, actIndex)
      };
    case FORTRESS_NODE_TYPES.PHARMACY:
      return {
        service: FORTRESS_NODE_TYPES.PHARMACY,
        enemyBudgetMult: 1,
        ...buildPharmacyPayload(round, actIndex)
      };
    case FORTRESS_NODE_TYPES.BEAST_DEN:
      return {
        service: FORTRESS_NODE_TYPES.BEAST_DEN,
        enemyBudgetMult: 1,
        serviceLabelKey: "fortress.serviceLabel.beastDen",
        ...buildBeastDenPayload(round, actIndex, randomFn)
      };
    case FORTRESS_NODE_TYPES.ELITE:
      return { service: FORTRESS_NODE_TYPES.ELITE, enemyBudgetMult: 1.25 };
    case FORTRESS_NODE_TYPES.BOSS:
      return { service: FORTRESS_NODE_TYPES.BOSS, enemyBudgetMult: 1.6, bossNode: true };
    case FORTRESS_NODE_TYPES.BATTLE:
    default:
      return { service: FORTRESS_NODE_TYPES.BATTLE, enemyBudgetMult: 1 };
  }
}

export function selectFortressNode(meta: Record<string, unknown> | null | undefined, node: FortNode | null | undefined, options: { round?: number } = {}): FortMeta {
  const { round = 1 } = options;
  const normalized = ensureFortressGraph(meta, { round });
  if (!node?.id) return normalized;
  return {
    ...normalized,
    stepIndex: normalized.stepIndex + 1,
    currentNodeId: node.id,
    visitedNodeIds: [...normalized.visitedNodeIds, node.id],
    pendingNodeType: node.type,
    pendingNodePayload: buildFortressNodePayload(node, {
      round,
      actIndex: normalized.actIndex
    })
  };
}

export function clearFortressPendingNode(meta: Record<string, unknown> | null | undefined, options: { round?: number } = {}): FortMeta {
  const { round = 1 } = options;
  const normalized = normalizeFortressMeta(meta, { round });
  return {
    ...normalized,
    pendingNodeType: null,
    pendingNodePayload: null
  };
}

export function isFortressShopNode(source: Record<string, unknown> | null | undefined): boolean {
  return getFortressPendingNode(source)?.type === FORTRESS_NODE_TYPES.SHOP;
}

export function isFortressBlacksmithNode(source: Record<string, unknown> | null | undefined): boolean {
  return getFortressPendingNode(source)?.type === FORTRESS_NODE_TYPES.BLACKSMITH;
}

export function isFortressPharmacyNode(source: Record<string, unknown> | null | undefined): boolean {
  return getFortressPendingNode(source)?.type === FORTRESS_NODE_TYPES.PHARMACY;
}

export function isFortressBeastDenNode(source: Record<string, unknown> | null | undefined): boolean {
  return getFortressPendingNode(source)?.type === FORTRESS_NODE_TYPES.BEAST_DEN;
}

export function getFortressNodeI18nKey(type: string): string {
  const key = (FORTRESS_NODE_I18N_KEYS as Record<string, string>)[type];
  return key ?? FORTRESS_NODE_I18N_KEYS[FORTRESS_NODE_TYPES.BATTLE];
}
