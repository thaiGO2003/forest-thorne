export interface ResolutionUnit {
  alive?: boolean;
  isDead?: boolean;
  [key: string]: unknown;
}

export interface ResolutionState {
  playerUnits?: ResolutionUnit[];
  enemyUnits?: ResolutionUnit[];
  combatLog?: Record<string, unknown>[];
  isFinished?: boolean;
  winner?: string | null;
  [key: string]: unknown;
}

export interface CombatEndResult {
  isFinished: boolean;
  winner: "player" | "enemy" | "draw" | null;
  playerUnitsRemaining?: number;
  enemyUnitsRemaining?: number;
  message?: string;
  error?: string;
}

export function checkCombatEnd(state: ResolutionState | null | undefined): CombatEndResult {
  if (!state) return { isFinished: false, winner: null, error: "Invalid state" };
  const playerUnits = state.playerUnits ?? [];
  const enemyUnits = state.enemyUnits ?? [];
  const alivePlayerUnits = playerUnits.filter((unit) => unit && unit.alive !== false && !unit.isDead);
  const aliveEnemyUnits = enemyUnits.filter((unit) => unit && unit.alive !== false && !unit.isDead);
  const playerCount = alivePlayerUnits.length;
  const enemyCount = aliveEnemyUnits.length;
  if (playerCount === 0 && enemyCount > 0) {
    state.isFinished = true;
    state.winner = "enemy";
    state.combatLog?.push({ type: "COMBAT_END", winner: "enemy", reason: "All player units defeated", playerUnitsRemaining: 0, enemyUnitsRemaining: enemyCount });
    return { isFinished: true, winner: "enemy", playerUnitsRemaining: 0, enemyUnitsRemaining: enemyCount, message: "Enemy victory - all player units defeated" };
  }
  if (enemyCount === 0 && playerCount > 0) {
    state.isFinished = true;
    state.winner = "player";
    state.combatLog?.push({ type: "COMBAT_END", winner: "player", reason: "All enemy units defeated", playerUnitsRemaining: playerCount, enemyUnitsRemaining: 0 });
    return { isFinished: true, winner: "player", playerUnitsRemaining: playerCount, enemyUnitsRemaining: 0, message: "Player victory - all enemy units defeated" };
  }
  if (playerCount === 0 && enemyCount === 0) {
    state.isFinished = true;
    state.winner = "draw";
    state.combatLog?.push({ type: "COMBAT_END", winner: "draw", reason: "All units defeated", playerUnitsRemaining: 0, enemyUnitsRemaining: 0 });
    return { isFinished: true, winner: "draw", playerUnitsRemaining: 0, enemyUnitsRemaining: 0, message: "Draw - all units defeated" };
  }
  return { isFinished: false, winner: null, playerUnitsRemaining: playerCount, enemyUnitsRemaining: enemyCount, message: "Combat continues" };
}
