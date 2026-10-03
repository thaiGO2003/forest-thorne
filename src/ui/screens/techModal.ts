// Technology Tree Modal View (spec §14.13, A8).
import { attachChrome, drawButton, drawPanel, setupButtonChrome } from "../chrome";
import { TECH_NODES, canResearch, maxLevel, researchCost, type Branch, type TechNode } from "../../core/tech";
import { research, type RunState } from "../../core/run";

const BRANCH_NAMES: Record<Branch, string> = {
  ROOT: "Cơ bản",
  VET: "Sinh tồn & Đội hình",
  EXPLORE: "Khai phá & Hàng chờ",
  ECON: "Kinh tế & Lợi tức",
  MIL: "Quân sự & Sát thương",
  CRAFT: "Chế tạo & Tốc độ",
};

export function createTechModal(
  state: RunState,
  onStateChange: () => void,
  onClose: () => void,
): HTMLElement {
  const modal = document.createElement("div");
  modal.className = "ft-tech-modal";
  modal.style.position = "relative";
  modal.style.width = "min(680px, 94vw)";
  modal.style.maxHeight = "86vh";
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
  header.style.marginBottom = "14px";

  const title = document.createElement("h2");
  title.textContent = `Viện Nghiên Cứu Công Nghệ (Vàng: ${state.gold}🪙)`;
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

  // Tabs for branches
  const branches: Branch[] = ["VET", "EXPLORE", "ECON", "MIL", "CRAFT"];
  let activeBranch: Branch = "VET";

  const tabRow = document.createElement("div");
  tabRow.style.display = "flex";
  tabRow.style.gap = "6px";
  tabRow.style.marginBottom = "14px";
  tabRow.style.overflowX = "auto";
  tabRow.style.paddingBottom = "4px";

  const tabButtons: Map<Branch, HTMLButtonElement> = new Map();

  // Nodes list container
  const listContainer = document.createElement("div");
  listContainer.style.flex = "1";
  listContainer.style.overflowY = "auto";
  listContainer.style.display = "flex";
  listContainer.style.flexDirection = "column";
  listContainer.style.gap = "10px";
  listContainer.style.padding = "2px";

  function renderBranchNodes(): void {
    listContainer.innerHTML = "";
    const nodes = TECH_NODES.filter((n) => n.branch === activeBranch);

    for (const node of nodes) {
      const curLevel = state.techLevels[node.id] ?? 0;
      const maxL = maxLevel(node);
      const isMax = curLevel >= maxL;
      const cost = isMax ? 0 : researchCost(node, curLevel);
      const canBuy = !isMax && canResearch(state.techLevels, node.id, state.gold);

      const card = document.createElement("div");
      card.style.background = "rgba(0,0,0,0.35)";
      card.style.border = isMax ? "1px solid #78e08f" : canBuy ? "1px solid #d4af37" : "1px solid #3a3227";
      card.style.borderRadius = "4px";
      card.style.padding = "12px";
      card.style.display = "flex";
      card.style.justifyContent = "space-between";
      card.style.alignItems = "center";
      card.style.gap = "12px";

      const left = document.createElement("div");
      left.style.flex = "1";

      const nameRow = document.createElement("div");
      nameRow.style.display = "flex";
      nameRow.style.alignItems = "center";
      nameRow.style.gap = "8px";

      const nameEl = document.createElement("div");
      nameEl.textContent = node.id;
      nameEl.style.fontWeight = "bold";
      nameEl.style.fontSize = "14px";
      nameEl.style.color = isMax ? "#78e08f" : "#ffd700";
      nameRow.appendChild(nameEl);

      const lvlEl = document.createElement("div");
      lvlEl.textContent = `Cấp: ${curLevel}/${Number.isFinite(maxL) ? maxL : "∞"}`;
      lvlEl.style.fontSize = "12px";
      lvlEl.style.color = "#a09888";
      nameRow.appendChild(lvlEl);

      left.appendChild(nameRow);

      // Requirements
      if (node.requires.length > 0) {
        const reqEl = document.createElement("div");
        reqEl.style.fontSize = "11px";
        reqEl.style.color = "#7c603a";
        reqEl.style.marginTop = "2px";
        reqEl.textContent = `Yêu cầu: ${node.requires.join(", ")}`;
        left.appendChild(reqEl);
      }

      // Effects
      const eff = node.effects[Math.min(curLevel, node.effects.length - 1)];
      if (eff) {
        const effEl = document.createElement("div");
        effEl.style.fontSize = "12px";
        effEl.style.color = "#e2d5c3";
        effEl.style.marginTop = "4px";
        const desc = Object.entries(eff).map(([k, v]) => `+${v} ${k}`).join(", ");
        effEl.textContent = `Hiệu ứng: ${desc}`;
        left.appendChild(effEl);
      }

      card.appendChild(left);

      // Research button
      const btn = document.createElement("button");
      btn.style.padding = "6px 14px";
      btn.style.fontSize = "12px";
      btn.style.fontWeight = "bold";
      btn.style.border = "none";
      btn.style.whiteSpace = "nowrap";

      if (isMax) {
        btn.textContent = "Đã tối đa";
        btn.disabled = true;
        setupButtonChrome(btn, "wood");
      } else {
        btn.textContent = `Nghiên cứu (${cost}🪙)`;
        btn.disabled = !canBuy;
        setupButtonChrome(btn, canBuy ? "primary" : "wood");
        if (canBuy) {
          btn.style.cursor = "pointer";
          btn.addEventListener("click", () => {
            const ok = research(state, node.id);
            if (ok) {
              onStateChange();
              title.textContent = `Viện Nghiên Cứu Công Nghệ (Vàng: ${state.gold}🪙)`;
              renderBranchNodes();
            }
          });
        }
      }

      card.appendChild(btn);
      listContainer.appendChild(card);
    }
  }

  for (const b of branches) {
    const btn = document.createElement("button");
    btn.textContent = BRANCH_NAMES[b];
    btn.style.padding = "6px 12px";
    btn.style.fontSize = "12px";
    btn.style.border = "none";
    btn.style.cursor = "pointer";
    btn.style.whiteSpace = "nowrap";
    setupButtonChrome(btn, b === activeBranch ? "primary" : "wood");

    btn.addEventListener("click", () => {
      activeBranch = b;
      for (const [br, bBtn] of tabButtons.entries()) {
        setupButtonChrome(bBtn, br === activeBranch ? "primary" : "wood");
      }
      renderBranchNodes();
    });

    tabButtons.set(b, btn);
    tabRow.appendChild(btn);
  }

  modal.appendChild(tabRow);
  modal.appendChild(listContainer);

  renderBranchNodes();
  return modal;
}
