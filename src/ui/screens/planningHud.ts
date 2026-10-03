// Planning Phase HUD & Workspace (spec §14, A1, A2, A3, A4, A8, A14).
// Asset-first overlay mounted on top of the 3D Stage with interactive shop, unit inspector, and modals.
import { attachChrome, drawBadge, drawButton, drawPanel, setupButtonChrome } from "../chrome";
import {
  boardCount,
  boardToBench,
  boardToBoard,
  benchCap,
  benchToBench,
  benchToBoard,
  buy,
  buyXp,
  deployLimit,
  refresh,
  toggleLock,
  type RunState,
} from "../../core/run";
import { refreshCost, xpBuyCost, xpToNext } from "../../core/economy";
import { getUnit } from "../../content/catalog";
import { openModal } from "../modalManager";
import { createSettingsModal } from "./settingsModal";
import { createCraftModal } from "./craftModal";
import { createInventoryModal } from "./inventoryModal";
import { createTechModal } from "./techModal";
import { createSynergyModal } from "./synergyModal";
import { createUnitCard } from "./unitCard";
import { createUnitManager, type UnitManager, type UnitTarget } from "../../world/unitManager";
import type { Stage } from "../../world/stage";
import type { KV, SettingsStore } from "../../core/settings";

export interface PlanningHudOptions {
  state: RunState;
  stage: Stage;
  kvStore: KV;
  settingsStore: SettingsStore;
  onStartCombat: () => void;
  onMainMenu: () => void;
}

export interface PlanningHud {
  root: HTMLElement;
  sync(): void;
  dispose(): void;
}

