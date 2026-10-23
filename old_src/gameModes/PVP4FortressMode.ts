import { createGameModeConfig, LOSE_CONDITION, AI_DIFFICULTY } from "./GameModeConfig.js";
import GameModeRegistry from "./GameModeRegistry.js";
import { COOP_4P_AI_MODES } from "../core/aiModes.js";
import {
  MODE_DAMAGE_SURVIVOR_COUNT,
  MODE_ROUTE_COOP_LOBBY
} from "../core/gameModeRuntime.js";

const PVP4FortressMode = createGameModeConfig("PVP4Fortress", {
  name: "PvP 4 Người: Công Thành",
  description: "Bốn người ghép cặp ngẫu nhiên từng vòng, đấu 1v1 kiểu TFT. Mỗi bên có 100 máu và bên thua bị trừ đúng bằng số quân đối phương còn sống; khi lẻ người sẽ đấu với bóng ma.",
  nameEn: "PvP 4 Players: Fortress",
  descriptionEn: "Four players rotate through random 1v1 pairings in a TFT-style fortress battle. Everyone starts at 100 HP, losses cost HP equal to surviving enemy units, and odd players face a ghost.",
  scenes: ["LoadingScene", "MainMenuScene", "PlanningScene", "CombatScene"],
  startingGold: 10,
  startingHP: 100,
  loseCondition: LOSE_CONDITION.NO_HEARTS,
  enabledSystems: {
    shop: true,
    crafting: true,
    augments: true,
    pvp: true
  },
  aiDifficulty: AI_DIFFICULTY.MEDIUM,
  goldScaling: () => 10,
  enemyScaling: () => 1,
  route: MODE_ROUTE_COOP_LOBBY,
  recommendedAiMode: "COOP4_MEDIUM",
  availableAiModes: COOP_4P_AI_MODES,
  playerCapacity: 4,
  fortressMode: true,
  damageRule: MODE_DAMAGE_SURVIVOR_COUNT,
  sessionType: "pvp_fortress"
});

GameModeRegistry.register(PVP4FortressMode);

export default PVP4FortressMode;
