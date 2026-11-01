// Canonical loot/inventory presentation hooks. Keep item identity in core data; UI resolves only authored copy/icons here.
import { ICONS, resolveEmojiChar } from "./emojiIcon";
import { t, type MsgKey } from "./i18n";
import { BASE_MATERIALS, getItem, type EquipmentBonuses } from "./itemRegistry";

export const itemDisplayName = (id: string): string => {
  const item = getItem(id);
  if (!item) return id;
  if (item.kind === "equipment" && item.nameVi) return item.nameVi;
  const translated = t(item.displayNameKey as MsgKey);
  return translated === item.displayNameKey ? id : translated;
};

const ITEM_ICON_HOOKS: Readonly<Record<string, string>> = {
  bark: "materialBark",
  feather: "materialFeather",
  belt: "materialBelt",
  claw: "materialClaw",
  tear: "materialTear",
  crystal: "materialCrystal",
  eq_blue_buff: "sparkles",
  eq_warmog_armor: "shield",
};

/** Semantic emoji hook; consumers resolve it through emojiIcon rather than drawing icon chrome. */
export const itemSemanticIcon = (id: string): string =>
  ITEM_ICON_HOOKS[id] ?? getItem(id)?.icon ?? "question";

/** Only these ids have hand-authored SVG art; every classic item falls back to its emoji icon. */
const ITEM_ART_IDS = new Set<string>([...BASE_MATERIALS, "eq_blue_buff", "eq_warmog_armor"]);

export const hasItemArt = (id: string): boolean => ITEM_ART_IDS.has(id);

/** Concrete emoji glyph for the item, used when no SVG exists. */
export const itemIconChar = (id: string): string => {
  const semantic = itemSemanticIcon(id);
  const known = (ICONS as Record<string, string>)[semantic];
  return known ?? resolveEmojiChar(semantic);
};

const trimNumber = (value: number): string => Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);

/** Player-facing equipment stat lines; only effects the current combat engine applies are listed. */
export const equipmentBonusCopy = (bonuses: EquipmentBonuses): string => {
  const parts: string[] = [];
  const pct = (value: number | undefined, icon: string, label: string) => {
    if (typeof value === "number" && value) parts.push(`${icon} +${trimNumber(value)}% ${label}`);
  };
  const flat = (value: number | undefined, icon: string, label: string) => {
    if (typeof value === "number" && value) parts.push(`${icon} +${trimNumber(value)} ${label}`);
  };
  pct(bonuses.hpPct, ICONS.hp, t("inventory.hp"));
  pct(bonuses.atkPct, ICONS.atk, t("inventory.atk"));
  pct(bonuses.matkPct, ICONS.matk, t("inventory.matk"));
  flat(bonuses.def, ICONS.def, t("inventory.def"));
  flat(bonuses.mdef, ICONS.mdef, t("inventory.mdef"));
  pct(bonuses.critPct, ICONS.crit, t("inventory.crit"));
  pct(bonuses.lifestealPct, ICONS.regen, t("inventory.lifesteal"));
  pct(bonuses.healPct, ICONS.regen, t("inventory.healPct"));
  pct(bonuses.evadePct, ICONS.evade, t("inventory.evade"));
  flat(bonuses.burnOnHit, ICONS.burn, t("inventory.onHitBurn"));
  flat(bonuses.poisonOnHit, ICONS.poison, t("inventory.onHitPoison"));
  flat(bonuses.startingRage, ICONS.rage, t("inventory.rage"));
  flat(bonuses.startingShield, ICONS.shield, t("inventory.shield"));
  return parts.join(" · ");
};
