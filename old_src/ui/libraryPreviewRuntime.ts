import { PLAYER_COLS } from "../core/boardConstants.js";
import { getTopFirstRowSweep, manhattan, scaledBaseStats } from "../core/gameUtils.js";
import { getLocale, t } from "../i18n/index.js";
import {
  collectSharedSkillPreviewCells,
  resolveSharedSkillVisualPlan
} from "../scenes/shared/sceneSkillPreviewRuntime.js";

export interface PreviewActorLayoutEntry {
  role?: string;
  row: number;
  col: number;
  classType: string;
  hpRatio: number;
  atk: number;
  matk: number;
  range: number;
}

const ALLY_PREVIEW_LAYOUT: PreviewActorLayoutEntry[] = [
  { role: "anchor", row: 1, col: 0, classType: "FIGHTER", hpRatio: 0.74, atk: 68, matk: 18, range: 1 },
  { role: "row_partner", row: 2, col: 3, classType: "ARCHER", hpRatio: 0.52, atk: 78, matk: 24, range: 4 },
  { role: "support", row: 3, col: 2, classType: "SUPPORT", hpRatio: 0.67, atk: 24, matk: 60, range: 4 },
  { role: "column_partner", row: 4, col: 1, classType: "TANKER", hpRatio: 0.92, atk: 32, matk: 16, range: 1 }
];

const ENEMY_PREVIEW_LAYOUT: PreviewActorLayoutEntry[] = [
  { row: 1, col: 6, classType: "TANKER", hpRatio: 0.95, atk: 34, matk: 16, range: 1 },
  { row: 0, col: 8, classType: "MAGE", hpRatio: 0.58, atk: 20, matk: 78, range: 4 },
  { row: 2, col: 8, classType: "ARCHER", hpRatio: 0.51, atk: 76, matk: 20, range: 4 },
  { row: 3, col: 7, classType: "SUPPORT", hpRatio: 0.82, atk: 22, matk: 58, range: 4 },
  { row: 4, col: 9, classType: "FIGHTER", hpRatio: 0.88, atk: 82, matk: 20, range: 1 }
];

export interface PreviewActorInput {
  uid: string;
  baseId?: string | null;
  side: "LEFT" | "RIGHT";
  row: number;
  col: number;
  classType: string;
  star: number;
  skillId?: string | null;
  range?: number;
  hp?: number;
  maxHp?: number;
  atk?: number;
  matk?: number;
}

export interface PreviewActor extends PreviewActorInput {
  id: string;
  baseId: string;
  skillId: string | null;
  alive: boolean;
  statuses: { tauntTargetId: null };
  sprite: { active: boolean };
  range: number;
  hp: number;
  maxHp: number;
  atk: number;
  matk: number;
}

export interface PreviewCell {
  row: number;
  col: number;
}

export interface PreviewBadge extends PreviewCell {
  icon: string;
  side: "ally" | "enemy";
  primary: boolean;
}

export interface PreviewSkillLike {
  id?: string;
  effect?: string;
  damageType?: string;
  effectLabelEn?: string;
  effectLabelVi?: string;
  nameEn?: string;
  nameVi?: string;
}

export interface PreviewUnitLike {
  id: string;
  classType: string;
  skillId?: string | null;
  stats?: {
    hp?: number;
    range?: number;
    atk?: number;
    matk?: number;
  };
}

export interface PreviewPlan {
  mode: "attack" | "skill";
  star: number;
  attacker: PreviewActor;
  allies: PreviewActor[];
  enemies: PreviewActor[];
  target: PreviewActor | null;
  primary: PreviewCell | null;
  cells: PreviewCell[];
  badges: PreviewBadge[];
  legend: string[];
  actionTarget?: PreviewActor | null;
  skillCells?: PreviewCell[];
  visualTargets?: PreviewActor[];
}

export interface PreviewPlanOptions {
  mode?: "attack" | "skill";
  star?: number;
}

function createPreviewActor({
  uid,
  baseId,
  side,
  row,
  col,
  classType,
  star,
  skillId = null,
  range = 1,
  hp = 100,
  maxHp = 100,
  atk = 32,
  matk = 18
}: PreviewActorInput): PreviewActor {
  const resolvedBaseId = baseId ?? uid;
  return {
    uid,
    id: resolvedBaseId,
    baseId: resolvedBaseId,
    side,
    row,
    col,
    classType,
    star,
    skillId,
    range,
    hp,
    maxHp,
    atk,
    matk,
    alive: true,
    statuses: { tauntTargetId: null },
    sprite: { active: true }
  };
}

