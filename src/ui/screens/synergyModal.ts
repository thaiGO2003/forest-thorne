// Synergy Breakdown Modal View (spec §14.7, A9).
import { attachChrome, drawPanel, setupButtonChrome } from "../chrome";
import { computeSynergies, type SynergyLine } from "../../core/synergy";
import type { RunState } from "../../core/run";

export function createSynergyModal(
  state: RunState,
  onClose: () => void,
): HTMLElement {
  const modal = document.createElement("div");
  modal.className = "ft-synergy-modal";
  modal.style.position = "relative";
  modal.style.width = "min(560px, 94vw)";
  modal.style.maxHeight = "80vh";
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

  const title = document.createElement("h2");
  title.textContent = "Kích Hoạt Tộc & Hệ (Synergies)";
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

  // Compute synergies for deployed allied board units
  const boardIds = state.board.flatMap((u) => (u ? [u.baseId] : []));
  const synergies = computeSynergies(boardIds, state.extraClassCount, state.extraTribeCount);

  const list = document.createElement("div");
  list.style.display = "flex";
  list.style.flexDirection = "column";
  list.style.gap = "8px";
  list.style.overflowY = "auto";
  list.style.padding = "4px";

  if (synergies.length === 0) {
    list.innerHTML = `<div style="text-align:center; padding:30px; color:#888;">Chưa có tướng nào được triển khai trên bàn cờ.</div>`;
  } else {
    for (const syn of synergies) {
      const card = document.createElement("div");
      card.style.background = syn.active > 0 ? "rgba(212, 175, 55, 0.12)" : "rgba(0,0,0,0.3)";
      card.style.border = syn.active > 0 ? "1px solid #ffd700" : "1px solid #3a3227";
      card.style.borderRadius = "4px";
      card.style.padding = "10px 14px";
      card.style.display = "flex";
      card.style.justifyContent = "space-between";
      card.style.alignItems = "center";

      const left = document.createElement("div");
      const nameEl = document.createElement("div");
      nameEl.style.fontWeight = "bold";
      nameEl.style.fontSize = "14px";
      nameEl.style.color = syn.active > 0 ? "#ffd700" : "#a09888";
      nameEl.textContent = `${syn.key} (${syn.count} tướng)`;
      left.appendChild(nameEl);

      const statusEl = document.createElement("div");
      statusEl.style.fontSize = "12px";
      statusEl.style.color = syn.active > 0 ? "#78e08f" : "#666";
      statusEl.style.marginTop = "2px";
      if (syn.active > 0) {
        statusEl.textContent = `Mốc kích hoạt: [${syn.active}]${syn.next ? ` · Mốc tiếp theo: [${syn.next}]` : " (Tối đa)"}`;
      } else {
        statusEl.textContent = `Cần thêm ${syn.next ? syn.next - syn.count : 2} tướng để đạt mốc [${syn.next ?? 2}]`;
      }
      left.appendChild(statusEl);

      card.appendChild(left);

      // Bonuses
      if (syn.active > 0 && Object.keys(syn.bonus).length > 0) {
        const bonusEl = document.createElement("div");
        bonusEl.style.fontSize = "12px";
        bonusEl.style.color = "#78e08f";
        bonusEl.style.fontWeight = "bold";
        bonusEl.textContent = Object.entries(syn.bonus)
          .map(([k, v]) => `+${v} ${k}`)
          .join(", ");
        card.appendChild(bonusEl);
      }

      list.appendChild(card);
    }
  }

  modal.appendChild(list);
  return modal;
}
