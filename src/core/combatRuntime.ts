// Nonvisual production combat owner: persisted preview -> one-shot materialization -> deterministic simulation -> result commit.
import {
  materializeCombatFormation,
  simulateMaterialized,
  type CombatEvent,
  type Placement,
  type Side,
} from "./combat";
import { AI_PROFILE } from "./encounter";
import { environmentFor } from "./environment";
import { rollLoot } from "./loot";
import { MODE_CONFIG } from "./modes";
import {
  applyRoundResult,
  enemyPreview,
  playerCombatBonus,
  runSynergies,
  startCombat,
  type RoundResultSummary,
  type RunState,
} from "./run";
import { computeSynergies } from "./synergy";
import type { EnemyPreviewResult } from "./preview";

export interface RunCombatRosterEntry {
  uid: string;
  baseId: string;
  star: number;
  side: Side;
  hp: number;
  maxHp: number;
  rage: number;
  rageMax: number;
  shield: number;
}

export interface RunCombatSession {
  combatId: string;
  round: number;
  previewSource: EnemyPreviewResult["source"];
  roster: RunCombatRosterEntry[];
  events: CombatEvent[];
  finish(): RoundResultSummary | null;
}

function boardPlacements(s: RunState): Placement[] {
  return s.board.flatMap((unit, index) => unit ? [{
    uid: unit.uid,
    baseId: unit.baseId,
    star: unit.star,
    row: Math.floor(index / 5),
    col: index % 5,
    equips: [...unit.equips],
    traits: [...(unit.traits ?? [])],
  }] : []);
}

function clonePlacement(unit: Placement): Placement {
  return {
    ...unit,
    equips: unit.equips ? [...unit.equips] : undefined,
    traits: unit.traits ? [...unit.traits] : undefined,
  };
}

function seededRng(seed: number): () => number {
  let value = seed | 0;
  return () => {
    value = (value + 0x6d2b79f5) | 0;
    let t = Math.imul(value ^ (value >>> 15), value | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Resolve one production combat from canonical run state.
 *
 * The persisted/Creative preview is consumed as-is, battle fighters are materialized exactly once,
 * and finish() is the only result-application boundary. Persistent board/preview placements are cloned
 * before battle-local HP/rage/shield/status state is constructed.
 */
export function resolveRunCombat(s: RunState): RunCombatSession | null {
  const preview = enemyPreview(s);
  if (!preview?.units.length) return null;

  const left = boardPlacements(s);
  if (!left.length) return null;
  const right = preview.units.map(clonePlacement);

  const round = s.round;
  const baseSeed = s.rngSeed | 0;
  const combatSeed = (baseSeed ^ Math.imul(round, 0x45d9f3b)) | 0;
  const combatId = `solo:${round}:${combatSeed >>> 0}`;
  const environment = environmentFor(round);
  const ai = AI_PROFILE[s.aiMode];
  const configuredScale = preview.source === "creative" ? 1 : MODE_CONFIG[s.mode].enemyScale(round);
  const roundScale = Number.isFinite(configuredScale) && configuredScale > 0 ? configuredScale : 1;

  if (startCombat(s) !== null) return null;

  const formation = materializeCombatFormation(left, right, {
    bonus: { L: playerCombatBonus(s) },
    synergy: {
      L: runSynergies(s),
      R: computeSynergies(right.map((placement) => placement.baseId)),
    },
    scale: {
      R: {
        hp: ai.hp,
        atk: ai.atk,
        matk: ai.matk,
        roundScale,
        tutorialHpHalf: s.aiMode === "TUTORIAL" && round >= 1 && round <= 8,
      },
    },
    environment,
  });

  const roster: RunCombatRosterEntry[] = formation.map((fighter) => ({
    uid: fighter.uid,
    baseId: fighter.baseId,
    star: fighter.star,
    side: fighter.side,
    hp: fighter.hp,
    maxHp: fighter.maxHp,
    rage: fighter.rage,
    rageMax: fighter.rageMax,
    shield: fighter.shield,
  }));

  const result = simulateMaterialized(formation, {
    seed: combatSeed,
    gold: { L: s.gold },
    rageGain: { R: ai.rageGain },
    rightRandomTargetChance: ai.randomTarget,
  });

  const rightSurvivors = new Set(
    result.survivors.filter((fighter) => fighter.side === "R").map((fighter) => fighter.uid),
  );
  const lootRng = seededRng(combatSeed ^ 0x51ed270b);
  const drops = right
    .filter((unit) => !rightSurvivors.has(unit.uid))
    .flatMap((unit) => rollLoot(unit.baseId, unit.star, lootRng));
  const winner = result.winner === "L" ? "LEFT" : result.winner === "R" ? "RIGHT" : "DRAW";

  return {
    combatId,
    round,
    previewSource: preview.source,
    roster,
    events: result.events,
    finish() {
      return applyRoundResult(s, {
        combatId,
        winner,
        enemySurvivors: result.alive.R,
        enemyStars: right.map((unit) => unit.star),
        bounty: result.bounty.L,
        drops,
      });
    },
  };
}