function buildAttackerActor(unit: PreviewUnitLike, star: number): PreviewActor {
  const stats = unit.stats ?? {};
  const baseStatsInput = {
    hp: stats.hp ?? 0,
    atk: stats.atk ?? 0,
    def: 0,
    matk: stats.matk ?? 0,
    mdef: 0,
    range: stats.range
  };
  const scaledStats = scaledBaseStats(baseStatsInput, star, unit.classType);
  const hp = Number(scaledStats?.hp ?? 100) || 100;
  return createPreviewActor({
    uid: `lib_preview_attacker_${unit.id}_${star}`,
    baseId: unit.id,
    side: "LEFT",
    row: 2,
    col: unit.classType === "ASSASSIN" ? 2 : 1,
    classType: unit.classType,
    star,
    skillId: unit.skillId ?? null,
    range: Number(scaledStats?.range ?? unit.stats?.range ?? 1) || 1,
    hp,
    maxHp: hp,
    atk: Number(scaledStats?.atk ?? unit.stats?.atk ?? 32) || 32,
    matk: Number(scaledStats?.matk ?? unit.stats?.matk ?? 18) || 18
  });
}

function buildAlliedCompanions(attacker: PreviewActor, star: number): PreviewActor[] {
  return ALLY_PREVIEW_LAYOUT.map((entry, index) => {
    const maxHp = 120 + (star - 1) * 28 + index * 6;
    return createPreviewActor({
      uid: `lib_preview_ally_${index}_${star}`,
      side: "LEFT",
      row: entry.row,
      col: entry.col,
      classType: entry.classType,
      star,
      range: entry.range,
      hp: Math.max(1, Math.round(maxHp * entry.hpRatio)),
      maxHp,
      atk: entry.atk,
      matk: entry.matk
    });
  }).filter((unit) => unit.row !== attacker.row || unit.col !== attacker.col);
}

function buildEnemyCompanions(star: number): PreviewActor[] {
  return ENEMY_PREVIEW_LAYOUT.map((entry, index) => {
    const maxHp = 128 + (star - 1) * 32 + index * 8;
    return createPreviewActor({
      uid: `lib_preview_enemy_${index}_${star}`,
      side: "RIGHT",
      row: entry.row,
      col: entry.col,
      classType: entry.classType,
      star,
      range: entry.range,
      hp: Math.max(1, Math.round(maxHp * entry.hpRatio)),
      maxHp,
      atk: entry.atk,
      matk: entry.matk
    });
  });
}

function computeSkillPrimary(attacker: PreviewActor, actionTarget: PreviewActor | null | undefined, skillCells: PreviewCell[]): PreviewCell | null {
  if (skillCells.some((cell) => cell.row === actionTarget?.row && cell.col === actionTarget?.col)) {
    return { row: actionTarget!.row, col: actionTarget!.col };
  }
  return [...skillCells].sort((a, b) => manhattan(attacker, a) - manhattan(attacker, b))[0] ?? null;
}

function compareTargets(attacker: PreviewActor, a: PreviewActor, b: PreviewActor): number {
  const sa = scoreTarget(attacker, a);
  const sb = scoreTarget(attacker, b);
  for (let i = 0; i < sa.length; i += 1) {
    if (sa[i] !== sb[i]) return sa[i] - sb[i];
  }
  return 0;
}

function scoreTarget(attacker: PreviewActor, target: PreviewActor): number[] {
  const myRow = attacker.row;
  const myCol = attacker.col;
  const colDist = Math.abs(target.col - myCol);
  const rowDist = Math.abs(target.row - myRow);
  const rowSweep = getTopFirstRowSweep(myRow, target.row);
  const sameRow = target.row === myRow ? 0 : 1;
  const totalDist = colDist + rowDist;
  const hpRatio = Math.round((target.hp / target.maxHp) * 1000);
  const hpRaw = target.hp;

  if (attacker.range <= 1) {
    if (attacker.classType === "ASSASSIN") {
      const farthestCol = attacker.side === "LEFT" ? -target.col : target.col;
      return [farthestCol, sameRow, rowSweep, totalDist, hpRatio, hpRaw];
    }
    return [colDist, sameRow, rowSweep, totalDist, hpRatio, hpRaw];
  }

  return [sameRow, rowSweep, colDist, totalDist, hpRatio, hpRaw];
}

