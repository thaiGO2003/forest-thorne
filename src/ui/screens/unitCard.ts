// Unit Inspector Card View (spec §14.6, A41).
import { attachChrome, drawButton, drawPanel, setupButtonChrome } from "../chrome";
import { getUnit } from "../../content/catalog";
import { sell, unequipAll, unequipQuote, type RunState } from "../../core/run";
import { sellValue } from "../../core/economy";
import { getEquipment } from "../../core/equipment";
import type { UnitTarget } from "../../world/unitManager";

export function createUnitCard(
  state: RunState,
  target: UnitTarget,
  onStateChange: () => void,
  onDeselect: () => void,
): HTMLElement {
  const card = document.createElement("div");
  card.className = "ft-unit-card";
  card.style.position = "relative";
  card.style.width = "300px";
  card.style.display = "flex";
  card.style.flexDirection = "column";
  card.style.padding = "16px";
  card.style.boxSizing = "border-box";
  card.style.fontFamily = "system-ui, sans-serif";
  card.style.color = "#f3e8d2";
  card.style.pointerEvents = "auto";

  attachChrome(card, (c) => drawPanel(c, "darkwood"));

  const unit = target.unit;
  const def = getUnit(unit.baseId);

  // Header
  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "flex-start";
  header.style.marginBottom = "8px";

  const titleCol = document.createElement("div");
  const nameEl = document.createElement("div");
  nameEl.style.fontSize = "16px";
  nameEl.style.fontWeight = "bold";
  nameEl.style.color = "#ffd700";
  nameEl.textContent = `${def.nameVi} ${"★".repeat(unit.star)}`;
  titleCol.appendChild(nameEl);

  const subEl = document.createElement("div");
  subEl.style.fontSize = "11px";
  subEl.style.color = "#a09888";
  subEl.textContent = `Bậc ${def.tier} · ${def.role} · ${def.element} · ${def.faction}`;
  titleCol.appendChild(subEl);
  header.appendChild(titleCol);

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✕";
  closeBtn.style.padding = "2px 8px";
  closeBtn.style.fontSize = "13px";
  closeBtn.style.border = "none";
  closeBtn.style.color = "#e2d5c3";
  closeBtn.style.cursor = "pointer";
  setupButtonChrome(closeBtn, "wood");
  closeBtn.addEventListener("click", onDeselect);
  header.appendChild(closeBtn);
  card.appendChild(header);

  // Location tag
  const locEl = document.createElement("div");
  locEl.style.fontSize = "11px";
  locEl.style.color = "#8f9b88";
  locEl.style.marginBottom = "8px";
  locEl.textContent = target.type === "board" ? `Vị trí: Bàn cờ (ô ${target.index})` : `Vị trí: Hàng chờ (ô ${target.index + 1})`;
  card.appendChild(locEl);

  // Stats Grid
  const statsGrid = document.createElement("div");
  statsGrid.style.display = "grid";
  statsGrid.style.gridTemplateColumns = "repeat(2, 1fr)";
  statsGrid.style.gap = "4px 8px";
  statsGrid.style.fontSize = "12px";
  statsGrid.style.padding = "8px";
  statsGrid.style.background = "rgba(0,0,0,0.3)";
  statsGrid.style.borderRadius = "4px";
  statsGrid.style.marginBottom = "8px";

  const statItems = [
    ["HP", def.stats.hp],
    ["ATK", def.stats.atk],
    ["MATK", def.stats.matk],
    ["DEF", def.stats.def],
    ["MDEF", def.stats.mdef],
    ["Tầm", def.stats.range],
  ];
  for (const [k, v] of statItems) {
    const item = document.createElement("div");
    item.textContent = `${k}: ${v}`;
    statsGrid.appendChild(item);
  }
  card.appendChild(statsGrid);

  // Skill
  const skillBox = document.createElement("div");
  skillBox.style.fontSize = "11px";
  skillBox.style.marginBottom = "8px";
  skillBox.style.padding = "6px 8px";
  skillBox.style.background = "rgba(0,0,0,0.2)";
  skillBox.style.borderRadius = "4px";

  const skillName = document.createElement("div");
  skillName.style.fontWeight = "bold";
  skillName.style.color = "#78e08f";
  skillName.textContent = `Kỹ năng: ${def.skill.nameVi} (Nộ: ${def.skill.rageCost.join("/")})`;
  skillBox.appendChild(skillName);

  const skillDesc = document.createElement("div");
  skillDesc.style.color = "#c8bca6";
  skillDesc.style.marginTop = "2px";
  skillDesc.textContent = def.skill.detailVi ?? "";
  skillBox.appendChild(skillDesc);
  card.appendChild(skillBox);

  // Equips
  const basic = document.createElement("div");
  basic.style.fontSize = "12px"; basic.style.marginBottom = "8px";
  basic.textContent = `Đòn đánh thường: ${def.basic.textVi}`;
  card.append(basic);
  if (unit.equips.length > 0) {
    const equipBox = document.createElement("div");
    equipBox.style.fontSize = "11px";
    equipBox.style.marginBottom = "8px";

    const eqTitle = document.createElement("div");
    eqTitle.textContent = "Trang bị:";
    eqTitle.style.fontWeight = "bold";
    eqTitle.style.color = "#d4af37";
    equipBox.appendChild(eqTitle);

    const eqList = document.createElement("div");
    eqList.style.display = "flex";
    eqList.style.flexWrap = "wrap";
    eqList.style.gap = "4px";
    eqList.style.marginTop = "4px";

    for (const eqId of unit.equips) {
      const eq = getEquipment(eqId);
      const tag = document.createElement("span");
      tag.style.padding = "2px 6px";
      tag.style.background = "rgba(120, 224, 143, 0.2)";
      tag.style.border = "1px solid #78e08f";
      tag.style.borderRadius = "3px";
      tag.style.fontSize = "11px";
      tag.textContent = eq ? eq.nameKey : eqId;
      eqList.appendChild(tag);
    }
    equipBox.appendChild(eqList);
    card.appendChild(equipBox);
  }

  // Action Buttons
  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "6px";
  actions.style.marginTop = "auto";

  // Unequip All button
  if (unit.equips.length > 0) {
    const unequipBtn = document.createElement("button");
    const costs = unequipQuote(state, target.type, target.index);
    const totalCost = costs ? costs.reduce((a, b) => a + b, 0) : 0;
    unequipBtn.textContent = `Tháo (${totalCost}🪙)`;
    unequipBtn.style.flex = "1";
    unequipBtn.style.padding = "6px 8px";
    unequipBtn.style.fontSize = "11px";
    unequipBtn.style.border = "none";
    unequipBtn.style.cursor = "pointer";
    setupButtonChrome(unequipBtn, "wood");

    unequipBtn.addEventListener("click", () => {
      const ok = unequipAll(state, target.type, target.index);
      if (ok) onStateChange();
    });
    actions.appendChild(unequipBtn);
  }

  // Sell Button
  const sellPrice = sellValue(def.tier, unit.star);
  const sellBtn = document.createElement("button");
  sellBtn.textContent = `Bán (+${sellPrice}🪙)`;
  sellBtn.style.flex = "1";
  sellBtn.style.padding = "6px 8px";
  sellBtn.style.fontSize = "11px";
  sellBtn.style.border = "none";
  sellBtn.style.cursor = "pointer";
  setupButtonChrome(sellBtn, "danger");

  sellBtn.addEventListener("click", () => {
    const ok = sell(state, target.type, target.index);
    if (ok) {
      onDeselect();
      onStateChange();
    }
  });
  actions.appendChild(sellBtn);

  card.appendChild(actions);
  return card;
}
