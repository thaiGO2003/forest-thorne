/**
 * unitStatsFormatter.ts
 *
 * Shared stat formatting for tooltip (PlanningScene) and library (LibraryModal).
 * Single source of truth for how unit stats are displayed.
 */

import { getBaseCritRate, getBaseEvasion, getEffectiveEvasion, scaledBaseStats } from "./gameUtils.js";
import { getClassAccuracy } from "./unitDescriptionHelper.js";
import { formatRangeLabel } from "./rangeText.js";
import { getElementLabel } from "../data/elementInfo.js";
import { getClassLabel, getTribeLabel } from "../data/unitVisuals.js";
import { resolveUnitSkillForStar } from "../data/unitCatalog.js";
import { CLASS_SYNERGY, TRIBE_SYNERGY, type SynergyDefinition, type SynergyBonus } from "../data/synergies.js";
import { t } from "../i18n/index.js";
import { aggregateVariantBonuses, type VariantTrait, type VariantBonus } from "./variantTraits.js";
import { highlightTooltipActiveText } from "./tooltipInlineMarkup.js";

interface UnitStatsBlock {
    hp?: number;
    atk?: number;
    def?: number;
    matk?: number;
    mdef?: number;
    critRate?: number;
    critDmgMult?: number;
    range?: number;
    rageMax?: number;
    [key: string]: unknown;
}

interface UnitCatalogEntry {
    id?: string;
    stats?: UnitStatsBlock;
    classType?: string;
    tribe?: string;
    tier?: number;
}

interface AttackStatRow {
    key?: string;
    format?: string;
    metric?: string;
    valuesByStar?: Record<number, number>;
}

interface AttackContext {
    statRows?: AttackStatRow[];
}

interface BuildUnitStatsOptions {
    star?: number;
    statScale?: number;
    ownedUnit?: unknown;
    skill?: { cost?: number } | null;
    attack?: AttackContext | null;
    rageMaxOverride?: number | null;
    variant?: VariantTrait | null;
    variants?: VariantTrait[] | null;
    formatVariantBonus?: (bonus: Record<string, number>) => string | null | undefined;
}

interface ScaledStatValues {
    hp: number;
    atk: number;
    def: number;
    matk: number;
    mdef: number;
    evasion: number;
    [key: string]: number;
}

interface BaseStatsArg {
    hp: number;
    atk: number;
    def: number;
    matk: number;
    mdef: number;
    range?: number;
    rageMax?: number;
}

/**
 * Build an array of stat lines for a unit.
 * Used by both PlanningScene tooltip and LibraryModal detail.
 */
