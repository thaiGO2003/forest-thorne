import { ELEMENT_INFO, type ElementItemInfo } from "./elementInfo.js";

export interface EnvironmentMods {
  atkPct: number;
  matkPct: number;
  healPct: number;
  lifestealPct: number;
  rageGainPct: number;
  critPct: number;
  evadePct: number;
  accuracyPct: number;
  burnOnHit: number;
  poisonOnHit: number;
  shieldStart: number;
  startingRage: number;
  defFlat: number;
  mdefFlat: number;
  healReceivedPct: number;
  fireVulnerabilityMultiplier: number;
  poisonAuraDamage: number;
  [key: string]: number;
}

export interface BattlefieldEnvironment {
  id: string;
  emoji: string;
  nameVi: string;
  nameEn: string;
  titleVi: string;
  shortLabelVi: string;
  descriptionVi: string;
  matchBuff: Readonly<Partial<EnvironmentMods>>;
  nonMatchDebuff: Readonly<Partial<EnvironmentMods>>;
}

export interface EnvironmentUnit {
  element?: unknown;
  tribe?: unknown;
  base?: { element?: unknown; tribe?: unknown };
  environmentMods?: EnvironmentMods;
  mods?: Record<string, number>;
  atk: number;
  matk: number;
  def: number;
  mdef: number;
}

export type EnvironmentRef = string | BattlefieldEnvironment | null | undefined;

export const ROUND_ENVIRONMENT_CYCLE: readonly string[] = Object.freeze([
  "FIRE",
  "TIDE",
  "WIND",
  "STONE",
  "NIGHT",
  "SWARM",
  "SPIRIT",
  "WOOD"
]);

export const DEFAULT_ENVIRONMENT_MODS: Readonly<EnvironmentMods> = Object.freeze({
  atkPct: 0,
  matkPct: 0,
  healPct: 0,
  lifestealPct: 0,
  rageGainPct: 0,
  critPct: 0,
  evadePct: 0,
  accuracyPct: 0,
  burnOnHit: 0,
  poisonOnHit: 0,
  shieldStart: 0,
  startingRage: 0,
  defFlat: 0,
  mdefFlat: 0,
  healReceivedPct: 0,
  fireVulnerabilityMultiplier: 1,
  poisonAuraDamage: 0
});

function createEnvironmentDefinition(
  id: string,
  descriptionVi: string,
  matchBuff: Partial<EnvironmentMods>,
  nonMatchDebuff: Partial<EnvironmentMods>
): BattlefieldEnvironment {
  const elementInfo: ElementItemInfo | undefined = ELEMENT_INFO[id];
  return Object.freeze({
    id,
    emoji: elementInfo?.emoji ?? "",
    nameVi: elementInfo?.nameVi ?? id,
    nameEn: elementInfo?.nameEn ?? id,
    titleVi: `Môi trường ${elementInfo?.nameVi ?? id}`,
    shortLabelVi: `${elementInfo?.emoji ?? ""} ${elementInfo?.nameVi ?? id}`.trim(),
    descriptionVi,
    matchBuff: Object.freeze({ ...matchBuff }),
    nonMatchDebuff: Object.freeze({ ...nonMatchDebuff })
  });
}

