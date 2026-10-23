const MAGIC_OFFENSE_ROLES = new Set(["MAGE", "SUPPORT"]);

interface UnitClassTypeLike {
    classType?: string;
}

interface OffenseDebuffStatuses {
    offenseDebuffTurns?: unknown;
    offenseDebuffValue?: unknown;
    offenseDebuffMode?: unknown;
    offenseDebuffStat?: unknown;
    atkDebuffTurns?: unknown;
    atkDebuffValue?: unknown;
}

interface UnitWithStatuses {
    statuses?: OffenseDebuffStatuses;
    classType?: string;
}

type OffenseStat = "atk" | "matk" | "autoByRole";
type CanonicalStat = "atk" | "matk" | "";

interface OffenseDebuffState {
    turns: number;
    value: number;
    stat: CanonicalStat;
}

function toNumber(value: unknown, fallback: number = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function isMagicOffenseRole(unitOrClassType: string | UnitClassTypeLike | UnitWithStatuses | null | undefined): boolean {
  const classType = typeof unitOrClassType === "string"
    ? unitOrClassType
    : unitOrClassType?.classType;
  return MAGIC_OFFENSE_ROLES.has(String(classType ?? "").trim().toUpperCase());
}

export function resolveOffenseDebuffStat(
  unitOrClassType: string | UnitClassTypeLike | UnitWithStatuses | null | undefined,
  mode: OffenseStat | string = "autoByRole"
): "atk" | "matk" {
  const normalizedMode = String(mode ?? "autoByRole").trim();
  if (normalizedMode === "atk" || normalizedMode === "matk") return normalizedMode;
  return isMagicOffenseRole(unitOrClassType) ? "matk" : "atk";
}

export function getOffenseDebuffState(
  statuses: OffenseDebuffStatuses = {},
  unitOrClassType: string | UnitClassTypeLike | UnitWithStatuses | null | undefined = null
): OffenseDebuffState {
  const canonicalTurns = Math.max(0, toNumber(statuses.offenseDebuffTurns));
  const canonicalValue = Math.max(0, toNumber(statuses.offenseDebuffValue));
  const canonicalStat: CanonicalStat = canonicalTurns > 0
    ? resolveOffenseDebuffStat(unitOrClassType, (statuses.offenseDebuffMode ?? statuses.offenseDebuffStat ?? "autoByRole") as OffenseStat | string)
    : "";
  if (canonicalTurns > 0 && canonicalValue > 0) {
    return {
      turns: canonicalTurns,
      value: canonicalValue,
      stat: canonicalStat || resolveOffenseDebuffStat(unitOrClassType)
    };
  }
  const legacyTurns = Math.max(0, toNumber(statuses.atkDebuffTurns));
  const legacyValue = Math.max(0, toNumber(statuses.atkDebuffValue));
  if (legacyTurns > 0 && legacyValue > 0) {
    return {
      turns: legacyTurns,
      value: legacyValue,
      stat: "atk"
    };
  }
  return {
    turns: 0,
    value: 0,
    stat: resolveOffenseDebuffStat(unitOrClassType)
  };
}

export function applyOffenseDebuffStatus(
  unit: UnitWithStatuses | null | undefined,
  { turns = 0, value = 0, mode = "autoByRole" }: { turns?: number; value?: number; mode?: OffenseStat | string } = {}
): void {
  const statuses = unit?.statuses;
  const resolvedTurns = Math.max(0, Math.round(toNumber(turns)));
  const resolvedValue = Math.max(0, Math.round(toNumber(value)));
  if (!statuses || resolvedTurns <= 0 || resolvedValue <= 0) return;
  const resolvedStat = resolveOffenseDebuffStat(unit, mode);
  statuses.offenseDebuffTurns = Math.max(toNumber(statuses.offenseDebuffTurns), resolvedTurns);
  statuses.offenseDebuffValue = Math.max(toNumber(statuses.offenseDebuffValue), resolvedValue);
  statuses.offenseDebuffMode = mode;
  statuses.offenseDebuffStat = resolvedStat;
  if (resolvedStat === "atk") {
    statuses.atkDebuffTurns = Math.max(toNumber(statuses.atkDebuffTurns), resolvedTurns);
    statuses.atkDebuffValue = Math.max(toNumber(statuses.atkDebuffValue), resolvedValue);
  }
}

export function clearOffenseDebuffStatus(unit: UnitWithStatuses | null | undefined): void {
  const statuses = unit?.statuses;
  if (!statuses) return;
  statuses.offenseDebuffTurns = 0;
  statuses.offenseDebuffValue = 0;
  statuses.offenseDebuffMode = "";
  statuses.offenseDebuffStat = "";
  statuses.atkDebuffTurns = 0;
  statuses.atkDebuffValue = 0;
}

export function getOffenseDebuffValueForStat(
  unit: UnitWithStatuses | null | undefined,
  statKey: string
): number {
  const state = getOffenseDebuffState(unit?.statuses ?? {}, unit);
  if (state.turns <= 0 || state.value <= 0) return 0;
  return state.stat === statKey ? state.value : 0;
}

export function formatOffenseDebuffLabel(
  unitOrClassType: string | UnitClassTypeLike | UnitWithStatuses | null | undefined,
  stat: "atk" | "matk" = resolveOffenseDebuffStat(unitOrClassType)
): string {
  if (stat === "matk") return "Giảm MATK";
  if (stat === "atk") return "Giảm ATK";
  return "Giảm sức công";
}

export function formatOffenseDebuffGenericText(
  statuses: OffenseDebuffStatuses = {},
  unitOrClassType: string | UnitClassTypeLike | UnitWithStatuses | null | undefined = null
): string {
  const state = getOffenseDebuffState(statuses, unitOrClassType);
  if (state.turns <= 0 || state.value <= 0) return "";
  return `Giảm ${state.value} ${state.stat === "matk" ? "MATK" : "ATK"} trong ${state.turns} lượt`;
}
