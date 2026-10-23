import { getResolvedSkillDefinition } from "../../data/skills.js";
import { UNIT_BY_ID } from "../../data/unitCatalog.js";
import { buildTooltipViewModel, type Skill } from "../../core/unitDescriptionHelper.js";
import { formatOffenseDebuffGenericText, formatOffenseDebuffLabel, getOffenseDebuffState } from "../../core/offenseDebuff.js";

interface StatusUnit {
  uid?: string;
  statuses?: Record<string, unknown>;
  statusSources?: Record<string, StatusSourceMeta>;
  star?: number;
  baseId?: string;
  id?: string;
  skillId?: string;
  [key: string]: unknown;
}

interface StatusSnapshot {
  active: boolean;
  turns: number;
  value: number;
}

interface StatusSourceMeta {
  skillId?: string | null;
  sourceUnitId?: string | null;
  sourceBaseId?: string | null;
  sourceStar?: number;
  turns?: number;
  value?: number;
  [key: string]: unknown;
}

interface StatusEntry {
  key: string;
  icon: string;
  label: string;
  badgeText: string;
  line: string;
  [key: string]: unknown;
}

type StatusLabelFn = (statuses: Record<string, unknown>, unit: StatusUnit, snapshot?: StatusSnapshot) => string;
type StatusReadTurnsFn = (statuses: Record<string, unknown>, unit?: StatusUnit) => number;
type StatusReadValueFn = (statuses: Record<string, unknown>, unit?: StatusUnit) => number;
type StatusDescribeFn = (statuses: Record<string, unknown>, snapshot: StatusSnapshot, unit?: StatusUnit) => string;

interface StatusDef {
  key: string;
  icon: string;
  label: string | StatusLabelFn;
  readTurns: StatusReadTurnsFn;
  readValue: StatusReadValueFn;
  describeGeneric: StatusDescribeFn;
}


