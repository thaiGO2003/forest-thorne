// Unit tooltip content model (§26, A96): the rich hover surface ported from old_src
// `buildUnitTooltipContentModel` + `buildSummaryUnitSectionBlocks` + `buildCanonicalUnitExpandedColumns`.
// Catalog-only callers (Shop/Library cards) get the same header/summary/expanded content without
// live diagnostics; planning/combat hover adds the live stat, shield, rage and status readouts.
import type { UnitDef } from "../content/catalog";
import { unitEvolutionName } from "../content/unitNames";
import { ICONS, SKILL_ICONS } from "../core/emojiIcon";
import { equipmentSaleValue } from "../core/equipment";
import { getEquipment } from "../core/itemRegistry";
import { sellValue } from "../core/economy";
import { hasMessage, t, type MsgKey } from "../core/i18n";
import { equipmentBonusCopy, itemDisplayName } from "../core/itemPresentation";
import { starStatMilestones, type UnitDiagnosticEffect, type UnitDiagnostics } from "../core/inspection";
import { skillSpec } from "../core/skills";
import { basicAttackCopy } from "../core/unitText";
import { VARIANT_BY_ID, type VariantBonuses } from "../core/variants";
import type { TooltipChip, TooltipContent, TooltipLine, TooltipMeter, TooltipSection } from "./tooltip";

export interface UnitTooltipOptions {
  star?: 1 | 2 | 3;
  diagnostics?: UnitDiagnostics | null;
  portrait?: CanvasImageSource | null;
  /** Gold price when the unit is currently purchasable (Shop card / shop hover). */
  cost?: number;
  /** Owned copies shown on cards. */
  owned?: number;
  showSale?: boolean;
}

const STATUS_ICONS: Record<string, string> = {
  burn: ICONS.burn, poison: ICONS.poison, bleed: ICONS.bleed, freeze: ICONS.freeze, stun: ICONS.stun,
  sleep: ICONS.sleep, silence: ICONS.silence, disease: ICONS.disease, taunt: ICONS.taunt,
  healBlock: ICONS.healBlock, shield: ICONS.shield, reflect: ICONS.reflect, counter: ICONS.start,
  phoenix: ICONS.burn, "phoenix-used": ICONS.skull, berserk: ICONS.streakWin, slow: ICONS.slow, haste: ICONS.haste,
};

const STAT_LABEL: Record<string, string> = {
  hp: "HP", atk: "ATK", def: "DEF", matk: "MATK", mdef: "MDEF",
};

const STAT_COPY: Partial<Record<string, MsgKey>> = {
  evade: "inventory.evade", crit: "inventory.crit", accuracy: "inventory.accuracy", critDmg: "inventory.critDmg",
};

const num = (v: unknown) => Math.round(Number(v) || 0);
const pct = (v: unknown) => `${Math.round(Number(v) * 100)}%`;

/** First authored sentence, trimmed for summary-mode skill copy. */
function firstSentence(text: string, max = 150): string {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const sentence = /^.*?[.!?](?:\s|$)/.exec(clean)?.[0]?.trim() ?? clean;
  return sentence.length > max ? `${sentence.slice(0, max - 1).trimEnd()}…` : sentence;
}

function bonusText(b: VariantBonuses): string {
  const parts: string[] = [];
  if (b.hpPct) parts.push(`+${b.hpPct}% ${t("inventory.hp")}`);
  if (b.atkPct) parts.push(`+${b.atkPct}% ${t("inventory.atk")}`);
  if (b.matkPct) parts.push(`+${b.matkPct}% ${t("inventory.matk")}`);
  if (b.def) parts.push(`+${b.def} ${t("inventory.def")}`);
  if (b.mdef) parts.push(`+${b.mdef} ${t("inventory.mdef")}`);
  if (b.healPct) parts.push(`+${b.healPct}% ${t("inventory.healPct")}`);
  if (b.critPct) parts.push(`+${b.critPct}% ${t("inventory.crit")}`);
  if (b.evadePct) parts.push(`+${b.evadePct}% ${t("inventory.evade")}`);
  if (b.lifestealPct) parts.push(`+${b.lifestealPct}% ${t("inventory.lifesteal")}`);
  if (b.startingShield) parts.push(`+${b.startingShield} ${t("inventory.shield")}`);
  if (b.startingRage) parts.push(`+${b.startingRage} ${t("inventory.rage")}`);
  return parts.join(" · ");
}