export function buildUnitStatsLines(
    unit: UnitCatalogEntry,
    opts: BuildUnitStatsOptions = {}
): Array<string | null> {
    const {
        star = 1,
        ownedUnit = null,
        skill = null,
        attack = null,
        rageMaxOverride = null,
        variant = null,
        variants = null,
        formatVariantBonus = null
    } = opts;
    const stats: UnitStatsBlock = unit.stats || {};
    const traitEntries: VariantTrait[] = Array.isArray(variants)
        ? variants.filter((v): v is VariantTrait => Boolean(v))
        : variant
            ? [variant]
            : [];

    const elementLabel = getElementLabel(unit.tribe ?? "");
    const accuracy = getClassAccuracy(unit.classType ?? "", unit.tier ?? 1);
    const baseEvasion = getBaseEvasion(unit.classType ?? "");
    const critRate = Math.round((stats.critRate ?? getBaseCritRate(unit.classType ?? "")) * 100);
    const critDmgMult = Math.round((stats.critDmgMult ?? 1.5) * 100);

    // Evasion text (with effective override if owned)
    let evasionText = `💨 ${t("stats.evasion")}: ${(baseEvasion * 100).toFixed(1)}%`;
    if (ownedUnit) {
        const effectiveEvasion = getEffectiveEvasion(ownedUnit);
        if (Math.abs(effectiveEvasion - baseEvasion) > 0.001) {
            evasionText = `💨 ${t("stats.evasion")}: ${(baseEvasion * 100).toFixed(1)}% → ${(effectiveEvasion * 100).toFixed(1)}%`;
        }
    }

    // Synergy marks
    const classDef: SynergyDefinition | undefined = unit.classType ? CLASS_SYNERGY[unit.classType] : undefined;
    const tribeDef: SynergyDefinition | undefined = unit.tribe ? TRIBE_SYNERGY[unit.tribe] : undefined;
    const classMarks = classDef ? classDef.thresholds.join("/") : "-";
    const tribeMarks = tribeDef ? tribeDef.thresholds.join("/") : "-";
    const milestoneStars = [1, 2, 3];
    const activeStarIndex = Math.max(0, Math.min(2, Number(star) - 1));
    const formatMilestoneValue = (value: unknown, format: string = "integer", metric: string = ""): string => {
        if (value == null || value === "") return "-";
        if (format === "range_text" || metric === "attack.range") {
            return formatRangeLabel(value);
        }
        if (format === "percent") {
            const percentValue = Number(value);
            return Number.isFinite(percentValue) ? `${Math.round(percentValue * 100)}%` : String(value);
        }
        const numeric = Number(value);
        return Number.isFinite(numeric) ? `${Math.round(numeric)}` : String(value);
    };
    const highlightCurrentStarMetric = (values: Record<number, unknown> | null | undefined, format: string = "integer", metric: string = ""): string => {
        const formatted: string[] = milestoneStars.map((milestoneStar, index) => {
            const text = formatMilestoneValue(values?.[milestoneStar], format, metric);
            return index === activeStarIndex
                ? highlightTooltipActiveText(text)
                : text;
        });
        return `[${formatted.join(" / ")}]`;
    };
    const highlightCurrentStarValue = (values: Record<number, unknown>): string => highlightCurrentStarMetric(values, "integer");
    const baseStatsForScale: BaseStatsArg = {
        hp: stats.hp ?? 100,
        atk: stats.atk ?? 50,
        def: stats.def ?? 20,
        matk: stats.matk ?? 20,
        mdef: stats.mdef ?? 20,
        range: stats.range ?? 1,
        rageMax: stats.rageMax
    };
    const scaledStatsByStar: Record<number, ScaledStatValues> = Object.fromEntries(
        milestoneStars.map((milestoneStar) => [milestoneStar, scaledBaseStats(baseStatsForScale, milestoneStar, unit.classType ?? "") as ScaledStatValues])
    );
    const attackStatRows: AttackStatRow[] = Array.isArray(attack?.statRows) ? attack.statRows : [];
    const attackDamageRow = attackStatRows.find((row) => row?.key === "damage")
        ?? attackStatRows.find((row) => row?.key === "firstHitDamage");
    const attackRangeRow = attackStatRows.find((row) => row?.key === "range");
    const fallbackAttackDamageValues: Record<number, number> = Object.fromEntries(
        milestoneStars.map((milestoneStar) => {
            const scaledStats = scaledStatsByStar[milestoneStar] ?? { evasion: 0 };
            const isMagicBasicAttack = unit.classType === "MAGE" || unit.classType === "SUPPORT";
            const key: keyof ScaledStatValues = isMagicBasicAttack ? "matk" : "atk";
            return [milestoneStar, scaledStats[key] ?? 0];
        })
    );
    const attackDamageValuesByStar: Record<number, number> = attackDamageRow?.valuesByStar ?? fallbackAttackDamageValues;
    const attackRangeValuesByStar: Record<number, number> = attackRangeRow?.valuesByStar ?? {
        1: stats.range ?? 1,
        2: stats.range ?? 1,
        3: stats.range ?? 1
    };
    const rageCostValuesByStar: Record<number, number> = Object.fromEntries(
        milestoneStars.map((milestoneStar) => {
            const resolvedStarSkill = unit?.id ? resolveUnitSkillForStar(unit.id, milestoneStar) : null;
            const skillCost = skill ? Number(skill.cost) : NaN;
            const fallbackCost = Number.isFinite(skillCost)
                ? skillCost
                : Number.isFinite(Number(stats.rageMax))
                    ? Number(stats.rageMax)
                    : Number(rageMaxOverride);
            const resolvedCost = (resolvedStarSkill as { cost?: unknown } | null)?.cost;
            return [
                milestoneStar,
                Math.max(
                    0,
                    Math.round(
                        Number.isFinite(Number(resolvedCost))
                            ? Number(resolvedCost)
                            : (Number.isFinite(Number(fallbackCost)) ? Number(fallbackCost) : 0)
                    )
                )
            ];
        })
    );
    const hasRageCost = milestoneStars.some((milestoneStar) => Number(rageCostValuesByStar[milestoneStar] ?? 0) > 0);

    const hp = (s: ScaledStatValues | undefined) => s?.hp ?? stats.hp ?? 100;
    const atk = (s: ScaledStatValues | undefined) => s?.atk ?? stats.atk ?? 50;
    const def = (s: ScaledStatValues | undefined) => s?.def ?? stats.def ?? 20;
    const matk = (s: ScaledStatValues | undefined) => s?.matk ?? stats.matk ?? 20;
    const mdef = (s: ScaledStatValues | undefined) => s?.mdef ?? stats.mdef ?? 20;

    const lines: Array<string | null> = [
        `🏷️ ${t("label.tier")}: ${unit.tier ?? 1}`,
        `🌟 ${t("stats.tribe")}: ${elementLabel || getTribeLabel(unit.tribe)}`,
        `⚔️ ${t("stats.roleClass")}: ${getClassLabel(unit.classType)}`,
        `❤️ HP: ${highlightCurrentStarValue({
            1: hp(scaledStatsByStar[1]),
            2: hp(scaledStatsByStar[2]),
            3: hp(scaledStatsByStar[3])
        })}`,
        `🗡️ ATK: ${highlightCurrentStarValue({
            1: atk(scaledStatsByStar[1]),
            2: atk(scaledStatsByStar[2]),
            3: atk(scaledStatsByStar[3])
        })}`,
        `🛡️ DEF: ${highlightCurrentStarValue({
            1: def(scaledStatsByStar[1]),
            2: def(scaledStatsByStar[2]),
            3: def(scaledStatsByStar[3])
        })}`,
        `✨ MATK: ${highlightCurrentStarValue({
            1: matk(scaledStatsByStar[1]),
            2: matk(scaledStatsByStar[2]),
            3: matk(scaledStatsByStar[3])
        })}`,
        `🔰 MDEF: ${highlightCurrentStarValue({
            1: mdef(scaledStatsByStar[1]),
            2: mdef(scaledStatsByStar[2]),
            3: mdef(scaledStatsByStar[3])
        })}`,
        `⚔️ Sát thương đòn đánh thường: ${highlightCurrentStarMetric(attackDamageValuesByStar, attackDamageRow?.format ?? "integer", attackDamageRow?.metric ?? "attack.total_damage")}`,
        `🏹 ${t("stats.range")}: ${highlightCurrentStarMetric(attackRangeValuesByStar, attackRangeRow?.format ?? "range_text", attackRangeRow?.metric ?? "attack.range")}`,
        `🎯 ${t("stats.accuracy")}: ${accuracy}%`,
        evasionText,
        `⚔️ ${t("stats.critRate")}: ${critRate}%`,
        `💥 ${t("stats.critDamage")}: ${critDmgMult}%`,
        hasRageCost ? `🔥 ${t("stats.maxRage")}: ${highlightCurrentStarMetric(rageCostValuesByStar, "integer", "cast.cost")}` : null
    ];

    if (traitEntries.length) {
        lines.push(`🎲 ${t("stats.variants")}: ${traitEntries.length} ${t("stats.traitCountSuffix")}`);
        if (formatVariantBonus) {
            const totalBonus = aggregateVariantBonuses(traitEntries);
            const summary = formatVariantBonus(totalBonus);
            if (summary) lines.push(`  • ${t("stats.total")}: ${summary}`);
            traitEntries.forEach((trait, index) => {
                const bonus: Record<string, number> = {};
                const traitBonus = trait?.bonus;
                if (traitBonus) {
                    for (const [k, v] of Object.entries(traitBonus)) {
                        if (typeof v === "number" && Number.isFinite(v)) {
                            bonus[k] = v;
                        }
                    }
                }
                const detail = formatVariantBonus(bonus);
                lines.push(`  • ${index + 1}. ${trait?.name ?? t("stats.traitFallback")}${detail ? ` (${detail})` : ""}`);
            });
        }
    }

    return lines.filter((line): line is string => line !== null && line !== "");
}

