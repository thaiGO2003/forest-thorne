import { getCoopPlayerCapacity, isCoopAiMode, normalizeAiMode } from "./aiModes.js";
import GameModeRegistry from "../gameModes/GameModeRegistry.js";

export const MODE_ROUTE_SOLO = "solo";
export const MODE_ROUTE_COOP_LOBBY = "coop_lobby";
export const MODE_ROUTE_FORTRESS_MAP = "fortress_map";
export const MODE_DAMAGE_ONE_PER_LOSS = "one_per_loss";
export const MODE_DAMAGE_CLAMPED_SURVIVORS = "clamped_survivors";
export const MODE_DAMAGE_SURVIVOR_COUNT = "survivor_count";

export function getGameModeConfig(gameModeId: string) {
  return GameModeRegistry.get(gameModeId) ?? GameModeRegistry.get("EndlessPvEClassic") ?? null;
}

export function getGameModeRoute(gameModeId: string, aiMode: string) {
  const config = getGameModeConfig(gameModeId);
  if (config?.route === MODE_ROUTE_COOP_LOBBY) return MODE_ROUTE_COOP_LOBBY;
  if (config?.route === MODE_ROUTE_FORTRESS_MAP) return MODE_ROUTE_FORTRESS_MAP;
  if (config?.route === MODE_ROUTE_SOLO) return MODE_ROUTE_SOLO;
  return isCoopAiMode(aiMode) ? MODE_ROUTE_COOP_LOBBY : MODE_ROUTE_SOLO;
}

export function getRecommendedAiModeForGameMode(gameModeId: string) {
  const config = getGameModeConfig(gameModeId);
  return typeof config?.recommendedAiMode === "string" ? config.recommendedAiMode : null;
}

export function getAvailableAiModesForGameMode(gameModeId: string) {
  const config = getGameModeConfig(gameModeId);
  return Array.isArray(config?.availableAiModes) && config.availableAiModes.length > 0
    ? config.availableAiModes
    : null;
}

export function getEffectiveAiModeForGameMode(gameModeId: string, aiMode: string) {
  const config = getGameModeConfig(gameModeId);
  const availableAiModes = getAvailableAiModesForGameMode(gameModeId);
  if (availableAiModes) {
    return [
      aiMode,
      getRecommendedAiModeForGameMode(gameModeId),
      config?.aiDifficulty,
      availableAiModes[0]
    ].find((mode) => availableAiModes.includes(mode)) ?? availableAiModes[0];
  }
  const recommendedAiMode = getRecommendedAiModeForGameMode(gameModeId)
    ?? config?.aiDifficulty
    ?? "MEDIUM";
  const route = getGameModeRoute(gameModeId, aiMode);
  if (route === MODE_ROUTE_COOP_LOBBY) {
    return normalizeAiMode(aiMode, recommendedAiMode);
  }
  if (isCoopAiMode(aiMode)) {
    return normalizeAiMode(recommendedAiMode, "MEDIUM");
  }
  return normalizeAiMode(aiMode, recommendedAiMode);
}

export function getRequiredPlayerCapacityForGameMode(gameModeId: string, aiMode: string) {
  const config = getGameModeConfig(gameModeId);
  const playerCapacity = config?.playerCapacity;
  if (Number.isInteger(playerCapacity) && playerCapacity !== undefined && playerCapacity > 1) {
    return Math.max(2, Math.min(4, playerCapacity));
  }
  return getCoopPlayerCapacity(aiMode);
}

export function isPvpGameMode(gameModeId: string) {
  return getGameModeConfig(gameModeId)?.enabledSystems?.pvp === true;
}

export function isFortressGameMode(gameModeId: string) {
  return getGameModeConfig(gameModeId)?.fortressMode === true;
}

export function usesBossRounds(gameModeId: string) {
  return getGameModeConfig(gameModeId)?.bossRounds === true;
}

export function computeModeDamage(gameModeId: string, survivorCount: number) {
  const survivors = Math.max(0, Math.floor(Number(survivorCount) || 0));
  const config = getGameModeConfig(gameModeId);
  if (config?.damageRule === MODE_DAMAGE_ONE_PER_LOSS) {
    return survivors > 0 ? 1 : 0;
  }
  if (config?.damageRule === MODE_DAMAGE_SURVIVOR_COUNT) {
    return survivors;
  }
  return Math.max(1, Math.min(4, survivors || 1));
}
