// Owned creature modal. Stat values and quoted prices are supplied by canonical core owners.
import { getUnit } from "../content/catalog";
import { unitEvolutionName } from "../content/unitNames";
import type { CombatUnitSnapshot } from "../core/combat";
import { ICONS } from "../core/emojiIcon";
import { getEquipment, slotCapForUnit } from "../core/equipment";
import { sellValue } from "../core/economy";
import { t, type MsgKey } from "../core/i18n";
import { MODE_CONFIG } from "../core/modes";
import { unequipQuote, type RunState } from "../core/run";
import { skillSpec } from "../core/skills";
import { tutorialActionAllowed } from "../core/tutorial";
import type { OwnedUnitInspection } from "../core/unitInventory";
import { starStatMilestones, type UnitDiagnostics, type UnitDiagnosticEffect, type UnitStatSnapshot } from "../core/inspection";
import { VARIANT_BY_ID, type VariantBonuses, type VariantTraitRef } from "../core/variants";
import { basicAttackCopy } from "../core/unitText";
import type { Portraits } from "../units/portraits";
import { h, INK, kitButton, label, nineSlice, NORMAL_FONT, SLICE, surface, threeSlice, type KitButton, type Surface } from "./kit";
import { uiFont } from "./fontScale";
import { mountPortraitControls } from "./portraitControls";
import type { ModalHandle } from "./modal";

export interface UnitInventoryModel {
  run: RunState;
  inspection: OwnedUnitInspection;
  current: CombatUnitSnapshot;
  inCombat: boolean;
}
export interface UnitInventoryIntents {
  getModel(): UnitInventoryModel | null;
  sell(): boolean;
  equip(itemId: string): boolean;
  unequip(index: number): boolean;
  unequipAll(): boolean;
  /** Owned units can jump to their Library entry; enemy inspection omits it. */
  openLibrary?(): void;
}

type StatKey = "hp" | "atk" | "matk" | "def" | "mdef" | "rage" | "shield" | "evade" | "crit" | "accuracy" | "range";
type StatRowKey = StatKey | "critDmg";
const STAT_ROWS: { key: StatRowKey; icon: string; fill: string }[] = [
  { key: "hp", icon: ICONS.hp, fill: "#69ae46" },
  { key: "atk", icon: ICONS.atk, fill: "#d8873c" },
  { key: "matk", icon: ICONS.matk, fill: "#af79c4" },
  { key: "def", icon: ICONS.def, fill: "#669bb1" },
  { key: "mdef", icon: ICONS.mdef, fill: "#8b8dce" },
  { key: "rage", icon: ICONS.rage, fill: "#e7b042" },
  { key: "shield", icon: ICONS.def, fill: "#9cbbb6" },
  { key: "evade", icon: ICONS.evade, fill: "#8fd6d0" },
  { key: "crit", icon: ICONS.crit, fill: "#e46a5a" },
  { key: "accuracy", icon: ICONS.accuracy, fill: "#d9c26a" },
  { key: "critDmg", icon: ICONS.critDmg, fill: "#c96f8f" },
  { key: "range", icon: ICONS.range, fill: "#9fb3c8" },
];
const PERCENT_STATS = new Set(["evade", "crit", "accuracy", "critDmg", "lifesteal", "healPct", "rageGainPct"]);
const fmt = (value: number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value);
const statValue = (key: string, value: number) => PERCENT_STATS.has(key) ? `${fmt(value * 100)}%` : fmt(value);
const statName = (key: string) => t(`inventory.${key}` as MsgKey);
const itemName = (id: string) => id === "eq_warmog_armor" ? t("item.eq_warmog_armor") : id === "eq_blue_buff" ? t("item.eq_blue_buff") : id;

type InventoryStats = Pick<UnitStatSnapshot, StatKey | "maxHp" | "rageMax"> & { critDmg?: number };
interface InventoryDisplay {
  uid: string;
  baseId: string;
  star: number;
  stats: readonly [InventoryStats, InventoryStats, InventoryStats];
  traits: readonly VariantTraitRef[];
  location: string;
  hint: string;
}

const VARIANT_BONUS_LABEL: Record<string, { key: MsgKey; pct: boolean }> = {
  hpPct: { key: "inventory.hp", pct: true },
  atkPct: { key: "inventory.atk", pct: true },
  matkPct: { key: "inventory.matk", pct: true },
  def: { key: "inventory.def", pct: false },
  mdef: { key: "inventory.mdef", pct: false },
  healPct: { key: "inventory.healPct", pct: true },
  critPct: { key: "inventory.crit", pct: true },
  evadePct: { key: "inventory.evade", pct: true },
  lifestealPct: { key: "inventory.lifesteal", pct: true },
  startingShield: { key: "inventory.shield", pct: false },
  startingRage: { key: "inventory.rage", pct: false },
};

const variantBonusCopy = (bonuses: VariantBonuses): string => Object.entries(bonuses)
  .filter(([, value]) => typeof value === "number" && value !== 0)
  .map(([key, value]) => {
    const label = VARIANT_BONUS_LABEL[key];
    return label ? `${t(label.key)} +${fmt(value!)}${label.pct ? "%" : ""}` : "";
  })
  .filter(Boolean)
  .join(" · ");

