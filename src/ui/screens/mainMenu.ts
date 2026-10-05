// Main menu view (spec §5, A35, A57).
// Canvas chrome panel with Continue summary, New Game, Settings, Library, Language.
import { attachChrome, drawButton, drawPanel, setupButtonChrome } from "../chrome";
import { inspectSave, type KV } from "../../core/save";
import { MODE_CONFIG } from "../../core/modes";
import { setLocale, t } from "../../core/i18n";
import type { SettingsStore } from "../../core/settings";
import { openModal } from "../modalManager";
import { createSettingsModal } from "./settingsModal";

export interface MainMenuOptions {
  kvStore: KV;
  settingsStore: SettingsStore;
  onNewGame: () => void;
  onContinue: () => void;
  onOpenLibrary: () => void;
  onProgressChange?: () => void;
}

export function createMainMenu(options: MainMenuOptions): HTMLElement {
  const { kvStore, settingsStore, onNewGame, onContinue, onOpenLibrary } = options;

  const root = document.createElement("div");
  root.className = "ft-main-menu-overlay";
  root.style.position = "absolute";
  root.style.inset = "0";
  root.style.display = "flex";
  root.style.justifyContent = "center";
  root.style.alignItems = "center";
  root.style.pointerEvents = "auto";
  root.style.zIndex = "10";
  root.style.fontFamily = "sans-serif";
  root.style.userSelect = "none";

  const card = document.createElement("div");
  card.className = "ft-menu-card";
  card.style.position = "relative";
  card.style.width = "min(420px, 90vw)";
  card.style.display = "flex";
  card.style.flexDirection = "column";
  card.style.alignItems = "center";
  card.style.padding = "32px 24px";
  card.style.boxSizing = "border-box";
  card.style.gap = "18px";

  attachChrome(card, (cvs) => drawPanel(cvs, "darkwood"));

  // Title
  const title = document.createElement("h1");
  title.style.margin = "0 0 12px 0";
  title.style.fontSize = "26px";
  title.style.color = "#ffd700";
  title.style.letterSpacing = "2px";
  title.style.textShadow = "0 2px 4px rgba(0,0,0,0.8)";
  title.textContent = "BÁ CHỦ KHU RỪNG";
  card.appendChild(title);

  const sub = document.createElement("div");
  sub.style.fontSize = "13px";
  sub.style.color = "#a89b88";
  sub.style.marginTop = "-12px";
  sub.style.marginBottom = "10px";
  sub.textContent = "FOREST THRONE";
  card.appendChild(sub);

  // Inspect save state
  const saveState = inspectSave(kvStore);

  // 1. Continue button
  const continueBtn = document.createElement("button");
  continueBtn.textContent = t("menu.continue");
  continueBtn.style.width = "100%";
  continueBtn.style.padding = "12px 0";
  continueBtn.style.fontSize = "16px";
  continueBtn.style.fontWeight = "bold";
  continueBtn.style.border = "none";
  continueBtn.style.color = "#e2d5c3";
  continueBtn.style.cursor = "pointer";
  continueBtn.style.position = "relative";

  const saved = saveState.status === "valid" ? saveState.envelope.payload.player : undefined;
  const isContinueValid = !!saved && saved.phase !== "GAME_OVER" && MODE_CONFIG[saved.mode].available;
  if (!isContinueValid) {
    continueBtn.disabled = true;
    continueBtn.style.cursor = "not-allowed";
    continueBtn.style.opacity = "0.5";
  } else {
    continueBtn.addEventListener("click", onContinue);
  }
  setupButtonChrome(continueBtn, isContinueValid ? "primary" : "wood");
  card.appendChild(continueBtn);

  // Summary under Continue
  const summary = document.createElement("div");
  summary.style.fontSize = "12px";
  summary.style.color = "#8f9b88";
  summary.style.marginTop = "-10px";
  if (saveState.status === "valid" && saveState.envelope.payload.player) {
    const p = saveState.envelope.payload.player;
    summary.textContent = t("menu.saveSummary", {
      round: p.round,
      hearts: p.hp,
      gold: p.gold,
    });
  } else if (saveState.status === "malformed_json") {
    summary.style.color = "#e57373";
    summary.textContent = t("save.malformed");
  } else if (saveState.status === "invalid_envelope") {
    summary.style.color = "#e57373";
    summary.textContent = t("save.invalid");
  }
  card.appendChild(summary);

  // 2. New Game button
  const newGameBtn = document.createElement("button");
  newGameBtn.textContent = t("menu.newGame");
  newGameBtn.style.width = "100%";
  newGameBtn.style.padding = "12px 0";
  newGameBtn.style.fontSize = "16px";
  newGameBtn.style.fontWeight = "bold";
  newGameBtn.style.border = "none";
  newGameBtn.style.color = "#e2d5c3";
  newGameBtn.style.cursor = "pointer";
  newGameBtn.style.position = "relative";
  setupButtonChrome(newGameBtn, "wood");
  newGameBtn.addEventListener("click", onNewGame);
  card.appendChild(newGameBtn);

  // 3. Library button
  const libBtn = document.createElement("button");
  libBtn.textContent = t("menu.library");
  libBtn.style.width = "100%";
  libBtn.style.padding = "10px 0";
  libBtn.style.fontSize = "14px";
  libBtn.style.border = "none";
  libBtn.style.color = "#e2d5c3";
  libBtn.style.cursor = "pointer";
  libBtn.style.position = "relative";
  setupButtonChrome(libBtn, "wood");
  libBtn.addEventListener("click", onOpenLibrary);
  card.appendChild(libBtn);

  // 4. Utility row: Settings + Language
  const utilRow = document.createElement("div");
  utilRow.style.display = "flex";
  utilRow.style.width = "100%";
  utilRow.style.gap = "12px";

  const settingsBtn = document.createElement("button");
  settingsBtn.textContent = `⚙ ${t("menu.settings")}`;
  settingsBtn.style.flex = "1";
  settingsBtn.style.padding = "8px 0";
  settingsBtn.style.fontSize = "13px";
  settingsBtn.style.border = "none";
  settingsBtn.style.color = "#e2d5c3";
  settingsBtn.style.cursor = "pointer";
  settingsBtn.style.position = "relative";
  setupButtonChrome(settingsBtn, "wood");
  settingsBtn.addEventListener("click", () => {
    openModal("settings", (close) => createSettingsModal(settingsStore, kvStore, close, options.onProgressChange));
  });
  utilRow.appendChild(settingsBtn);

  const langBtn = document.createElement("button");
  const curLang = settingsStore.get().language;
  langBtn.textContent = `🌐 ${curLang === "vi" ? "Tiếng Việt" : "English"}`;
  langBtn.style.flex = "1";
  langBtn.style.padding = "8px 0";
  langBtn.style.fontSize = "13px";
  langBtn.style.border = "none";
  langBtn.style.color = "#e2d5c3";
  langBtn.style.cursor = "pointer";
  langBtn.style.position = "relative";
  setupButtonChrome(langBtn, "wood");
  langBtn.addEventListener("click", () => {
    const next = settingsStore.get().language === "vi" ? "en" : "vi";
    settingsStore.save({ language: next });
    setLocale(next);
    // Refresh text
    langBtn.textContent = `🌐 ${next === "vi" ? "Tiếng Việt" : "English"}`;
    continueBtn.textContent = t("menu.continue");
    newGameBtn.textContent = t("menu.newGame");
    libBtn.textContent = t("menu.library");
    settingsBtn.textContent = `⚙ ${t("menu.settings")}`;
  });
  utilRow.appendChild(langBtn);
  card.appendChild(utilRow);

  // Version footer
  const version = document.createElement("div");
  version.style.fontSize = "11px";
  version.style.color = "#665c4f";
  version.style.marginTop = "8px";
  version.textContent = "v1.0.0-rebuild · 3D Engine";
  card.appendChild(version);

  root.appendChild(card);
  return root;
}