/**
 * Format variant bonus into a readable string.
 */
export function formatVariantBonusText(bonus: VariantBonus | null | undefined): string {
    if (!bonus) return "";
    const parts: string[] = [];
    const num = (v: number | undefined): number | null => (typeof v === "number" && Number.isFinite(v)) ? v : null;
    const critPct = num(bonus.critPct);
    const atkPct = num(bonus.atkPct);
    const matkPct = num(bonus.matkPct);
    const hpPct = num(bonus.hpPct);
    const evadePct = num(bonus.evadePct);
    const healPct = num(bonus.healPct);
    const lifestealPct = num(bonus.lifestealPct);
    if (critPct !== null) parts.push(`+${Math.round(critPct * 100)}% ${t("stats.critRate")}`);
    if (atkPct !== null) parts.push(`+${Math.round(atkPct * 100)}% ATK`);
    if (matkPct !== null) parts.push(`+${Math.round(matkPct * 100)}% MATK`);
    if (hpPct !== null) parts.push(`+${Math.round(hpPct * 100)}% HP`);
    if (evadePct !== null) parts.push(`+${Math.round(evadePct * 100)}% ${t("stats.evasionShort")}`);
    if (bonus.defFlat) parts.push(`+${bonus.defFlat} DEF`);
    if (bonus.mdefFlat) parts.push(`+${bonus.mdefFlat} MDEF`);
    if (bonus.shieldStart) parts.push(`+${bonus.shieldStart} ${t("stats.shield")}`);
    if (healPct !== null) parts.push(`+${Math.round(healPct * 100)}% ${t("stats.healShort")}`);
    if (bonus.startingRage) parts.push(`+${bonus.startingRage} ${t("stats.rage")}`);
    if (lifestealPct !== null) parts.push(`+${Math.round(lifestealPct * 100)}% ${t("stats.lifesteal")}`);
    return parts.join(", ");
}

