import { createGameModeConfig, LOSE_CONDITION, AI_DIFFICULTY } from "./GameModeConfig.js";
import GameModeRegistry from "./GameModeRegistry.js";
import { SOLO_FULL_AI_MODES } from "../core/aiModes.js";
import {
  MODE_DAMAGE_SURVIVOR_COUNT,
  MODE_ROUTE_FORTRESS_MAP
} from "../core/gameModeRuntime.js";

const EndlessPvEFortressMode = createGameModeConfig("EndlessPvEFortress", {
  name: "PvE Vô Tận: Công Thành",
  description: "Chọn đường trên bản đồ trước mỗi vòng để ghé chợ, nhà thuốc, ổ thú hoặc lò rèn. Chế độ này bỏ công nghệ, pháp ấn và bàn chế tạo mặc định; phe địch chỉ có quân, không có trụ.",
  nameEn: "PvE Endless: Fortress",
  descriptionEn: "Choose your route on the map before each round to visit shops, pharmacy, beast dens, or blacksmiths. This mode removes the tech tree, augments, and always-on crafting; enemies field units only, with no towers.",
  scenes: ["LoadingScene", "MainMenuScene", "PlanningScene", "CombatScene"],
  startingGold: 10,
  startingHP: 100,
  loseCondition: LOSE_CONDITION.NO_HEARTS,
  enabledSystems: {
    shop: false,
    crafting: false,
    augments: false,
    pvp: false
  },
  aiDifficulty: AI_DIFFICULTY.MEDIUM,
  goldScaling: () => 10,
  enemyScaling: (round: number) => {
    if (round <= 10) return 1;
    return 1 + (round - 10) * 0.05;
  },
  route: MODE_ROUTE_FORTRESS_MAP,
  recommendedAiMode: "MEDIUM",
  availableAiModes: SOLO_FULL_AI_MODES,
  fortressMode: true,
  renderStrongholds: false,
  bossRounds: false,
  damageRule: MODE_DAMAGE_SURVIVOR_COUNT
});

GameModeRegistry.register(EndlessPvEFortressMode);

export default EndlessPvEFortressMode;
