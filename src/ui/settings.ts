// Settings modal (§6, A35, A110): one canonical surface over SettingsStore. Every control writes
// straight to the store (no second temporary truth) and repaints from it. Tabs: Âm thanh, Hiển thị,
// Lối chơi, Phím tắt, Thiết bị, Dữ liệu. Destructive clear needs a second press within 3000 ms.
import { t, type MsgKey } from "../core/i18n";
import {
  DEFAULT_KEYS, normalizeKey, QUALITY, RENDER_SCALES, RESOLUTIONS, TOOLTIP_MODES,
  type KeyContext, type Settings, type SettingsStore,
} from "../core/settings";
import { h, kitButton, panelEl, type KitButton } from "./kit";
import type { ModalHandle } from "./modal";

type Tab = "audio" | "display" | "gameplay" | "keys" | "device" | "data";
const TABS: { id: Tab; key: MsgKey }[] = [
  { id: "audio", key: "settings.audio" }, { id: "display", key: "settings.display" },
  { id: "gameplay", key: "settings.gameplay" }, { id: "keys", key: "settings.keys" },
  { id: "device", key: "settings.device" }, { id: "data", key: "settings.data" },
];
const CONFIRM_MS = 3000;

/** A110.4 stepper: distinct − / + targets around a read-only value; bounds disable the ends. */
function stepper<T>(values: readonly T[], current: T, show: (v: T) => string, set: (v: T) => void) {
  const row = h("div", "stepper");
  const i = Math.max(0, values.indexOf(current));
  const dec = kitButton({ skin: "wood", label: "−", cls: "step-btn", onClick: () => set(values[i - 1]!) });
  const inc = kitButton({ skin: "wood", label: "+", cls: "step-btn", onClick: () => set(values[i + 1]!) });
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

export function mountSettings(modal: ModalHandle, store: SettingsStore, o: { clearRun(): void; hasRun: boolean }): SettingsView {
  let tab: Tab = "audio", listening: { ctx: KeyContext; action: string } | null = null, note = "";
  let confirmUntil = 0, confirmTimer = 0;
  const root = h("div", "settings");
  const tabs = h("div", "tabs");
  const tabBtns: [Tab, KitButton][] = TABS.map((x) => {
    const b = kitButton({ skin: "wood", label: t(x.key), onClick: () => { tab = x.id; listening = null; note = ""; render(); } });
    tabs.append(b.el);
    return [x.id, b];
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
    const raw = e.key === " " ? "SPACE" : e.key;
    const k = normalizeKey(raw);
    if (!k || k === "ESCAPE") { note = t("settings.reserved"); listening = null; render(); return; }
    const s = store.get(), { ctx, action } = listening;
    listening = null; note = ""; // clear first: save() notifies subscribers, which re-render immediately
    store.save({ keys: { ...s.keys, [ctx]: { ...s.keys[ctx], [action]: k } } });
  };
  addEventListener("keydown", onKey, true);
  const off = store.subscribe(() => render());

  function render() {
    const s: Settings = store.get();
    for (const [id, b] of tabBtns) b.setSelected(id === tab);
    body.replaceChildren();
    switch (tab) {
      case "audio":
        field("settings.sound", toggle(s.audioEnabled && !s.audioMuted, (v) => store.save({ audioEnabled: true, audioMuted: !v })));
        field("settings.volume", stepper([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], s.volumeLevel, (v) => `${v}/10`, (v) => store.save({ volumeLevel: v })));
        break;
      case "display":
        field("settings.resolution", stepper(RESOLUTIONS, s.resolutionKey, (v) => v === "adaptive" ? t("settings.resolution.adaptive") : v, (v) => store.save({ resolutionKey: v })));
        field("settings.tooltip", stepper(TOOLTIP_MODES, s.tooltipMode, (v) => t(`settings.tooltip.${v}` as MsgKey), (v) => store.save({ tooltipMode: v })));
        field("menu.language", stepper(["vi", "en"] as const, s.language, (v) => (v === "vi" ? "Tiếng Việt" : "English"), (v) => store.save({ language: v })));
        break;
      case "gameplay":
        field("settings.subtitle", toggle(s.subtitleEnabled, (v) => store.save({ subtitleEnabled: v })));
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
      case "device":
        field("settings.quality", stepper(QUALITY, s.quality, (v) => t(`settings.quality.${v}` as MsgKey), (v) => store.save({ quality: v })));
        field("settings.renderScale", stepper(RENDER_SCALES, (RENDER_SCALES as readonly number[]).includes(s.renderScale) ? (s.renderScale as (typeof RENDER_SCALES)[number]) : 1, (v) => `${Math.round(v * 100)}%`, (v) => store.save({ renderScale: v })));
        field("settings.battery", toggle(s.batterySaver, (v) => store.save({ batterySaver: v })));
        break;
      case "data": {
        const armed = performance.now() < confirmUntil;
        const b = kitButton({ skin: "red", label: armed ? t("settings.confirm") : t("settings.clearRun"), cls: "wide-btn", onClick: () => {
          if (performance.now() < confirmUntil) {
            clearTimeout(confirmTimer); confirmUntil = 0; o.clearRun(); note = t("settings.cleared"); render(); return;
          }
          confirmUntil = performance.now() + CONFIRM_MS;
          confirmTimer = window.setTimeout(() => { confirmUntil = 0; render(); }, CONFIRM_MS);
          render();
        } });
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
      root.remove();
    },
  };
}