/**
 * Build synergy bonus description texts for a given synergy definition.
 */
export function buildSynergyBonusTexts(synergyDef: SynergyDefinition | null | undefined): string[] {
    if (!synergyDef) return [];
    return synergyDef.thresholds.map((threshold, i) => {
        const b: SynergyBonus = synergyDef.bonuses[i] ?? {};
        const parts: string[] = [];
        const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v)) ? v : null;
        const defFlat = num(b.defFlat);
        const mdefFlat = num(b.mdefFlat);
        const atkPct = num(b.atkPct);
        const matkPct = num(b.matkPct);
        const hpPct = num(b.hpPct);
        const healPct = num(b.healPct);
        const critPct = num(b.critPct);
        const evadePct = num(b.evadePct);
        if (defFlat !== null) parts.push(`+${defFlat}DEF`);
        if (mdefFlat !== null) parts.push(`+${mdefFlat}MDEF`);
        if (atkPct !== null) parts.push(`+${Math.round(atkPct * 100)}%ATK`);
        if (matkPct !== null) parts.push(`+${Math.round(matkPct * 100)}%MATK`);
        if (hpPct !== null) parts.push(`+${Math.round(hpPct * 100)}%HP`);
        if (healPct !== null) parts.push(`+${Math.round(healPct * 100)}%${t("stats.healShort")}`);
        if (b.shieldStart) parts.push(`+${b.shieldStart}${t("stats.shield")}`);
        if (b.burnOnHit) parts.push(`${t("status.burn")} ${b.burnOnHit}`);
        if (critPct !== null) parts.push(`+${Math.round(critPct * 100)}%${t("stats.critRate")}`);
        if (b.startingRage) parts.push(`+${b.startingRage}${t("stats.rage")}`);
        if (b.poisonOnHit) parts.push(`${t("status.poison")} ${b.poisonOnHit}`);
        if (evadePct !== null) parts.push(`+${Math.round(evadePct * 100)}%${t("stats.evasionShort")}`);
        return `${threshold}: ${parts.join(", ")}`;
    });
}
