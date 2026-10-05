// Settings modal view (spec §6, A35, A44).
// Canvas chrome panel with live preview & save through SettingsStore.
import { attachChrome, drawButton, drawPanel, setupButtonChrome } from "../chrome";
import { TOOLTIP_MODES, type Settings, type SettingsStore } from "../../core/settings";
import { t } from "../../core/i18n";
import { AI_MODES } from "../../core/encounter";
import { clearProgress, clearRunProgress, importProgress, PROGRESS_KEY, type KV } from "../../core/save";

export function createSettingsModal(store: SettingsStore, kvStore: KV, onClose: () => void, onProgressChange?: () => void): HTMLElement {
  const modal = document.createElement("div");
  modal.className = "ft-settings-modal";
  modal.style.position = "relative";
  modal.style.width = "min(680px, 94vw)";
  modal.style.maxHeight = "86vh";
  modal.style.display = "flex";
  modal.style.flexDirection = "column";
  modal.style.padding = "24px";
  modal.style.boxSizing = "border-box";
  modal.style.color = "#e2d5c3";
  modal.style.fontFamily = "sans-serif";
  modal.style.userSelect = "none";

  attachChrome(modal, (cvs) => drawPanel(cvs, "stone"));

  // Header
  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "center";
  header.style.marginBottom = "16px";
  header.style.position = "relative";
  header.style.zIndex = "1";

  const title = document.createElement("h2");
  title.style.margin = "0";
  title.style.fontSize = "20px";
  title.style.color = "#ffd700";
  title.textContent = t("settings.title");
  header.appendChild(title);

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✕";
  closeBtn.style.width = "32px";
  closeBtn.style.height = "32px";
  closeBtn.style.border = "none";
  closeBtn.style.background = "none";
  closeBtn.style.color = "#ffd700";
  closeBtn.style.cursor = "pointer";
  closeBtn.style.position = "relative";
  setupButtonChrome(closeBtn, "danger");
  closeBtn.addEventListener("click", onClose);
  header.appendChild(closeBtn);
  modal.appendChild(header);

  // Content body (scrollable)
  const body = document.createElement("div");
  body.style.flex = "1";
  body.style.overflowY = "auto";
  body.style.display = "flex";
  body.style.flexDirection = "column";
  body.style.gap = "20px";
  body.style.paddingRight = "8px";
  body.style.position = "relative";
  body.style.zIndex = "1";

  const current = store.get();

  // Helper row builder
  function createRow(label: string, control: HTMLElement): HTMLElement {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.justifyContent = "space-between";
    row.style.alignItems = "center";
    row.style.minHeight = "36px";

    const lbl = document.createElement("span");
    lbl.textContent = label;
    lbl.style.fontSize = "14px";
    row.appendChild(lbl);
    row.appendChild(control);
    return row;
  }

  function createSection(headingText: string): HTMLElement {
    const sec = document.createElement("div");
    sec.style.display = "flex";
    sec.style.flexDirection = "column";
    sec.style.gap = "8px";

    const h = document.createElement("h3");
    h.textContent = headingText;
    h.style.margin = "0 0 6px 0";
    h.style.fontSize = "16px";
    h.style.color = "#d4af37";
    h.style.borderBottom = "1px solid #38475a";
    h.style.paddingBottom = "4px";
    sec.appendChild(h);
    return sec;
  }

  // 1. Audio Section
  const audioSec = createSection(t("settings.audio"));
  const audioToggle = document.createElement("input");
  audioToggle.type = "checkbox";
  audioToggle.checked = current.audioEnabled;
  audioToggle.addEventListener("change", () => store.preview({ audioEnabled: audioToggle.checked }));
  audioSec.appendChild(createRow(t("settings.audioEnabled"), audioToggle));

  const muteToggle = document.createElement("input");
  muteToggle.type = "checkbox";
  muteToggle.checked = current.audioMuted;
  muteToggle.addEventListener("change", () => store.preview({ audioMuted: muteToggle.checked }));
  audioSec.appendChild(createRow(t("settings.audioMuted"), muteToggle));

  const volContainer = document.createElement("div");
  volContainer.style.display = "flex";
  volContainer.style.alignItems = "center";
  volContainer.style.gap = "8px";
  const volSlider = document.createElement("input");
  volSlider.type = "range";
  volSlider.min = "1";
  volSlider.max = "10";
  volSlider.value = String(current.volumeLevel);
  const volVal = document.createElement("span");
  volVal.textContent = String(current.volumeLevel);
  volSlider.addEventListener("input", () => {
    const val = Number(volSlider.value);
    volVal.textContent = String(val);
    store.preview({ volumeLevel: val });
  });
  volContainer.appendChild(volSlider);
  volContainer.appendChild(volVal);
  audioSec.appendChild(createRow(t("settings.volume", { val: current.volumeLevel }), volContainer));
  body.appendChild(audioSec);

  // 2. Display Section
  const dispSec = createSection(t("settings.display"));
  const qualitySel = document.createElement("select");
  qualitySel.style.padding = "4px 8px";
  qualitySel.style.background = "#1b140e";
  qualitySel.style.color = "#e2d5c3";
  qualitySel.style.border = "1px solid #4a3525";
  for (const q of ["low", "medium", "high"] as const) {
    const opt = document.createElement("option");
    opt.value = q;
    opt.textContent = q.toUpperCase();
    if (current.quality === q) opt.selected = true;
    qualitySel.appendChild(opt);
  }
  qualitySel.addEventListener("change", () => store.preview({ quality: qualitySel.value as Settings["quality"] }));
  dispSec.appendChild(createRow(t("settings.quality"), qualitySel));

  const scaleContainer = document.createElement("div");
  scaleContainer.style.display = "flex";
  scaleContainer.style.alignItems = "center";
  scaleContainer.style.gap = "8px";
  const scaleSlider = document.createElement("input");
  scaleSlider.type = "range";
  scaleSlider.min = "50";
  scaleSlider.max = "100";
  scaleSlider.value = String(Math.round(current.renderScale * 100));
  const scaleVal = document.createElement("span");
  scaleVal.textContent = `${Math.round(current.renderScale * 100)}%`;
  scaleSlider.addEventListener("input", () => {
    const val = Number(scaleSlider.value) / 100;
    scaleVal.textContent = `${scaleSlider.value}%`;
    store.preview({ renderScale: val });
  });
  scaleContainer.appendChild(scaleSlider);
  scaleContainer.appendChild(scaleVal);
  dispSec.appendChild(createRow(t("settings.renderScale", { val: `${Math.round(current.renderScale * 100)}%` }), scaleContainer));

  const battToggle = document.createElement("input");
  battToggle.type = "checkbox";
  battToggle.checked = current.batterySaver;
  battToggle.addEventListener("change", () => store.preview({ batterySaver: battToggle.checked }));
  dispSec.appendChild(createRow(t("settings.batterySaver"), battToggle));
  body.appendChild(dispSec);

  // 3. Gameplay Section
  const gameSec = createSection(t("settings.gameplay"));
  const aiSel = document.createElement("select");
  aiSel.style.padding = "4px 8px";
  aiSel.style.background = "#1b140e";
  aiSel.style.color = "#e2d5c3";
  aiSel.style.border = "1px solid #4a3525";
  for (const m of AI_MODES) {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    if (current.aiMode === m) opt.selected = true;
    aiSel.appendChild(opt);
  }
  aiSel.addEventListener("change", () => store.preview({ aiMode: aiSel.value as Settings["aiMode"] }));
  gameSec.appendChild(createRow(t("settings.aiMode"), aiSel));

  const tipSel = document.createElement("select");
  tipSel.style.padding = "4px 8px";
  tipSel.style.background = "#1b140e";
  tipSel.style.color = "#e2d5c3";
  tipSel.style.border = "1px solid #4a3525";
  for (const m of TOOLTIP_MODES) {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m.toUpperCase();
    if (current.tooltipMode === m) opt.selected = true;
    tipSel.appendChild(opt);
  }
  tipSel.addEventListener("change", () => store.preview({ tooltipMode: tipSel.value as Settings["tooltipMode"] }));
  gameSec.appendChild(createRow(t("settings.tooltipMode"), tipSel));

  const subToggle = document.createElement("input");
  subToggle.type = "checkbox";
  subToggle.checked = current.subtitleEnabled;
  subToggle.addEventListener("change", () => store.preview({ subtitleEnabled: subToggle.checked }));
  gameSec.appendChild(createRow(t("settings.subtitles"), subToggle));
  body.appendChild(gameSec);

  // 4. Shortcuts Section
  const keysSec = createSection(t("settings.shortcuts"));
  const keysList = document.createElement("div");
  keysList.style.display = "grid";
  keysList.style.gridTemplateColumns = "repeat(auto-fit, minmax(180px, 1fr))";
  keysList.style.gap = "8px";
  keysList.style.fontSize = "13px";

  for (const [ctx, actions] of Object.entries(current.keys)) {
    for (const [action, key] of Object.entries(actions)) {
      const item = document.createElement("div");
      item.style.display = "flex";
      item.style.justifyContent = "space-between";
      item.style.padding = "4px 6px";
      item.style.background = "#181410";
      item.innerHTML = `<span>${ctx}.${action}</span><strong style="color:#d4af37">[${key}]</strong>`;
      keysList.appendChild(item);
    }
  }
  keysSec.appendChild(keysList);

  const resetKeysBtn = document.createElement("button");
  resetKeysBtn.textContent = t("settings.resetKeys");
  resetKeysBtn.style.padding = "6px 12px";
  resetKeysBtn.style.alignSelf = "flex-start";
  resetKeysBtn.style.border = "none";
  resetKeysBtn.style.color = "#e2d5c3";
  resetKeysBtn.style.cursor = "pointer";
  setupButtonChrome(resetKeysBtn, "wood");
  resetKeysBtn.addEventListener("click", () => {
    store.resetKeys();
    alert("Keybindings reset to default");
  });
  keysSec.appendChild(resetKeysBtn);
  body.appendChild(keysSec);

  // 5. Data Section
  const dataSec = createSection(t("settings.data"));
  const dataActions = document.createElement("div");
  dataActions.style.display = "flex";
  dataActions.style.flexWrap = "wrap";
  dataActions.style.gap = "10px";

  const exportBtn = document.createElement("button");
  exportBtn.textContent = t("settings.exportSave");
  exportBtn.style.padding = "6px 12px";
  exportBtn.style.border = "none";
  exportBtn.style.color = "#e2d5c3";
  exportBtn.style.cursor = "pointer";
  setupButtonChrome(exportBtn, "wood");
  exportBtn.addEventListener("click", () => {
    const raw = kvStore.getItem(PROGRESS_KEY);
    if (raw) {
      navigator.clipboard?.writeText(raw);
      alert("Save data copied to clipboard");
    } else {
      alert("No save data found");
    }
  });
  dataActions.appendChild(exportBtn);

  const importBtn = document.createElement("button");
  importBtn.textContent = t("settings.importSave");
  importBtn.style.padding = "6px 12px";
  importBtn.style.border = "none";
  importBtn.style.color = "#e2d5c3";
  importBtn.style.cursor = "pointer";
  setupButtonChrome(importBtn, "wood");
  importBtn.addEventListener("click", () => {
    const text = prompt("Paste save JSON:");
    if (text) {
      const res = importProgress(kvStore, text, true);
      if (res) {
        onProgressChange?.();
        alert("Save imported successfully!");
      } else {
        alert("Failed to import save: invalid format");
      }
    }
  });
  dataActions.appendChild(importBtn);

  const clearRunBtn = document.createElement("button");
  clearRunBtn.textContent = t("settings.clearRun");
  clearRunBtn.style.padding = "6px 12px";
  clearRunBtn.style.border = "none";
  clearRunBtn.style.color = "#e2d5c3";
  clearRunBtn.style.cursor = "pointer";
  setupButtonChrome(clearRunBtn, "danger");
  clearRunBtn.addEventListener("click", () => {
    if (confirm("Clear active run progress?")) {
      clearRunProgress(kvStore);
      onProgressChange?.();
      alert("Run progress cleared");
    }
  });
  dataActions.appendChild(clearRunBtn);

  const clearAllBtn = document.createElement("button");
  clearAllBtn.textContent = t("settings.clearAll");
  clearAllBtn.style.padding = "6px 12px";
  clearAllBtn.style.border = "none";
  clearAllBtn.style.color = "#e2d5c3";
  clearAllBtn.style.cursor = "pointer";
  setupButtonChrome(clearAllBtn, "danger");
  clearAllBtn.addEventListener("click", () => {
    if (confirm("Reset ALL data (runs, achievements, collections)?")) {
      clearProgress(kvStore);
      onProgressChange?.();
      alert("All game data reset");
    }
  });
  dataActions.appendChild(clearAllBtn);
  dataSec.appendChild(dataActions);
  body.appendChild(dataSec);

  modal.appendChild(body);
  return modal;
}
