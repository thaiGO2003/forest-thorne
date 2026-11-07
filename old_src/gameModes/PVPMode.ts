import { createGameModeConfig, AI_DIFFICULTY, LOSE_CONDITION } from "./GameModeConfig.js";

export const PVP_MODE_STATUS = "HIDDEN_INTERNAL";

export const PVP_MODE_GATE = {
  status: PVP_MODE_STATUS,
  reason: "Matchmaking va combat PVP chua duoc mo trong production.",
  bootVisibility: "internal-only",
  registryVisibility: "unregistered"
};

export const PVPMode = createGameModeConfig("PVP", {
  name: "PVP (Ẩn nội bộ)",
  description: "Stub nội bộ cho PVP. Không được đăng ký vào registry production.",
  scenes: ["LoadingScene", "MainMenuScene", "PlanningScene", "CombatScene"],
  startingGold: 10,
  startingHP: 3,
  loseCondition: LOSE_CONDITION.NO_HEARTS,
  enabledSystems: {
    shop: true,
    crafting: true,
    augments: true,
    pvp: false
  },
  aiDifficulty: AI_DIFFICULTY.MEDIUM,
  goldScaling: () => 10,
  enemyScaling: (round: number) => round
});

export function isPvpModeEnabledForProduction() {
  return false;
}

export default PVPMode;

