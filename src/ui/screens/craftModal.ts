// Crafting Modal View (spec §14.11, §14.12, A7).
import { attachChrome, drawButton, drawPanel, setupButtonChrome } from "../chrome";
import { activeIndices, craft, matchRecipe, type Recipe } from "../../core/craft";
import { getEquipment } from "../../core/equipment";
import type { RunState } from "../../core/run";

export function createCraftModal(
  state: RunState,
  onStateChange: () => void,
  onClose: () => void,
): HTMLElement {
  const modal = document.createElement("div");
  modal.className = "ft-craft-modal";
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

  const title = document.createElement("h2");
  title.textContent = `Bàn chế tạo (Cấp ${state.craftTableLevel}/3)`;
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

  if (state.craftTableLevel <= 0) {
    const notice = document.createElement("div");
    notice.style.padding = "20px";
    notice.style.textAlign = "center";
    notice.style.color = "#c8bca6";
    notice.style.fontSize = "15px";
    notice.textContent = "Chưa mở bàn chế tạo. Hãy nghiên cứu 'Bàn chế tạo' (craft_t) trong cây Công nghệ để mở khóa!";
    modal.appendChild(notice);
    return modal;
  }

  // 3x3 Craft Grid State
  const staged: (string | null)[] = Array(9).fill(null);
  const activeCells = new Set(activeIndices(state.craftTableLevel));

  const body = document.createElement("div");
  body.style.display = "flex";
  body.style.gap = "20px";
  body.style.flexWrap = "wrap";

  // Grid
  const gridContainer = document.createElement("div");
  gridContainer.style.display = "grid";
  gridContainer.style.gridTemplateColumns = "repeat(3, 72px)";
  gridContainer.style.gridTemplateRows = "repeat(3, 72px)";
  gridContainer.style.gap = "8px";
  gridContainer.style.margin = "0 auto";

  const cellElements: HTMLDivElement[] = [];

  function updatePreview(): void {
    const matched = matchRecipe(staged, state.craftTableLevel);
    if (matched) {
      const eq = getEquipment(`eq_${matched.id}`) ?? getEquipment(matched.id);
      const name = eq ? eq.nameKey : matched.id;
      previewBox.innerHTML = `
        <div style="font-size:16px; font-weight:bold; color:#78e08f;">✨ Có thể chế tạo: ${name}</div>
        <div style="font-size:12px; color:#c8bca6; margin-top:4px;">Trang bị đặc biệt (Bậc ${eq?.tier ?? 1})</div>
      `;
      craftBtn.disabled = false;
      setupButtonChrome(craftBtn, "primary");
    } else {
      previewBox.innerHTML = `<div style="font-size:13px; color:#888;">Đặt nguyên liệu vào lưới để chế tạo trang bị...</div>`;
      craftBtn.disabled = true;
      setupButtonChrome(craftBtn, "wood");
    }
  }

  for (let i = 0; i < 9; i++) {
    const cell = document.createElement("div");
    cell.style.width = "72px";
    cell.style.height = "72px";
    cell.style.display = "flex";
    cell.style.alignItems = "center";
    cell.style.justifyContent = "center";
    cell.style.borderRadius = "4px";
    cell.style.boxSizing = "border-box";
    cell.style.cursor = activeCells.has(i) ? "pointer" : "not-allowed";
    cell.style.background = activeCells.has(i) ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.65)";
    cell.style.border = activeCells.has(i) ? "1px solid #7c603a" : "1px dashed #3a3227";
    cell.style.fontSize = "13px";
    cell.style.fontWeight = "bold";

    cell.addEventListener("click", () => {
      if (!activeCells.has(i) || !staged[i]) return;
      // Return to available bag
      staged[i] = null;
      renderGrid();
      renderBag();
      updatePreview();
    });

    cellElements.push(cell);
    gridContainer.appendChild(cell);
  }

  body.appendChild(gridContainer);

  // Right side: Bag materials
  const rightCol = document.createElement("div");
  rightCol.style.flex = "1";
  rightCol.style.display = "flex";
  rightCol.style.flexDirection = "column";
  rightCol.style.gap = "12px";

  const bagTitle = document.createElement("div");
  bagTitle.textContent = "Nguyên liệu trong túi:";
  bagTitle.style.fontSize = "14px";
  bagTitle.style.color = "#d4af37";
  rightCol.appendChild(bagTitle);

  const bagList = document.createElement("div");
  bagList.style.display = "flex";
  bagList.style.flexWrap = "wrap";
  bagList.style.gap = "8px";
  bagList.style.maxHeight = "160px";
  bagList.style.overflowY = "auto";
  rightCol.appendChild(bagList);

  function renderGrid(): void {
    for (let i = 0; i < 9; i++) {
      const el = cellElements[i];
      if (!el) continue;
      const item = staged[i];
      if (item) {
        el.textContent = item;
        el.style.color = "#ffd700";
        el.style.borderColor = "#ffd700";
      } else {
        el.textContent = activeCells.has(i) ? "Trống" : "Khóa";
        el.style.color = activeCells.has(i) ? "#666" : "#444";
        el.style.borderColor = activeCells.has(i) ? "#7c603a" : "#3a3227";
      }
    }
  }

  function getAvailableBag(): string[] {
    const bagCopy = state.itemBag.slice();
    for (const s of staged) {
      if (!s) continue;
      const idx = bagCopy.indexOf(s);
      if (idx >= 0) bagCopy.splice(idx, 1);
    }
    return bagCopy;
  }

  function renderBag(): void {
    bagList.innerHTML = "";
    const avail = getAvailableBag();
    if (avail.length === 0) {
      bagList.innerHTML = `<span style="font-size:12px; color:#888;">Không có nguyên liệu</span>`;
      return;
    }
    for (const item of avail) {
      const btn = document.createElement("button");
      btn.textContent = `+ ${item}`;
      btn.style.padding = "4px 8px";
      btn.style.fontSize = "12px";
      btn.style.color = "#f3e8d2";
      btn.style.border = "none";
      btn.style.cursor = "pointer";
      setupButtonChrome(btn, "wood");

      btn.addEventListener("click", () => {
        // Place in first empty active slot
        for (let i = 0; i < 9; i++) {
          if (activeCells.has(i) && !staged[i]) {
            staged[i] = item;
            renderGrid();
            renderBag();
            updatePreview();
            break;
          }
        }
      });
      bagList.appendChild(btn);
    }
  }

  // Preview Box
  const previewBox = document.createElement("div");
  previewBox.style.padding = "10px";
  previewBox.style.background = "rgba(0,0,0,0.3)";
  previewBox.style.border = "1px solid #5a452a";
  previewBox.style.borderRadius = "4px";
  rightCol.appendChild(previewBox);

  // Craft Button
  const craftBtn = document.createElement("button");
  craftBtn.textContent = "Chế tạo";
  craftBtn.style.padding = "10px 20px";
  craftBtn.style.fontSize = "15px";
  craftBtn.style.fontWeight = "bold";
  craftBtn.style.border = "none";
  craftBtn.style.cursor = "pointer";
  craftBtn.disabled = true;
  setupButtonChrome(craftBtn, "wood");

  craftBtn.addEventListener("click", () => {
    const res = craft(state, staged);
    if (res) {
      staged.fill(null);
      renderGrid();
      renderBag();
      updatePreview();
      onStateChange();
    }
  });

  rightCol.appendChild(craftBtn);
  body.appendChild(rightCol);
  modal.appendChild(body);

  renderGrid();
  renderBag();
  updatePreview();

  return modal;
}
