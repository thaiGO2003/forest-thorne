// Owned creature modal. Stat values and quoted prices are supplied by canonical core owners.
import { getUnit } from "../content/catalog";
import type { CombatUnitSnapshot } from "../core/combat";
import { ICONS } from "../core/emojiIcon";
import { getEquipment, slotCapForUnit } from "../core/equipment";
import { sellValue } from "../core/economy";
import { t, type MsgKey } from "../core/i18n";
import { MODE_CONFIG } from "../core/modes";
import { unequipQuote, type RunState } from "../core/run";
import { tutorialActionAllowed } from "../core/tutorial";
import type { OwnedUnitInspection } from "../core/unitInventory";
import type { Portraits } from "../units/portraits";
import { h, INK, kitButton, label, nineSlice, SLICE, surface, threeSlice, type KitButton, type Surface } from "./kit";
import type { ModalHandle } from "./modal";

export interface UnitInventoryModel {
  run: RunState;
  inspection: OwnedUnitInspection;
  current: CombatUnitSnapshot;
  inCombat: boolean;
}
export interface UnitInventoryIntents {
  getModel(): UnitInventoryModel | null;
  select(): void;
  sell(): boolean;
  equip(itemId: string): boolean;
  unequip(index: number): boolean;
  unequipAll(): boolean;
}

type StatKey = "hp" | "atk" | "matk" | "def" | "mdef" | "rage" | "shield" | "evade" | "crit" | "accuracy";
const STAT_ROWS: { key: StatKey; icon: string; fill: string }[] = [
  { key: "hp", icon: ICONS.hp, fill: "#69ae46" },
  { key: "atk", icon: ICONS.atk, fill: "#d8873c" },
  { key: "matk", icon: ICONS.matk, fill: "#af79c4" },
  { key: "def", icon: ICONS.def, fill: "#669bb1" },
  { key: "mdef", icon: ICONS.mdef, fill: "#8b8dce" },
  { key: "rage", icon: ICONS.rage, fill: "#e7b042" },
  { key: "shield", icon: ICONS.def, fill: "#9cbbb6" },
];
const PERCENT_STATS = new Set(["evade", "crit", "accuracy", "lifesteal", "healPct", "rageGainPct"]);
const fmt = (value: number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value);
const statValue = (key: string, value: number) => PERCENT_STATS.has(key) ? `${fmt(value * 100)}%` : fmt(value);
const statName = (key: string) => t(`inventory.${key}` as MsgKey);
const itemName = (id: string) => id === "eq_warmog_armor" ? t("item.eq_warmog_armor") : id === "eq_blue_buff" ? t("item.eq_blue_buff") : id;

