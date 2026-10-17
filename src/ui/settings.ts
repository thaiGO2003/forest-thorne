// Settings modal (§6, A35, A110): one canonical surface over SettingsStore. Every control writes
// straight to the store (no second temporary truth). Device controls live under Display; narration
// and music selection live under Audio.
import { onLocaleChange, t, type MsgKey } from "../core/i18n";
import {
  DEFAULT_KEYS, FPS_LIMITS, GUI_SCALES, normalizeKey, QUALITY, RENDER_SCALES, RESOLUTIONS, TOOLTIP_MODES,
  type KeyContext, type Settings, type SettingsStore,
} from "../core/settings";
import { MUSIC_TRACKS } from "../data/musicPlaylists";
import { h, kitButton, panelEl, type KitButton } from "./kit";
import type { ModalHandle } from "./modal";

type Tab = "audio" | "display" | "keys" | "data";
const TABS: { id: Tab; key: MsgKey }[] = [
  { id: "audio", key: "settings.audio" }, { id: "display", key: "settings.display" },
  { id: "keys", key: "settings.keys" }, { id: "data", key: "settings.data" },
];
const CONFIRM_MS = 3000;

/** A110.4 stepper: distinct < / > targets around a read-only value; bounds disable the ends. */
function stepper<T>(values: readonly T[], current: T, show: (v: T) => string, set: (v: T) => void) {
  const row = h("div", "stepper");
  const i = Math.max(0, values.indexOf(current));
  const dec = kitButton({ skin: "wood", label: "<", cls: "step-btn", onClick: () => set(values[i - 1]!) });
  const inc = kitButton({ skin: "wood", label: ">", cls: "step-btn", onClick: () => set(values[i + 1]!) });
  const val = panelEl("slot_well", "step-val");
  val.append(h("span", "step-text", show(current)));
  val.setAttribute("aria-live", "polite");
  dec.setDisabled(i <= 0);
  inc.setDisabled(i >= values.length - 1);
  row.append(dec.el, val, inc.el);
  return row;
}

function toggle(on: boolean, set: (v: boolean) => void): HTMLElement {
  const b = kitButton({ skin: on ? "green" : "wood", label: t(on ? "settings.on" : "settings.off"), cls: "toggle-btn", onClick: () => set(!on) });
  b.setSelected(on);
  return b.el;
}

export interface SettingsView { dispose(): void }