function findTargetMeleeFrontline(attacker: PreviewActor, enemies: PreviewActor[]): PreviewActor | null {
  const myRow = attacker.row;
  const myCol = attacker.col;
  let best = null;
  let bestScore = Infinity;

  enemies.forEach((enemy) => {
    const colDist = Math.abs(enemy.col - myCol);
    const sameRow = enemy.row === myRow ? 0 : 1;
    const rowSweep = getTopFirstRowSweep(myRow, enemy.row);
    const score = colDist * 1000 + sameRow * 100 + rowSweep;
    if (score < bestScore) {
      bestScore = score;
      best = enemy;
    }
  });

  return best;
}

function findTargetAssassin(attacker: PreviewActor, enemies: PreviewActor[]): PreviewActor | null {
  const myRow = attacker.row;
  let best = null;
  let bestScore = -Infinity;
  const classPriority: Record<string, number> = { MAGE: 0, ARCHER: 1, SUPPORT: 2, FIGHTER: 3, TANKER: 4 };

  enemies.forEach((enemy) => {
    const farthestCol = attacker.side === "LEFT" ? enemy.col : -enemy.col;
    const sameRow = enemy.row === myRow ? 0 : 1;
    const rowSweep = getTopFirstRowSweep(myRow, enemy.row);
    const classScore = classPriority[enemy.classType] !== undefined ? classPriority[enemy.classType] : 5;
    const score = farthestCol * 1000000 - sameRow * 100000 - rowSweep * 1000 - classScore;
    if (score > bestScore) {
      bestScore = score;
      best = enemy;
    }
  });

  return best;
}

function findTargetRanged(attacker: PreviewActor, enemies: PreviewActor[]): PreviewActor | null {
  const myRow = attacker.row;
  const myCol = attacker.col;
  let best = null;
  let bestScore = Infinity;

  enemies.forEach((enemy) => {
    const sameRow = enemy.row === myRow ? 0 : 1;
    const rowSweep = getTopFirstRowSweep(myRow, enemy.row);
    const colDist = Math.abs(enemy.col - myCol);
    const score = sameRow * 1000 + rowSweep * 100 + colDist;
    if (score < bestScore) {
      bestScore = score;
      best = enemy;
    }
  });

  return best;
}

function selectPreviewTarget(attacker: PreviewActor, enemies: PreviewActor[]): PreviewActor | null {
  if (!enemies.length) return null;
  if (attacker.range <= 1 && attacker.classType !== "ASSASSIN") {
    return findTargetMeleeFrontline(attacker, enemies);
  }
  if (attacker.classType === "ASSASSIN") {
    return findTargetAssassin(attacker, enemies);
  }
  const target = findTargetRanged(attacker, enemies);
  if (target) return target;
  return [...enemies].sort((a, b) => compareTargets(attacker, a, b))[0] ?? null;
}

export function resolvePreviewSkillIcon(attacker: PreviewActor | null, skill: PreviewSkillLike | null | undefined, isAllyCell = false): string {
  const fx = String(skill?.effect ?? "").toLowerCase();

  if (isAllyCell) {
    if (/shield|taunt|reflect|armor|protect|fortif|immune|pangolin|turtle|resilient|damage_shield|team_def|team_buff_def|ally_row_def|column_bless|guardian/.test(fx)) {
      return "🛡️";
    }
    if (/heal|regen|cleanse|peace|soul_link|spring|rebirth|revive|phoenix|hot|cure|dual_heal|purify/.test(fx)) {
      return "💚";
    }
    return "✨";
  }

  if (/debuff|disarm|slow|weaken|curse|roar_debuff/.test(fx)) return "🔻";
  if (/stun|freeze|sleep|paralyze|confuse/.test(fx)) return "❄️";
  if (/knockback/.test(fx)) return "🌊";
  if (/fire|burn/.test(fx)) return "🔥";
  if (/poison/.test(fx)) return "☠️";
  if (/bleed/.test(fx)) return "🩸";
  if (/silence|blind/.test(fx)) return "🚫";

  if (attacker?.classType === "SUPPORT") return "✨";
  if (attacker?.classType === "ARCHER") return "🏹";
  if (attacker?.classType === "ASSASSIN") return "🗡️";
  if (attacker?.classType === "MAGE" || skill?.damageType === "magic") return "🪄";
  return "👊";
}