const richSpan = (text: string, tone: string): HTMLElement => h("span", `rich rich-${tone}`, text);
const richLine = (...parts: Array<string | Node>): HTMLElement => {
  const line = h("p", "ui-inventory-formula-line");
  for (const part of parts) line.append(part);
  return line;
};
/** Wrap authored damage formulas so the numbers carry the effect colour the panel headings use. */
const colorizeNumbers = (text: string, tone: string): Array<string | Node> => {
  const parts: Array<string | Node> = [];
  const pattern = /(\d+(?:[.,]\d+)?%?)/g;
  let last = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(richSpan(match[1], tone));
    last = match.index + match[1].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
};

const PROSE_RULES: { test: RegExp; emoji: string; tone: string }[] = [
  { test: /hồi .*HP tối đa|tự hồi/i, emoji: "💚", tone: "heal" },
  { test: /khiên/i, emoji: "🛡️", tone: "shield" },
  { test: /giảm .*sát thương nhận|giảm sát thương/i, emoji: "🛡️", tone: "shield" },
  { test: /thanh tẩy|xóa hiệu ứng/i, emoji: "✨", tone: "buff" },
  { test: /chảy máu|nhiễm độc|thiêu đốt|độc/i, emoji: "🩸", tone: "element" },
  { test: /choáng|đóng băng|ngủ|khiêu khích/i, emoji: "💫", tone: "control" },
];

/** Decorate authored prose sentence by sentence: effect emoji plus tone-coloured numbers. */
const decorateProse = (text: string, tone: string): DocumentFragment => {
  const frag = document.createDocumentFragment();
  for (const sentence of text.split(/(?<=\.)\s+/)) {
    if (!sentence) continue;
    const rule = PROSE_RULES.find((entry) => entry.test.test(sentence));
    if (rule) frag.append(`${rule.emoji} `);
    for (const part of colorizeNumbers(sentence, rule?.tone ?? tone)) frag.append(part);
    frag.append(" ");
  }
  return frag;
};

