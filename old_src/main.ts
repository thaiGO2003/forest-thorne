import { ThreeApp } from "./three/ThreeApp.js";
import { ThreeMainMenuScene } from "./three/ThreeMainMenuScene.js";
import { ThreePlanningScene } from "./three/ThreePlanningScene.js";
import { ThreeCombatScene } from "./three/ThreeCombatScene.js";
import type { PlayerState } from "./core/runState.js";
import type { Board, BoardUnit } from "./systems/BoardSystem.js";
import { warmupBrowserSpeechVoices } from "./core/browserSpeech.js";
import { GAME_SCALE_CONFIG } from "./three/ThreeGameConfig.js";
import { discordActivityRuntime } from "./platform/discordActivity.js";

/**
 * Window-owned Three.js application reference for idempotent browser boot.
 */
declare global {
  interface Window {
    __threeApp?: ThreeApp;
  }
}

export { GAME_SCALE_CONFIG };

/**
 * Start the production Three.js game loop: Menu -> Planning -> Combat -> Result -> Planning.
 */
function startThreeFlow(app: ThreeApp, modeId = "EndlessPvEClassic"): void {
  const startPlanning = (
    playerState: PlayerState,
    board?: Board,
    bench?: (BoardUnit | null)[],
    round = 1
  ) => {
    const planningScene = new ThreePlanningScene({
      player: playerState,
      board,
      bench,
      round,
      callbacks: {
        onStartCombat: (combatData) => {
          const combatScene = new ThreeCombatScene({
            player: combatData.player,
            board: combatData.board,
            bench: combatData.bench,
            round: combatData.round,
            callbacks: {
              onNextRound: (updatedPlayer) => {
                const nextRound = (combatData.round || 1) + 1;
                updatedPlayer.round = nextRound;
                startPlanning(updatedPlayer, combatData.board, combatData.bench, nextRound);
              },
              onRetry: () => {
                startPlanning(combatData.player, combatData.board, combatData.bench, combatData.round);
              },
              onExitToMenu: () => {
                app.setScene(new ThreeMainMenuScene({ onStart: (id) => startThreeFlow(app, id) }));
              }
            }
          });
          app.setScene(combatScene);
        }
      }
    });
    app.setScene(planningScene);
  };

  const initialPlayer: PlayerState = {
    hp: 100,
    gold: 25,
    xp: 0,
    level: 1,
    round: 1,
    gameMode: modeId,
    benchBonus: 0,
    deployCapBonus: 0
  } as unknown as PlayerState;

  startPlanning(initialPlayer, undefined, undefined, 1);
}

/**
 * Initialize the production Three.js application once per browser page.
 */
export function initThreeApp(): ThreeApp {
  const existing = window.__threeApp;
  if (existing) return existing;
  const container = document.getElementById("app") ?? document.body;
  const app = new ThreeApp({ container, quality: "high", showDemoUnits: false });
  app.setScene(new ThreeMainMenuScene({ onStart: (modeId) => startThreeFlow(app, modeId) }));
  window.__threeApp = app;
  return app;
}

/**
 * Initialize the standalone Three.js game engine and preserve Discord activity readiness.
 */
export async function bootstrapApp(
  _gameModeId: string = "EndlessPvEClassic",
  runtime: typeof discordActivityRuntime = discordActivityRuntime
): Promise<ThreeApp> {
  if (runtime?.isDiscordActivity) {
    await runtime.ready();
  }

  warmupBrowserSpeechVoices();
  return initThreeApp();
}

void bootstrapApp().catch((error: unknown) => {
  console.error("[AppBootstrap] Failed to initialize game", error);
});
