import { PHASE, PLAYER_COLS } from "../../core/boardConstants.js";
import { UNIT_BY_ID } from "../../data/unitCatalog.js";
import { getResolvedSkillDefinition, type SkillDefinition } from "../../data/skills.js";

import { EMOJI_FONT } from "../../core/uiTheme.js";
import { manhattan, getTopFirstRowSweep, randomItem, scaledBaseStats } from "../../core/gameUtils.js";
import { calculateCombatPowerFromStats } from "../../core/combatPower.js";
import { buildCombatTeamStatusModel } from "./combatHudRuntime.js";

import { getPlanningBoardOwnerSlot, getPlanningBoardRowCount, getPlanningBoardUnit, getPlanningCoopPlayerState } from "./planningCoopSessionRuntime.js";
import { getPlanningCreativeSandboxUnits, hasPlanningManualEnemySandboxUnits } from "./planningCreativeSandboxRuntime.js";
import { getPlanningUnitDisplayResources } from "./planningUnitInfoRuntime.js";

import { gridKey } from "../../core/gameUtils.js";
import { getPlanningEffectiveAtk, getPlanningEffectiveDef, getPlanningEffectiveMatk, getPlanningEffectiveMdef } from "./planningCombatCalcRuntime.js";
import { getPlanningAI } from "./planningDescriptionRuntime.js";
import { recordPlanningTutorialEvent } from "./planningTutorialRuntime.js";
import { clearSharedAttackPreview, drawSharedAttackPreviewCells, drawSharedAttackPreviewSword } from "./sceneAttackPreview.js";
import { collectSharedSkillPreviewCells, dedupeSharedPreviewCells } from "./sceneSkillPreviewCells.js";

interface AttackPreviewUnitLike {
  uid: string;
  side: string;
  row: number;
  col: number;
  classType?: string;
  star?: number;
  skillId?: string | null;
  range?: number;
  hp?: number;
  maxHp?: number;
  shield?: number;
  alive?: boolean;
  baseId?: string;
  id?: string;
  statuses?: {
    freeze?: number;
    stun?: number;
    sleep?: number;
    tauntTargetId?: string | null;
    [key: string]: unknown;
  };
  statusSources?: Record<string, unknown>;
  base?: {
    classType?: string;
    skillId?: string;
    stats?: {
      range?: number;
      hp?: number;
      [key: string]: unknown;
    };
  };
  [key: string]: unknown;
}

interface AttackPreviewCell {
  row: number;
  col: number;
}