/** The owned inventory and read-only enemy inspection share the same DOM, kit and stat painters. */
function createInventoryView(modal: ModalHandle, portraits: Portraits, getDisplay: () => InventoryDisplay, readonly = false) {
  const initial = getDisplay();
  const unit = getUnit(initial.baseId);
  const surfaces: Surface[] = [], itemSurfaces: Surface[] = [], itemButtons: KitButton[] = [];
  const panel = (cls: string, temporary = false) => {
    const el = h("div", `kit-panel ${cls}`);
    const s = surface(el, (g, w, hh) => nineSlice(g, "slot_well", SLICE.slot_well, 0, 0, w, hh));
    (temporary ? itemSurfaces : surfaces).push(s);
    return el;
  };
  const root = h("div", "ui-inventory");
  root.dataset.uid = initial.uid;
  if (readonly) root.dataset.readonly = "true";
  const content = h("div", "ui-inventory-content");
  const profile = h("div", "ui-inventory-profile");
  const portraitPanel = panel("ui-inventory-portrait");
  const portraitHost = h("div", "ui-inventory-view");
  portraitPanel.append(portraitHost);
  const viewer = portraits.createViewer(portraitHost);
  const controlsOff = mountPortraitControls(portraitHost, viewer);
  let shownStar = initial.star;
  viewer.setUnit(unit.id, shownStar as Parameters<typeof viewer.setUnit>[1]);
  const name = h("h2", "ui-inventory-name", unitEvolutionName(unit, initial.star));
  const stars = h("div", "ui-inventory-stars", ICONS.star.repeat(initial.star));
  const identity = h("div", "ui-inventory-identity");
  identity.append(h("span", "", `${ICONS[unit.role]} ${t(`role.${unit.role}` as MsgKey)}`),
    h("span", "", `${ICONS[unit.faction]} ${t(`faction.${unit.faction}` as MsgKey)}`),
    h("span", "", `${ICONS[unit.element]} ${t(`element.${unit.element}` as MsgKey)}`));
  const location = h("p", "ui-inventory-note");
  const skill = panel("ui-inventory-skill");
  const skillHead = h("div", "ui-inventory-section-head");
  const skillName = h("strong", "", unit.skill.nameVi);
  const skillRage = h("span", "ui-inventory-note");
  skillHead.append(h("h3", "", t("inventory.skillBlock")), skillRage);
  const skillMeta = h("p", "ui-inventory-note");
  const skillFormula = h("div", "ui-inventory-formula");
  const skillDescription = h("p");
  const milestones = h("div", "ui-inventory-milestones");
  skill.append(skillHead, skillName, skillMeta, skillFormula, skillDescription, milestones);

  const passive = panel("ui-inventory-passive");
  passive.append(h("h3", "", t("inventory.passive")), h("p", "", t(`passive.${unit.role}` as MsgKey)));

  const basic = panel("ui-inventory-basic");
  const basicCopy = h("p");
  basic.append(h("h3", "", t("inventory.basicAttack")), basicCopy);

  profile.append(portraitPanel, name, stars, identity, location, skill, passive, basic);

  const renderSkill = (star: number) => {
    const rageCost = unit.skill.rageCost[star - 1] ?? unit.skill.rageCost[0];
    skillRage.textContent = `${ICONS.rage} ${t("unit.rage", { cost: rageCost })}`;
    skillMeta.textContent = [unit.skill.targetVi, unit.skill.shapeVi, unit.skill.selectionVi, unit.skill.countVi, unit.skill.durationVi]
      .filter(Boolean).join(" · ");
    const spec = skillSpec(unit.id, star);
    const extra = spec as typeof spec & {
      selfHealPctMaxHp?: number; damageReductionPct?: number; damageReductionTurns?: number; cleanseCount?: number;
    };
    const statKey = (key: string) => t(`inventory.${key}` as MsgKey);
    const formula = (f: { base: number; scale: number; stat: string }) =>
      f.scale > 0
        ? t("inventory.formula", { base: fmt(f.base), scale: fmt(Math.round(f.scale * 100)), stat: statKey(f.stat) })
        : fmt(f.base);
    const rows: HTMLElement[] = [];
    if (spec.damage) {
      rows.push(richLine(`${spec.damage.type === "magic" ? ICONS.matk : spec.damage.type === "true" ? "✨" : ICONS.atk} `,
        richSpan(formula(spec.damage), spec.damage.type), ` · ${t(`inventory.${spec.damage.type}` as MsgKey)}`));
    }
    if (extra.selfHealPctMaxHp && extra.selfHealPctMaxHp > 0) {
      rows.push(richLine(`💚 ${t("inventory.selfHeal")}: `, richSpan(`${fmt(extra.selfHealPctMaxHp * 100)}% HP`, "heal")));
    }
    if (spec.heal?.formula) rows.push(richLine(`💚 ${t("inventory.healPct")}: `, richSpan(formula(spec.heal.formula), "heal")));
    if (spec.shield) rows.push(richLine(`🛡️ ${t("inventory.shield")}: `, richSpan(formula(spec.shield), "shield")));
    if (extra.damageReductionPct && extra.damageReductionPct > 0) {
      rows.push(richLine(`🛡️ ${t("inventory.damageReduction")}: `, richSpan(`${fmt(extra.damageReductionPct * 100)}%`, "shield"),
        ` · ${t("inventory.turns", { turns: extra.damageReductionTurns ?? 1 })}`));
    }
    if (extra.cleanseCount && extra.cleanseCount > 0) {
      rows.push(richLine(`✨ ${t("inventory.cleanse")}: `, richSpan(String(extra.cleanseCount), "buff")));
    }
    for (const dot of spec.dots) {
      const icon = dot.kind === "burn" ? "🔥" : dot.kind === "poison" ? "☠️" : dot.kind === "disease" ? "🦠" : "🩸";
      rows.push(richLine(`${icon} ${t(`inventory.${dot.kind}` as MsgKey)}: `, richSpan(`${fmt(dot.value)}/lượt`, "element"), ` · ${t("inventory.turns", { turns: dot.turns })}`));
    }
    for (const control of spec.controls) rows.push(richLine(`💫 ${t(`inventory.${control.kind}` as MsgKey)} · ${t("inventory.turns", { turns: control.turns })}`));
    for (const mod of spec.buffs) rows.push(richLine(`💪 +${fmt(mod.value)}${mod.pct ? "%" : ""} ${statKey(mod.stat)} · ${t("inventory.turns", { turns: mod.turns })}`));
    for (const mod of spec.debuffs) rows.push(richLine(`🥀 ${fmt(mod.value)}${mod.pct ? "%" : ""} ${statKey(mod.stat)} · ${t("inventory.turns", { turns: mod.turns })}`));
    skillFormula.replaceChildren(...rows);
    const tone = spec.damage?.type ?? (spec.heal || extra.selfHealPctMaxHp ? "heal" : "magic");
    const prose = unit.skill.starDetailVi[star - 1] ?? unit.skill.detailVi ?? unit.pitchVi;
    skillDescription.replaceChildren(decorateProse(prose, tone));
    milestones.replaceChildren(h("h4", "", `${ICONS.star} ${t("inventory.starMilestones")}`));
    for (let s = 1; s <= 3; s++) {
      const entry = h("p", s === star ? "is-current" : "");
      entry.append(`${ICONS.star.repeat(s)} ${t("inventory.starLine", { star: s })}: `,
        decorateProse(unit.skill.starDetailVi[s - 1] ?? "", tone));
      milestones.append(entry);
    }
    const milestone = starStatMilestones(unit)[star - 1];
    basicCopy.replaceChildren(
      `${unit.basic.damageType === "magic" ? ICONS.matk : ICONS.atk} ${basicAttackCopy(unit).replace(/\.\s*$/, "")} · ${t("inventory.basicDamage")}: `,
      richSpan(fmt(milestone?.basicDamage ?? 0), unit.basic.damageType),
    );
  };
  renderSkill(initial.star);

  const right = h("div", "ui-inventory-right");
  const statGrid = h("div", "ui-inventory-stats");
  const statPainters: Surface[] = [];
  const titles: MsgKey[] = ["inventory.base", "inventory.boosted", "inventory.current"];
  for (let col = 0; col < 3; col++) {
    const column = panel("ui-inventory-stat-column");
    column.append(h("h3", "", t(titles[col])));
    const hint = h("p", "ui-inventory-column-hint", col === 0 ? t("inventory.baseHint", { star: initial.star }) :
      col === 1 ? t("inventory.boostedHint") : initial.hint);
    if (col === 0) hint.dataset.baseHint = "true";
    if (col === 2) hint.dataset.currentHint = "true";
    column.append(hint);
    for (const row of STAT_ROWS) {
      const el = h("div", "ui-inventory-stat");
      el.setAttribute("role", "meter");
      el.setAttribute("aria-label", `${t(titles[col])}: ${statName(row.key)}`);
      el.dataset.stat = row.key; el.dataset.column = String(col);
      const paint = surface(el, (g, w, hh) => {
        const key = row.key;
        const stats = getDisplay().stats;
        const current = stats[col];
        const value = key === "critDmg" ? (current.critDmg ?? stats[1].critDmg ?? 1.5) : current[key];
        const max = key === "hp" ? current.maxHp : key === "rage" ? current.rageMax
          : key === "evade" || key === "crit" || key === "accuracy" ? 1
          : key === "critDmg" ? 3 : key === "range" ? 5
          : Math.max(1, ...stats.map((s) => s[key]));
        const previous = key === "critDmg" ? (stats[1].critDmg ?? value) : stats[1][key];
        const delta = col === 2 ? value - previous : 0;
        const text = key === "hp" ? `${fmt(value)} / ${fmt(current.maxHp)}` : key === "rage" ? `${fmt(value)} / ${fmt(current.rageMax)}` : statValue(key, value);
        // Two stat columns make each cell narrow: keep the value on the label line only when it
        // fits, otherwise stack it above the bar so long labels never collide with their number.
        const font = uiFont(Math.max(8, Math.min(13, w / 14)));
        g.font = `700 ${font}px ${NORMAL_FONT}`;
        const labelW = g.measureText(`${row.icon} ${statName(row.key)}`).width;
        const valueW = g.measureText(text).width;
        const stacked = labelW + valueW + 14 > w;
        const textY = Math.max(13, font * (stacked ? 0.62 : 0.58));
        label(g, `${row.icon} ${statName(row.key)}`, 3, textY, { size: font, align: "left", fill: INK, stroke: null, maxW: w - 6 });
        if (stacked) label(g, text, w - 3, textY + font * 1.05, { size: font, align: "right", fill: INK, stroke: null, maxW: w - 6 });
        else label(g, text, w - 3, textY, { size: font, align: "right", fill: INK, stroke: null });
        const y = hh - 16, barW = w - 6;
        nineSlice(g, "bar_trough", 1, 3, y + 2, barW, 9);
        const ratio = Math.max(0, Math.min(1, value / Math.max(1, max)));
        g.fillStyle = row.fill;
        if (row.key === "rage") {
          const count = Math.max(1, Math.min(12, current.rageMax)), gap = 2, seg = (barW - (count - 1) * gap) / count;
          for (let i = 0; i < count; i++) if ((i + 1) / count <= ratio + .001) g.fillRect(3 + i * (seg + gap), y + 2, seg, 9);
        } else g.fillRect(3, y + 2, barW * ratio, 9);
        threeSlice(g, "frame_bar", 3, 1, y, w - 2, 14);
        if (delta) label(g, `${delta > 0 ? "+" : ""}${fmt(delta)}`, w - 5, y - 10, { size: uiFont(9), align: "right" });
        el.setAttribute("aria-valuenow", String(Number(value.toFixed(3)))); el.setAttribute("aria-valuemin", "0"); el.setAttribute("aria-valuemax", String(max));
        el.setAttribute("aria-valuetext", `${text}${delta ? ` (${delta > 0 ? "+" : ""}${fmt(delta)})` : ""}`);
      });
      statPainters.push(paint); surfaces.push(paint); column.append(el);
    }
    statGrid.append(column);
  }

  const lower = h("div", "ui-inventory-lower");
  const equipment = panel("ui-inventory-equipment");
  const equippedHead = h("div", "ui-inventory-section-head");
  const slotsCount = h("span", "ui-inventory-note");
  equippedHead.append(h("h3", "", t("inventory.equipped")), slotsCount);
  const equipped = h("div", "ui-inventory-items");
  const bag = h("div", "ui-inventory-items");
  const equippedActions = h("div", "ui-inventory-equipped-actions");
  equipment.append(equippedHead, equipped, equippedActions);
  if (!readonly) equipment.append(h("h3", "", t("inventory.bag")), bag);
  const effectPanel = panel("ui-inventory-effects");
  const effects = h("div", "ui-inventory-effect-list");
  const sources = h("div", "ui-inventory-effect-list");
  effectPanel.append(h("h3", "", t("inventory.effects")), effects);
  if (!readonly) effectPanel.append(h("h3", "", t("inventory.sources")), sources);
  const variantPanel = panel("ui-inventory-variants");
  const variantHead = h("div", "ui-inventory-section-head");
  const variantCount = h("span", "ui-inventory-note");
  variantHead.append(h("h3", "", t("inventory.variant")), variantCount);
  const variantList = h("div", "ui-inventory-variant-list");
  variantPanel.append(variantHead, variantList);
  const renderVariants = () => {
    const defs = (getDisplay().traits ?? [])
      .map((ref) => VARIANT_BY_ID.get(ref.id))
      .filter((def): def is NonNullable<typeof def> => Boolean(def) && def!.role === unit.role);
    variantCount.textContent = t("inventory.variantCount", { count: defs.length });
    variantList.replaceChildren(...(defs.length
      ? defs.map((def, index) => h("p", "ui-inventory-variant",
        t("inventory.variantLine", { index: index + 1, name: def.nameVi, bonus: variantBonusCopy(def.bonuses) })))
      : [h("p", "ui-inventory-note", t("inventory.noVariant"))]));
  };
  lower.append(equipment, effectPanel, variantPanel); right.append(statGrid, lower); content.append(profile, right);
  root.append(content);

  const makeItem = (itemId: string, worn: boolean, count = 0) => {
    const item = getEquipment(itemId);
    if (!item) return null;
    const card = h("div", "ui-inventory-item");
    const icon = panel("ui-inventory-item-icon", true);
    const image = h("img");
    image.src = `/assets/items/${encodeURIComponent(itemId)}.svg`;
    image.alt = itemName(itemId);
    image.loading = "lazy";
    icon.append(image);
    const caption = h("strong", "ui-inventory-item-name", itemName(itemId));
    const meta = h("small", "ui-inventory-note", `${t("library.tier", { tier: item.tier })}${worn ? "" : ` · ×${count}`}`);
    card.title = !Object.keys(item.bonuses).length ? t("inventory.itemNoBonus") :
      Object.entries(item.bonuses).map(([key, value]) => `${key}: ${value}`).join(" · ");
    const detail = h("details", "ui-inventory-item-details");
    detail.append(h("summary", "", t("inventory.itemDetail")), h("p", "", card.title));
    card.append(icon, caption, meta);
    return { card, detail };
  };
  const emptySlot = () => {
    const empty = panel("ui-inventory-item-empty", true);
    empty.append(h("span", "", "+"), h("small", "", t("inventory.emptySlot")));
    return empty;
  };
  return {
    root, content, equipped, equippedHead, equippedActions, bag, slotsCount, effects, sources, itemButtons, panel, makeItem, emptySlot,
    updateStats() {
      const display = getDisplay();
      if (display.star !== shownStar) {
        shownStar = display.star;
        name.textContent = unitEvolutionName(unit, shownStar);
        viewer.setUnit(unit.id, shownStar as Parameters<typeof viewer.setUnit>[1]);
        stars.textContent = ICONS.star.repeat(shownStar);
        renderSkill(shownStar);
      }
      const baseHint = root.querySelector<HTMLElement>("[data-base-hint]");
      if (baseHint) baseHint.textContent = t("inventory.baseHint", { star: display.star });
      location.textContent = display.location;
      const hint = root.querySelector<HTMLElement>("[data-current-hint]");
      if (hint) hint.textContent = display.hint;
      renderVariants();
      for (const painter of statPainters) painter.paint();
    },
    clearItems() {
      for (const s of itemSurfaces.splice(0)) s.dispose();
      for (const b of itemButtons.splice(0)) b.dispose();
      equipped.replaceChildren(); bag.replaceChildren();
    },
    dispose() {
      controlsOff();
      viewer.dispose();
      for (const s of [...surfaces, ...itemSurfaces]) s.dispose();
      for (const b of itemButtons) b.dispose();
      root.remove();
    },
  };
}

