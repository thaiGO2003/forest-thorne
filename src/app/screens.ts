// Registers every screen and utility modal with the app shell. Import side-effects only.
import { LOCALES, t, getLocale } from "../core/i18n";
import { h, kitButton } from "../ui/kit";
import { applyLocale, registerUtility } from "./app";

// Language: one control opens the list; selecting refreshes copy immediately (A98).
registerUtility("language", (app) => {
  const m = app.modals.open({ id: "language", title: t("menu.language"), size: "sm", closeLabel: t("ui.close") });
  const list = h("div", "choice-list");
  const names: Record<string, string> = { vi: "Tiếng Việt", en: "English" };
  for (const l of LOCALES) {
    const b = kitButton({ skin: "blue", label: names[l] ?? l, onClick: () => {
      // LOGIC: persist via SettingsStore.save({ language }) once settings wiring lands.
      applyLocale(l);
      m.close();
    } });
    b.setSelected(l === getLocale());
    list.append(b.el);
  }
  m.body.append(list);
});
