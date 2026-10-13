import type { EnvironmentId } from "./environment";
import { modeConfig } from "./modes";
import type { RunState } from "./run";

export const HEART_RECOVERY_BLESSING_ID = "heart_recovery" as const;

export const WEATHER_BLESSING_ENVIRONMENT = {
  weather_fire: "FIRE",
  weather_tide: "TIDE",
  weather_wind: "WIND",
  weather_stone: "STONE",
  weather_night: "NIGHT",
  weather_swarm: "SWARM",
  weather_spirit: "SPIRIT",
  weather_wood: "WOOD",
} as const satisfies Record<string, EnvironmentId>;

export type WeatherBlessingId = keyof typeof WEATHER_BLESSING_ENVIRONMENT;
export type BlessingId = WeatherBlessingId | typeof HEART_RECOVERY_BLESSING_ID;

export interface WeatherBlessing {
  id: WeatherBlessingId;
  kind: "weather";
  environment: EnvironmentId;
}

export interface HeartRecoveryBlessing {
  id: typeof HEART_RECOVERY_BLESSING_ID;
  kind: "heart_recovery";
}

export type BlessingDefinition = WeatherBlessing | HeartRecoveryBlessing;

export const WEATHER_BLESSING_IDS = Object.freeze(
  Object.keys(WEATHER_BLESSING_ENVIRONMENT) as WeatherBlessingId[],
);

export const BLESSINGS: readonly BlessingDefinition[] = Object.freeze([
  { id: HEART_RECOVERY_BLESSING_ID, kind: "heart_recovery" },
  ...WEATHER_BLESSING_IDS.map((id): WeatherBlessing => ({
    id,
    kind: "weather",
    environment: WEATHER_BLESSING_ENVIRONMENT[id],
  })),
]);

export function isWeatherBlessingId(value: unknown): value is WeatherBlessingId {
  return typeof value === "string"
    && Object.prototype.hasOwnProperty.call(WEATHER_BLESSING_ENVIRONMENT, value);
}

export function normalizeWeatherBlessingQueue(value: unknown): WeatherBlessingId[] {
  return Array.isArray(value) ? value.filter(isWeatherBlessingId) : [];
}

export function weatherBlessingEnvironment(id: WeatherBlessingId): EnvironmentId {
  return WEATHER_BLESSING_ENVIRONMENT[id];
}

export function restoreHeartBlessing(s: RunState, amount = 1): number {
  if (s.phase === "GAME_OVER") return 0;
  const restored = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
  if (!restored) return 0;
  const before = s.hp;
  s.hp = Math.min(modeConfig(s.mode).startHp, Math.max(0, s.hp + restored));
  return s.hp - before;
}