function effectCard(host: HTMLElement, title: string, detail: string, positive: boolean, note?: string) {
  const row = h("div", "ui-inventory-effect"); row.dataset.positive = String(positive);
  row.append(h("strong", "", `${positive ? "✦" : "▼"} ${title}`), h("p", "", detail));
  if (note) row.append(h("small", "", note));
  host.append(row);
}

function renderTimedStatus(host: HTMLElement, kind: string, turns: number, value: number, sourceUnitBaseId?: string) {
  if (turns <= 0) return;
  let detail: string;
  if (["burn", "poison", "bleed", "disease"].includes(kind)) detail = t("inventory.dotDetail", { value: fmt(value) });
  else if (kind === "hot") detail = t("inventory.hotDetail", { value: fmt(value * 100) });
  else if (kind === "fireVulnerability") detail = t("inventory.fireVulnerabilityDetail", { value: fmt(value) });
  else if (["stun", "freeze", "sleep"].includes(kind)) detail = t("inventory.controlDetail");
  else if (["silence", "disarm", "taunt"].includes(kind)) detail = t(`inventory.${kind}Detail` as MsgKey);
  else detail = fmt(value);
  const source = sourceUnitBaseId ? getUnit(sourceUnitBaseId) : null;
  const note = source ? t("inventory.source", { name: source.nameVi, skill: source.skill.nameVi }) : undefined;
  effectCard(host, `${t(`inventory.${kind}` as MsgKey)} · ${t("inventory.turns", { turns })}`, detail, kind === "hot", note);
}