export function mountSettings(modal: ModalHandle, store: SettingsStore, o: { clearRun(): void; exportRun(): { filename: string; text: string } | null; hasRun: boolean }): SettingsView {
  let tab: Tab = "audio", listening: { ctx: KeyContext; action: string } | null = null, note = "";
  let confirmUntil = 0, confirmTimer = 0;
  const root = h("div", "settings");
  const tabs = h("div", "tabs");
  const tabBtns: { id: Tab; key: MsgKey; button: KitButton }[] = TABS.map((x) => {
    const button = kitButton({ skin: "wood", label: t(x.key), onClick: () => { tab = x.id; listening = null; note = ""; render(); } });
    tabs.append(button.el);
    return { id: x.id, key: x.key, button };
  });
  const body = h("div", "stack settings-body");
  root.append(tabs, body);
  modal.body.append(root);

  const field = (labelKey: MsgKey, control: HTMLElement) => {
    const f = h("div", "field");
    f.append(h("span", "field-label", t(labelKey)), control);
    body.append(f);
  };

  const onKey = (e: KeyboardEvent) => {
    if (!listening) return;
    e.preventDefault();
    e.stopPropagation(); // capture must not leak to Escape-close or board shortcuts (A95.3)
    const raw = e.code === "ShiftRight" ? "SHIFTRIGHT" : e.key === " " ? "SPACE" : e.key;
    const k = normalizeKey(raw);
    if (!k || k === "ESCAPE") { note = t("settings.reserved"); listening = null; render(); return; }
    const s = store.get(), { ctx, action } = listening;
    if (Object.entries(s.keys[ctx]).some(([other, value]) => other !== action && value === k)) {
      note = t("settings.keyConflict"); listening = null; render(); return;
    }
    listening = null; note = ""; // clear first: save() notifies subscribers, which re-render immediately
    store.save({ keys: { ...s.keys, [ctx]: { ...s.keys[ctx], [action]: k } } });
  };
  addEventListener("keydown", onKey, true);
  const off = store.subscribe(() => render());
  const offLocale = onLocaleChange(() => render());

  function render() {
    const s: Settings = store.get();
    modal.setTitle(t("menu.settings"));
    modal.setCloseLabel(t("ui.close"));
    modal.setHeaderActionLabel(t("settings.home"));
    for (const { id, key, button } of tabBtns) {
      button.setLabel(t(key));
      button.setSelected(id === tab);
    }
    body.replaceChildren();
    switch (tab) {
      case "audio": {
        field("settings.sound", toggle(s.audioEnabled && !s.audioMuted, (v) => store.save({ audioEnabled: true, audioMuted: !v })));
        field("settings.music", toggle(s.musicEnabled, (v) => store.save({ musicEnabled: v })));
        field("settings.volume", stepper([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], s.volumeLevel, (v) => `${v}/10`, (v) => store.save({ volumeLevel: v })));
        field("settings.narration", toggle(s.narrationEnabled, (v) => store.save({ narrationEnabled: v })));
        field("settings.musicVolume", stepper([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], s.musicVolume, (v) => `${v}/10`, (v) => store.save({ musicVolume: v })));
        field("settings.musicSource", stepper(["local", "online"] as const, s.musicSource, (v) => t(v === "local" ? "settings.musicLocal" : "settings.musicOnline"), (v) => {
          const first = Object.values(MUSIC_TRACKS).find((track) => track.source === v)?.key ?? "";
          store.save({ musicSource: v, musicTrack: first });
        }));
        const tracks = Object.values(MUSIC_TRACKS).filter((track) => track.source === s.musicSource);
        if (tracks.length) {
          const currentIndex = Math.max(0, tracks.findIndex((track) => track.key === s.musicTrack));
          const row = h("div", "stepper music-track-nav");
          const previous = kitButton({ skin: "wood", label: "‹", cls: "step-btn", onClick: () => {
            const index = (currentIndex - 1 + tracks.length) % tracks.length;
            store.save({ musicTrack: tracks[index]!.key });
          } });
          const next = kitButton({ skin: "wood", label: "›", cls: "step-btn", onClick: () => {
            const index = (currentIndex + 1) % tracks.length;
            store.save({ musicTrack: tracks[index]!.key });
          } });
          previous.setAria(t("settings.musicPrevious"));
          next.setAria(t("settings.musicNext"));
          const value = panelEl("slot_well", "step-val");
          value.append(h("span", "step-text", tracks[currentIndex]?.title ?? tracks[0]!.title));
          row.append(previous.el, value, next.el);
          field("settings.musicTrack", row);
        }
        break;
      }
      case "display":
        field("settings.resolution", stepper(RESOLUTIONS, s.resolutionKey, (v) => v === "adaptive" ? t("settings.resolution.adaptive") : v, (v) => store.save({ resolutionKey: v })));
        field("settings.tooltip", stepper(TOOLTIP_MODES, s.tooltipMode, (v) => t(`settings.tooltip.${v}` as MsgKey), (v) => store.save({ tooltipMode: v })));
        field("settings.quality", stepper(QUALITY, s.quality, (v) => t(`quality.${v}` as MsgKey), (v) => store.save({ quality: v })));
        field("settings.renderScale", stepper(RENDER_SCALES, s.renderScale, (v) => `${Math.round(v * 100)}%`, (v) => store.save({ renderScale: v })));
        field("settings.fpsLimit", stepper(FPS_LIMITS, s.fpsLimit, (v) => `${v} FPS`, (v) => store.save({ fpsLimit: v })));
        field("settings.batterySaver", toggle(s.batterySaver, (v) => store.save({ batterySaver: v })));
        field("settings.guiScale", stepper(GUI_SCALES, s.guiScale, (v) => `${Math.round(v * 100)}%`, (v) => store.save({ guiScale: v })));
        break;
      case "keys":
        for (const ctx of Object.keys(DEFAULT_KEYS) as KeyContext[]) {
          body.append(h("h3", "lib-h", t(`ctx.${ctx}` as MsgKey)));
          for (const action of Object.keys(DEFAULT_KEYS[ctx])) {
            const cur = (s.keys[ctx] as Record<string, string>)[action] ?? "";
            const isListening = listening?.ctx === ctx && listening.action === action;
            const reserved = cur === "ESCAPE";
            const b = kitButton({ skin: isListening ? "plum" : "wood", label: isListening ? t("settings.listening") : cur, cls: "key-btn", onClick: () => { listening = { ctx, action }; note = ""; render(); } });
            b.setSelected(isListening);
            b.setDisabled(reserved);
            field(`key.${action}` as MsgKey, b.el);
          }
          const reset = kitButton({ skin: "red", label: `${t("settings.resetKeys")} · ${t(`ctx.${ctx}` as MsgKey)}`, cls: "wide-btn", onClick: () => { listening = null; store.resetKeys(ctx); } });
          body.append(reset.el);
        }
        break;

      case "data": {
        const exported = kitButton({ skin: "wood", label: t("settings.exportSave"), cls: "wide-btn", onClick: () => {
          const file = o.exportRun();
          if (!file) return;
          const url = URL.createObjectURL(new Blob([file.text], { type: "application/json" }));
          const a = document.createElement("a");
          a.href = url;
          a.download = file.filename;
          a.click();
          URL.revokeObjectURL(url);
        } });
        exported.setDisabled(!o.hasRun);
        body.append(exported.el);
        const armed = performance.now() < confirmUntil;
        const clearLabel = armed ? t("settings.confirm") : t("settings.clearRun");
        const b = kitButton({ skin: "red", label: clearLabel, cls: "wide-btn destructive-fit", onClick: () => {
          if (performance.now() < confirmUntil) {
            clearTimeout(confirmTimer); confirmUntil = 0; o.clearRun(); return;
          }
          confirmUntil = performance.now() + CONFIRM_MS;
          confirmTimer = window.setTimeout(() => { confirmUntil = 0; render(); }, CONFIRM_MS);
          render();
        } });
        b.el.append(h("span", "kit-fit-measure", clearLabel));
        b.setDisabled(!o.hasRun && !armed);
        b.setSelected(armed);
        body.append(b.el);
        break;
      }
    }
    if (note) { const n = h("div", "slot settings-note", note); n.setAttribute("role", "status"); body.append(n); }
  }
  render();

  return {
    dispose() {
      listening = null;
      removeEventListener("keydown", onKey, true);
      clearTimeout(confirmTimer);
      off();
      offLocale();
      root.remove();
    },
  };
}