function effectCopy(e: UnitDiagnosticEffect): string {
  const copy = STAT_COPY[e.key];
  const label = STAT_LABEL[e.key] ?? (copy ? t(copy) : (hasMessage(`inventory.${e.key}`) ? t(`inventory.${e.key}` as MsgKey) : e.key));
  const value = e.pct ? `${e.value > 0 ? "+" : ""}${e.value}%` : (e.value ? String(e.value) : "");
  const turns = e.turns > 0 ? t("inventory.turns", { turns: e.turns }) : "";
  return [label, value, turns].filter(Boolean).join(" · ");
}

function statusChip(e: UnitDiagnosticEffect): TooltipChip {
  const icon = STATUS_ICONS[e.key] ?? ICONS.event;
  return { icon, text: effectCopy(e), tone: "status" };
}

function equipmentCopy(ids: string[]): string {
  if (!ids.length) return t("tooltip.noEquipment");
  return ids.map((id) => {
    const bonus = equipmentBonusCopy(getEquipment(id)?.bonuses ?? {});
    return `${ICONS.craft} ${itemDisplayName(id)}${bonus ? ` · ${bonus}` : ""}`;
  }).join("\n");
}

/**
 * Build one catalog + live-diagnostics tooltip model. The returned content carries every mode:
 * `lines` for compact, `sections` for summary and `columns` for expanded.
 */