function renderDiagnosticEffect(host: HTMLElement, effect: UnitDiagnosticEffect) {
  if (effect.kind === "status") {
    renderTimedStatus(host, effect.key, effect.turns, effect.value, effect.sourceUnitBaseId);
    return;
  }
  const duration = (title: string) => effect.turns > 0 ? `${title} · ${t("inventory.turns", { turns: effect.turns })}` : title;
  if (effect.kind === "modifier") {
    const delta = `${effect.value > 0 ? "+" : ""}${fmt(effect.value)}`;
    effectCard(host, duration(statName(effect.key)),
      t("inventory.mod", { stat: statName(effect.key), value: delta, unit: effect.pct || effect.key === "evade" ? "%" : "" }),
      effect.value >= 0);
    return;
  }
  switch (effect.key) {
    case "reflect":
      effectCard(host, duration(t("inventory.reflect")),
        Object.entries(effect.reflectByDamageType ?? {}).map(([type, value]) =>
          `${t(`inventory.${type}` as MsgKey)}: ${fmt(value! * 100)}%`).join(" · "), true);
      break;
    case "counter":
      effectCard(host, duration(t("inventory.counter")), t("inventory.counterDetail"), true);
      break;
    case "phoenix":
      effectCard(host, t("inventory.phoenix"), t("inventory.phoenixDetail", { value: fmt(effect.value * 100) }), true);
      break;
    case "phoenix-used":
      effectCard(host, t("inventory.phoenixUsed"), t("inventory.phoenixUsedDetail"), false);
      break;
    case "berserk":
      if (effect.firstBasicMultiplier !== undefined && effect.rageOnKill !== undefined) {
        effectCard(host, duration(t("inventory.berserk")), t("inventory.berserkDetail", {
          value: fmt(effect.value * 100), mult: effect.firstBasicMultiplier, rage: effect.rageOnKill,
        }), true);
      }
      break;
  }
}

