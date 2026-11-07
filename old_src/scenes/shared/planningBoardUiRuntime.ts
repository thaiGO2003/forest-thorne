import Phaser from "phaser";
import { UNIT_BY_ID } from "../../data/unitCatalog.js";
import { getResolvedSkillDefinition } from "../../data/skills.js";
import { PHASE, PLAYER_COLS } from "../../core/boardConstants.js";
import { clamp, scaledBaseStats } from "../../core/gameUtils.js";
import { UI_FONT, EMOJI_FONT, UI_COLORS } from "../../core/uiTheme.js";
import { getClassIcon, getUnitVisual } from "../../data/unitVisuals.js";
import { createUnitVisualModel, getUnitVisualModule } from "../../visuals/visualRegistry.js";
import {
  applySharedTokenLabelTextStyle,
  buildSharedTokenLabelText,
  createSharedTokenLabelBackground,
  layoutSharedTokenLabel,
  createSharedRageBarGrid,
  createSharedUnitVisualStack,
  SHARED_UNIT_BAR_COLORS
} from "../../visuals/sceneVisualPolish.js";

import { buildPlanningPreviewActor, calculatePlanningPreviewPower, clearPlanningAttackPreview, showPlanningAttackPreviewForUnit } from "./planningAttackPreviewRuntime.js";
import { getPlanningRoleTheme } from "./planningBoardChromeRuntime.js";
import { clearPlanningSprites } from "./planningCombatTransitionRuntime.js";
import { getPlanningBoardOwnerSlot, getPlanningBoardRowCount, getPlanningBoardUnit, getPlanningCoopLocalSlot, getPlanningCoopPlayerState, isPlanningCoopMode, mapPlanningVisualBoardRowToLocalRow } from "./planningCoopSessionRuntime.js";
import { setPlanningCortisolDanceEligibility } from "./planningCortisolRuntime.js";
import { getPlanningCreativeSandboxUnits, hasPlanningManualEnemySandboxUnits } from "./planningCreativeSandboxRuntime.js";
import { onPlanningPlayerCellClick } from "./planningFormationRuntime.js";
import { isPlanningPanPointer } from "./planningInputRuntime.js";
import { getPlanningUnitTooltip } from "./planningTooltipRuntime.js";
import { getPlanningUnitDisplayResources } from "./planningUnitInfoRuntime.js";
import { gridToSharedBoardScreen } from "./sceneBoardViewport.js";

interface PointLike { x: number; y: number }

type AnyObj = Record<string, unknown>;
type VisualLike = { icon?: string; previewIcon?: string; nameVi?: string; name?: string; portraitKey?: string | null; visual?: unknown };
type TokenLabelBackground = Phaser.GameObjects.GameObject & {
  setStrokeStyle?: (w: number, c: number, a: number) => unknown;
  setDepth?: (d: number) => unknown;
  setAlpha?: (a: number) => unknown;
};
type TokenLabelTag = Phaser.GameObjects.Text | (Phaser.GameObjects.GameObject & { setOrigin?: (x: number, y?: number) => unknown; setDepth?: (d: number) => unknown; setAlpha?: (a: number) => unknown });
type PreviewLike = { baseId: string; star?: number; row: number; col: number; rage?: number; rageMax?: number; [k: string]: unknown };
type SandboxUnit = { base?: { classType: string; skillId?: string; stats: Record<string, unknown> } | null; star?: number; baseId?: string; row?: number; col?: number; [k: string]: unknown };
type BaseStatsLike = { range?: number; rageMax?: number; [k: string]: unknown };
type BaseUnitRec = { classType: string; skillId?: string; id?: string; stats: Record<string, unknown>; tier?: number };
type OwnedUnitRec = { base?: { classType?: string; skillId?: string; stats?: BaseStatsLike } | null; star?: number; baseId?: string; row?: number; col?: number; rage?: number; rageMax?: number; [k: string]: unknown };