const TOOLTIP_STATUS_DEFS: readonly StatusDef[] = Object.freeze([
  {
    key: "stun",
    icon: "💫",
    label: "Choáng",
    readTurns: (statuses) => Number(statuses?.stun ?? 0),
    readValue: () => 0,
    describeGeneric: (statuses) => `Không thể hành động (${Math.max(0, Number(statuses?.stun ?? 0))} lượt)`
  },
  {
    key: "freeze",
    icon: "❄",
    label: "Đóng băng",
    readTurns: (statuses) => Number(statuses?.freeze ?? 0),
    readValue: () => 0,
    describeGeneric: (statuses) => `Bị đóng băng (${Math.max(0, Number(statuses?.freeze ?? 0))} lượt)`
  },
  {
    key: "sleep",
    icon: "😴",
    label: "Ngủ",
    readTurns: (statuses) => Number(statuses?.sleep ?? 0),
    readValue: () => 0,
    describeGeneric: (statuses) => `Bị ngủ, mất lượt (${Math.max(0, Number(statuses?.sleep ?? 0))} lượt)`
  },
  {
    key: "silence",
    icon: "🔇",
    label: "Câm lặng",
    readTurns: (statuses) => Number(statuses?.silence ?? 0),
    readValue: () => 0,
    describeGeneric: (statuses) => `Không thể dùng kỹ năng (${Math.max(0, Number(statuses?.silence ?? 0))} lượt)`
  },
  {
    key: "disarmTurns",
    icon: "🚫",
    label: "Giải giới",
    readTurns: (statuses) => Number(statuses?.disarmTurns ?? 0),
    readValue: () => 0,
    describeGeneric: (statuses) => `Không thể đánh thường (${Math.max(0, Number(statuses?.disarmTurns ?? 0))} lượt)`
  },
  {
    key: "burnTurns",
    icon: "🔥",
    label: "Thiêu đốt",
    readTurns: (statuses) => Number(statuses?.burnTurns ?? 0),
    readValue: (statuses) => Number(statuses?.burnDamage ?? 0),
    describeGeneric: (statuses) => `Mất ${Math.max(0, Number(statuses?.burnDamage ?? 0))} mỗi lượt trong ${Math.max(0, Number(statuses?.burnTurns ?? 0))} lượt`
  },
  {
    key: "fireVulnerabilityTurns",
    icon: "🔥",
    label: "Yếu Hỏa",
    readTurns: (statuses) => Number(statuses?.fireVulnerabilityTurns ?? 0),
    readValue: (statuses) => Number(statuses?.fireVulnerabilityMultiplier ?? 1),
    describeGeneric: (statuses) => `Nhận x${Math.max(1, Number(statuses?.fireVulnerabilityMultiplier ?? 1))} sát thương Hỏa trong ${Math.max(0, Number(statuses?.fireVulnerabilityTurns ?? 0))} lượt`
  },
  {
    key: "poisonTurns",
    icon: "☠",
    label: "Nhiễm độc",
    readTurns: (statuses) => Number(statuses?.poisonTurns ?? 0),
    readValue: (statuses) => Number(statuses?.poisonDamage ?? 0),
    describeGeneric: (statuses) => `Độc rút ${Math.max(0, Number(statuses?.poisonDamage ?? 0))} mỗi lượt trong ${Math.max(0, Number(statuses?.poisonTurns ?? 0))} lượt`
  },
  {
    key: "bleedTurns",
    icon: "🩸",
    label: "Chảy máu",
    readTurns: (statuses) => Number(statuses?.bleedTurns ?? 0),
    readValue: (statuses) => Number(statuses?.bleedDamage ?? 0),
    describeGeneric: (statuses) => `Mất ${Math.max(0, Number(statuses?.bleedDamage ?? 0))} mỗi lượt trong ${Math.max(0, Number(statuses?.bleedTurns ?? 0))} lượt`
  },
  {
    key: "diseaseTurns",
    icon: "🦠",
    label: "Bệnh",
    readTurns: (statuses) => Number(statuses?.diseaseTurns ?? 0),
    readValue: (statuses) => Number(statuses?.diseaseDamage ?? 0),
    describeGeneric: (statuses) => `Bị bệnh trong ${Math.max(0, Number(statuses?.diseaseTurns ?? 0))} lượt`
  },
  {
    key: "healBlockTurns",
    icon: "💔",
    label: "Cấm hồi máu",
    readTurns: (statuses) => Number(statuses?.healBlockTurns ?? 0),
    readValue: () => 0,
    describeGeneric: (statuses) => `Không thể được hồi máu trong ${Math.max(0, Number(statuses?.healBlockTurns ?? 0))} lượt`
  },
  {
    key: "healReductionTurns",
    icon: "🫀",
    label: "Giảm hồi máu",
    readTurns: (statuses) => Number(statuses?.healReductionTurns ?? 0),
    readValue: (statuses) => Number(statuses?.healReductionPct ?? 0),
    describeGeneric: (statuses) => `Nhận ít hơn ${Math.round(Math.max(0, Number(statuses?.healReductionPct ?? 0)) * 100)}% hồi máu trong ${Math.max(0, Number(statuses?.healReductionTurns ?? 0))} lượt`
  },
  {
    key: "tauntTurns",
    icon: "🎯",
    label: "Khiêu khích",
    readTurns: (statuses) => Number(statuses?.tauntTurns ?? 0),
    readValue: () => 0,
    describeGeneric: (statuses) => `Bị ép tấn công mục tiêu chỉ định (${Math.max(0, Number(statuses?.tauntTurns ?? 0))} lượt)`
  },
  {
    key: "armorBreakTurns",
    icon: "⚔️",
    label: "Giảm giáp",
    readTurns: (statuses) => Number(statuses?.armorBreakTurns ?? 0),
    readValue: (statuses) => Number(statuses?.armorBreakValue ?? 0),
    describeGeneric: (statuses) => `Giảm ${Math.max(0, Number(statuses?.armorBreakValue ?? 0))} DEF trong ${Math.max(0, Number(statuses?.armorBreakTurns ?? 0))} lượt`
  },
  {
    key: "offenseDebuffTurns",
    icon: "📉",
    label: (_statuses, unit) => formatOffenseDebuffLabel(unit),
    readTurns: (statuses, unit) => getOffenseDebuffState(statuses, unit).turns,
    readValue: (statuses, unit) => getOffenseDebuffState(statuses, unit).value,
    describeGeneric: (statuses, snapshot, unit) => formatOffenseDebuffGenericText(statuses, unit)
  },
  {
    key: "reflectTurns",
    icon: "🌀",
    label: "Phản chiếu",
    readTurns: (statuses) => Number(statuses?.reflectTurns ?? 0),
    readValue: (statuses) => Number(statuses?.reflectPct ?? 0),
    describeGeneric: (statuses) => `Phản sát thương ${Math.round(Math.max(0, Number(statuses?.reflectPct ?? 0)) * 100)}% trong ${Math.max(0, Number(statuses?.reflectTurns ?? 0))} lượt`
  },
  {
    key: "physReflectTurns",
    icon: "🛡️",
    label: "Phản đòn vật lý",
    readTurns: (statuses) => Number(statuses?.physReflectTurns ?? 0),
    readValue: (statuses) => Number(statuses?.physReflectPct ?? 0),
    describeGeneric: (statuses) => `Phản đòn vật lý ${Math.round(Math.max(0, Number(statuses?.physReflectPct ?? 0)) * 100)}% trong ${Math.max(0, Number(statuses?.physReflectTurns ?? 0))} lượt`
  },
  {
    key: "immuneTurns",
    icon: "🧤",
    label: "Miễn nhiễm",
    readTurns: (statuses) => Number(statuses?.immuneTurns ?? 0),
    readValue: () => 0,
    describeGeneric: (statuses) => `Miễn dịch trạng thái bất lợi (${Math.max(0, Number(statuses?.immuneTurns ?? 0))} lượt)`
  },
  {
    key: "atkBuffTurns",
    icon: "🗡️",
    label: "Tăng ATK",
    readTurns: (statuses) => Number(statuses?.atkBuffTurns ?? 0),
    readValue: (statuses) => Number(statuses?.atkBuffValue ?? 0),
    describeGeneric: (statuses) => `Tăng ${Math.max(0, Number(statuses?.atkBuffValue ?? 0))} ATK trong ${Math.max(0, Number(statuses?.atkBuffTurns ?? 0))} lượt`
  },
  {
    key: "matkBuffTurns",
    icon: "✨",
    label: "Tăng MATK",
    readTurns: (statuses) => Number(statuses?.matkBuffTurns ?? 0),
    readValue: (statuses) => Number(statuses?.matkBuffValue ?? 0),
    describeGeneric: (statuses) => `Tăng ${Math.max(0, Number(statuses?.matkBuffValue ?? 0))} MATK trong ${Math.max(0, Number(statuses?.matkBuffTurns ?? 0))} lượt`
  },
  {
    key: "defBuffTurns",
    icon: "🛡️",
    label: "Tăng DEF",
    readTurns: (statuses) => Number(statuses?.defBuffTurns ?? 0),
    readValue: (statuses) => Number(statuses?.defBuffValue ?? 0),
    describeGeneric: (statuses) => `Tăng ${Math.max(0, Number(statuses?.defBuffValue ?? 0))} DEF trong ${Math.max(0, Number(statuses?.defBuffTurns ?? 0))} lượt`
  },
  {
    key: "mdefBuffTurns",
    icon: "🔰",
    label: "Tăng MDEF",
    readTurns: (statuses) => Number(statuses?.mdefBuffTurns ?? 0),
    readValue: (statuses) => Number(statuses?.mdefBuffValue ?? 0),
    describeGeneric: (statuses) => `Tăng ${Math.max(0, Number(statuses?.mdefBuffValue ?? 0))} MDEF trong ${Math.max(0, Number(statuses?.mdefBuffTurns ?? 0))} lượt`
  },
  {
    key: "evadeBuffTurns",
    icon: "💨",
    label: "Tăng né tránh",
    readTurns: (statuses) => Number(statuses?.evadeBuffTurns ?? 0),
    readValue: (statuses) => Number(statuses?.evadeBuffValue ?? 0),
    describeGeneric: (statuses) => `Tăng né tránh ${Math.round(Math.max(0, Number(statuses?.evadeBuffValue ?? 0)) * 100)}% trong ${Math.max(0, Number(statuses?.evadeBuffTurns ?? 0))} lượt`
  },
  {
    key: "evadeDebuffTurns",
    icon: "🎯",
    label: "Giảm né tránh",
    readTurns: (statuses) => Number(statuses?.evadeDebuffTurns ?? 0),
    readValue: (statuses) => Number(statuses?.evadeDebuffValue ?? 0),
    describeGeneric: (statuses) => `Giảm né tránh ${Math.round(Math.max(0, Number(statuses?.evadeDebuffValue ?? 0)) * 100)}% trong ${Math.max(0, Number(statuses?.evadeDebuffTurns ?? 0))} lượt`
  },
  {
    key: "hotTurns",
    icon: "💚",
    label: "Hồi dần",
    readTurns: (statuses) => Number(statuses?.hotTurns ?? 0),
    readValue: (statuses) => Number(statuses?.hotAmount ?? 0),
    describeGeneric: (statuses) => `Hồi ${Math.max(0, Number(statuses?.hotAmount ?? 0))} mỗi lượt trong ${Math.max(0, Number(statuses?.hotTurns ?? 0))} lượt`
  },
  {
    key: "guardianTurns",
    icon: "🛡️",
    label: "Gánh đòn",
    readTurns: (statuses) => Number(statuses?.guardianTurns ?? 0),
    readValue: (statuses) => Number(statuses?.guardianAbsorb ?? 0),
    describeGeneric: (statuses) => `Có đồng minh gánh sát thương ${Math.round(Math.max(0, Number(statuses?.guardianAbsorb ?? 0)) * 100)}% trong ${Math.max(0, Number(statuses?.guardianTurns ?? 0))} lượt`
  },
  {
    key: "damageReductionTurns",
    icon: "🧱",
    label: "Giảm sát thương",
    readTurns: (statuses) => Number(statuses?.damageReductionTurns ?? 0),
    readValue: (statuses) => Number(statuses?.damageReductionPct ?? 0),
    describeGeneric: (statuses) => `Giảm sát thương nhận vào ${Math.round(Math.max(0, Number(statuses?.damageReductionPct ?? 0)) * 100)}% trong ${Math.max(0, Number(statuses?.damageReductionTurns ?? 0))} lượt`
  },
  {
    key: "magicDamageReductionTurns",
    icon: "🔮",
    label: "Giảm sát thương phép",
    readTurns: (statuses) => Number(statuses?.magicDamageReductionTurns ?? 0),
    readValue: (statuses) => Number(statuses?.magicDamageReductionPct ?? 0),
    describeGeneric: (statuses) => `Giảm sát thương phép ${Math.round(Math.max(0, Number(statuses?.magicDamageReductionPct ?? 0)) * 100)}% trong ${Math.max(0, Number(statuses?.magicDamageReductionTurns ?? 0))} lượt`
  },
  {
    key: "fortifyReduceTurns",
    icon: "🏰",
    label: "Kiên cố",
    readTurns: (statuses) => Number(statuses?.fortifyReduceTurns ?? 0),
    readValue: (statuses) => Number(statuses?.fortifyReducePct ?? 0),
    describeGeneric: (statuses) => `Giảm sát thương ${Math.round(Math.max(0, Number(statuses?.fortifyReducePct ?? 0)) * 100)}% trong ${Math.max(0, Number(statuses?.fortifyReduceTurns ?? 0))} lượt`
  }
]);