export function mountUnitInventory(modal: ModalHandle, portraits: Portraits, intents: UnitInventoryIntents) {
  const first = intents.getModel();
  if (!first) return { update() {}, dispose() {} };
  let model = first, disposed = false, confirmingSale = false;
  const unit = getUnit(model.inspection.unit.baseId);
  const view = createInventoryView(modal, portraits, () => ({
    uid: model.inspection.unit.uid,
    baseId: model.inspection.unit.baseId,
    star: model.inspection.unit.star,
    stats: [model.inspection.base, model.inspection.boosted, model.current],
    traits: model.inspection.unit.traits ?? [],
    location: t(model.inspection.where === "board" ? "inventory.board" : "inventory.bench"),
    hint: t(model.inCombat ? "inventory.liveHint" :
      model.inspection.where === "bench" ? "inventory.benchHint" : "inventory.planningHint"),
  }));
  const { root, equipped, bag, slotsCount, effects, sources, itemButtons, panel } = view;

  const footer = h("div", "ui-inventory-footer");
  const gold = h("strong", "ui-inventory-gold");
  const execute = (action: () => boolean, ok: MsgKey) => {
    const result = action();
    notice.textContent = t(result ? ok : "inventory.failed");
    notice.dataset.failed = String(!result);
    update();
  };
  const removeAll = kitButton({ skin: "wood", cls: "ui-inventory-action", onClick: () => execute(intents.unequipAll, "inventory.unequippedOk") });
  view.equippedActions.append(removeAll.el);
  const sell = kitButton({ skin: "red", cls: "ui-inventory-action", onClick: () => { confirmingSale = true; update(); confirm.el.focus(); } });
  const library = intents.openLibrary
    ? kitButton({
      skin: "blue", icon: ICONS.library, label: t("menu.library"), cls: "ui-inventory-action",
      onClick: () => { modal.close(); intents.openLibrary?.(); },
    })
    : null;
  footer.append(gold, sell.el, ...(library ? [library.el] : []));
  const saleHint = h("p", "ui-inventory-sale-hint", t("inventory.sellHint"));
  const confirmation = panel("ui-inventory-confirm");
  const confirmationText = h("p");
  const confirm = kitButton({ skin: "red", label: t("common.confirm"), onClick: () => {
    if (intents.sell()) { modal.close(); return; }
    confirmingSale = false; notice.textContent = t("inventory.failed"); update();
  } });
  const cancel = kitButton({ skin: "wood", label: t("common.cancel"), onClick: () => { confirmingSale = false; update(); sell.el.focus(); } });
  const confirmActions = h("div", "ui-inventory-confirm-actions");
  confirmActions.append(confirm.el, cancel.el); confirmation.append(confirmationText, confirmActions);
  const notice = h("p", "ui-inventory-notice");
  notice.setAttribute("role", "status"); notice.setAttribute("aria-live", "polite");
  root.append(notice, confirmation, footer, saleHint); modal.body.append(root);

  const editable = () => !model.inCombat && model.run.phase === "PLANNING";
  const allows = (action: "equip_item" | "unequip_item" | "sell_unit", itemId?: string) => tutorialActionAllowed(model.run, action, {
    source: action === "equip_item" ? { where: "inventory", index: model.run.itemBag.indexOf(itemId!), itemId } : { where: model.inspection.where, index: model.inspection.index },
    destination: action === "equip_item" ? { where: model.inspection.where, index: model.inspection.index } : undefined, itemId,
  });
  const affordable = (cost: number) => MODE_CONFIG[model.run.mode].creative || model.run.gold >= cost;
  let equipmentKey = "", effectsKey = "";
  const renderEffects = () => {
    const current = model.current;
    effects.replaceChildren(); sources.replaceChildren();
    for (const [kind, status] of Object.entries(current.status)) {
      renderTimedStatus(effects, kind, status.turns, status.value, status.source?.unitBaseId);
    }
    for (const mod of current.mods) {
      const delta = `${mod.value > 0 ? "+" : ""}${fmt(mod.value)}`;
      effectCard(effects, `${statName(mod.stat)} · ${t("inventory.turns", { turns: mod.turns })}`,
        `${t("inventory.mod", { stat: statName(mod.stat), value: delta, unit: mod.pct || mod.stat === "evade" ? "%" : "" })} · ${t("inventory.total", { before: statValue(mod.stat, model.inspection.boosted[mod.stat]), after: statValue(mod.stat, current[mod.stat]) })}`, mod.value >= 0);
    }
    if (unit.role === "FIGHTER" && current.hp > 0 && current.hp < current.maxHp) effectCard(effects, t("inventory.fighterPassive"),
      t("inventory.total", { before: fmt(model.inspection.boosted.atk), after: fmt(current.atk) }), true);
    if (current.reflect) effectCard(effects, `${t("inventory.reflect")} · ${t("inventory.turns", { turns: current.reflect.turns })}`,
      Object.entries(current.reflect.pctByDamageType).map(([type, value]) => `${t(`inventory.${type}` as MsgKey)}: ${fmt(value! * 100)}%`).join(" · "), true);
    if (current.counterTurns > 0) effectCard(effects, `${t("inventory.counter")} · ${t("inventory.turns", { turns: current.counterTurns })}`, t("inventory.counterDetail"), true);
    if (current.phoenix.armed && !current.phoenix.used) effectCard(effects, t("inventory.phoenix"), t("inventory.phoenixDetail", { value: fmt(current.phoenix.revivePct * 100) }), true);
    if (current.berserk) effectCard(effects, `${t("inventory.berserk")} · ${t("inventory.turns", { turns: current.berserk.turns })}`,
      t("inventory.berserkDetail", { value: fmt(current.berserk.lifestealPct * 100), mult: current.berserk.firstBasicMultiplier, rage: current.berserk.rageOnKill }), true);
    if (!effects.childElementCount) effects.append(h("p", "ui-inventory-note", t("inventory.noEffects")));
    for (const source of model.inspection.sources) {
      const rows = [...STAT_ROWS.map((row) => row.key), "evade", "crit", "accuracy"] as StatKey[];
      const changes = rows.filter((key) => source.after[key] !== source.before[key]).map((key) =>
        `${statName(key)}: ${statValue(key, source.before[key])} → ${statValue(key, source.after[key])}`);
      for (const key of ["lifesteal", "healPct", "rageGainPct", "onHitBurn", "onHitPoison"] as const) {
        if (source.after[key] !== source.before[key]) changes.push(`${statName(key)}: ${statValue(key, source.before[key])} → ${statValue(key, source.after[key])}`);
      }
      if (source.kind === "environment") {
        const env = model.inspection.envMods;
        const keys = ["burnOnHit", "poisonOnHit", "fireVuln", "healPct", "healRecvPct", "poisonAura", "rageGainPct", "lifesteal"] as const;
        for (const key of keys) {
          if (key === "fireVuln" ? env[key] === 1 : env[key] === 0) continue;
          const percent = ["healPct", "healRecvPct", "rageGainPct", "lifesteal"].includes(key);
          const value = env[key] * (percent ? 100 : 1);
          changes.push(t(`inventory.env.${key}` as MsgKey, { value: `${percent && value > 0 ? "+" : ""}${fmt(value)}` }));
        }
      }
      if (!changes.length && source.kind !== "environment") continue;
      const title = source.kind === "environment" ? t("inventory.environment", { name: t(`element.${model.inspection.environment}` as MsgKey) }) : t(`inventory.${source.kind}` as MsgKey);
      const reduced = rows.some((key) => source.after[key] < source.before[key]);
      const envPenalty = source.kind === "environment" && (model.inspection.envMods.fireVuln > 1 || model.inspection.envMods.poisonAura > 0 || model.inspection.envMods.healRecvPct < 0 || model.inspection.envMods.healPct < 0 || model.inspection.envMods.lifesteal < 0 || model.inspection.envMods.rageGainPct < 0);
      effectCard(sources, title, changes.join(" · ") || t("inventory.noStatChange"), !reduced && !envPenalty);
    }
  };
  const renderEquipment = () => {
    view.clearItems();
    const own = model.inspection.unit;
    const cap = slotCapForUnit(unit, own.star);
    const costs = unequipQuote(model.run, model.inspection.where, model.inspection.index);
    slotsCount.textContent = t("inventory.slots", { used: own.equips.length, max: cap });
    const makeItem = (itemId: string, host: HTMLElement, index: number, worn: boolean) => {
      const item = getEquipment(itemId);
      if (!item) return;
      const rendered = view.makeItem(itemId, worn, model.run.itemBag.filter((id) => id === itemId).length);
      if (!rendered) return;
      const { card, detail } = rendered;
      const cost = worn ? costs?.[index] : undefined;
      let reason = "";
      if (!editable()) reason = t("inventory.combatLocked");
      else if (!allows(worn ? "unequip_item" : "equip_item", itemId)) reason = t("inventory.tutorialLocked");
      else if (worn && (cost === undefined || !affordable(cost))) reason = t("planning.notEnoughGold");
      else if (!worn && item.tier > own.star) reason = t("inventory.overTier", { tier: item.tier });
      else if (!worn && own.equips.some((id) => getEquipment(id)?.nameKey === item.nameKey)) reason = t("inventory.duplicate");
      else if (!worn && own.equips.length >= cap) reason = t("inventory.slotFull");
      const button = kitButton({ skin: worn ? "wood" : "green", size: 12,
        label: worn ? t("inventory.unequip", { cost: `${cost ?? 0} ${ICONS.gold}` }) : t("inventory.equip"),
        onClick: () => execute(() => worn ? intents.unequip(index) : intents.equip(itemId), worn ? "inventory.unequippedOk" : "inventory.equippedOk"),
      });
      button.setDisabled(Boolean(reason));
      button.el.title = reason || itemName(itemId);
      itemButtons.push(button);
      card.append(button.el, detail);
      if (reason && editable()) card.append(h("small", "ui-inventory-item-reason", reason));
      host.append(card);
    };
    own.equips.forEach((id, index) => makeItem(id, equipped, index, true));
    for (let i = own.equips.length; i < cap; i++) equipped.append(view.emptySlot());
    const items = [...new Set(model.run.itemBag.filter((id) => getEquipment(id)))];
    items.forEach((id) => makeItem(id, bag, 0, false));
    if (!items.length) bag.append(h("p", "ui-inventory-note", t("inventory.noEquipment")));
  };
  function update() {
    if (disposed) return;
    const next = intents.getModel();
    if (!next) { modal.close(); return; }
    model = next;
    view.updateStats();
    gold.textContent = `${ICONS.gold} ${t("inventory.gold", { gold: model.run.gold })}`;
    const costs = unequipQuote(model.run, model.inspection.where, model.inspection.index);
    const totalCost = costs?.reduce((sum, cost) => sum + cost, 0) ?? 0;
    removeAll.setLabel(t("inventory.unequipAll", { cost: `${totalCost} ${ICONS.gold}` }));
    removeAll.setDisabled(!editable() || !costs?.length || !affordable(totalCost) || !allows("unequip_item"));
    removeAll.el.title = !affordable(totalCost) ? t("planning.notEnoughGold") : "";
    const own = model.inspection.unit;
    const price = sellValue(unit.tier, own.star);
    sell.setLabel(t("inventory.sell", { price }));
    sell.setDisabled(!editable() || !allows("sell_unit"));
    confirm.setDisabled(!editable() || !allows("sell_unit"));
    if (!editable()) { confirmingSale = false; notice.textContent = t("inventory.combatLocked"); }
    confirmation.hidden = !confirmingSale;
    confirmationText.textContent = t("inventory.sellConfirm", { name: unit.nameVi, star: own.star, price, count: own.equips.length });
    const nextEquipmentKey = JSON.stringify([own.star, own.equips, model.run.itemBag, model.run.gold, model.run.phase, model.run.tutorial, model.run.unequipDiscount, model.inspection.where, model.inspection.index]);
    if (equipmentKey !== nextEquipmentKey) { equipmentKey = nextEquipmentKey; renderEquipment(); }
    const nextEffectsKey = JSON.stringify([model.current, model.inspection.sources]);
    if (effectsKey !== nextEffectsKey) { effectsKey = nextEffectsKey; renderEffects(); }
  }
  update();
  return { update, dispose() {
    if (disposed) return;
    disposed = true;
    view.dispose();
    library?.dispose();
    for (const b of [removeAll, sell, confirm, cancel]) b.dispose();
  } };
}