interface PreviewGraphics {
  clear(): void;
  fillStyle(color: number, alpha: number): void;
  lineStyle(width: number, color: number, alpha: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  strokePath(): void;
  fillTriangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void;
  setDepth(depth: number): void;
  setVisible(visible: boolean): void;
}

interface AttackPreviewSceneLike {
  phase?: string;
  settingsVisible?: boolean;
  isActing?: boolean;
  previewHoverUnit: AttackPreviewUnitLike | null;
  attackPreviewLayer: PreviewGraphics | null;
  attackPreviewIcons: Array<{ destroy?: () => void }> | null;
  attackPreviewSword: PreviewGraphics | null;
  tileLookup: Map<string, { center: { x: number; y: number }; [key: string]: unknown }>;
  tutorialOverlay?: { handleTrigger?: (key: string) => void } | null;
  add?: unknown;
  drawDiamond: (gfx: PreviewGraphics, x: number, y: number) => void;
  gridToScreen: (col: number, row: number) => { x: number; y: number };
  player: {
    enemyPreview?: unknown[];
    [key: string]: unknown;
  };
  aiMode?: string;
  [key: string]: unknown;
}

type PowerOptions = { fullHp?: boolean; shieldOverride?: number | null };

export function canPlanningPreviewAttack(scene: AttackPreviewSceneLike, unit: AttackPreviewUnitLike | null | undefined): boolean {
    return Boolean(
      unit &&
      unit.alive &&
      (scene.phase === PHASE.COMBAT || scene.phase === PHASE.PLANNING) &&
      !scene.settingsVisible &&
      !scene.isActing &&
      (scene.phase !== PHASE.COMBAT ||
        (unit.statuses?.freeze ?? 0) <= 0 && (unit.statuses?.stun ?? 0) <= 0 && (unit.statuses?.sleep ?? 0) <= 0)
    );
}

export function showPlanningAttackPreviewForUnit(scene: AttackPreviewSceneLike, unit: AttackPreviewUnitLike): void {
    if (!canPlanningPreviewAttack(scene, unit)) {
      clearPlanningAttackPreview(scene);
      return;
    }
    const target = selectPlanningTarget(scene, unit);
    if (!target) {
      clearPlanningAttackPreview(scene);
      return;
    }
    const impact = getPlanningPreviewImpact(scene, unit, target);
    if (!impact.cells.length) {
      clearPlanningAttackPreview(scene);
      return;
    }

    scene.previewHoverUnit = unit;
    const skill = getResolvedSkillDefinition(unit.skillId, { baseId: unit.baseId ?? unit.id, star: unit.star });
    (scene.attackPreviewLayer as { clear?: () => void } | null)?.clear?.();
    clearPlanningAttackPreviewIcons(scene);
    drawSharedAttackPreviewCells(scene, impact.cells, (cell) => {
      const isPrimary = cell.row === impact.primary.row && cell.col === impact.primary.col;
      return {
        fillColor: isPrimary ? 0xffcc6a : 0x6fd6ff,
        fillAlpha: isPrimary ? 0.28 : 0.18,
        lineColor: isPrimary ? 0xffefb5 : 0xb8ebff,
        lineAlpha: 0.95,
        lineWidth: isPrimary ? 3 : 2
      };
    });
    drawPlanningAttackPreviewSword(scene, impact.primary.row, impact.primary.col, unit);
    // Normal attack preview is always fist icon for all roles.
    drawPlanningAttackPreviewPrimaryIcon(scene, impact.primary.row, impact.primary.col, "👊", -11);
    // Draw skill icons on ALL affected skill cells with per-cell icon
    if (impact.skillCells && impact.skillCells.length > 0) {
      impact.skillCells.forEach(cell => {
        // Determine if cell is ally or enemy based on column position
        const isAllyCell = unit.side === "LEFT" ? cell.col < PLAYER_COLS : cell.col >= PLAYER_COLS;
        const cellIcon = getPlanningPreviewSkillIcon(scene, unit, skill, isAllyCell);
        const sameAsBasic = cell.row === impact.primary.row && cell.col === impact.primary.col;
        const iconYOffset = sameAsBasic ? 10 : -11;
        drawPlanningAttackPreviewPrimaryIcon(scene, cell.row, cell.col, cellIcon, iconYOffset);
      });
    }
    recordPlanningTutorialEvent(scene as unknown as Parameters<typeof recordPlanningTutorialEvent>[0], "show_attack_preview");
    scene.tutorialOverlay?.handleTrigger?.("show_attack_preview");
}

export function clearPlanningAttackPreview(scene: AttackPreviewSceneLike, unit: AttackPreviewUnitLike | null = null): void {
    clearSharedAttackPreview(scene, unit, { clearIcons: true });
}

export function clearPlanningAttackPreviewIcons(scene: AttackPreviewSceneLike): void {
    if (!Array.isArray(scene.attackPreviewIcons)) scene.attackPreviewIcons = [];
    scene.attackPreviewIcons.forEach((obj) => obj?.destroy?.());
    scene.attackPreviewIcons = [];
}

export function getPlanningPreviewSkillIcon(
  _scene: AttackPreviewSceneLike,
  attacker: AttackPreviewUnitLike,
  skill: SkillDefinition | null,
  isAllyCell: boolean = false
): string {
    const fx = String(skill?.effect ?? "").toLowerCase();

    // For ally cells: show appropriate buff/heal/shield icon
    if (isAllyCell) {
      if (/shield|taunt|reflect|armor|protect|fortif|immune|pangolin|turtle|resilient|damage_shield|team_def|team_buff_def|ally_row_def|column_bless|guardian/.test(fx)) {
        return "🛡️";
      }
      if (/heal|regen|cleanse|peace|soul_link|spring|rebirth|revive|phoenix|hot|cure|dual_heal/.test(fx)) {
        return "💚";
      }
      // Default ally icon: buff sparkle
      return "✨";
    }

    // For enemy cells: show appropriate damage/debuff icon
    if (/debuff|disarm|slow|weaken|curse|roar_debuff/.test(fx)) {
      return "🔻";
    }
    if (/stun|freeze|sleep|paralyze|confuse/.test(fx)) {
      return "❄️";
    }
    if (/knockback/.test(fx)) return "🌊";
    if (/fire|burn/.test(fx)) return "🔥";
    if (/poison/.test(fx)) return "☠️";
    if (/bleed/.test(fx)) return "🩸";
    if (/silence|blind/.test(fx)) return "🚫";

    // Role-based enemy icon fallbacks
    if (attacker?.classType === "SUPPORT") return "✨";
    if (attacker?.classType === "ARCHER") return "🏹";
    if (attacker?.classType === "ASSASSIN") return "🗡️";
    if (attacker?.classType === "MAGE" || skill?.damageType === "magic") return "🪄";

    // Offensive melee fallback
    return "👊";
}

export function drawPlanningAttackPreviewPrimaryIcon(
  scene: AttackPreviewSceneLike,
  row: number,
  col: number,
  iconText: string = "👊",
  yOffset: number = -11
): void {
    const tile = scene.tileLookup?.get(gridKey(row, col));
    if (!tile) return;
    const topDepth = 3300;
    const badgeY = tile.center.y + yOffset;
    const add = scene.add as {
      circle: (x: number, y: number, r: number, c: number, a: number) => {
        destroy?: () => void;
        setStrokeStyle: (w: number, c: number, a: number) => unknown;
        setDepth: (d: number) => unknown;
      };
      text: (x: number, y: number, text: string, style: Record<string, unknown>) => {
        destroy?: () => void;
        setOrigin: (x: number, y?: number) => { destroy?: () => void; setDepth: (d: number) => unknown };
        setDepth: (d: number) => unknown;
      };
    };
    const badgeBg = add.circle(tile.center.x, badgeY, 12, 0x0b1724, 0.9);
    badgeBg.setStrokeStyle(1.4, 0xe6f5ff, 0.95);
    badgeBg.setDepth(topDepth);
    const badgeIcon = add.text(tile.center.x, badgeY, iconText, {
      fontFamily: EMOJI_FONT,
      fontSize: "13px",
      color: "#ffffff"
    }).setOrigin(0.5);
    badgeIcon.setDepth(topDepth + 1);
    scene.attackPreviewIcons?.push(badgeBg, badgeIcon);
}

export function drawPlanningAttackPreviewSword(
  scene: AttackPreviewSceneLike,
  row: number,
  col: number,
  attacker: AttackPreviewUnitLike
): void {
    drawSharedAttackPreviewSword(scene, row, col, attacker);
}

interface ImpactResult {
  primary: AttackPreviewCell;
  skillPrimary: AttackPreviewCell | null;
  skillCells: AttackPreviewCell[];
  cells: AttackPreviewCell[];
}

export function getPlanningPreviewImpact(
  scene: AttackPreviewSceneLike,
  attacker: AttackPreviewUnitLike,
  target: AttackPreviewUnitLike
): ImpactResult {
    const enemySide = attacker.side === "LEFT" ? "RIGHT" : "LEFT";
    const allies = collectPlanningPreviewUnits(scene, attacker.side ?? "LEFT");
    const enemies = collectPlanningPreviewUnits(scene, enemySide);
    const skill = getResolvedSkillDefinition(attacker.skillId, { baseId: attacker.baseId ?? attacker.id, star: attacker.star });
    const attackCell: AttackPreviewCell = { row: target.row ?? 0, col: target.col ?? 0 };
    const skillCells = collectPlanningSkillPreviewCells(scene, attacker, target, skill, allies, enemies);
    const impactCells = dedupePlanningPreviewCells(scene, [attackCell, ...skillCells]);
    let skillPrimary: AttackPreviewCell | null = null;
    if (skillCells.length) {
      const skillHasTarget = skillCells.some((cell) => cell.row === target.row && cell.col === target.col);
      skillPrimary = skillHasTarget
        ? attackCell
        : [...skillCells].sort((a, b) => manhattan(attacker, a) - manhattan(attacker, b))[0] ?? null;
    }
    return { primary: attackCell, skillPrimary, skillCells, cells: impactCells };
}

export function collectPlanningSkillPreviewCells(
  _scene: AttackPreviewSceneLike,
  attacker: AttackPreviewUnitLike,
  target: AttackPreviewUnitLike,
  skill: SkillDefinition | null,
  allies: AttackPreviewUnitLike[],
  enemies: AttackPreviewUnitLike[]
): AttackPreviewCell[] {
    return collectSharedSkillPreviewCells({ attacker: attacker as unknown as Parameters<typeof collectSharedSkillPreviewCells>[0]["attacker"], target, skill: skill as unknown as Parameters<typeof collectSharedSkillPreviewCells>[0]["skill"], allies, enemies });
}

export function dedupePlanningPreviewCells(
  _scene: AttackPreviewSceneLike,
  cells: AttackPreviewCell[]
): AttackPreviewCell[] {
    return dedupeSharedPreviewCells(cells);
}

export function buildPlanningPreviewActor(
  _scene: AttackPreviewSceneLike,
  side: string,
  row: number,
  col: number,
  classType: string,
  star: number = 1,
  skillId: string | null = null,
  range: number = 1
): AttackPreviewUnitLike {
    const hpBase = star >= 3 ? 460 : star === 2 ? 360 : 280;
    return {
      uid: `plan_${side}_${row}_${col}_${classType}_${star}`,
      side,
      row,
      col,
      classType,
      star,
      skillId,
      range,
      hp: hpBase,
      maxHp: hpBase,
      alive: true,
      statuses: { tauntTargetId: null },
      statusSources: {}
    };
}

export function calculatePlanningPreviewPower(
  scene: AttackPreviewSceneLike,
  baseUnit: { stats?: Parameters<typeof scaledBaseStats>[0] | undefined; classType?: string; tier?: number } | null | undefined,
  star: number,
  ownedUnit: Record<string, unknown> | null = null,
  options: PowerOptions = {}
): number {
    if (!baseUnit) return 0;
    const scaledStats = scaledBaseStats(baseUnit.stats ?? { hp: 0, atk: 0, def: 0, matk: 0, mdef: 0 }, star, baseUnit.classType ?? "WARRIOR");
    const hasRuntimeStats = ownedUnit && (
      ownedUnit.base
      || Number.isFinite(Number(ownedUnit.atk))
      || Number.isFinite(Number(ownedUnit.matk))
      || Number.isFinite(Number(ownedUnit.def))
      || Number.isFinite(Number(ownedUnit.mdef))
    );
    const previewHp = options.fullHp === true
      ? (ownedUnit?.maxHp ?? scaledStats.hp)
      : (ownedUnit?.hp ?? scaledStats.hp);
    const previewShield = options.shieldOverride != null
      ? options.shieldOverride
      : (ownedUnit?.shield ?? 0);
    return calculateCombatPowerFromStats({
      hp: Math.max(0, Math.round(Number(previewHp) || 0)),
      shield: Math.max(0, Math.round(Number(previewShield) || 0)),
      atk: hasRuntimeStats ? (getPlanningEffectiveAtk(scene, ownedUnit) ?? ownedUnit?.atk ?? scaledStats.atk) : (ownedUnit?.atk ?? scaledStats.atk),
      def: hasRuntimeStats ? (getPlanningEffectiveDef(scene, ownedUnit) ?? ownedUnit?.def ?? scaledStats.def) : (ownedUnit?.def ?? scaledStats.def),
      matk: hasRuntimeStats ? (getPlanningEffectiveMatk(scene, ownedUnit) ?? ownedUnit?.matk ?? scaledStats.matk) : (ownedUnit?.matk ?? scaledStats.matk),
      mdef: hasRuntimeStats ? (getPlanningEffectiveMdef(scene, ownedUnit) ?? ownedUnit?.mdef ?? scaledStats.mdef) : (ownedUnit?.mdef ?? scaledStats.mdef),
      star,
      tier: baseUnit.tier ?? 1
    });
}

interface TeamStatusEntry {
  side: string;
  alive: boolean;
  hp: number;
  maxHp: number;
  powerValue: number;
  powerMaxValue: number;
}

export function buildPlanningTeamStatusEntry(
  scene: AttackPreviewSceneLike,
  side: string,
  baseUnit: { stats?: Parameters<typeof scaledBaseStats>[0] | undefined; classType?: string } | null | undefined,
  star: number,
  previewUnit: Record<string, unknown> | null = null,
  ownerPlayer: unknown = scene.player
): TeamStatusEntry | null {
    if (!baseUnit) return null;
    const scaledStats = scaledBaseStats(baseUnit.stats ?? { hp: 0, atk: 0, def: 0, matk: 0, mdef: 0 }, star, baseUnit.classType ?? "WARRIOR");
    const previewHp = Math.max(0, Math.round(Number(previewUnit?.maxHp ?? scaledStats.hp) || 0));
    if (previewHp <= 0) return null;

    let previewShield = Math.max(0, Math.round(Number(previewUnit?.shield ?? 0) || 0));
    if (side === "LEFT" && previewUnit) {
      const displayResources = getPlanningUnitDisplayResources(scene as unknown as Parameters<typeof getPlanningUnitDisplayResources>[0], previewUnit, ownerPlayer as unknown as Parameters<typeof getPlanningUnitDisplayResources>[2]);
      previewShield = Math.max(previewShield, Math.round(Number(displayResources?.shield ?? 0) || 0));
    }

    const previewPower = calculatePlanningPreviewPower(scene, baseUnit, star, previewUnit, {
      fullHp: true,
      shieldOverride: previewShield
    });

    return {
      side,
      alive: true,
      hp: previewHp,
      maxHp: previewHp,
      powerValue: previewPower,
      powerMaxValue: previewPower
    };
}

export function buildPlanningTeamStatusModel(scene: AttackPreviewSceneLike): unknown {
    const previewUnits: TeamStatusEntry[] = [];

    for (let row = 0; row < getPlanningBoardRowCount(scene as unknown as Parameters<typeof getPlanningBoardRowCount>[0]); row += 1) {
      for (let col = 0; col < PLAYER_COLS; col += 1) {
        const unit = getPlanningBoardUnit(scene as unknown as Parameters<typeof getPlanningBoardUnit>[0], row, col);
        if (!unit?.base) continue;
        const ownerSlot = getPlanningBoardOwnerSlot(scene as unknown as Parameters<typeof getPlanningBoardOwnerSlot>[0], row);
        const ownerPlayer = getPlanningCoopPlayerState(scene as unknown as Parameters<typeof getPlanningCoopPlayerState>[0], ownerSlot) ?? scene.player;
        const entry = buildPlanningTeamStatusEntry(scene, "LEFT", unit.base, unit.star, unit as unknown as Record<string, unknown>, ownerPlayer);
        if (entry) previewUnits.push(entry);
      }
    }

    getPlanningCreativeSandboxUnits(scene as unknown as Parameters<typeof getPlanningCreativeSandboxUnits>[0], "LEFT").forEach((unit) => {
      if (!unit?.base) return;
      const entry = buildPlanningTeamStatusEntry(scene, "LEFT", unit.base as unknown as Parameters<typeof buildPlanningTeamStatusEntry>[2], unit.star, unit as unknown as Record<string, unknown>, scene.player);
      if (entry) previewUnits.push(entry);
    });

    const enemyPreview = hasPlanningManualEnemySandboxUnits(scene as unknown as Parameters<typeof hasPlanningManualEnemySandboxUnits>[0])
      ? getPlanningCreativeSandboxUnits(scene as unknown as Parameters<typeof getPlanningCreativeSandboxUnits>[0], "RIGHT")
      : (Array.isArray(scene.player?.enemyPreview) ? scene.player.enemyPreview : []);
    enemyPreview.forEach((preview) => {
      const p = preview as { base?: { classType?: string; stats?: { range?: number }; skillId?: string }; baseId?: string; star?: number; row?: number; col?: number } | null;
      const base = p?.base ?? UNIT_BY_ID[p?.baseId ?? ""];
      if (!base) return;
      const entry = buildPlanningTeamStatusEntry(scene, "RIGHT", base, Math.max(1, p?.star ?? 1), p, scene.player);
      if (entry) previewUnits.push(entry);
    });

    return buildCombatTeamStatusModel(previewUnits as unknown as Parameters<typeof buildCombatTeamStatusModel>[0], {
      resolveUnitPower: (unit) => Number((unit as unknown as TeamStatusEntry)?.powerValue ?? 0),
      resolveUnitPowerMax: (unit) => Number((unit as unknown as TeamStatusEntry)?.powerMaxValue ?? (unit as unknown as TeamStatusEntry)?.powerValue ?? 0)
    });
}

export function collectPlanningPreviewUnits(scene: AttackPreviewSceneLike, side: string): AttackPreviewUnitLike[] {
    const out: AttackPreviewUnitLike[] = [];
    if (side === "LEFT") {
      for (let row = 0; row < getPlanningBoardRowCount(scene as unknown as Parameters<typeof getPlanningBoardRowCount>[0]); row += 1) {
        for (let col = 0; col < PLAYER_COLS; col += 1) {
          const u = getPlanningBoardUnit(scene as unknown as Parameters<typeof getPlanningBoardUnit>[0], row, col);
          if (!u) continue;
          out.push(buildPlanningPreviewActor(scene, "LEFT", row, col, u.base.classType, u.star, u.base.skillId, u.base.stats.range));
        }
      }
      getPlanningCreativeSandboxUnits(scene as unknown as Parameters<typeof getPlanningCreativeSandboxUnits>[0], "LEFT").forEach((u) => {
        const sandboxBase = u.base as unknown as { classType?: string; skillId?: string; stats?: { range?: number } };
        const sandboxStats = sandboxBase?.stats as { range?: number } | undefined;
        out.push(buildPlanningPreviewActor(scene, "LEFT", u.row, u.col, sandboxBase?.classType ?? "WARRIOR", u.star, sandboxBase?.skillId, sandboxStats?.range));
      });
      return out;
    }

    const enemyPreview = hasPlanningManualEnemySandboxUnits(scene as unknown as Parameters<typeof hasPlanningManualEnemySandboxUnits>[0])
      ? getPlanningCreativeSandboxUnits(scene as unknown as Parameters<typeof getPlanningCreativeSandboxUnits>[0], "RIGHT")
      : (Array.isArray(scene.player?.enemyPreview) ? scene.player.enemyPreview as unknown[] : []);
    enemyPreview.forEach((raw) => {
      const p = raw as { baseId?: string; star?: number; row?: number; col?: number };
      const base = UNIT_BY_ID[p.baseId ?? ""];
      if (!base) return;
      out.push(buildPlanningPreviewActor(scene, "RIGHT", p.row ?? 0, p.col ?? 0, base.classType, p.star ?? 1, base.skillId, base.stats.range));
    });
    return out;
}

export function selectPlanningTarget(scene: AttackPreviewSceneLike, attacker: AttackPreviewUnitLike): AttackPreviewUnitLike | null {
    const enemySide = attacker.side === "LEFT" ? "RIGHT" : "LEFT";
    const enemies = collectPlanningPreviewUnits(scene, enemySide);
    if (!enemies.length) return null;
    const sorted = [...enemies].sort((a, b) => comparePlanningTargets(scene, attacker, a, b));
    return sorted[0] ?? null;
}

export function selectPlanningCombatTarget(
  scene: AttackPreviewSceneLike,
  attacker: AttackPreviewUnitLike,
  options: { deterministic?: boolean } = {}
): AttackPreviewUnitLike | null {
    const enemySide = attacker.side === "LEFT" ? "RIGHT" : "LEFT";
    const enemies = collectPlanningPreviewUnits(scene, enemySide);
    if (!enemies.length) return null;

    if (attacker.statuses?.tauntTargetId) {
      const tauntId = attacker.statuses.tauntTargetId;
      const forced = enemies.find((e) => e.uid === tauntId);
      if (forced) return forced;
    }

    const ai = getPlanningAI(scene as unknown as Parameters<typeof getPlanningAI>[0]);
    const keepFrontline = (attacker.range ?? 1) <= 1 && attacker.classType !== "ASSASSIN";
    const allowRandomTarget = attacker.classType !== "ASSASSIN";
    if (
      attacker.side === "RIGHT" &&
      allowRandomTarget &&
      !keepFrontline &&
      !options.deterministic &&
      ai &&
      Math.random() < ai.randomTargetChance
    ) {
      return randomItem(enemies);
    }

    const sorted = [...enemies].sort((a, b) => comparePlanningTargets(scene, attacker, a, b));
    return sorted[0] ?? null;
}

export function comparePlanningTargets(
  scene: AttackPreviewSceneLike,
  attacker: AttackPreviewUnitLike,
  a: AttackPreviewUnitLike,
  b: AttackPreviewUnitLike
): number {
    const sa = scorePlanningTarget(scene, attacker, a);
    const sb = scorePlanningTarget(scene, attacker, b);
    for (let i = 0; i < sa.length; i += 1) {
      if (sa[i] !== sb[i]) return sa[i] - sb[i];
    }
    return 0;
}

export function scorePlanningTarget(
  _scene: AttackPreviewSceneLike,
  attacker: AttackPreviewUnitLike,
  target: AttackPreviewUnitLike
): number[] {
    const myRow = attacker.row ?? 0;
    const myCol = attacker.col ?? 0;
    const targetRow = target.row ?? 0;
    const targetCol = target.col ?? 0;

    // Khoảng cách cột và hàng
    const colDist = Math.abs(targetCol - myCol);
    const rowDist = Math.abs(targetRow - myRow);
    const rowSweep = getTopFirstRowSweep(myRow, targetRow);
    const sameRow = targetRow === myRow ? 0 : 1;
    const totalDist = colDist + rowDist;

    // HP tiebreaker
    const hpRatio = Math.round(((target.hp ?? 0) / (target.maxHp ?? 1)) * 1000);
    const hpRaw = target.hp ?? 0;

    // === THUẬT TOÁN 1: CẬN CHIẾN (Ưu tiên CỘT) ===
    if ((attacker.range ?? 1) <= 1) {
      if (attacker.classType === "ASSASSIN") {
        // Sát thủ: Cột XA NHẤT → Cùng hàng → Lên trên → Xuống dưới
        const farthestCol = attacker.side === "LEFT" ? -targetCol : targetCol;
        return [farthestCol, sameRow, rowSweep, totalDist, hpRatio, hpRaw];
      } else {
        // Tank/Fighter: Cột GẦN NHẤT → Cùng hàng → Lên trên → Xuống dưới
        return [colDist, sameRow, rowSweep, totalDist, hpRatio, hpRaw];
      }
    }

    // === THUẬT TOÁN 2: TẦM XA (Ưu tiên HÀNG) ===
    // Archer/Mage/Support: Cùng hàng → Lên/xuống → Gần nhất trong hàng
    return [sameRow, rowSweep, colDist, totalDist, hpRatio, hpRaw];
}