export function refreshPlanningBoardUi(scene: Phaser.Scene): void {
    clearPlanningSprites(scene as unknown as Parameters<typeof clearPlanningSprites>[0]);
    if ((scene as { phase?: string }).phase !== PHASE.PLANNING && (scene as { phase?: string }).phase !== PHASE.AUGMENT) return;
    if (!(scene as { player?: { board?: unknown } }).player?.board) return;
    const sAny = scene as unknown as Record<string, unknown> & {
      add: {
        rectangle: (x: number, y: number, w: number, h: number, c: number, a?: number) => Phaser.GameObjects.Rectangle & { setStrokeStyle?: (w?: number, c?: number, a?: number) => unknown };
        circle: (x: number, y: number, r: number, c: number, a?: number) => Phaser.GameObjects.Shape & { setStrokeStyle?: (w?: number, c?: number, a?: number) => unknown; setInteractive?: (...a: unknown[]) => unknown; on?: (e: string, h: (...a: unknown[]) => void) => void; setAlpha?: (a: number) => unknown };
        ellipse: (x: number, y: number, w: number, h: number, c: number, a?: number) => Phaser.GameObjects.Ellipse & { setDepth?: (d: number) => unknown };
        text: (x: number, y: number, t: string, s: Phaser.Types.GameObjects.Text.TextStyle) => Phaser.GameObjects.Text;
        zone: (x: number, y: number, w: number, h: number) => Phaser.GameObjects.Zone & { setInteractive?: (...a: unknown[]) => unknown; setDepth?: (d: number) => unknown; on?: (e: string, h: (...a: unknown[]) => void) => void };
      };
      tooltip?: { attach?: (target: unknown, getContent: () => unknown) => void };
      planningSprites?: Array<Phaser.GameObjects.GameObject | unknown>;
      collectionProfile?: unknown;
      isUnitDragging?: boolean;
      isItemDragging?: boolean;
      itemDragConsumed?: boolean;
      boardDragConsumed?: boolean;
      player?: AnyObj;
    };
    const buildPlanningUnitBars = (point: PointLike, stats: { hp?: number }, rageValue = 0, rageMax = 1, shieldValue = 0) => {
      const barW = 56;
      const barH = 6;
      const fillH = 4;
      const barLeft = point.x - barW / 2 + 1;
      const hpBarBg = sAny.add.rectangle(point.x, point.y + 11, barW, barH, SHARED_UNIT_BAR_COLORS.hpBg, 0.96);
      hpBarBg.setStrokeStyle(2, SHARED_UNIT_BAR_COLORS.hpStroke, 0.98);
      hpBarBg.setDepth(2001 + point.y);
      const hpBarFill = sAny.add.rectangle(barLeft, point.y + 11, barW - 2, fillH, SHARED_UNIT_BAR_COLORS.hpFill, 0.98).setOrigin(0, 0.5);
      hpBarFill.setDepth(2002 + point.y);

      const hpInnerW = Math.max(1, barW - 2);
      const shieldRatio = clamp((stats?.hp ?? 0) > 0 ? shieldValue / (stats.hp ?? 1) : 0, 0, 1);
      const shieldBar = sAny.add.rectangle(barLeft, point.y + 11, hpInnerW * shieldRatio, fillH, SHARED_UNIT_BAR_COLORS.shieldFill, 0.94).setOrigin(0, 0.5);
      shieldBar.setDepth(2003 + point.y);

      const rageRatio = clamp(rageMax > 0 ? rageValue / rageMax : 0, 0, 1);
      const rageBarBg = sAny.add.rectangle(point.x, point.y + 18, barW, barH, SHARED_UNIT_BAR_COLORS.rageBg, 0.96);
      rageBarBg.setStrokeStyle(2, SHARED_UNIT_BAR_COLORS.rageStroke, 1);
      rageBarBg.setDepth(2001 + point.y);
      const rageBarFill = sAny.add.rectangle(barLeft, point.y + 18, hpInnerW * rageRatio, fillH, SHARED_UNIT_BAR_COLORS.rageFill, 0.98).setOrigin(0, 0.5);
      rageBarFill.setDepth(2002 + point.y);
      const rageGrid = createSharedRageBarGrid(scene as unknown as Parameters<typeof createSharedRageBarGrid>[0], {
        x: barLeft,
        y: point.y + 18,
        width: hpInnerW,
        height: fillH,
        rageMax,
        depth: 2003 + point.y,
        alpha: 0.96
      });
      const showRage = rageMax > 0;
      rageBarBg.setVisible?.(showRage);
      rageBarFill.setVisible?.(showRage);
      rageGrid.setVisible?.(showRage);

      return { barW, hpBarBg, hpBarFill, shieldBar, rageBarBg, rageBarFill, rageGrid };
    };
    const createNeutralToken = (point: PointLike, strokeColor: number, alpha = 1) => {
      const shadow = sAny.add.ellipse(point.x, point.y + 8, 44, 14, 0x000000, 0);
      shadow.setDepth?.(point.y + 13);
      const sprite = sAny.add.circle(point.x, point.y - 10, 22, 0x14202c, 0);
      sprite.setStrokeStyle?.(0, strokeColor, 0);
      sprite.setDepth(2000 + point.y);
      sprite.setAlpha?.(alpha);
      return { shadow, sprite };
    };
    const createPlanningIconStack = (options: {
      baseId: string;
      star: number;
      point: PointLike;
      side: string;
      ownerKind: string;
      alpha?: number;
      visual: { icon?: string; nameVi?: string } | null;
      visualModule?: { createModel?: (...a: unknown[]) => unknown } | null;
      depthBase?: number;
      animationName?: string;
    }) => {
      const {
        baseId, star, point, side, ownerKind, alpha = 1, visual, visualModule,
        depthBase = 2002 + point.y, animationName = "playRelaxedAnimation"
      } = options;
      const stack = createSharedUnitVisualStack(scene as unknown as Parameters<typeof createSharedUnitVisualStack>[0], {
        star,
        side,
        baseX: point.x,
        baseY: point.y - 10,
        baseDepth: depthBase,
        baseAlpha: alpha,
        createVisual: (slot: AnyObj) => {
          const x = (slot.x as number) ?? point.x;
          const y = (slot.y as number) ?? point.y;
          const scale = (slot.scale as number) ?? 1;
          const depth = (slot.depth as number) ?? depthBase;
          let created: AnyObj | null;
          if (visualModule && visualModule.createModel) {
            created = createUnitVisualModel(scene as unknown as Parameters<typeof createUnitVisualModel>[0], baseId, {
              x, y, scale: 0.9 * scale, star, side, ownerKind,
              collectionProfile: sAny.collectionProfile
            } as unknown as Parameters<typeof createUnitVisualModel>[2]) as AnyObj | null;
          } else {
            created = sAny.add.text(x, y, visual?.icon || "🐾", {
              fontFamily: EMOJI_FONT, fontSize: "32px", color: "#ffffff"
            }).setOrigin(0.5) as unknown as AnyObj;
            if (created && typeof (created as { setScale?: (s: number) => void }).setScale === "function") {
              (created as { setScale?: (s: number) => void }).setScale?.(scale);
            }
          }
          if (created) {
            (created as { setDepth?: (d: number) => void }).setDepth?.(depth);
            (created as { setAlpha?: (a: number) => void }).setAlpha?.(alpha);
          }
          return created;
        }
      } as unknown as Parameters<typeof createSharedUnitVisualStack>[1]);
      stack.entries.forEach(({ target }: { target: unknown }) => {
        setPlanningCortisolDanceEligibility(scene as unknown as Parameters<typeof setPlanningCortisolDanceEligibility>[0], target as unknown as Parameters<typeof setPlanningCortisolDanceEligibility>[1], stack.primary === target);
      });
      if (stack.primary) {
        const animation = (visualModule as Record<string, unknown> | null)?.[animationName];
        if (typeof animation === "function") (animation as (s: unknown, t: unknown) => void)(scene, stack.primary);
      }
      return stack;
    };
    const getRoleNameColor = (roleTheme: { stroke: number }): string => Phaser.Display.Color.IntegerToColor(roleTheme.stroke).rgba;
    const createTokenTag = (options: { point: PointLike; tagText: string; strokeColor: number; textColor: string; alpha?: number }) => {
      const { point, tagText, strokeColor, textColor, alpha = 1 } = options;
      const tagBg = createSharedTokenLabelBackground(scene as unknown as Parameters<typeof createSharedTokenLabelBackground>[0], point.x, point.y - 47, {
        width: 64, height: 13, fillColor: 0x05070c, fillAlpha: 0.76
      }) as unknown as TokenLabelBackground;
      tagBg.setStrokeStyle?.(1, strokeColor, 0.72);
      tagBg.setDepth?.(2001 + point.y);
      tagBg.setAlpha?.(alpha);
      const tag = sAny.add.text(point.x, point.y - 47, tagText, {
        fontFamily: UI_FONT, fontSize: "15px", color: textColor, fontStyle: "bold"
      }).setOrigin(0.5) as unknown as TokenLabelTag;
      applySharedTokenLabelTextStyle(tag as unknown as Parameters<typeof applySharedTokenLabelTextStyle>[0], { color: textColor });
      (tag as { setDepth?: (d: number) => void }).setDepth?.(2002 + point.y);
      (tag as { setAlpha?: (a: number) => void }).setAlpha?.(alpha);
      const layout = layoutSharedTokenLabel(scene as unknown as Parameters<typeof layoutSharedTokenLabel>[0], tagBg as unknown as Parameters<typeof layoutSharedTokenLabel>[1], tag as unknown as Parameters<typeof layoutSharedTokenLabel>[2], { x: point.x, y: point.y - 47 });
      return { tagBg, tag, layout };
    };

    const isManualEnemySandbox = hasPlanningManualEnemySandboxUnits(scene as unknown as Parameters<typeof hasPlanningManualEnemySandboxUnits>[0]);
    const sandboxUnits = getPlanningCreativeSandboxUnits(scene as unknown as Parameters<typeof getPlanningCreativeSandboxUnits>[0], "RIGHT") as unknown as PreviewLike[];
    const playerEnemyPreview = (scene as { player?: { enemyPreview?: unknown } }).player?.enemyPreview;
    const enemyPreview: PreviewLike[] = (isManualEnemySandbox
      ? sandboxUnits
      : (Array.isArray(playerEnemyPreview) ? (playerEnemyPreview as PreviewLike[]) : []));
    const visiblePowerValues: unknown[] = [];
    enemyPreview.forEach((preview) => {
      const base = UNIT_BY_ID[preview?.baseId] as BaseUnitRec | undefined;
      if (!base) return;
      visiblePowerValues.push(calculatePlanningPreviewPower(scene as unknown as Parameters<typeof calculatePlanningPreviewPower>[0], base as unknown as Parameters<typeof calculatePlanningPreviewPower>[1], Math.max(1, preview?.star ?? 1), preview));
    });
    for (let row = 0; row < getPlanningBoardRowCount(scene as unknown as Parameters<typeof getPlanningBoardRowCount>[0]); row += 1) {
      for (let col = 0; col < PLAYER_COLS; col += 1) {
        const unit = getPlanningBoardUnit(scene as unknown as Parameters<typeof getPlanningBoardUnit>[0], row, col);
        const unitRec = unit as { base?: { classType: string; skillId?: string; stats: Record<string, unknown> }; star?: number; baseId?: string } | null | undefined;
        if (!unitRec?.base) continue;
        visiblePowerValues.push(calculatePlanningPreviewPower(scene as unknown as Parameters<typeof calculatePlanningPreviewPower>[0], unitRec.base as unknown as Parameters<typeof calculatePlanningPreviewPower>[1], unitRec.star ?? 1, unit as unknown as Parameters<typeof calculatePlanningPreviewPower>[3]));
      }
    }
    (getPlanningCreativeSandboxUnits(scene as unknown as Parameters<typeof getPlanningCreativeSandboxUnits>[0], "LEFT") as unknown as SandboxUnit[]).forEach((unit) => {
      if (!unit?.base) return;
      visiblePowerValues.push(calculatePlanningPreviewPower(scene as unknown as Parameters<typeof calculatePlanningPreviewPower>[0], unit.base as unknown as Parameters<typeof calculatePlanningPreviewPower>[1], unit.star ?? 1, unit));
    });
    enemyPreview.forEach((preview) => {
      const base = UNIT_BY_ID[preview.baseId] as BaseUnitRec | undefined;
      if (!base) return;
      const star = Math.max(1, preview.star ?? 1);
      const point = gridToSharedBoardScreen(scene as unknown as Parameters<typeof gridToSharedBoardScreen>[0], preview.col, preview.row) as PointLike;
      const visual = getUnitVisual(preview.baseId, base.classType, star) as VisualLike;
      const visualModule = getUnitVisualModule(preview.baseId) as { createModel?: (...a: unknown[]) => unknown } | null;
      const roleTheme = getPlanningRoleTheme(scene as unknown as Parameters<typeof getPlanningRoleTheme>[0], base.classType) as { stroke: number };
      const actor = buildPlanningPreviewActor(scene as unknown as Parameters<typeof buildPlanningPreviewActor>[0], "RIGHT", preview.row, preview.col, base.classType, star, base.skillId, (base.stats as BaseStatsLike).range as Parameters<typeof buildPlanningPreviewActor>[7]);
      const { shadow, sprite } = createNeutralToken(point, isManualEnemySandbox ? UI_COLORS.accent : 0x6c7480);
      sprite.setInteractive?.({ useHandCursor: true } as unknown);
      sAny.tooltip?.attach?.(sprite, () => getPlanningUnitTooltip(scene as unknown as Parameters<typeof getPlanningUnitTooltip>[0], preview.baseId, star, preview as unknown as Parameters<typeof getPlanningUnitTooltip>[3]));
      sprite.on?.("pointerover", () => showPlanningAttackPreviewForUnit(scene as unknown as Parameters<typeof showPlanningAttackPreviewForUnit>[0], actor));
      sprite.on?.("pointerout", () => clearPlanningAttackPreview(scene as unknown as Parameters<typeof clearPlanningAttackPreview>[0], actor));
      const iconStack = createPlanningIconStack({
        baseId: preview.baseId, star, point, side: "RIGHT", ownerKind: "ENEMY", visual, visualModule
      });
      const enemyTagText = buildSharedTokenLabelText({
        star, roleIcon: getClassIcon(base.classType), name: visual.nameVi ?? "", suffix: isManualEnemySandbox ? "∞" : ""
      });
      const enemyTagParts = createTokenTag({
        point, tagText: enemyTagText,
        strokeColor: isManualEnemySandbox ? UI_COLORS.accent : 0x6c7480,
        textColor: getRoleNameColor(roleTheme)
      });
      const baseStats = scaledBaseStats(base.stats as unknown as Parameters<typeof scaledBaseStats>[0], star, base.classType);
      const previewSkill = getResolvedSkillDefinition(base.skillId, { baseId: base.id, star });
      const enemyBars = buildPlanningUnitBars(
        point, baseStats, preview?.rage ?? 0, preview?.rageMax ?? (previewSkill?.cost as number | undefined) ?? Number((base.stats as BaseStatsLike).rageMax ?? 0), 0
      );
      (sAny.planningSprites as unknown[]).push(
        shadow, sprite,
        ...iconStack.entries.map(({ target }: { target: unknown }) => target),
        enemyTagParts.tagBg, enemyTagParts.tag,
        enemyBars.hpBarBg, enemyBars.hpBarFill, enemyBars.shieldBar,
        enemyBars.rageBarBg, enemyBars.rageBarFill, enemyBars.rageGrid
      );
    });

    for (let row = 0; row < getPlanningBoardRowCount(scene as unknown as Parameters<typeof getPlanningBoardRowCount>[0]); row += 1) {
      for (let col = 0; col < PLAYER_COLS; col += 1) {
        const unit = getPlanningBoardUnit(scene as unknown as Parameters<typeof getPlanningBoardUnit>[0], row, col);
        const unitRec = unit as OwnedUnitRec | null | undefined;
        if (!unitRec) continue;
        const ownerSlot = getPlanningBoardOwnerSlot(scene as unknown as Parameters<typeof getPlanningBoardOwnerSlot>[0], row);
        const ownerPlayer = (getPlanningCoopPlayerState(scene as unknown as Parameters<typeof getPlanningCoopPlayerState>[0], ownerSlot) ?? (scene as { player?: AnyObj }).player) as Record<string, unknown> | null | undefined;
        const isOwnedUnit = ownerSlot === getPlanningCoopLocalSlot(scene as unknown as Parameters<typeof getPlanningCoopLocalSlot>[0]);
        const displayResources = getPlanningUnitDisplayResources(scene as unknown as Parameters<typeof getPlanningUnitDisplayResources>[0], unit as unknown as Parameters<typeof getPlanningUnitDisplayResources>[1], ownerPlayer as unknown as Parameters<typeof getPlanningUnitDisplayResources>[2]);
        const alpha = isOwnedUnit ? 1 : 0.72;
        const point = gridToSharedBoardScreen(scene as unknown as Parameters<typeof gridToSharedBoardScreen>[0], col, row) as PointLike;
        const roleTheme = getPlanningRoleTheme(scene as unknown as Parameters<typeof getPlanningRoleTheme>[0], unitRec.base?.classType ?? "") as { stroke: number };
        const ownerKind = isOwnedUnit ? "PLAYER" : "ENEMY";
        const classType = unitRec.base?.classType ?? "";
        const visual = getUnitVisual(unitRec.baseId ?? "", classType, unitRec.star ?? 1, { side: "LEFT", ownerKind, collectionProfile: sAny.collectionProfile }) as VisualLike;
        const visualModule = getUnitVisualModule(unitRec.baseId ?? "", { side: "LEFT", ownerKind, star: unitRec.star ?? 1, collectionProfile: sAny.collectionProfile } as unknown as Parameters<typeof getUnitVisualModule>[1]) as { createModel?: (...a: unknown[]) => unknown } | null;
        const actor = buildPlanningPreviewActor(scene as unknown as Parameters<typeof buildPlanningPreviewActor>[0], "LEFT", row, col, classType, unitRec.star ?? 1, unitRec.base?.skillId, unitRec.base?.stats?.range as Parameters<typeof buildPlanningPreviewActor>[7]);
        const { shadow, sprite } = createNeutralToken(point, isOwnedUnit ? 0x60788f : 0x8da6bf, alpha);
        const iconStack = createPlanningIconStack({
          baseId: unitRec.baseId ?? "", star: unitRec.star ?? 1, point, side: "LEFT", ownerKind, alpha, visual, visualModule
        });
        const tagText = buildSharedTokenLabelText({
          prefix: isPlanningCoopMode(scene as unknown as Parameters<typeof isPlanningCoopMode>[0]) ? ownerSlot : "",
          star: unitRec.star ?? 1, roleIcon: getClassIcon(classType), name: visual.nameVi ?? ""
        });
        const tagParts = createTokenTag({
          point, tagText, strokeColor: isOwnedUnit ? 0x60788f : 0x8da6bf, textColor: getRoleNameColor(roleTheme), alpha
        });
        const baseStats = scaledBaseStats(unitRec.base?.stats as unknown as Parameters<typeof scaledBaseStats>[0], unitRec.star ?? 1, classType);
        const unitBars = buildPlanningUnitBars(point, baseStats, displayResources.rage, displayResources.rageMax, displayResources.shield);
        unitBars.hpBarBg.setAlpha(alpha);
        unitBars.hpBarFill.setAlpha(alpha);
        unitBars.shieldBar.setAlpha(alpha);
        unitBars.rageBarBg.setAlpha(alpha);
        unitBars.rageBarFill.setAlpha(alpha);
        unitBars.rageGrid.setAlpha?.(alpha);
        const hoverZoneW = Math.max(
          60, unitBars.barW + 16,
          (tagParts.layout?.width ?? 0) + Math.abs((tagParts.layout?.x ?? point.x) - point.x) * 2 + 12
        );
        const hoverZoneH = 74;
        const hoverZoneX = ((tagParts.layout?.x ?? point.x) + point.x) * 0.5;
        const hoverZone = sAny.add.zone(hoverZoneX, point.y - 18, hoverZoneW, hoverZoneH);
        hoverZone.setInteractive?.(new Phaser.Geom.Rectangle(0, 0, hoverZoneW, hoverZoneH), Phaser.Geom.Rectangle.Contains);
        hoverZone.setDepth?.(2005 + point.y);
        sAny.tooltip?.attach?.(hoverZone, () => getPlanningUnitTooltip(scene as unknown as Parameters<typeof getPlanningUnitTooltip>[0], unitRec.baseId ?? "", unitRec.star ?? 1, unit as unknown as Parameters<typeof getPlanningUnitTooltip>[3]));
        hoverZone.on?.("pointerover", () => showPlanningAttackPreviewForUnit(scene as unknown as Parameters<typeof showPlanningAttackPreviewForUnit>[0], actor));
        hoverZone.on?.("pointerout", () => clearPlanningAttackPreview(scene as unknown as Parameters<typeof clearPlanningAttackPreview>[0], actor));
        hoverZone.on?.("pointerup", (pointer: Phaser.Input.Pointer) => {
          if (sAny.isUnitDragging || sAny.isItemDragging || sAny.itemDragConsumed) return;
          if (sAny.boardDragConsumed) return;
          if (isPlanningPanPointer(scene as unknown as Parameters<typeof isPlanningPanPointer>[0], pointer as unknown as Parameters<typeof isPlanningPanPointer>[1])) return;
          if (!isOwnedUnit) return;
          const localRow = mapPlanningVisualBoardRowToLocalRow(scene as unknown as Parameters<typeof mapPlanningVisualBoardRowToLocalRow>[0], row);
          if (localRow == null) return;
          onPlanningPlayerCellClick(scene as unknown as Parameters<typeof onPlanningPlayerCellClick>[0], localRow, col);
        });
        (sAny.planningSprites as unknown[]).push(
          shadow, sprite,
          ...iconStack.entries.map(({ target }: { target: unknown }) => target),
          tagParts.tagBg, tagParts.tag,
          unitBars.hpBarBg, unitBars.hpBarFill, unitBars.shieldBar,
          unitBars.rageBarBg, unitBars.rageBarFill, unitBars.rageGrid,
          hoverZone
        );
      }
    }

    (getPlanningCreativeSandboxUnits(scene as unknown as Parameters<typeof getPlanningCreativeSandboxUnits>[0], "LEFT") as unknown as SandboxUnit[]).forEach((unit) => {
      const row = unit.row ?? 0;
      const col = unit.col ?? 0;
      const point = gridToSharedBoardScreen(scene as unknown as Parameters<typeof gridToSharedBoardScreen>[0], col, row) as PointLike;
      const classType = unit.base?.classType ?? "";
      const roleTheme = getPlanningRoleTheme(scene as unknown as Parameters<typeof getPlanningRoleTheme>[0], classType) as { stroke: number };
      const visual = getUnitVisual(unit.baseId ?? "", classType, unit.star ?? 1, { side: "LEFT", ownerKind: "PLAYER", collectionProfile: sAny.collectionProfile }) as VisualLike;
      const visualModule = getUnitVisualModule(unit.baseId ?? "", { side: "LEFT", ownerKind: "PLAYER", star: unit.star ?? 1, collectionProfile: sAny.collectionProfile } as unknown as Parameters<typeof getUnitVisualModule>[1]);
      const actor = buildPlanningPreviewActor(scene as unknown as Parameters<typeof buildPlanningPreviewActor>[0], "LEFT", row, col, classType, unit.star ?? 1, unit.base?.skillId, unit.base?.stats?.range as Parameters<typeof buildPlanningPreviewActor>[7]);
      const { shadow, sprite } = createNeutralToken(point, UI_COLORS.accent, 1);
      sprite.setAlpha?.(0.82);
      const iconStack = createPlanningIconStack({
        baseId: unit.baseId ?? "", star: unit.star ?? 1, point, side: "LEFT", ownerKind: "PLAYER", visual, visualModule: visualModule as unknown as { createModel?: (...a: unknown[]) => unknown } | null | undefined
      });
      const tagParts = createTokenTag({
        point,
        tagText: buildSharedTokenLabelText({
          star: unit.star ?? 1, roleIcon: getClassIcon(classType), name: visual.nameVi ?? "", suffix: "∞"
        }),
        strokeColor: UI_COLORS.accent,
        textColor: getRoleNameColor(roleTheme)
      });
      const baseStats = scaledBaseStats(unit.base?.stats as unknown as Parameters<typeof scaledBaseStats>[0], unit.star ?? 1, classType);
      const displayResources = getPlanningUnitDisplayResources(scene as unknown as Parameters<typeof getPlanningUnitDisplayResources>[0], unit as unknown as Parameters<typeof getPlanningUnitDisplayResources>[1], (scene as { player?: AnyObj }).player as unknown as Parameters<typeof getPlanningUnitDisplayResources>[2]);
      const unitBars = buildPlanningUnitBars(point, baseStats, displayResources.rage, displayResources.rageMax, displayResources.shield);
      const hoverZoneW = Math.max(
        60, unitBars.barW + 16,
        (tagParts.layout?.width ?? 0) + Math.abs((tagParts.layout?.x ?? point.x) - point.x) * 2 + 12
      );
      const hoverZoneH = 74;
      const hoverZoneX = ((tagParts.layout?.x ?? point.x) + point.x) * 0.5;
      const hoverZone = sAny.add.zone(hoverZoneX, point.y - 18, hoverZoneW, hoverZoneH);
      hoverZone.setInteractive?.(new Phaser.Geom.Rectangle(0, 0, hoverZoneW, hoverZoneH), Phaser.Geom.Rectangle.Contains);
      hoverZone.setDepth?.(2005 + point.y);
      sAny.tooltip?.attach?.(hoverZone, () => getPlanningUnitTooltip(scene as unknown as Parameters<typeof getPlanningUnitTooltip>[0], unit.baseId ?? "", unit.star ?? 1, unit as unknown as Parameters<typeof getPlanningUnitTooltip>[3]));
      hoverZone.on?.("pointerover", () => showPlanningAttackPreviewForUnit(scene as unknown as Parameters<typeof showPlanningAttackPreviewForUnit>[0], actor));
      hoverZone.on?.("pointerout", () => clearPlanningAttackPreview(scene as unknown as Parameters<typeof clearPlanningAttackPreview>[0], actor));
      (sAny.planningSprites as unknown[]).push(
        shadow, sprite,
        ...iconStack.entries.map(({ target }: { target: unknown }) => target),
        tagParts.tagBg, tagParts.tag,
        unitBars.hpBarBg, unitBars.hpBarFill, unitBars.shieldBar,
        unitBars.rageBarBg, unitBars.rageBarFill, unitBars.rageGrid,
        hoverZone
      );
    });
}