export function mountUnitInventory(modal: ModalHandle, portraits: Portraits, intents: UnitInventoryIntents) {
  const first = intents.getModel();
  if (!first) return { update() {}, dispose() {} };
  let model = first, disposed = false, confirmingSale = false;
  const unit = getUnit(model.inspection.unit.baseId);
  const surfaces: Surface[] = [], itemSurfaces: Surface[] = [], itemButtons: KitButton[] = [];
  const panel = (cls: string, temporary = false) => {
    const el = h("div", `kit-panel ${cls}`);
    const s = surface(el, (g, w, hh) => nineSlice(g, "slot_well", SLICE.slot_well, 0, 0, w, hh));
    (temporary ? itemSurfaces : surfaces).push(s);
    return el;
  };
  const root = h("div", "ui-inventory");
  root.dataset.uid = model.inspection.unit.uid;
  const content = h("div", "ui-inventory-content");
  const profile = h("div", "ui-inventory-profile");
  const portraitPanel = panel("ui-inventory-portrait");
  const portraitHost = h("div", "ui-inventory-view");
  portraitPanel.append(portraitHost);
  const viewer = portraits.createViewer(portraitHost);
  viewer.setUnit(unit.id, model.inspection.unit.star);
  const name = h("h2", "ui-inventory-name", unit.nameVi);
  const stars = h("div", "ui-inventory-stars", "⭐".repeat(model.inspection.unit.star));
  const identity = h("div", "ui-inventory-identity");
  identity.append(h("span", "", `${ICONS[unit.role]} ${t(`role.${unit.role}` as MsgKey)}`),
    h("span", "", `${ICONS[unit.faction]} ${t(`faction.${unit.faction}` as MsgKey)}`),
    h("span", "", `${ICONS[unit.element]} ${t(`element.${unit.element}` as MsgKey)}`));
  const location = h("p", "ui-inventory-note");
  const skill = panel("ui-inventory-skill");
  skill.append(h("h3", "", t("library.skill")), h("strong", "", unit.skill.nameVi),
    h("p", "", unit.skill.starDetailVi[model.inspection.unit.star - 1] ?? unit.skill.detailVi ?? unit.pitchVi));
  profile.append(portraitPanel, name, stars, identity, location, skill);

  const right = h("div", "ui-inventory-right");
  const statGrid = h("div", "ui-inventory-stats");
  const statPainters: Surface[] = [];
  const titles: MsgKey[] = ["inventory.base", "inventory.boosted", "inventory.current"];
  for (let col = 0; col < 3; col++) {
    const column = panel("ui-inventory-stat-column");
    column.append(h("h3", "", t(titles[col])));
    const hint = h("p", "ui-inventory-column-hint", col === 0 ? t("inventory.baseHint", { star: model.inspection.unit.star }) :
      col === 1 ? t("inventory.boostedHint") : t(model.inCombat ? "inventory.liveHint" : "inventory.planningHint"));
    if (col === 2) hint.dataset.currentHint = "true";
    column.append(hint);
    for (const row of STAT_ROWS) {
      const el = h("div", "ui-inventory-stat");
      el.setAttribute("role", "meter");
      el.setAttribute("aria-label", `${t(titles[col])}: ${statName(row.key)}`);
      el.dataset.stat = row.key; el.dataset.column = String(col);
      const paint = surface(el, (g, w, hh) => {
        const snapshots = [model.inspection.base, model.inspection.boosted, model.current];
        const current = snapshots[col], value = current[row.key];
        const max = row.key === "hp" ? current.maxHp : row.key === "rage" ? current.rageMax : Math.max(1, ...snapshots.map((s) => s[row.key]));
        const delta = col === 2 ? value - model.inspection.boosted[row.key] : 0;
        const text = row.key === "hp" ? `${fmt(value)} / ${fmt(current.maxHp)}` : row.key === "rage" ? `${fmt(value)} / ${fmt(current.rageMax)}` : fmt(value);
        const font = Math.max(10, Math.min(13, w / 13));
        label(g, `${row.icon} ${statName(row.key)}`, 3, 12, { size: font, align: "left", fill: INK, stroke: null });
        label(g, text, w - 3, 12, { size: font, align: "right", fill: INK, stroke: null });
        const y = hh - 16, barW = w - 6;
        nineSlice(g, "bar_trough", 1, 3, y + 2, barW, 9);
        const ratio = Math.max(0, Math.min(1, value / Math.max(1, max)));
        g.fillStyle = row.fill;
        if (row.key === "rage") {
          const count = Math.max(1, Math.min(12, current.rageMax)), gap = 2, seg = (barW - (count - 1) * gap) / count;
          for (let i = 0; i < count; i++) if ((i + 1) / count <= ratio + .001) g.fillRect(3 + i * (seg + gap), y + 2, seg, 9);
        } else g.fillRect(3, y + 2, barW * ratio, 9);
        threeSlice(g, "frame_bar", 3, 1, y, w - 2, 14);
        if (delta) label(g, `${delta > 0 ? "+" : ""}${fmt(delta)}`, w - 5, y + 7, { size: 9, align: "right" });
        el.setAttribute("aria-valuenow", String(value)); el.setAttribute("aria-valuemin", "0"); el.setAttribute("aria-valuemax", String(max));
        el.setAttribute("aria-valuetext", `${text}${delta ? ` (${delta > 0 ? "+" : ""}${fmt(delta)})` : ""}`);
      });
      statPainters.push(paint); surfaces.push(paint); column.append(el);
    }
    const secondary = h("div", "ui-inventory-secondary");
    secondary.dataset.secondary = String(col);
    column.append(secondary); statGrid.append(column);
  }

  const lower = h("div", "ui-inventory-lower");
  const equipment = panel("ui-inventory-equipment");
  const equippedHead = h("div", "ui-inventory-section-head");
  const slotsCount = h("span", "ui-inventory-note");
  equippedHead.append(h("h3", "", t("inventory.equipped")), slotsCount);
  const equipped = h("div", "ui-inventory-items");
  const bag = h("div", "ui-inventory-items");
  equipment.append(equippedHead, equipped, h("h3", "", t("inventory.bag")), bag);
  const effectPanel = panel("ui-inventory-effects");
  const effects = h("div", "ui-inventory-effect-list");
  const sources = h("div", "ui-inventory-effect-list");
  effectPanel.append(h("h3", "", t("inventory.effects")), effects, h("h3", "", t("inventory.sources")), sources);
  lower.append(equipment, effectPanel); right.append(statGrid, lower); content.append(profile, right);

  const footer = h("div", "ui-inventory-footer");
  const gold = h("strong", "ui-inventory-gold");
  const execute = (action: () => boolean, ok: MsgKey) => {
    const result = action();
    notice.textContent = t(result ? ok : "inventory.failed");
    notice.dataset.failed = String(!result);
    update();
  };
  const removeAll = kitButton({ skin: "wood", cls: "ui-inventory-action", onClick: () => execute(intents.unequipAll, "inventory.unequippedOk") });
  const select = kitButton({ skin: "green", label: t("inventory.select"), cls: "ui-inventory-action", onClick: () => { intents.select(); modal.close(); } });
  const sell = kitButton({ skin: "red", cls: "ui-inventory-action", onClick: () => { confirmingSale = true; update(); confirm.el.focus(); } });
  footer.append(gold, removeAll.el, select.el, sell.el);
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
  root.append(content, notice, confirmation, footer, saleHint); modal.body.append(root);

  const editable = () => !model.inCombat && model.run.phase === "PLANNING";
  const allows = (action: "equip_item" | "unequip_item" | "sell_unit", itemId?: string) => tutorialActionAllowed(model.run, action, {
    source: action === "equip_item" ? { where: "inventory", index: model.run.itemBag.indexOf(itemId!), itemId } : { where: model.inspection.where, index: model.inspection.index },
    destination: action === "equip_item" ? { where: model.inspection.where, index: model.inspection.index } : undefined, itemId,
  });
  const affordable = (cost: number) => MODE_CONFIG[model.run.mode].creative || model.run.gold >= cost;
  let equipmentKey = "", effectsKey = "";
  const effectCard = (host: HTMLElement, title: string, detail: string, positive: boolean, note?: string) => {
    const row = h("div", "ui-inventory-effect"); row.dataset.positive = String(positive);
    row.append(h("strong", "", `${positive ? "✦" : "▼"} ${title}`), h("p", "", detail));
    if (note) row.append(h("small", "", note));
    host.append(row);
  };
  const renderEffects = () => {
    const current = model.current;
    effects.replaceChildren(); sources.replaceChildren();
    for (const [kind, status] of Object.entries(current.status)) {
      if (status.turns <= 0) continue;
      let detail = "";
      if (["burn", "poison", "bleed", "disease"].includes(kind)) detail = t("inventory.dotDetail", { value: fmt(status.value) });
      else if (kind === "hot") detail = t("inventory.hotDetail", { value: fmt(status.value * 100) });
      else if (kind === "fireVulnerability") detail = t("inventory.fireVulnerabilityDetail", { value: fmt(status.value) });
      else if (["stun", "freeze", "sleep"].includes(kind)) detail = t("inventory.controlDetail");
      else if (["silence", "disarm", "taunt"].includes(kind)) detail = t(`inventory.${kind}Detail` as MsgKey);
      else detail = `${fmt(status.value)}`;
      const source = status.source ? getUnit(status.source.unitBaseId) : null;
      const note = source ? t("inventory.source", { name: source.nameVi, skill: source.skill.nameVi }) : undefined;
      effectCard(effects, `${t(`inventory.${kind}` as MsgKey)} · ${t("inventory.turns", { turns: status.turns })}`, detail, kind === "hot", note);
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
    for (const s of itemSurfaces.splice(0)) s.dispose();
    for (const b of itemButtons.splice(0)) b.dispose();
    equipped.replaceChildren(); bag.replaceChildren();
    const own = model.inspection.unit;
    const cap = slotCapForUnit(unit, own.star), costs = unequipQuote(model.run, model.inspection.where, model.inspection.index);
    slotsCount.textContent = t("inventory.slots", { used: own.equips.length, max: cap });
    const makeItem = (itemId: string, host: HTMLElement, index: number, worn: boolean) => {
      const item = getEquipment(itemId);
      if (!item) return;
      const card = h("div", "ui-inventory-item");
      const icon = panel("ui-inventory-item-icon", true);
      const image = h("img");
      image.src = `/assets/items/${encodeURIComponent(itemId)}.svg`;
      image.alt = itemName(itemId);
      image.loading = "lazy";
      icon.append(image);
      const caption = h("strong", "ui-inventory-item-name", itemName(itemId));
      const meta = h("small", "ui-inventory-note", `${t("library.tier", { tier: item.tier })}${worn ? "" : ` · ×${model.run.itemBag.filter((id) => id === itemId).length}`}`);
      const noBonus = !Object.keys(item.bonuses).length;
      card.title = noBonus ? t("inventory.itemNoBonus") : Object.entries(item.bonuses).map(([key, value]) => `${key}: ${value}`).join(" · ");
      let reason = "";
      const cost = worn ? costs?.[index] : undefined;
      if (!editable()) reason = t("inventory.combatLocked");
      else if (!allows(worn ? "unequip_item" : "equip_item", itemId)) reason = t("inventory.tutorialLocked");
      else if (worn && (cost === undefined || !affordable(cost))) reason = t("planning.notEnoughGold");
      else if (!worn && item.tier > own.star) reason = t("inventory.overTier", { tier: item.tier });
      else if (!worn && own.equips.some((id) => getEquipment(id)?.nameKey === item.nameKey)) reason = t("inventory.duplicate");
      else if (!worn && own.equips.length >= cap) reason = t("inventory.slotFull");
      const button = kitButton({ skin: worn ? "wood" : "green", size: 12,
        label: worn ? t("inventory.unequip", { cost: cost ?? 0 }) : t("inventory.equip"),
        onClick: () => execute(() => worn ? intents.unequip(index) : intents.equip(itemId), worn ? "inventory.unequippedOk" : "inventory.equippedOk"),
      });
      button.setDisabled(Boolean(reason)); button.el.title = reason || itemName(itemId); itemButtons.push(button);
      card.append(icon, caption, meta, button.el);
      const detail = h("details", "ui-inventory-item-details");
      detail.append(h("summary", "", t("inventory.itemDetail")), h("p", "", card.title));
      card.append(detail);
      if (reason && editable()) card.append(h("small", "ui-inventory-item-reason", reason));
      host.append(card);
    };
    own.equips.forEach((id, index) => makeItem(id, equipped, index, true));
    for (let i = own.equips.length; i < cap; i++) {
      const empty = panel("ui-inventory-item-empty", true);
      empty.append(h("span", "", "+"), h("small", "", t("inventory.emptySlot"))); equipped.append(empty);
    }
    const items = [...new Set(model.run.itemBag.filter((id) => getEquipment(id)))];
    items.forEach((id) => makeItem(id, bag, 0, false));
    if (!items.length) bag.append(h("p", "ui-inventory-note", t("inventory.noEquipment")));
  };
  function update() {
    if (disposed) return;
    const next = intents.getModel();
    if (!next) { modal.close(); return; }
    model = next;
    location.textContent = t(model.inspection.where === "board" ? "inventory.board" : "inventory.bench");
    const hint = root.querySelector<HTMLElement>("[data-current-hint]");
    if (hint) hint.textContent = t(model.inCombat ? "inventory.liveHint" : model.inspection.where === "bench" ? "inventory.benchHint" : "inventory.planningHint");
    for (const s of statPainters) s.paint();
    [model.inspection.base, model.inspection.boosted, model.current].forEach((snapshot, col) => {
      const el = root.querySelector<HTMLElement>(`[data-secondary="${col}"]`);
      if (el) el.textContent = ["evade", "crit", "accuracy"].map((key) => `${statName(key)} ${statValue(key, snapshot[key as "evade" | "crit" | "accuracy"])}`).join(" · ");
    });
    gold.textContent = `${ICONS.gold} ${t("inventory.gold", { gold: model.run.gold })}`;
    const costs = unequipQuote(model.run, model.inspection.where, model.inspection.index);
    const totalCost = costs?.reduce((sum, cost) => sum + cost, 0) ?? 0;
    removeAll.setLabel(t("inventory.unequipAll", { cost: totalCost }));
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
    const nextEquipmentKey = JSON.stringify([own.equips, model.run.itemBag, model.run.gold, model.run.phase, model.run.tutorial, model.run.unequipDiscount, model.inspection.where, model.inspection.index]);
    if (equipmentKey !== nextEquipmentKey) { equipmentKey = nextEquipmentKey; renderEquipment(); }
    const nextEffectsKey = JSON.stringify([model.current, model.inspection.sources]);
    if (effectsKey !== nextEffectsKey) { effectsKey = nextEffectsKey; renderEffects(); }
  }
  update();
  return { update, dispose() {
    if (disposed) return;
    disposed = true; viewer.dispose();
    for (const s of [...surfaces, ...itemSurfaces]) s.dispose();
    for (const b of [...itemButtons, removeAll, select, sell, confirm, cancel]) b.dispose();
    root.remove();
  } };
}
