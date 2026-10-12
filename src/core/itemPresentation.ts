// Canonical loot/inventory presentation hooks. Keep item identity in core data; UI resolves only authored copy/icons here.
import { t, type MsgKey } from "./i18n";

const ITEM_NAME_KEYS: Partial<Record<string, MsgKey>> = {
  bark: "item.bark",
  feather: "item.feather",
  belt: "item.belt",
  claw: "item.claw",
  tear: "item.tear",
  crystal: "item.crystal",
  eq_warmog_armor: "item.eq_warmog_armor",
  eq_blue_buff: "item.eq_blue_buff",
};

const ITEM_ICON_HOOKS: Readonly<Record<string, string>> = {
  bark: "leaf",
  feather: "wind",
  belt: "shield",
  claw: "swords",
  tear: "droplet",
  crystal: "sparkles",
  eq_blue_buff: "sparkles",
  eq_warmog_armor: "shield",
};

export const itemDisplayName = (id: string): string => {
  const key = ITEM_NAME_KEYS[id];
  return key ? t(key) : id;
};

/** Semantic emoji hook; consumers resolve it through emojiIcon rather than drawing icon chrome. */
export const itemSemanticIcon = (id: string): string => ITEM_ICON_HOOKS[id] ?? "question";
