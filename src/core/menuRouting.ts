import { normalizeAiMode, type AiMode } from "./encounter";
import { isGameMode, MODE_CONFIG, normalizeGameMode, type GameMode } from "./modes";
import type { RunState } from "./run";

export type ModeAvailabilityPolicy = Partial<Record<GameMode, boolean>>;
export type MenuRouteDestination = "planning" | "fortress-map" | "coop-lobby";

export interface NewRunRoute {
  kind: "route";
  destination: MenuRouteDestination;
  mode: GameMode;
  aiMode: AiMode;
  forceNewRun: boolean;
  clearPriorRun: boolean;
  requiredPlayerCapacity?: 2 | 4;
}

export interface BlockedMenuRoute {
  kind: "blocked";
  reason: "missing" | "unavailable";
  mode?: GameMode;
}

export type NewRunRouteResult = NewRunRoute | BlockedMenuRoute;

export interface ContinueRoute {
  kind: "route";
  destination: MenuRouteDestination;
  mode: GameMode;
  aiMode: AiMode;
  forceNewRun: false;
  requiredPlayerCapacity?: 2 | 4;
}

export type ContinueRouteResult = ContinueRoute | BlockedMenuRoute;

export function modeAvailable(mode: GameMode, policy?: ModeAvailabilityPolicy): boolean {
  return policy?.[mode] ?? MODE_CONFIG[mode].available;
}

export function resolveModeAi(mode: GameMode, requested: unknown): AiMode {
  const config = MODE_CONFIG[mode];
  const normalized = normalizeAiMode(requested, config.ai.def);
  return config.ai.allowed.includes(normalized) ? normalized : config.ai.def;
}

export function coopCapacityForAi(aiMode: AiMode): 2 | 4 {
  return aiMode.startsWith("COOP4_") ? 4 : 2;
}

/** A116.1 canonical New Game gate/router. Valid-but-locked mode ids are rejected, never remapped into a new Classic run. */
export function resolveNewRunRoute(
  selectedMode: unknown,
  selectedAi: unknown,
  policy?: ModeAvailabilityPolicy,
): NewRunRouteResult {
  const mode = isGameMode(selectedMode) ? selectedMode : normalizeGameMode(selectedMode);
  if (!modeAvailable(mode, policy)) return { kind: "blocked", reason: "unavailable", mode };
  const config = MODE_CONFIG[mode];
  const aiMode = resolveModeAi(mode, selectedAi);
  if (config.route === "coop") {
    return {
      kind: "route", destination: "coop-lobby", mode, aiMode,
      forceNewRun: false, clearPriorRun: false, requiredPlayerCapacity: coopCapacityForAi(aiMode),
    };
  }
  return {
    kind: "route",
    destination: config.route === "fortress" ? "fortress-map" : "planning",
    mode,
    aiMode,
    forceNewRun: true,
    clearPriorRun: true,
  };
}

export interface ContinueRunSnapshot extends Pick<RunState, "mode" | "aiMode"> {
  fortress?: Pick<RunState["fortress"], "pendingNode">;
}

/** A116.2 Continue route. Saved mode/AI own the restore; availability only gates whether it may resume. */
export function resolveContinueRoute(
  run: ContinueRunSnapshot | null | undefined,
  policy?: ModeAvailabilityPolicy,
): ContinueRouteResult {
  if (!run || !isGameMode(run.mode)) return { kind: "blocked", reason: "missing" };
  const mode = run.mode;
  if (!modeAvailable(mode, policy)) return { kind: "blocked", reason: "unavailable", mode };
  const config = MODE_CONFIG[mode];
  const aiMode = resolveModeAi(mode, run.aiMode);
  if (config.route === "coop") {
    return {
      kind: "route", destination: "coop-lobby", mode, aiMode, forceNewRun: false,
      requiredPlayerCapacity: coopCapacityForAi(aiMode),
    };
  }
  if (config.route === "fortress") {
    return {
      kind: "route",
      destination: run.fortress?.pendingNode ? "planning" : "fortress-map",
      mode,
      aiMode,
      forceNewRun: false,
    };
  }
  return { kind: "route", destination: "planning", mode, aiMode, forceNewRun: false };
}