export function unitTooltipContent(unit: UnitDef, options: UnitTooltipOptions = {}): TooltipContent {
  const diagnostics = options.diagnostics ?? null;
  const star = Math.max(1, Math.min(3, Number(options.star ?? diagnostics?.star ?? 1))) as 1 | 2 | 3;
  const row = starStatMilestones(unit)[star - 1]!;
  const live = diagnostics?.live ?? null;
  const derived = diagnostics?.derived ?? null;
  const current = live ?? derived;
  const hp = current ? num(current.hp) : row.hp;
  const maxHp = current ? num(current.maxHp) : row.hp;
  const shield = current ? num(current.shield) : 0;
  const rage = current ? num(current.rage) : 0;
  const rageMax = Math.max(0, current ? num(current.rageMax) : row.rageCost);
  const magicBasic = unit.basic.damageType === "magic";
  const basicDamage = magicBasic ? row.matk : row.atk;
  const skill = unit.skill;
  const detail = skill.starDetailVi[star - 1] ?? skill.detailVi ?? "";
  const rageCost = Math.max(0, num(skill.rageCost[star - 1] ?? skill.rageCost[0]));
  const effects = diagnostics?.effects ?? [];
  const variants = diagnostics?.traits ?? [];
  const equips = diagnostics?.equips ?? [];
  // Skills carry their authored role marker (dagger for ASSASSIN, axe for FIGHTER) so two physical
  // skill lines never read as the same action; basic attacks always use the shared fist.
  const skillIcon = SKILL_ICONS[unit.role];

  // ── header ────────────────────────────────────────────────────────────────
  const badges: TooltipChip[] = [
    { icon: ICONS.star, text: t("unit.star", { star }), tone: "star" },
    { text: t("library.tier", { tier: unit.tier }), tone: "tier" },
  ];
  if (options.cost !== undefined) badges.unshift({ icon: ICONS.gold, text: t("tooltip.badge.buy", { cost: options.cost }), tone: "gold" });
  if (options.owned) badges.push({ icon: ICONS.inventory, text: t("tooltip.badge.owned", { count: options.owned }), tone: "default" });
  badges.push(
    { icon: ICONS[unit.role], text: t(`role.${unit.role}` as MsgKey), tone: "class", secondary: true },
    { icon: ICONS[unit.faction], text: t(`faction.${unit.faction}` as MsgKey), tone: "tribe", secondary: true },
    { icon: ICONS[unit.element], text: t(`element.${unit.element}` as MsgKey), tone: "default", secondary: true },
  );
  if (unit.boss) badges.push({ icon: ICONS.crown, text: t("library.boss"), tone: "gold" });
  if (diagnostics) {
    badges.push(diagnostics.side === "R"
      ? { icon: ICONS.start, text: t("tooltip.badge.enemy"), tone: "status" }
      : { icon: ICONS.shield, text: t("tooltip.badge.ally"), tone: "status" });
    if (live && !live.alive) badges.push({ icon: ICONS.skull, text: t("tooltip.badge.dead"), tone: "status" });
  }
  const sale = sellValue(unit.tier, star) + equips.reduce((sum, id) => sum + equipmentSaleValue(getEquipment(id)?.tier ?? 1), 0);
  if (!unit.boss && (options.showSale ?? Boolean(diagnostics))) {
    badges.push({ icon: ICONS.sell, text: t("tooltip.badge.sell", { price: sale }), tone: "gold" });
  }

  const meters: TooltipMeter[] = [
    { key: "hp", label: t("inventory.hp"), icon: ICONS.hp, kind: "bar", value: hp, max: maxHp, shield },
  ];
  if (rageMax > 0) meters.push({ key: "rage", label: t("inventory.rage"), icon: ICONS.rage, kind: "pips", value: rage, max: rageMax });

  const statusChips = effects.map(statusChip);

  // ── compact lines ─────────────────────────────────────────────────────────
  const lines: TooltipLine[] = [
    { icon: ICONS.hp, text: `${t("inventory.hp")} ${hp}/${maxHp}${shield ? ` (+${shield})` : ""}` },
    { icon: ICONS.atk, text: `ATK ${num(current?.atk ?? row.atk)} · DEF ${num(current?.def ?? row.def)}` },
    { icon: ICONS.matk, text: `MATK ${num(current?.matk ?? row.matk)} · MDEF ${num(current?.mdef ?? row.mdef)}` },
    { icon: ICONS.range, text: `${t("inventory.range")} ${num(current?.range ?? row.range)} · ${t("inventory.rage")} ${rage}/${rageMax}` },
  ];
  if (current) {
    lines.push({
      icon: ICONS.evade,
      text: `${t("inventory.evade")} ${pct(current.evade)} · ${t("inventory.crit")} ${pct(current.crit)} · ${t("inventory.accuracy")} ${pct(current.accuracy)}`,
    });
  }
  lines.push({ icon: skillIcon, text: `${t("library.skill")}: ${skill.nameVi} (${t("unit.rage", { cost: rageCost })})` });

  // ── summary blocks (old_src buildSummaryUnitSectionBlocks) ────────────────
  const traitLines: string[] = [
    `${t("library.tier", { tier: unit.tier })} · ${t("unit.star", { star })}`,
  ];
  if (variants.length) {
    const names = variants.map((ref) => VARIANT_BY_ID.get(ref.id)?.nameVi ?? ref.id);
    traitLines.push(`${ICONS.variant} ${t("inventory.variant")}: ${names.join(" · ")}`);
  }
  if (equips.length) {
    const names = equips.map((id) => itemDisplayName(id));
    traitLines.push(`${ICONS.craft} ${t("inventory.equipment")}: ${t("tooltip.equipmentSlots", { used: equips.length, max: star })} · ${names.join(", ")}`);
  }

  const summarySections: TooltipSection[] = [];
  summarySections.push({ title: t("tooltip.section.traits"), lines: traitLines });
  if (statusChips.length) summarySections.push({ title: t("tooltip.section.statuses"), lines: statusChips.map((c) => [c.icon, c.text].filter(Boolean).join(" ")) });
  summarySections.push({
    title: t("tooltip.section.currentSkill"),
    lines: [`${skillIcon} ${skill.nameVi} (${t("unit.rage", { cost: rageCost })})`, firstSentence(detail)],
  });

  // ── expanded columns (old_src buildCanonicalUnitExpandedColumns) ──────────
  const basicInfo: string[] = [
    `${ICONS.star} ${t("unit.star", { star })} · ${t("library.tier", { tier: unit.tier })}`,
    `${ICONS[unit.faction]} ${t("tooltip.stat.faction")}: ${t(`faction.${unit.faction}` as MsgKey)}`,
    `${ICONS[unit.role]} ${t("tooltip.stat.role")}: ${t(`role.${unit.role}` as MsgKey)}`,
    `${ICONS[unit.element]} ${t("tooltip.stat.element")}: ${t(`element.${unit.element}` as MsgKey)}`,
    `${ICONS.hp} ${t("inventory.hp")}: ${row.hp}`,
    `${ICONS.atk} ATK: ${row.atk} · ${ICONS.def} DEF: ${row.def}`,
    `${ICONS.matk} MATK: ${row.matk} · ${ICONS.mdef} MDEF: ${row.mdef}`,
    `${ICONS.range} ${t("inventory.range")}: ${row.range} · ${ICONS.rage} ${t("inventory.rage")}: ${row.rageCost}`,
  ];
  if (unit.boss) basicInfo.push(`${ICONS.crown} ${t("library.boss")}`);

  const currentStats: string[] = [
    `${ICONS.hp} ${t("inventory.hp")}: ${hp}/${maxHp}${shield ? ` (+${shield})` : ""}`,
    `${ICONS.atk} ATK: ${num(current?.atk ?? row.atk)} · ${ICONS.def} DEF: ${num(current?.def ?? row.def)}`,
    `${ICONS.matk} MATK: ${num(current?.matk ?? row.matk)} · ${ICONS.mdef} MDEF: ${num(current?.mdef ?? row.mdef)}`,
    `${ICONS.range} ${t("inventory.range")}: ${num(current?.range ?? row.range)}`,
    `${ICONS.rage} ${t("inventory.rage")}: ${rage}/${rageMax}`,
  ];
  if (current) {
    currentStats.push(
      `${ICONS.evade} ${t("inventory.evade")}: ${pct(current.evade)} · ${ICONS.crit} ${t("inventory.crit")}: ${pct(current.crit)}`,
      `${ICONS.accuracy} ${t("inventory.accuracy")}: ${pct(current.accuracy)} · ${ICONS.critDmg} ${t("inventory.critDmg")}: ${pct(current.critDmg)}`,
    );
  }

  const passiveLines: string[] = variants.length
    ? variants.map((ref, index) => {
      const def = VARIANT_BY_ID.get(ref.id);
      const bonus = def ? bonusText(def.bonuses) : "";
      return `${index + 1}. ${def?.nameVi ?? ref.id}${bonus ? ` · ${bonus}` : ""}`;
    })
    : [t("inventory.noVariant")];

  const basicLines: string[] = [
    `${ICONS.fist} ${basicAttackCopy(unit)}`,
    `${ICONS.crit} ${t("inventory.basicDamage")}: ${basicDamage}`,
  ];

  const skillStars = ([1, 2, 3] as const).map((milestone) => {
    const damage = skillSpec(unit.id, milestone).damage;
    const formula = damage
      ? `${ICONS.crit} ${t("tooltip.formula", {
        value: `${damage.base} + ${Math.round(damage.scale * 100)}% ${damage.stat.toUpperCase()}`,
      })}`
      : null;
    return {
      star: milestone,
      current: milestone === star,
      label: `${milestone === star ? "▶ " : ""}${ICONS.star.repeat(milestone)} ${t("unit.star", { star: milestone })} · ${t("unit.rage", { cost: skill.rageCost[milestone - 1] })}${milestone === star ? ` · ${t("tooltip.currentStar")}` : ""}`,
      lines: [skill.starDetailVi[milestone - 1] ?? skill.detailVi ?? "", ...(formula ? [formula] : [])],
    };
  });
  const skillMeta: string[] = [];
  if (skill.targetVi) skillMeta.push(`${ICONS.range} ${t("library.target")}: ${skill.targetVi}`);
  if (skill.shapeVi) skillMeta.push(`${ICONS.synergy} ${t("library.shape")}: ${skill.shapeVi}`);
  if (skill.countVi) skillMeta.push(`${ICONS.range} ${t("library.targets")}: ${skill.countVi}`);
  if (skill.durationVi) skillMeta.push(`${ICONS.hourglass} ${t("library.duration")}: ${skill.durationVi}`);
  const skillSection: TooltipSection = {
    title: t("tooltip.section.skill"),
    lines: [`${skillIcon} ${skill.nameVi}`],
    stars: skillStars,
    metadata: skillMeta,
  };

  const columns: TooltipSection[][] = [
    [{ title: t("tooltip.section.basicInfo"), lines: basicInfo }],
    [
      { title: t("tooltip.section.currentStats"), lines: currentStats },
      { title: t("tooltip.section.equipment"), lines: [t("tooltip.equipmentSlots", { used: equips.length, max: star }), equipmentCopy(equips)] },
      ...(effects.length ? [{ title: t("tooltip.section.statuses"), lines: effects.map(effectCopy) }] : []),
    ],
    [
      { title: t("tooltip.section.passive"), lines: passiveLines },
      { title: t("tooltip.section.basicAttack"), lines: basicLines },
    ],
    [skillSection],
  ];

  return {
    title: unitEvolutionName(unit, star),
    subtitle: `${t(`role.${unit.role}` as MsgKey)} · ${t(`faction.${unit.faction}` as MsgKey)} · ${t(`element.${unit.element}` as MsgKey)}`,
    icon: ICONS[unit.role],
    portrait: options.portrait ?? null,
    description: unit.pitchVi,
    lines,
    badges,
    statuses: statusChips,
    meters,
    sections: summarySections,
    columns,
    expandedSections: [...summarySections.slice(0, -1), skillSection],
  };
}
