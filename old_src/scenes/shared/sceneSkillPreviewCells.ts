import {
  COLS,
  PLAYER_COLS,
  RIGHT_COL_END,
  RIGHT_COL_START,
  ROWS
} from "../../core/boardConstants.js";
import {
  getWaspMaxTargets,
  gridKey,
  manhattan,
  sampleWithoutReplacement,
  starTargetBonus
} from "../../core/gameUtils.js";
import {
  buildSkillSelectionOptions,
  collectUnitsInForwardCone,
  collectLowestHpRatioUnits,
  collectUnitsBySelector,
  isAliveUnit,
  selectRowGuardUnits
} from "./sceneSkillTargeting.js";

import type { SkillTargetUnit, SkillTargetingSkill, SkillTargetSelector } from "./sceneSkillTargeting.js";

interface PreviewCell {
  row: number;
  col: number;
}

interface PreviewUnit extends SkillTargetUnit {
  row: number;
  col: number;
  atk?: number;
  star?: number;
}

interface PreviewSkill extends SkillTargetingSkill {
  effect: string;
  maxTargets?: number;
  maxHits?: number;
  allySelector?: string;
  targetSelector?: string;
  targetClasses?: string[] | null;
  runtimeShapeVersion?: number;
  previewCells?: (ctx: {
    attacker: PreviewUnit | null | undefined;
    target: PreviewUnit | null | undefined;
    allies: PreviewUnit[] | null | undefined;
    enemies: PreviewUnit[] | null | undefined;
    star: number;
    ROWS: number;
    COLS: number;
  }) => PreviewCell[] | null | undefined;
  splashSameRowCount?: number;
  areaPattern?: string;
  aoeRadius?: number;
  shieldSharePctToNearest?: number;
  rowGuardIncludeSelf?: boolean;
  rowGuardMaxAllies?: number;
  multiTargetSelector?: string;
  bonusTargetSelector?: string;
  uniqueTargets?: boolean;
  disableStarTargetScaling?: boolean;
  adjacentColumnAtkBuff?: number;
  adjacentColumnEvadeBuff?: number;
  adjacentColumnTurns?: number;
  [key: string]: unknown;
}

interface SharedPreviewContext {
  attacker: PreviewUnit;
  target: PreviewUnit;
  skill: PreviewSkill | null | undefined;
  allies: PreviewUnit[];
  enemies: PreviewUnit[];
}

function inferPreviewGridSize(ctx: { attacker: PreviewUnit; target: PreviewUnit; allies?: PreviewUnit[]; enemies?: PreviewUnit[] }) {
  const { attacker, target, allies = [], enemies = [] } = ctx;
  let maxRow = ROWS - 1;
  let maxCol = COLS - 1;
  const units = [attacker, target, ...(allies ?? []), ...(enemies ?? [])];
  units.forEach((unit: PreviewUnit | undefined) => {
    if (!unit || typeof unit !== "object") return;
    if (Number.isInteger(unit.row)) maxRow = Math.max(maxRow, unit.row);
    if (Number.isInteger(unit.col)) maxCol = Math.max(maxCol, unit.col);
  });
  return {
    rows: maxRow + 1,
    cols: maxCol + 1
  };
}

export function dedupeSharedPreviewCells(cells: PreviewCell[] | null | undefined) {
  const map = new Map<string, PreviewCell>();
  (cells ?? []).forEach((cell: PreviewCell | undefined) => {
    if (!cell) return;
    const key = gridKey(cell.row, cell.col);
    if (!map.has(key)) map.set(key, cell as PreviewCell);
  });
  return [...map.values()];
}

