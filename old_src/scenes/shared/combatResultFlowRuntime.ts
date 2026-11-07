import type Phaser from "phaser";
import { startManagedScene } from "../sceneLazyRouting.js";
import { buildSharedRoundRewardLog } from "./sceneLogRuntime.js";
import { isCreativeMode } from "../../core/creativeMode.js";
import { computeModeDamage } from "../../core/gameModeRuntime.js";
import { sumTeamAssassinBounty, sumTeamAssassinBountyKills } from "../../core/rolePassives.js";

type Unit = { side?: string; star?: number; [key: string]: unknown };
type LootEntry = Record<string, unknown>;
type Result = {
  winnerSide: "LEFT" | "RIGHT" | "DRAW";
  round: number;
  leftAlive: number;
  leftTotal: number;
  rightSurvivors: number;
  rightAlive: number;
  rightTotal: number;
  damage: number;
  goldDelta: number;
  goldBase: number;
  goldStarBonus: number;
  assassinBountyGold: number;
  assassinBountyKills: number;
  lootDrops: LootEntry[];
  lootDropDetails: LootEntry[];
  creativeMode?: boolean;
  creativePassiveXpSuppressed?: boolean;
  creativeIgnoreDefeat?: boolean;
  [key: string]: unknown;
};
type ResultScene = Phaser.Scene & {
  phase: string; getCombatUnits: (side: string) => Unit[]; combatUnits: Unit[]; combatLootDrops: LootEntry[]; combatLootDropDetails: LootEntry[];
  player: { round: number; gameMode?: string; hp?: number; gold?: number; [key: string]: unknown };
  gameMode?: string; aiMode?: unknown;
  toggleSettingsOverlay: (open: boolean) => void;
  gainXp: (amount: number) => void;
  addLog: (message: string, phase: string) => void;
  handlePvpCombatResolution?: (result: Result) => string | undefined;
  handleCoopCombatResolution?: (result: Result) => string | undefined;
  clearCombatSprites: () => void;
  runStatePayload: unknown;
};

export function buildCombatRoundResult(scene: ResultScene, winnerSide: "LEFT" | "RIGHT" | "DRAW"): Result {
  const leftSurvivors = scene.getCombatUnits("LEFT").length;
  const leftTeamUnits = Array.isArray(scene.combatUnits) ? scene.combatUnits.filter((unit) => unit?.side === "LEFT") : [];
  const rightSurvivors = scene.getCombatUnits("RIGHT").length;
  const rightTeamUnits = Array.isArray(scene.combatUnits) ? scene.combatUnits.filter((unit) => unit?.side === "RIGHT") : [];
  const winGoldBase = rightTeamUnits.length;
  const winGoldStarBonus = rightTeamUnits.reduce((sum, unit) => {
    const star = Number.isFinite(Number(unit?.star)) ? Math.floor(Number(unit?.star)) : 1;
    return sum + Math.max(0, star - 1);
  }, 0);
  const assassinBountyGold = sumTeamAssassinBounty(leftTeamUnits, "LEFT");
  const assassinBountyKills = sumTeamAssassinBountyKills(leftTeamUnits, "LEFT");
  const gameModeId = scene.player?.gameMode ?? scene.gameMode ?? "EndlessPvEClassic";
  return {
    winnerSide, round: scene.player.round,
    leftAlive: leftSurvivors, leftTotal: leftTeamUnits.length,
    rightSurvivors, rightAlive: rightSurvivors, rightTotal: rightTeamUnits.length,
    damage: computeModeDamage(gameModeId, rightSurvivors),
    goldDelta: assassinBountyGold, goldBase: winGoldBase, goldStarBonus: winGoldStarBonus,
    assassinBountyGold, assassinBountyKills,
    lootDrops: Array.isArray(scene.combatLootDrops) ? [...scene.combatLootDrops] : [],
    lootDropDetails: Array.isArray(scene.combatLootDropDetails) ? scene.combatLootDropDetails.map((entry) => ({ ...entry })) : []
  };
}

export function resolveCombatToPlanning(scene: ResultScene, winnerSide: "LEFT" | "RIGHT" | "DRAW"): void {
  if (scene.phase !== "COMBAT") return;
  scene.toggleSettingsOverlay(false);
  scene.phase = "PLANNING";
  const result: Result = buildCombatRoundResult(scene, winnerSide);
  const creative = isCreativeMode(scene.aiMode as string);
  result.creativeMode = creative;
  if (winnerSide === "LEFT") {
    result.goldDelta += result.goldBase + result.goldStarBonus;
    result.creativePassiveXpSuppressed = creative;
    if (!creative) scene.gainXp(2);
    const logEntry = buildSharedRoundRewardLog({
      round: scene.player.round, outcome: "WIN",
      baseGold: result.goldBase, starBonus: result.goldStarBonus,
      assassinBountyGold: result.assassinBountyGold,
      xpEarned: creative ? 0 : 2,
      playerHearts: scene.player?.hp ?? null,
      goldAfter: creative ? "∞" : Number(scene.player?.gold ?? 0) + result.goldDelta
    } as unknown as Parameters<typeof buildSharedRoundRewardLog>[0]);
    if (logEntry) scene.addLog(logEntry.previewText, "COMBAT");
  } else if (winnerSide === "DRAW") {
    result.damage = 0;
    const drawLog = buildSharedRoundRewardLog({
      round: scene.player.round, outcome: "DRAW",
      assassinBountyGold: result.assassinBountyGold,
      playerHearts: scene.player?.hp ?? null
    } as unknown as Parameters<typeof buildSharedRoundRewardLog>[0]);
    if (drawLog) scene.addLog(drawLog.previewText, "COMBAT");
  } else {
    result.creativeIgnoreDefeat = creative;
    const loseLog = buildSharedRoundRewardLog({
      round: scene.player.round, outcome: "LOSE",
      assassinBountyGold: result.assassinBountyGold,
      playerHearts: scene.player?.hp ?? null
    } as unknown as Parameters<typeof buildSharedRoundRewardLog>[0]);
    if (loseLog) scene.addLog(loseLog.previewText, "COMBAT");
  }

  const pvpResolutionMode = scene.handlePvpCombatResolution?.(result);
  if (pvpResolutionMode === "wait") return;
  const coopResolutionMode = scene.handleCoopCombatResolution?.(result);
  if (coopResolutionMode === "wait") return;
  scene.clearCombatSprites();
  startManagedScene(scene as unknown as Phaser.Scene, "PlanningScene", { restoredState: scene.runStatePayload, combatResult: result });
}
