// Canonical game-mode registry and temporary production availability gate (A19, A60, A116).
import type { AiMode } from "./encounter";
import type { DamageRule } from "./loot";

export const GAME_MODES = ["EndlessPvEClassic", "EndlessPvEFortress", "EndlessCreative", "FortressPvP4"] as const;
export type GameMode = (typeof GAME_MODES)[number];
export type LossCondition = "NO_HEARTS" | "NO_UNITS";
export type ModeRoute = "solo" | "fortress" | "coop";

export interface GameModeConfig {
  id: GameMode;
  available: boolean;
  route: ModeRoute;
  startGold: number;
  startHp: number;
  lossCondition: LossCondition;
  damageRule: DamageRule;
  creative: boolean;
  shop: boolean;
  craft: boolean;
  augments: boolean;
  pvp: boolean;
  ai: { allowed: readonly AiMode[]; def: AiMode };
  enemyScale(round: number): number;
  goldIncome(round: number): number;
}

const after = (round: number, threshold: number, perRound: number): number =>
  round <= threshold ? 1 : 1 + (round - threshold) * perRound;

export const MODE_CONFIG: Readonly<Record<GameMode, GameModeConfig>> = {
  EndlessPvEClassic: {
    id: "EndlessPvEClassic", available: true, route: "solo", startGold: 10, startHp: 3,
    lossCondition: "NO_HEARTS", damageRule: "onePerLoss", creative: false,
    shop: true, craft: true, augments: true, pvp: false,
    ai: { allowed: ["TUTORIAL", "EASY", "MEDIUM", "HARD"], def: "TUTORIAL" },
    enemyScale: (round) => after(round, 10, 0.04), goldIncome: () => 10,
  },
  EndlessPvEFortress: {
    id: "EndlessPvEFortress", available: false, route: "fortress", startGold: 10, startHp: 100,
    lossCondition: "NO_HEARTS", damageRule: "survivorCount", creative: false,
    shop: false, craft: false, augments: false, pvp: false,
    ai: { allowed: ["EASY", "MEDIUM", "HARD"], def: "MEDIUM" },
    enemyScale: (round) => after(round, 10, 0.05), goldIncome: () => 10,
  },
  EndlessCreative: {
    id: "EndlessCreative", available: false, route: "solo", startGold: 10, startHp: 100,
    lossCondition: "NO_HEARTS", damageRule: "clamped", creative: true,
    shop: true, craft: true, augments: true, pvp: false,
    ai: { allowed: ["CREATIVE", "TUTORIAL"], def: "TUTORIAL" },
    enemyScale: () => 1, goldIncome: () => 0,
  },
  FortressPvP4: {
    id: "FortressPvP4", available: false, route: "coop", startGold: 10, startHp: 100,
    lossCondition: "NO_HEARTS", damageRule: "survivorCount", creative: false,
    shop: true, craft: true, augments: true, pvp: true,
    ai: { allowed: ["COOP4_EASY", "COOP4_MEDIUM", "COOP4_HARD"], def: "COOP4_MEDIUM" },
    enemyScale: () => 1, goldIncome: () => 10,
  },
};

export const isGameMode = (value: unknown): value is GameMode =>
  typeof value === "string" && (GAME_MODES as readonly string[]).includes(value);

export const normalizeGameMode = (value: unknown): GameMode => isGameMode(value) ? value : "EndlessPvEClassic";

/** Normal production selection gate. Locked ids normalize to Classic without mutating saved data. */
export function normalizeAvailableMode(value: unknown): GameMode {
  const id = normalizeGameMode(value);
  return MODE_CONFIG[id].available ? id : "EndlessPvEClassic";
}

export const modeConfig = (id: GameMode): GameModeConfig => MODE_CONFIG[id];