export function createPlanningHud(options: PlanningHudOptions): PlanningHud {
  const { state, stage, kvStore, settingsStore, onStartCombat, onMainMenu } = options;

  const root = document.createElement("div");
  root.className = "ft-planning-hud";
  root.style.position = "absolute";
  root.style.inset = "0";
  root.style.pointerEvents = "none";
  root.style.display = "flex";
  root.style.flexDirection = "column";
  root.style.justifyContent = "space-between";
  root.style.padding = "12px";
  root.style.boxSizing = "border-box";
  root.style.fontFamily = "system-ui, sans-serif";
  root.style.color = "#f3e8d2";
  root.style.zIndex = "10";

  // 3D Unit Manager
  const unitMgr: UnitManager = createUnitManager(stage.scene);
  unitMgr.sync(state);

  let selectedTarget: UnitTarget | null = null;
  let inspectorEl: HTMLElement | null = null;

  // TOP BAR
  const topBar = document.createElement("div");
  topBar.style.display = "flex";
  topBar.style.justifyContent = "space-between";
  topBar.style.alignItems = "center";
  topBar.style.gap = "12px";
  topBar.style.pointerEvents = "auto";
  topBar.style.flexWrap = "wrap";

  // Left Status Bar
  const statusBar = document.createElement("div");
  statusBar.style.display = "flex";
  statusBar.style.alignItems = "center";
  statusBar.style.gap = "10px";
  statusBar.style.padding = "8px 16px";
  statusBar.style.boxSizing = "border-box";
  attachChrome(statusBar, (c) => drawPanel(c, "darkwood"));

  const roundEl = document.createElement("span");
  roundEl.style.fontWeight = "bold";
  roundEl.style.color = "#ffd700";

  const hpEl = document.createElement("span");
  hpEl.style.color = "#ff6b6b";

  const goldEl = document.createElement("span");
  goldEl.style.color = "#fbc531";
  goldEl.style.fontWeight = "bold";

  const deployEl = document.createElement("span");
  deployEl.style.color = "#78e08f";

  statusBar.appendChild(roundEl);
  statusBar.appendChild(hpEl);
  statusBar.appendChild(goldEl);
  statusBar.appendChild(deployEl);
  topBar.appendChild(statusBar);

  // Right Actions Bar
  const actionsBar = document.createElement("div");
  actionsBar.style.display = "flex";
  actionsBar.style.alignItems = "center";
  actionsBar.style.gap = "8px";

  // Synergy Button
  const synBtn = document.createElement("button");
  synBtn.textContent = "✨ Tộc/Hệ";
  synBtn.style.padding = "8px 12px";
  synBtn.style.fontSize = "13px";
  synBtn.style.border = "none";
  synBtn.style.cursor = "pointer";
  setupButtonChrome(synBtn, "wood");
  synBtn.addEventListener("click", () => {
    openModal("synergy", (close) => createSynergyModal(state, close));
  });
  actionsBar.appendChild(synBtn);

  // Inventory Button
  const bagBtn = document.createElement("button");
  bagBtn.textContent = "🎒 Túi";
  bagBtn.style.padding = "8px 12px";
  bagBtn.style.fontSize = "13px";
  bagBtn.style.border = "none";
  bagBtn.style.cursor = "pointer";
  setupButtonChrome(bagBtn, "wood");
  bagBtn.addEventListener("click", () => {
    openModal("inventory", (close) => createInventoryModal(state, selectedTarget, () => sync(), close));
  });
  actionsBar.appendChild(bagBtn);

  // Craft Button
  const craftBtn = document.createElement("button");
  craftBtn.textContent = "🔨 Chế tạo";
  craftBtn.style.padding = "8px 12px";
  craftBtn.style.fontSize = "13px";
  craftBtn.style.border = "none";
  craftBtn.style.cursor = "pointer";
  setupButtonChrome(craftBtn, "wood");
  craftBtn.addEventListener("click", () => {
    openModal("craft", (close) => createCraftModal(state, () => sync(), close));
  });
  actionsBar.appendChild(craftBtn);

  // Tech Button
  const techBtn = document.createElement("button");
  techBtn.textContent = "🔬 Công nghệ";
  techBtn.style.padding = "8px 12px";
  techBtn.style.fontSize = "13px";
  techBtn.style.border = "none";
  techBtn.style.cursor = "pointer";
  setupButtonChrome(techBtn, "wood");
  techBtn.addEventListener("click", () => {
    openModal("tech", (close) => createTechModal(state, () => sync(), close));
  });
  actionsBar.appendChild(techBtn);

  // Settings Button
  const settingsBtn = document.createElement("button");
  settingsBtn.textContent = "⚙️";
  settingsBtn.style.padding = "8px 12px";
  settingsBtn.style.fontSize = "13px";
  settingsBtn.style.border = "none";
  settingsBtn.style.cursor = "pointer";
  setupButtonChrome(settingsBtn, "wood");
  settingsBtn.addEventListener("click", () => {
    openModal("settings", (close) => createSettingsModal(settingsStore, kvStore, close));
  });
  actionsBar.appendChild(settingsBtn);

  // Start Combat Button
  const startBtn = document.createElement("button");
  startBtn.textContent = "⚔️ Bắt đầu";
  startBtn.style.padding = "8px 18px";
  startBtn.style.fontSize = "14px";
  startBtn.style.fontWeight = "bold";
  startBtn.style.border = "none";
  startBtn.style.cursor = "pointer";
  setupButtonChrome(startBtn, "primary");
  startBtn.addEventListener("click", onStartCombat);
  actionsBar.appendChild(startBtn);

  topBar.appendChild(actionsBar);
  root.appendChild(topBar);

  // CENTER AREA (Inspector on left)
  const centerArea = document.createElement("div");
  centerArea.style.flex = "1";
  centerArea.style.display = "flex";
  centerArea.style.alignItems = "center";
  centerArea.style.pointerEvents = "none";
  centerArea.style.marginTop = "12px";
  centerArea.style.marginBottom = "12px";
  root.appendChild(centerArea);

  function renderInspector(): void {
    if (inspectorEl) {
      inspectorEl.remove();
      inspectorEl = null;
    }
    if (!selectedTarget) return;

    inspectorEl = createUnitCard(
      state,
      selectedTarget,
      () => sync(),
      () => {
        selectedTarget = null;
        unitMgr.select(null);
        renderInspector();
      },
    );
    centerArea.appendChild(inspectorEl);
  }

  // BOTTOM BAR (Shop)
  const shopBar = document.createElement("div");
  shopBar.style.display = "flex";
  shopBar.style.gap = "10px";
  shopBar.style.pointerEvents = "auto";
  shopBar.style.padding = "12px";
  shopBar.style.alignItems = "stretch";
  shopBar.style.boxSizing = "border-box";
  attachChrome(shopBar, (c) => drawPanel(c, "darkwood"));

  // Shop Controls (Left)
  const shopControls = document.createElement("div");
  shopControls.style.display = "flex";
  shopControls.style.flexDirection = "column";
  shopControls.style.gap = "8px";
  shopControls.style.minWidth = "150px";

  const rerollBtn = document.createElement("button");
  rerollBtn.style.padding = "8px 10px";
  rerollBtn.style.fontSize = "12px";
  rerollBtn.style.border = "none";
  rerollBtn.style.cursor = "pointer";
  rerollBtn.style.fontWeight = "bold";
  setupButtonChrome(rerollBtn, "wood");
  rerollBtn.addEventListener("click", () => {
    const ok = refresh(state);
    if (ok) sync();
  });
  shopControls.appendChild(rerollBtn);

  const xpBtn = document.createElement("button");
  xpBtn.style.padding = "8px 10px";
  xpBtn.style.fontSize = "12px";
  xpBtn.style.border = "none";
  xpBtn.style.cursor = "pointer";
  setupButtonChrome(xpBtn, "wood");
  xpBtn.addEventListener("click", () => {
    const ok = buyXp(state);
    if (ok) sync();
  });
  shopControls.appendChild(xpBtn);

  const lockBtn = document.createElement("button");
  lockBtn.style.padding = "4px 8px";
  lockBtn.style.fontSize = "12px";
  lockBtn.style.border = "none";
  lockBtn.style.cursor = "pointer";
  setupButtonChrome(lockBtn, "wood");
  lockBtn.addEventListener("click", () => {
    toggleLock(state);
    sync();
  });
  shopControls.appendChild(lockBtn);

  shopBar.appendChild(shopControls);

  // Shop Cards (5 slots)
  const cardsContainer = document.createElement("div");
  cardsContainer.style.flex = "1";
  cardsContainer.style.display = "grid";
  cardsContainer.style.gridTemplateColumns = "repeat(5, 1fr)";
  cardsContainer.style.gap = "8px";
  shopBar.appendChild(cardsContainer);

  root.appendChild(shopBar);

  function renderShop(): void {
    // Controls
    const rCost = refreshCost(state.level, state.rollCostDelta);
    rerollBtn.textContent = `🔄 Đổi tướng (${rCost}🪙)`;
    const xCost = xpBuyCost(state.xpCostDelta);
    xpBtn.textContent = `⭐ Mua XP (${xCost}🪙)\nCấp ${state.level} (${state.xp}/${xpToNext(state.level)})`;
    lockBtn.textContent = state.shopLocked ? "🔒 Cửa hàng đã khóa" : "🔓 Khóa cửa hàng";

    // Cards
    cardsContainer.innerHTML = "";
    for (let slot = 0; slot < state.shop.length; slot++) {
      const unitId = state.shop[slot];
      const card = document.createElement("div");
      card.style.height = "100px";
      card.style.borderRadius = "4px";
      card.style.boxSizing = "border-box";
      card.style.display = "flex";
      card.style.flexDirection = "column";
      card.style.justifyContent = "space-between";
      card.style.padding = "8px";
      card.style.position = "relative";

      if (!unitId) {
        card.style.background = "rgba(0,0,0,0.3)";
        card.style.border = "1px dashed #3a3227";
        card.innerHTML = `<span style="margin:auto; font-size:11px; color:#555;">Đã mua</span>`;
      } else {
        const def = getUnit(unitId);
        card.style.background = "rgba(0,0,0,0.45)";
        card.style.border = "1px solid #7c603a";
        card.style.cursor = "pointer";

        const topRow = document.createElement("div");
        topRow.style.display = "flex";
        topRow.style.justifyContent = "space-between";
        topRow.style.alignItems = "center";

        const nameEl = document.createElement("div");
        nameEl.textContent = def.nameVi;
        nameEl.style.fontSize = "13px";
        nameEl.style.fontWeight = "bold";
        nameEl.style.color = "#ffd700";
        topRow.appendChild(nameEl);

        const tierEl = document.createElement("div");
        tierEl.textContent = `Bậc ${def.tier}`;
        tierEl.style.fontSize = "10px";
        tierEl.style.color = "#a09888";
        topRow.appendChild(tierEl);
        card.appendChild(topRow);

        const infoRow = document.createElement("div");
        infoRow.style.fontSize = "11px";
        infoRow.style.color = "#c8bca6";
        infoRow.textContent = `${def.role} · ${def.element}`;
        card.appendChild(infoRow);

        const costRow = document.createElement("div");
        costRow.style.display = "flex";
        costRow.style.justifyContent = "flex-end";
        costRow.style.alignItems = "center";

        const costEl = document.createElement("div");
        costEl.textContent = `${def.tier} 🪙`;
        costEl.style.fontSize = "12px";
        costEl.style.fontWeight = "bold";
        costEl.style.color = state.gold >= def.tier ? "#ffd700" : "#ff6b6b";
        costRow.appendChild(costEl);
        card.appendChild(costRow);

        card.addEventListener("click", () => {
          const ok = buy(state, slot);
          if (ok) {
            sync();
          }
        });
      }

      cardsContainer.appendChild(card);
    }
  }

  function sync(): void {
    // Sync Top Bar
    roundEl.textContent = `Vòng ${state.round}`;
    hpEl.textContent = `❤️ ${state.hp}`;
    goldEl.textContent = `🪙 ${state.gold}`;
    deployEl.textContent = `Ra trận ${boardCount(state)}/${deployLimit(state)} (Hàng chờ ${state.bench.length}/${benchCap(state)})`;

    // Sync 3D scene
    unitMgr.sync(state);

    // Sync Shop
    renderShop();

    // Re-verify selected target
    if (selectedTarget) {
      const stillThere =
        selectedTarget.type === "board"
          ? state.board[selectedTarget.index]?.uid === selectedTarget.unit.uid
          : state.bench[selectedTarget.index]?.uid === selectedTarget.unit.uid;
      if (!stillThere) {
        selectedTarget = null;
        unitMgr.select(null);
      }
    }
    renderInspector();
  }

  // Pointer Interaction with 3D Canvas
  function onPointerUp(e: PointerEvent): void {
    // Only handle if clicking canvas directly (not UI overlays)
    if (e.target !== stage.renderer.domElement) return;

    const hit = unitMgr.pickScreen(e.clientX, e.clientY, stage.camera, state);
    if (!hit) {
      selectedTarget = null;
      unitMgr.select(null);
      renderInspector();
      return;
    }

    if (!selectedTarget) {
      // First selection
      if (hit.unit) {
        selectedTarget = { type: hit.type, index: hit.index, unit: hit.unit };
        unitMgr.select(selectedTarget);
        renderInspector();
      }
    } else {
      // Movement / Swap action
      const src = selectedTarget;
      let moved = false;

      if (src.type === "board" && hit.type === "board") {
        moved = boardToBoard(state, src.index, hit.index);
      } else if (src.type === "bench" && hit.type === "board") {
        moved = benchToBoard(state, src.index, hit.index);
      } else if (src.type === "board" && hit.type === "bench") {
        moved = boardToBench(state, src.index, hit.index);
      } else if (src.type === "bench" && hit.type === "bench") {
        moved = benchToBench(state, src.index, hit.index);
      }

      if (moved) {
        selectedTarget = null;
        unitMgr.select(null);
        sync();
      } else {
        // Switch selection to new unit if legal
        if (hit.unit) {
          selectedTarget = { type: hit.type, index: hit.index, unit: hit.unit };
          unitMgr.select(selectedTarget);
          renderInspector();
        } else {
          selectedTarget = null;
          unitMgr.select(null);
          renderInspector();
        }
      }
    }
  }

  stage.renderer.domElement.addEventListener("pointerup", onPointerUp);

  sync();

  return {
    root,
    sync,
    dispose() {
      stage.renderer.domElement.removeEventListener("pointerup", onPointerUp);
      unitMgr.dispose();
      root.remove();
    },
  };
}