/** Enemy detail reuses the owned presentation but never creates mutation controls. */
export function mountReadonlyUnitInventory(
  modal: ModalHandle,
  portraits: Portraits,
  getDiagnostics: () => UnitDiagnostics | null,
) {
  const initial = getDiagnostics();
  if (!initial) return { update() {}, dispose() {} };
  let diagnostics = initial;
  let disposed = false;
  let equipmentKey = "", effectsKey = "";
  const view = createInventoryView(modal, portraits, () => ({
    uid: diagnostics.uid,
    baseId: diagnostics.baseId,
    star: diagnostics.star,
    stats: [diagnostics.base, diagnostics.derived, diagnostics.live],
    traits: diagnostics.traits,
    location: t("inventory.board"),
    hint: t("inventory.liveHint"),
  }), true);
  modal.body.append(view.root);

  const update = () => {
    if (disposed) return;
    const next = getDiagnostics();
    if (!next) { modal.close(); return; }
    diagnostics = next;
    view.updateStats();

    const nextEquipmentKey = JSON.stringify([diagnostics.star, diagnostics.equips]);
    if (nextEquipmentKey !== equipmentKey) {
      equipmentKey = nextEquipmentKey;
      view.clearItems();
      const cap = slotCapForUnit(getUnit(diagnostics.baseId), diagnostics.star);
      view.slotsCount.textContent = t("inventory.slots", { used: diagnostics.equips.length, max: cap });
      for (const itemId of diagnostics.equips) {
        const item = view.makeItem(itemId, true);
        if (item) {
          item.card.append(item.detail);
          view.equipped.append(item.card);
        }
      }
      for (let i = diagnostics.equips.length; i < cap; i++) view.equipped.append(view.emptySlot());
    }

    const nextEffectsKey = JSON.stringify(diagnostics.effects);
    if (nextEffectsKey !== effectsKey) {
      effectsKey = nextEffectsKey;
      view.effects.replaceChildren();
      for (const effect of diagnostics.effects) renderDiagnosticEffect(view.effects, effect);
      if (!view.effects.childElementCount) view.effects.append(h("p", "ui-inventory-note", t("inventory.noEffects")));
    }
  };
  update();
  return {
    update,
    dispose() {
      if (disposed) return;
      disposed = true;
      view.dispose();
    },
  };
}
