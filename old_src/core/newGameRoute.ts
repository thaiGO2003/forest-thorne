import { isCoopAiMode } from "./aiModes.js";
import { getGameModeRoute } from "./gameModeRuntime.js";

export const NEW_GAME_ROUTE_SOLO = "solo";
export const NEW_GAME_ROUTE_COOP_LOBBY = "coop_lobby";
export const NEW_GAME_ROUTE_FORTRESS_MAP = "fortress_map";

export function getNewGameRouteForAiMode(aiMode: string): string {
  return isCoopAiMode(aiMode) ? NEW_GAME_ROUTE_COOP_LOBBY : NEW_GAME_ROUTE_SOLO;
}

export function getNewGameRoute({ aiMode, gameModeId }: { aiMode?: string; gameModeId?: string } = {}): string {
  return getGameModeRoute(gameModeId ?? "", aiMode ?? "");
}
