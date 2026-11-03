// Player-facing copy for the eight battlefield environments (A32). The canonical table only
// stores raw EnvMods numbers; the Information modal needs to explain what the current weather
// actually does to a unit that shares the element versus one that does not.
import { environmentMods, type EnvMods, type EnvironmentId } from "../core/environment";

const pct = (v: number) => `${v > 0 ? "+" : "−"}${Math.abs(Math.round(v * 100))}%`;
const num = (v: number) => `${v > 0 ? "+" : "−"}${Math.abs(Math.round(v))}`;

/** Describe a mod bundle as short, readable clauses. Zero entries are omitted. */
export function envModsText(mods: EnvMods): string[] {
  const out: string[] = [];
  if (mods.burnOnHit) out.push(`${num(mods.burnOnHit)} sát thương cháy mỗi đòn`);
  if (mods.poisonOnHit) out.push(`${num(mods.poisonOnHit)} độc mỗi đòn`);
  if (mods.fireVuln !== 1) out.push(`nhận ${pct(mods.fireVuln - 1)} sát thương lửa`);
  if (mods.healPct) out.push(`${pct(mods.healPct)} hồi máu`);
  if (mods.healRecvPct) out.push(`${pct(mods.healRecvPct)} hồi máu nhận vào`);
  if (mods.mdef) out.push(`${num(mods.mdef)} kháng phép`);
  if (mods.def) out.push(`${num(mods.def)} phòng thủ`);
  if (mods.evade) out.push(`${pct(mods.evade)} né tránh`);
  if (mods.accuracy) out.push(`${pct(mods.accuracy)} chính xác`);
  if (mods.atkPct) out.push(`${pct(mods.atkPct)} tấn công`);
  if (mods.matkPct) out.push(`${pct(mods.matkPct)} phép lực`);
  if (mods.startShield) out.push(`${num(mods.startShield)} khiên đầu trận`);
  if (mods.startRage) out.push(`${num(mods.startRage)} nộ đầu trận`);
  if (mods.critPct) out.push(`${pct(mods.critPct)} chí mạng`);
  if (mods.poisonAura) out.push(`${num(mods.poisonAura)} độc mỗi đòn cho đối thủ`);
  if (mods.rageGainPct) out.push(`${pct(mods.rageGainPct)} tích nộ`);
  if (mods.lifesteal) out.push(`${pct(mods.lifesteal)} hút máu`);
  return out;
}

export interface EnvironmentCopy {
  /** Bonuses for units whose element matches the weather. */
  own: string[];
  /** Penalties applied to every other element. */
  other: string[];
}

export function environmentCopy(environment: EnvironmentId): EnvironmentCopy {
  return {
    own: envModsText(environmentMods(environment, environment)),
    other: envModsText(environmentMods(environment, environment === "FIRE" ? "TIDE" : "FIRE")),
  };
}