function cloneStatusSnapshot(unit: StatusUnit | null | undefined, def: StatusDef): StatusSnapshot {
  const statuses = unit?.statuses ?? {};
  const unitRef = unit ?? undefined;
  const turns = Math.max(0, Number(def.readTurns(statuses, unitRef) || 0));
  const value = Number(def.readValue(statuses, unitRef) || 0);
  return {
    active: turns > 0,
    turns,
    value
  };
}

function firstMeaningfulLine(value: unknown): string {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) ?? "";
}

function resolveSourceSkillSummary(meta: StatusSourceMeta | null | undefined): { name: string; summaryLine: string } | null {
  if (!meta?.skillId) return null;
  const baseId = meta.sourceBaseId ?? null;
  const star = Math.max(1, Math.round(Number(meta.sourceStar) || 1));
  const baseUnit = baseId ? UNIT_BY_ID[baseId] : null;
  const skill = getResolvedSkillDefinition(meta.skillId, { baseId, star });
  if (!skill) return null;
  const tooltipVm = baseUnit
    ? buildTooltipViewModel(baseUnit, star, { skill, tribe: baseUnit?.tribe } as unknown as { skill?: Skill; tribe?: string })
    : null;
  const summaryLine = firstMeaningfulLine(
    tooltipVm?.skill?.summaryByStar?.[star]
    ?? tooltipVm?.skill?.summaryText
    ?? skill?.descriptionVi
    ?? skill?.description
    ?? ""
  );
  return {
    name: skill.name ?? "",
    summaryLine
  };
}

