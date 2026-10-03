// Inventory Modal View (spec §14.8, §14.9, A6).
import { attachChrome, drawButton, drawPanel, setupButtonChrome } from "../chrome";
import { equipItem, inventoryCapacity, sellItem, type RunState } from "../../core/run";
import { getEquipment } from "../../core/equipment";
import { getUnit } from "../../content/catalog";
import type { UnitTarget } from "../../world/unitManager";

export function createInventoryModal(
  state: RunState,
  selectedTarget: UnitTarget | null,
  onStateChange: () => void,
  onClose: () => void,
): HTMLElement {
  const modal = document.createElement("div");
  modal.className = "ft-inventory-modal";
  modal.style.position = "relative";
  modal.style.width = "min(560px, 94vw)";
  modal.style.display = "flex";
  modal.style.flexDirection = "column";
  modal.style.padding = "24px";
  modal.style.boxSizing = "border-box";
  modal.style.fontFamily = "system-ui, sans-serif";
  modal.style.color = "#f3e8d2";

  attachChrome(modal, (c) => drawPanel(c, "darkwood"));

  // Header
  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "center";
  header.style.marginBottom = "16px";

  const cap = inventoryCapacity(state);
  const title = document.createElement("h2");
  title.textContent = `Túi đồ (${state.itemBag.length}/${cap})`;
  title.style.margin = "0";
  title.style.fontSize = "20px";
  title.style.color = "#ffd700";
  header.appendChild(title);

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✕";
  closeBtn.style.padding = "4px 10px";
  closeBtn.style.fontSize = "16px";
  closeBtn.style.border = "none";
  closeBtn.style.color = "#e2d5c3";
  closeBtn.style.cursor = "pointer";
  setupButtonChrome(closeBtn, "wood");
  closeBtn.addEventListener("click", onClose);
  header.appendChild(closeBtn);
  modal.appendChild(header);

  // Selected Unit Notice
  if (selectedTarget) {
    const unitDef = getUnit(selectedTarget.unit.baseId);
    const info = document.createElement("div");
    info.style.padding = "8px 12px";
    info.style.marginBottom = "14px";
    info.style.background = "rgba(212, 175, 55, 0.15)";
    info.style.border = "1px solid #d4af37";
    info.style.borderRadius = "4px";
    info.style.fontSize = "13px";
    info.style.color = "#ffd700";
    info.textContent = `🎯 Đang chọn: ${unitDef.nameVi} (${selectedTarget.unit.star}★) — Nhấp vào trang bị để lắp.`;
    modal.appendChild(info);
  }

  // Item List
  const list = document.createElement("div");
  list.style.display = "grid";
  list.style.gridTemplateColumns = "repeat(auto-fill, minmax(140px, 1fr))";
  list.style.gap = "10px";
  list.style.maxHeight = "360px";
  list.style.overflowY = "auto";
  list.style.padding = "4px";

  function renderItems(): void {
    list.innerHTML = "";
    if (state.itemBag.length === 0) {
      list.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:30px; color:#888;">Túi đồ rỗng.</div>`;
      return;
    }

    state.itemBag.forEach((itemId, idx) => {
      const eq = getEquipment(itemId);
      const isEquip = Boolean(eq);
      const name = eq ? eq.nameKey : itemId;

      const card = document.createElement("div");
      card.style.background = "rgba(0,0,0,0.35)";
      card.style.border = isEquip ? "1px solid #7c603a" : "1px solid #4a3e2e";
      card.style.borderRadius = "4px";
      card.style.padding = "10px";
      card.style.display = "flex";
      card.style.flexDirection = "column";
      card.style.justifyContent = "space-between";
      card.style.gap = "6px";

      const nameEl = document.createElement("div");
      nameEl.textContent = name;
      nameEl.style.fontWeight = "bold";
      nameEl.style.fontSize = "13px";
      nameEl.style.color = isEquip ? "#78e08f" : "#e2d5c3";
      card.appendChild(nameEl);

      if (eq) {
        const descEl = document.createElement("div");
        descEl.textContent = `Trang bị bậc ${eq.tier}`;
        descEl.style.fontSize = "11px";
        descEl.style.color = "#a09888";
        card.appendChild(descEl);
      }

      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.gap = "6px";
      actions.style.marginTop = "auto";

      if (isEquip && selectedTarget) {
        const equipBtn = document.createElement("button");
        equipBtn.textContent = "Lắp";
        equipBtn.style.flex = "1";
        equipBtn.style.padding = "4px 8px";
        equipBtn.style.fontSize = "11px";
        equipBtn.style.border = "none";
        equipBtn.style.cursor = "pointer";
        setupButtonChrome(equipBtn, "primary");
        equipBtn.addEventListener("click", () => {
          const ok = equipItem(state, itemId, selectedTarget.type, selectedTarget.index);
          if (ok) {
            onStateChange();
            renderItems();
          }
        });
        actions.appendChild(equipBtn);
      }

      const sellBtn = document.createElement("button");
      sellBtn.textContent = "Bán";
      sellBtn.style.padding = "4px 8px";
      sellBtn.style.fontSize = "11px";
      sellBtn.style.border = "none";
      sellBtn.style.color = "#f3e8d2";
      sellBtn.style.cursor = "pointer";
      setupButtonChrome(sellBtn, "wood");
      sellBtn.addEventListener("click", () => {
        const ok = sellItem(state, idx);
        if (ok) {
          onStateChange();
          renderItems();
        }
      });
      actions.appendChild(sellBtn);

      card.appendChild(actions);
      list.appendChild(card);
    });
  }

  renderItems();
  modal.appendChild(list);

  return modal;
}
