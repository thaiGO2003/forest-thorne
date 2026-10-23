// Canonical Planning enemy-preview lifecycle (A68, A103, A114). Pure gameplay data only.
import { getUnit, UNIT_BY_ID } from "../content/catalog";
import type { Placement } from "./combat";
import { creativeRightEnemyOverride } from "./creative";
import { generateEncounter } from "./encounter";
import { FORTRESS_BUDGET_MULTIPLIER } from "./fortress";
import { modeConfig } from "./modes";
import type { RunState } from "./run";
import { normalizeVariantTraits, type VariantTraitRef } from "./variants";

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

/** Preview entries are identity/placement only; temporary combat state never belongs here. */
export function normalizeEnemyPreview(value: unknown): Placement[] {
  if (!Array.isArray(value)) return [];
  const out: Placement[] = [];
  for (let index = 0; index < value.length; index++) {
    const raw = record(value[index]);
    if (!raw || typeof raw.baseId !== "string" || !UNIT_BY_ID.has(raw.baseId)) continue;
    const row = Math.min(4, Math.max(0, Math.floor(Number(raw.row) || 0)));
    const col = Math.min(9, Math.max(5, Math.floor(Number(raw.col) || 5)));
    const star = Math.min(3, Math.max(1, Math.round(Number(raw.star) || 1)));
    const uid = typeof raw.uid === "string" && raw.uid.trim()
      ? raw.uid
      : `preview:${raw.baseId}:${row}:${col}:${index}`;
    const equips = Array.isArray(raw.equips) ? raw.equips.filter((id): id is string => typeof id === "string") : [];
    const traits: VariantTraitRef[] = Array.isArray(raw.traits)
      ? raw.traits.flatMap((value) => {
        const trait = record(value);
        return trait && typeof trait.id === "string" ? [{ id: trait.id, seed: Number(trait.seed) }] : [];
      })
      : [];
    out.push({
      uid,
      baseId: raw.baseId,
      star,
      row,
      col,
      equips,
      traits: normalizeVariantTraits(getUnit(raw.baseId).role, traits),
    });
  }
  return out;
}

function seededPreviewRng(seed: number, round: number): () => number {
  let state = ((seed >>> 0) ^ Math.imul(Math.max(1, Math.floor(round)), 0x9e3779b1)) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface EnemyPreviewOptions {
  force?: boolean;
  /** Co-op guest must consume host preview instead of generating locally. */
  isHost?: boolean;
  sharedPreview?: unknown;
  sharedPreviewRound?: number;
  sharedEnemyBudget?: number;
  players?: 1 | 2 | 4;
}

export interface EnemyPreviewResult {
  units: Placement[];
  round: number;
  budget: number;
  source: "creative" | "saved" | "shared" | "generated";
}

export function resolveEnemyPreview(s: RunState, options: EnemyPreviewOptions = {}): EnemyPreviewResult | null {
  const round = Math.max(1, Math.floor(Number(s.round) || 1));
  const cfg = modeConfig(s.mode);
  const creative = cfg.creative ? creativeRightEnemyOverride(s.creativeSandboxUnits) : null;
  if (creative) {
    s.enemyPreview = [];
    s.enemyPreviewRound = round;
    s.enemyBudget = 0;
    return { units: normalizeEnemyPreview(creative), round, budget: 0, source: "creative" };
  }

  if (options.isHost === false) {
    if (Math.floor(Number(options.sharedPreviewRound) || 0) !== round) return null;
    const shared = normalizeEnemyPreview(options.sharedPreview);
    if (!shared.length) return null;
    s.enemyPreview = shared;
    s.enemyPreviewRound = round;
    s.enemyBudget = Math.max(0, Math.round(Number(options.sharedEnemyBudget) || 0));
    return { units: shared, round, budget: s.enemyBudget, source: "shared" };
  }

  if (!options.force && s.enemyPreviewRound === round && s.enemyPreview.length > 0) {
    const normalized = normalizeEnemyPreview(s.enemyPreview);
    s.enemyPreview = normalized;
    return { units: normalized, round, budget: Math.max(0, s.enemyBudget), source: "saved" };
  }

  const pendingType = cfg.route === "fortress" ? s.fortress.pendingNode?.type : undefined;
  const budgetMult = pendingType ? FORTRESS_BUDGET_MULTIPLIER[pendingType] : 1;
  const generated = generateEncounter({
    round,
    mode: s.aiMode,
    rng: seededPreviewRng(s.rngSeed, round),
    sandbox: cfg.creative,
    bossRounds: s.mode === "EndlessPvEClassic",
    players: options.players,
    budgetMult,
  });
  const units = normalizeEnemyPreview(generated.units);
  s.enemyPreview = units;
  s.enemyPreviewRound = round;
  s.enemyBudget = Math.max(0, Math.round(generated.budget));
  return { units, round, budget: s.enemyBudget, source: "generated" };
}