export const BATTLEFIELD_ENVIRONMENTS: Record<string, BattlefieldEnvironment> = Object.freeze({
  FIRE: createEnvironmentDefinition(
    "FIRE",
    "Đồng hệ gây thêm 6 thiêu đốt mỗi ra đòn. Khác hệ nhận x1.25 sát thương Hỏa.",
    { burnOnHit: 6 },
    { fireVulnerabilityMultiplier: 1.25 }
  ),
  TIDE: createEnvironmentDefinition(
    "TIDE",
    "Đồng hệ nhận +6% hồi máu và +6 kháng phép. Khác hệ giảm 10% né tránh.",
    { healPct: 0.06, mdefFlat: 6 },
    { evadePct: -0.10 }
  ),
  WIND: createEnvironmentDefinition(
    "WIND",
    "Đồng hệ nhận +6% ATK và +6% MATK. Khác hệ giảm 10% chính xác.",
    { atkPct: 0.06, matkPct: 0.06 },
    { accuracyPct: -0.10 }
  ),
  STONE: createEnvironmentDefinition(
    "STONE",
    "Đồng hệ nhận +18 khiên đầu giao tranh. Khác hệ giảm 6 giáp và 4 kháng phép.",
    { shieldStart: 18 },
    { defFlat: -6, mdefFlat: -4 }
  ),
  NIGHT: createEnvironmentDefinition(
    "NIGHT",
    "Đồng hệ nhận +8% chí mạng. Khác hệ giảm 25% hồi máu nhận vào.",
    { critPct: 0.08 },
    { healReceivedPct: -0.25 }
  ),
  SWARM: createEnvironmentDefinition(
    "SWARM",
    "Đồng hệ gây thêm 8 độc mỗi ra đòn. Khác hệ chịu 4 sát thương độc mỗi lượt.",
    { poisonOnHit: 8 },
    { poisonAuraDamage: 4 }
  ),
  SPIRIT: createEnvironmentDefinition(
    "SPIRIT",
    "Đồng hệ nhận +1 nộ đầu giao tranh. Khác hệ giảm 20% tốc độ hồi nộ.",
    { startingRage: 1 },
    { rageGainPct: -0.20 }
  ),
  WOOD: createEnvironmentDefinition(
    "WOOD",
    "Đồng hệ nhận +5% hút máu và +5% né tránh. Khác hệ giảm 5% hút máu và 10% hồi máu gây ra.",
    { lifestealPct: 0.05, evadePct: 0.05 },
    { lifestealPct: -0.05, healPct: -0.10 }
  )
});

export function createEnvironmentMods(): EnvironmentMods {
  return { ...DEFAULT_ENVIRONMENT_MODS };
}

export function resolveRoundEnvironment(round = 1): BattlefieldEnvironment {
  const normalizedRound = Number.isFinite(round) ? Math.max(1, Math.floor(round)) : 1;
  const cycleIndex = (normalizedRound - 1) % ROUND_ENVIRONMENT_CYCLE.length;
  return BATTLEFIELD_ENVIRONMENTS[ROUND_ENVIRONMENT_CYCLE[cycleIndex]] ?? BATTLEFIELD_ENVIRONMENTS.FIRE;
}

export function buildEnvironmentModsForUnit(unit: EnvironmentUnit | null | undefined, environment: EnvironmentRef): EnvironmentMods {
  const resolvedEnvironment = typeof environment === "string"
    ? BATTLEFIELD_ENVIRONMENTS[environment]
    : environment;
  const mods = createEnvironmentMods();
  if (!resolvedEnvironment) return mods;
  const unitElement = unit?.element ?? unit?.tribe ?? unit?.base?.element ?? unit?.base?.tribe ?? null;
  const sourceMods = unitElement === resolvedEnvironment.id
    ? resolvedEnvironment.matchBuff
    : resolvedEnvironment.nonMatchDebuff;
  Object.entries(sourceMods).forEach(([key, value]) => {
    if (typeof value === "number") mods[key] = value;
  });
  return mods;
}

export function applyEnvironmentModsToCombatUnit(
  unit: EnvironmentUnit | null | undefined,
  environment: EnvironmentRef
): EnvironmentMods | null {
  if (!unit) return null;
  const resolvedEnvironment = typeof environment === "string"
    ? BATTLEFIELD_ENVIRONMENTS[environment]
    : environment;
  const environmentMods = buildEnvironmentModsForUnit(unit, resolvedEnvironment);
  unit.environmentMods = environmentMods;

  if (!unit.mods) unit.mods = {};

  if (environmentMods.defFlat) unit.def += environmentMods.defFlat;
  if (environmentMods.mdefFlat) unit.mdef += environmentMods.mdefFlat;
  if (environmentMods.atkPct) unit.atk = Math.max(1, Math.round(unit.atk * (1 + environmentMods.atkPct)));
  if (environmentMods.matkPct) unit.matk = Math.max(1, Math.round(unit.matk * (1 + environmentMods.matkPct)));

  ["shieldStart", "startingRage"].forEach((key) => {
    const value = environmentMods[key];
    if (!Number.isFinite(value) || value === 0) return;
    unit.mods![key] = (Number.isFinite(unit.mods![key]) ? unit.mods![key] : 0) + value;
  });

  return environmentMods;
}