function formatStatusSourceDetail(snapshot: StatusSnapshot | null | undefined): string {
  if (!snapshot) return "";
  const parts = [];
  if ((snapshot?.turns ?? 0) > 0) parts.push(`${snapshot.turns} lượt`);
  if (Math.abs(Number(snapshot?.value ?? 0)) > 0.001) {
    const value = Number(snapshot.value);
    if (Math.abs(value) <= 1 && value !== Math.round(value)) {
      parts.push(`${Math.round(value * 100)}%`);
    } else {
      parts.push(`${Math.round(value)}`);
    }
  }
  return parts.join(", ");
}

function formatStatusBadgeText(snapshot: StatusSnapshot | null | undefined): string {
  if (!snapshot) return "";
  const parts = [];
  if ((snapshot?.turns ?? 0) > 0) parts.push(`${snapshot.turns}L`);
  if (Math.abs(Number(snapshot?.value ?? 0)) > 0.001) {
    const value = Number(snapshot.value);
    if (Math.abs(value) <= 1 && value !== Math.round(value)) {
      parts.push(`${Math.round(value * 100)}%`);
    } else {
      parts.push(`${Math.round(value)}`);
    }
  }
  return parts.join(" • ");
}

function ensureStatusSources(unit: StatusUnit | null | undefined): StatusSourceMeta {
  if (!unit || typeof unit !== "object") return {};
  if (!unit.statusSources || typeof unit.statusSources !== "object") {
    unit.statusSources = {};
  }
  return unit.statusSources;
}