export function collectSharedSkillPreviewCells({ attacker, target, skill, allies, enemies }: SharedPreviewContext) {
  const { rows: runtimeRows, cols: runtimeCols } = inferPreviewGridSize({ attacker, target, allies, enemies });
  const cells: PreviewCell[] = [];
  const pushCell = (row: number | undefined, col: number | undefined) => {
    const r = row as number | undefined;
    const cl = col as number | undefined;
    if (r === undefined || cl === undefined || r < 0 || r >= runtimeRows || cl < 0 || cl >= runtimeCols) return;
    cells.push({ row: r, col: cl });
  };
  const pushUnits = (units: SkillTargetUnit[] | null | undefined) => units?.forEach((u) => pushCell(u.row as number, u.col as number));
  const selectPreviewUnits = (units: SkillTargetUnit[] | null | undefined, count: number, selector: SkillTargetSelector | undefined, extraOptions: Record<string, unknown> = {}) => collectUnitsBySelector(
    units as SkillTargetUnit[],
    selector ?? "random",
    count,
    {
      ...buildSkillSelectionOptions(null, attacker as SkillTargetUnit, target as SkillTargetUnit, skill as SkillTargetingSkill | null),
      ...extraOptions
    }
  );
  const pushCrossArea = (center: PreviewUnit | null | undefined) => {
    if (!center) return;
    const targetOnRight = center.col >= RIGHT_COL_START;
    const minCol = targetOnRight ? RIGHT_COL_START : 0;
    const maxCol = targetOnRight ? RIGHT_COL_END : PLAYER_COLS - 1;
    const pushCross = (row: number, col: number) => {
      if (col < minCol || col > maxCol) return;
      pushCell(row, col as number);
    };
    pushCross(center.row, center.col);
    pushCross(center.row - 1, center.col);
    pushCross(center.row + 1, center.col);
    pushCross(center.row, center.col - 1);
    pushCross(center.row, center.col + 1);
  };

  if (!skill) {
    pushCell(target.row, target.col);
    return dedupeSharedPreviewCells(cells);
  }

  if (typeof skill.previewCells === "function") {
    try {
      const customCells = skill.previewCells({
        attacker,
        target,
        allies,
        enemies,
        star: attacker?.star ?? 1,
        ROWS: runtimeRows,
        COLS: runtimeCols
      });
      if (Array.isArray(customCells) && customCells.length > 0) {
        return dedupeSharedPreviewCells(customCells.filter((cell) => (
          cell.row >= 0
          && cell.row < runtimeRows
          && cell.col >= 0
          && cell.col < runtimeCols
        )));
      }
    } catch (_error) {
      // Fall back to effect routing below.
    }
  }

  switch (skill.effect) {
    case "global_stun":
    case "global_debuff_atk":
    case "global_fire":
    case "global_slow":
    case "global_knockback":
    case "global_poison_team":
      pushUnits(enemies);
      break;
    case "global_tide_evade":
      pushUnits(allies);
      break;
    case "single_burst_armor_pen":
    case "single_poison_slow":
    case "single_poison_stack":
    case "single_bleed":
    case "knockback_charge":
    case "single_strong_poison":
    case "execute_heal":
    case "assassin_execute_rage_refund":
    case "backstab_crit":
    case "beak_disarm":
    case "ice_blast_freeze":
    case "quick_strike_rage":
    case "root_snare":
    case "root_snare_debuff":
    case "scavenge_heal":
    case "silent_kill_stealth":
    case "snipe_execute":
    case "sniper_crit":
    case "stealth_strike":
    case "sting_paralyze":
    case "web_trap_slow":
    case "single_silence_lock":
    case "death_mark":
    case "double_hit_gold_reward":
    case "lifesteal_disease_maxhp":
    case "true_execute":
      if (skill.effect === "root_snare" || skill.effect === "root_snare_debuff") {
        const selected = selectPreviewUnits(
          enemies.filter(isAliveUnit),
          Math.max(1, Math.round(skill.maxTargets || 1)),
          skill.targetSelector || "highest_matk",
          { targetClasses: skill.targetClasses }
        );
        if (selected.length) {
          pushUnits(selected);
          break;
        }
      }
      if (skill.effect === "single_silence_lock" && (skill.runtimeShapeVersion === 3 || Number(skill.maxTargets || 1) > 1)) {
        const selected = selectPreviewUnits(
          enemies.filter(isAliveUnit),
          Math.max(1, Math.round(Number(skill.maxTargets || 1) || 1)),
          skill.targetSelector || "front",
          { targetClasses: skill.targetClasses }
        );
        if (selected.length) {
          pushUnits(selected);
          break;
        }
      }
      pushCell(target.row, target.col);
      break;
    case "fire_arrow_burn": {
      pushCell(target.row, target.col);
      const splashCount = Math.max(0, Math.round(Number(skill?.splashSameRowCount ?? 0) || 0));
      if (splashCount > 0) {
        enemies
          .filter((enemy) => isAliveUnit(enemy) && enemy.uid !== target.uid && enemy.row === target.row)
          .sort((a, b) => manhattan(target, a) - manhattan(target, b))
          .slice(0, splashCount)
          .forEach((enemy) => pushCell(enemy.row, enemy.col));
      }
      break;
    }
    case "aoe_circle_stun":
      enemies.filter((enemy) => Math.abs(enemy.row - target.row) <= 1 && Math.abs(enemy.col - target.col) <= 1)
        .forEach((enemy) => pushCell(enemy.row, enemy.col));
      break;
    case "cleave_armor_break": {
      const aoeRadius = Number.isFinite(Number(skill?.aoeRadius))
        ? Math.max(0, Math.round(Number(skill.aoeRadius)))
        : 1;
      enemies.filter((enemy) => Math.abs(enemy.row - target.row) <= aoeRadius && Math.abs(enemy.col - target.col) <= aoeRadius)
        .forEach((enemy) => pushCell(enemy.row, enemy.col));
      break;
    }
    case "fireball_burn": {
      if (skill?.areaPattern === "cross_5") {
        pushCrossArea(target);
        break;
      }
      const aoeRadius = Number.isFinite(Number(skill?.aoeRadius))
        ? Math.max(0, Math.round(Number(skill.aoeRadius)))
        : 1;
      enemies.filter((enemy) => Math.abs(enemy.row - target.row) <= aoeRadius && Math.abs(enemy.col - target.col) <= aoeRadius)
        .forEach((enemy) => pushCell(enemy.row, enemy.col));
      break;
    }
    case "cone_shot":
      collectUnitsInForwardCone(enemies, target).forEach((enemy) => pushCell(enemy.row, enemy.col));
      break;
    case "shield_immune":
    case "revive_or_heal":
    case "team_buff_def":
    case "team_def_buff":
    case "heal_over_time":
    case "team_evade_buff":
    case "warcry_atk_def":
    case "team_rage_self_heal":
    case "frost_aura_buff":
    case "bless_rain_mdef":
    case "spring_aoe_heal":
    case "mass_cleanse":
    case "mimic_rage_buff":
    case "unicorn_atk_buff":
    case "soul_link_heal":
    case "wind_shield_ally":
    case "team_shield":
    case "light_purify":
    case "mirror_reflect":
    case "peace_heal_reduce_dmg":
    case "self_regen_team_heal":
    case "scout_buff_ally":
    case "pack_howl_rage":
    case "row_carry_rage_buff":
    case "row_random_rage_buff":
      if (
        skill.effect === "team_evade_buff"
        || skill.effect === "mass_cleanse"
        || skill.effect === "wind_shield_ally"
        || (skill.effect === "frost_aura_buff" && (skill.allySelector || skill.runtimeShapeVersion === 3))
        || skill.effect === "row_carry_rage_buff"
        || skill.effect === "row_random_rage_buff"
      ) {
        const selector = skill.effect === "row_carry_rage_buff"
          ? (skill.allySelector || "same_row_carry")
          : skill.effect === "row_random_rage_buff"
            ? (skill.allySelector || "same_row")
            : skill.effect === "wind_shield_ally"
              ? (skill.allySelector || "lowest_hp_pct_ally")
              : skill.effect === "frost_aura_buff"
                ? (skill.allySelector || "lowest_hp_pct_ally")
            : (skill.allySelector || "lowest_hp_pct_ally");
        const selected = selectPreviewUnits(
          allies.filter(isAliveUnit),
          skill.maxTargets ?? allies.length,
          selector,
          { excludeUid: skill?.includeSelf ? null : attacker?.uid }
        );
        if (selected.length) {
          pushUnits(selected);
          break;
        }
      }
      if (skill.effect === "soul_link_heal") {
        pushCell(attacker.row, attacker.col);
        collectLowestHpRatioUnits(
          allies.filter((ally) => isAliveUnit(ally) && ally.uid !== attacker.uid),
          Math.max(1, Math.min(2, Number(skill?.soulLinkTargetCount ?? ((attacker?.star ?? 0) >= 3 ? 2 : 1)) || 1))
        ).forEach((ally) => pushCell(ally.row, ally.col));
        break;
      }
      pushUnits(allies);
      break;
    case "self_armor_reflect":
    case "self_def_fortify":
    case "self_shield_immune":
    case "self_maxhp_boost":
    case "resilient_shield":
    case "guardian_pact":
    case "self_bersek":
    case "turtle_protection":
    case "rhino_counter":
    case "pangolin_reflect":
      pushCell(attacker.row, attacker.col);
      if (skill.effect === "resilient_shield" && (skill.shieldSharePctToNearest || 0) > 0) {
        const nearestAlly = allies
          .filter((ally) => ally.alive && ally.uid !== attacker.uid)
          .sort((a, b) => manhattan(attacker, a) - manhattan(attacker, b))[0];
        if (nearestAlly) pushCell(nearestAlly.row, nearestAlly.col);
      }
      if (skill.effect === "pangolin_reflect" && (skill.shieldSharePctToNearest || 0) > 0) {
        const nearestAlly = allies
          .filter((ally) => ally.alive && ally.uid !== attacker.uid)
          .sort((a, b) => manhattan(attacker, a) - manhattan(attacker, b))[0];
        if (nearestAlly) pushCell(nearestAlly.row, nearestAlly.col);
      }
      break;
    case "damage_shield_taunt":
      pushCell(target.row, target.col);
      pushUnits(enemies);
      break;
    case "damage_shield_reflect":
      pushCell(target.row, target.col);
      pushCell(attacker.row, attacker.col);
      break;
    case "roar_debuff_heal":
      pushCell(attacker.row, attacker.col);
      enemies.filter(isAliveUnit)
        .sort((a, b) => manhattan(attacker, a) - manhattan(attacker, b))
        .slice(0, Math.min(3, Math.max(1, attacker.star ?? 1)))
        .forEach((enemy) => pushCell(enemy.row, enemy.col));
      break;
    case "metamorphosis":
      pushCell(attacker.row, attacker.col);
      if ((attacker.star ?? 1) >= 2) pushUnits(allies);
      break;
    case "lifesteal_disease":
    case "self_atk_and_assist":
    case "self_blood_hunt":
    case "row_pack_followup":
      pushCell(target.row, target.col);
      pushUnits(allies.filter((ally) => ally.uid !== attacker.uid && ally.row === attacker.row));
      break;
    case "multi_disarm":
      enemies.sort((a, b) => (b.atk ?? 0) - (a.atk ?? 0)).slice(0, 3).forEach((enemy) => pushCell(enemy.row, enemy.col));
      break;
    case "random_lightning":
      pushCell(target.row, target.col);
      break;
    case "cross_5": {
      pushCrossArea(target);
      break;
    }
    case "row_multi":
      pushUnits(enemies.filter((enemy) => enemy.row === target.row).sort((a, b) => manhattan(attacker, a) - manhattan(attacker, b)).slice(0, skill.maxHits ?? 3));
      break;
    case "random_multi": {
      const pool = enemies.filter(isAliveUnit);
      const baseMaxHits = getWaspMaxTargets(attacker, skill) ?? skill.maxHits ?? 3;
      const maxHits = skill.id === "wasp_triple_strike" || skill.runtimeShapeVersion === 3 || skill.disableStarTargetScaling
        ? baseMaxHits
        : baseMaxHits + starTargetBonus(attacker.star ?? 1);
      pushUnits(sampleWithoutReplacement(pool, Math.min(maxHits, pool.length)));
      break;
    }
    case "column_freeze":
    case "dive_bomb":
    case "column_bleed":
    case "frost_storm":
      for (let row = 0; row < runtimeRows; row += 1) pushCell(row, target.col);
      break;
    case "ram_charge_pierce":
      pushCell(target.row, target.col);
      if (attacker?.side === "RIGHT") pushCell(target.row, target.col - 1);
      else pushCell(target.row, target.col + 1);
      break;
    case "aoe_circle":
    case "fish_bomb_aoe":
    case "ink_bomb_blind":
    case "dust_sleep":
      if (skill.effect === "ink_bomb_blind" && skill.runtimeShapeVersion === 3) {
        const aoeRadius = Math.max(0, Math.round(Number(skill.aoeRadius ?? 0) || 0));
        pushUnits(enemies.filter((enemy) => Math.abs(enemy.row - target.row) <= aoeRadius && Math.abs(enemy.col - target.col) <= aoeRadius));
        break;
      }
      pushUnits(enemies.filter((enemy) => Math.abs(enemy.row - target.row) <= 1 && Math.abs(enemy.col - target.col) <= 1));
      break;
    case "pollen_confuse":
      pushUnits(enemies.filter(isAliveUnit));
      break;
    case "cone_smash":
      pushUnits(collectUnitsInForwardCone(enemies, target));
      break;
    case "aoe_poison": {
      const aoeRadius = Number.isFinite(Number(skill?.aoeRadius))
        ? Math.max(0, Math.round(Number(skill.aoeRadius)))
        : 1;
      pushUnits(
        enemies.filter((enemy) => Math.abs(enemy.row - target.row) <= aoeRadius && Math.abs(enemy.col - target.col) <= aoeRadius)
      );
      break;
    }
    case "column_plus_splash":
      pushUnits(enemies.filter((enemy) => enemy.col === target.col || enemy.col === target.col - 1 || enemy.col === target.col + 1));
      break;
    case "row_cleave":
    case "piercing_shot":
    case "row_charge":
      pushUnits(enemies.filter((enemy) => enemy.row === target.row));
      break;
    case "ally_row_def_buff":
      if (skill.rowGuardIncludeSelf != null || skill.rowGuardMaxAllies != null) {
        pushUnits(selectRowGuardUnits(allies, attacker, {
          includeSelf: skill.rowGuardIncludeSelf !== false,
          maxAllies: skill.rowGuardMaxAllies ?? 0
        }));
      } else {
        pushUnits(allies.filter((ally) => ally.row === attacker.row));
      }
      break;
    case "dual_heal":
      pushUnits(collectLowestHpRatioUnits(allies, skill.maxTargets ?? 2));
      break;
    case "shield_cleanse": {
      const maxTargets = skill.runtimeShapeVersion === 3
        ? Math.max(1, Math.round(Number(skill.maxTargets || 1) || 1))
        : 1;
      pushUnits(collectLowestHpRatioUnits(allies, maxTargets));
      break;
    }
    case "team_rage":
      pushUnits(selectPreviewUnits(
        allies.filter(isAliveUnit),
        skill.maxTargets ?? 3,
        skill.allySelector || "lowest_rage_ally",
        { excludeUid: attacker?.uid }
      ));
      break;
    case "column_bless":
      pushUnits(
        allies.filter((ally) => ally.col === attacker.col
          || (
            skill.runtimeShapeVersion === 3
            && ((skill.adjacentColumnAtkBuff || 0) > 0 || (skill.adjacentColumnEvadeBuff || 0) > 0)
            && (ally.col === attacker.col - 1 || ally.col === attacker.col + 1)
          ))
      );
      break;
    case "fire_breath_cone":
      enemies.filter((enemy) => Math.abs(enemy.row - target.row) <= 1 && enemy.col >= target.col)
        .forEach((enemy) => pushCell(enemy.row, enemy.col));
      break;
    case "arrow_rain":
    case "multi_sting_poison":
    case "plague_spread": {
      const pool = enemies.filter((enemy) => enemy.alive !== false);
      const maxTargets = Math.max(1, Math.round(Number(skill?.maxHits ?? skill?.maxTargets ?? 3) || 3));
      pushUnits(sampleWithoutReplacement(pool, Math.min(maxTargets, pool.length)));
      break;
    }
    case "rapid_fire":
      pushCell(target.row, target.col);
      break;
    case "chain_shock": {
      const primary = enemies.find((enemy: PreviewUnit) => enemy.uid === target.uid) || target;
      if (primary?.alive !== false) pushCell(primary.row, primary.col);
      const pool = enemies.filter((enemy) => enemy.alive !== false && enemy.uid !== primary?.uid);
      const maxTargets = Math.min(3 + starTargetBonus(attacker.star ?? 1), enemies.filter((enemy) => enemy.alive !== false).length);
      pushUnits(sampleWithoutReplacement(pool, Math.max(0, maxTargets - 1)));
      break;
    }
    case "double_hit":
    case "double_poison_hit":
    case "x_slash_bleed":
    case "flame_combo":
      pushCell(target.row, target.col);
      break;
    case "dark_feather_debuff": {
      const pool = enemies.filter(isAliveUnit);
      const maxHits = Math.max(1, Math.round(Number(skill?.maxHits ?? 3) || 3));
      pushUnits(sampleWithoutReplacement(pool, Math.min(maxHits, pool.length)));
      break;
    }
    case "feather_bleed": {
      const pool = enemies.filter((enemy) => enemy.alive !== false);
      const picked = skill.uniqueTargets || skill.multiTargetSelector
        ? selectPreviewUnits(
            pool,
            Math.max(1, Math.round(Number(skill.maxHits ?? 3) || 3)),
            skill.multiTargetSelector || "random",
            { allowRepeatTargets: false }
          )
        : sampleWithoutReplacement(pool, Math.max(1, Math.round(Number(skill.maxHits ?? 3) || 3)));
      pushUnits(picked);
      if (skill.bonusTargetSelector) {
        const bonus = selectPreviewUnits(
          pool.filter((enemy) => !picked.some((unit) => unit.uid === enemy.uid)),
          1,
          skill.bonusTargetSelector,
          { allowRepeatTargets: false }
        );
        pushUnits(bonus);
      }
      break;
    }
    case "flash_blind":
      pushUnits(enemies.filter(isAliveUnit));
      break;
    default:
      pushCell(target.row, target.col);
      break;
  }

  if (!cells.length) pushCell(target.row, target.col);
  return dedupeSharedPreviewCells(cells);
}