function getPreviewSkillLabel(skill: PreviewSkillLike | null | undefined): string {
  if (getLocale() === "en") {
    return skill?.effectLabelEn ?? skill?.nameEn ?? skill?.id ?? "skill";
  }
  return skill?.effectLabelVi ?? skill?.nameVi ?? skill?.id ?? "kỹ năng";
}

export function resolveLibraryPreviewPlan(unit: PreviewUnitLike, skill: PreviewSkillLike | null, { mode = "attack", star = 1 }: PreviewPlanOptions = {}): PreviewPlan {
  const attacker = buildAttackerActor(unit, star);
  const allies = [attacker, ...buildAlliedCompanions(attacker, star)];
  const enemies = buildEnemyCompanions(star);
  const target = selectPreviewTarget(attacker, enemies);
  const primaryAttackCell = target ? { row: target.row, col: target.col } : null;

  if (mode !== "skill" || !skill) {
    return {
      mode: "attack",
      star,
      attacker,
      allies,
      enemies,
      target,
      primary: primaryAttackCell,
      cells: primaryAttackCell ? [primaryAttackCell] : [],
      badges: primaryAttackCell ? [{ ...primaryAttackCell, icon: "👊", side: "enemy", primary: true }] : [],
      legend: primaryAttackCell
        ? [
            t("library.previewPrimaryTarget"),
            t("library.previewAttackStyle", {
              style: t(attacker.range >= 2 ? "library.previewAttackStyleRanged" : "library.previewAttackStyleMelee")
            })
          ]
        : [t("library.previewNoValidTarget")]
    };
  }

  const visualPlan = resolveSharedSkillVisualPlan({
    attacker: attacker as unknown as Parameters<typeof resolveSharedSkillVisualPlan>[0]["attacker"],
    target: (target || attacker) as unknown as Parameters<typeof resolveSharedSkillVisualPlan>[0]["target"],
    skill: skill as unknown as Parameters<typeof resolveSharedSkillVisualPlan>[0]["skill"],
    allyUnits: allies as unknown as Parameters<typeof resolveSharedSkillVisualPlan>[0]["allyUnits"],
    enemyUnits: enemies as unknown as Parameters<typeof resolveSharedSkillVisualPlan>[0]["enemyUnits"],
    getEffectiveAtk: (candidate) => Number((candidate as { atk?: number } | null | undefined)?.atk ?? 0) || 0,
    getEffectiveDef: () => 0,
    getEffectiveMatk: (candidate) => Number((candidate as { matk?: number } | null | undefined)?.matk ?? 0) || 0,
    getEffectiveMdef: () => 0
  });
  const actionTarget: PreviewActor = (visualPlan.actionTarget as unknown as PreviewActor) || target || attacker;
  const skillCells = collectSharedSkillPreviewCells({
    attacker: attacker as unknown as Parameters<typeof collectSharedSkillPreviewCells>[0]["attacker"],
    target: actionTarget as unknown as Parameters<typeof collectSharedSkillPreviewCells>[0]["target"],
    skill: skill as unknown as Parameters<typeof collectSharedSkillPreviewCells>[0]["skill"],
    allies: allies as unknown as Parameters<typeof collectSharedSkillPreviewCells>[0]["allies"],
    enemies: enemies as unknown as Parameters<typeof collectSharedSkillPreviewCells>[0]["enemies"]
  });


  const primary = skillCells.length
    ? computeSkillPrimary(attacker, actionTarget, skillCells)
    : primaryAttackCell;
  const cells = skillCells.length ? skillCells : (primary ? [primary] : []);
  const badges = cells.map((cell) => {
    const isAllyCell = cell.col < PLAYER_COLS;
    return {
      ...cell,
      side: isAllyCell ? "ally" : "enemy",
      icon: resolvePreviewSkillIcon(attacker, skill, isAllyCell),
      primary: primary ? cell.row === primary.row && cell.col === primary.col : false
    };
  });

  return {
    mode: "skill",
    star,
    attacker,
    allies,
    enemies,
    target,
    actionTarget,
    primary,
    cells,
    skillCells,
    visualTargets: (visualPlan.visualUnits ?? []) as unknown as PreviewActor[],
    badges: badges as PreviewBadge[],
    legend: [
      t("library.previewCells", { count: cells.length || 0 }),
      t("library.previewPattern", { skill: getPreviewSkillLabel(skill) })
    ]
  };
}