export function createEmptyStatusSources() {
  return {};
}

export function snapshotTooltipStatusState(units: StatusUnit[] | null | undefined = []): Map<string, Record<string, StatusSnapshot>> {
  const snapshotByUnitId = new Map<string, Record<string, StatusSnapshot>>();
  const uniqueUnits = Array.isArray(units)
    ? units.filter((unit, index, arr) => unit?.uid && arr.findIndex((candidate) => candidate?.uid === unit.uid) === index)
    : [];
  uniqueUnits.forEach((unit) => {
    const unitSnapshot: Record<string, StatusSnapshot> = {};
    TOOLTIP_STATUS_DEFS.forEach((def) => {
      unitSnapshot[def.key] = cloneStatusSnapshot(unit, def);
    });
    snapshotByUnitId.set(String(unit.uid), unitSnapshot);
  });
  return snapshotByUnitId;
}

export function recordTooltipStatusChanges(units: StatusUnit[] | null | undefined = [], beforeSnapshot: Map<string, Record<string, StatusSnapshot>> = new Map(), attacker: StatusUnit | null = null, skill: SkillLike | null = null) {
  const uniqueUnits = Array.isArray(units)
    ? units.filter((unit, index, arr) => unit?.uid && arr.findIndex((candidate) => candidate?.uid === unit.uid) === index)
    : [];
  uniqueUnits.forEach((unit) => {
    const previousUnitSnapshot = beforeSnapshot.get(String(unit.uid)) ?? {};
    const statusSources = ensureStatusSources(unit);
    TOOLTIP_STATUS_DEFS.forEach((def) => {
      const previous = previousUnitSnapshot[def.key] ?? { active: false, turns: 0, value: 0 };
      const current = cloneStatusSnapshot(unit, def);
      if (!current.active) return;
      const changed = !previous.active
        || current.turns !== previous.turns
        || Math.abs((current.value ?? 0) - (previous.value ?? 0)) > 0.001;
      if (!changed) return;
      statusSources[def.key] = {
        skillId: skill?.id ?? attacker?.skillId ?? null,
        sourceUnitId: attacker?.uid ?? null,
        sourceBaseId: attacker?.baseId ?? attacker?.id ?? null,
        sourceStar: attacker?.star ?? 1,
        turns: current.turns,
        value: current.value
      };
    });
  });
}

interface SkillLike { id?: string; [key: string]: unknown }

export function buildActiveStatusTooltipLines(unit: unknown = null): string[] {
  return buildActiveStatusTooltipEntries(unit).map((entry) => entry?.line ?? "");
}

export function buildActiveStatusTooltipEntries(unit: unknown = null): StatusEntry[] {
  const unitRecord = (unit ?? null) as StatusUnit | null;
  if (!unitRecord?.statuses) return [];
  const statuses = unitRecord.statuses ?? {};
  const statusSources: Record<string, StatusSourceMeta> = unitRecord.statusSources ?? {};
  return TOOLTIP_STATUS_DEFS
    .map((def) => {
      const snapshot = cloneStatusSnapshot(unitRecord, def);
      if (!snapshot.active) return null;
      const sourceMeta = statusSources[def.key] ?? null;
      const sourceSummary = resolveSourceSkillSummary(sourceMeta);
      const detail = formatStatusSourceDetail(snapshot);
      const badgeText = formatStatusBadgeText(snapshot);
      const label = typeof def.label === "function" ? def.label(statuses, unitRecord, snapshot) : def.label;
      const line = sourceSummary?.name || sourceSummary?.summaryLine
        ? `${def.icon} ${label}: ${[sourceSummary?.name, sourceSummary?.summaryLine].filter((x): x is string => Boolean(x)).join(": ")}${detail ? ` (${detail})` : ""}`
        : `${def.icon} ${label}: ${def.describeGeneric(statuses, snapshot, unitRecord)}`;
      return {
        key: def.key,
        icon: def.icon,
        label,
        badgeText,
        line
      };
    })
    .filter((entry): entry is StatusEntry => Boolean(entry));
}
