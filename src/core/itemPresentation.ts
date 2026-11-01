// Canonical loot/inventory presentation hooks. Keep item identity in core data; UI resolves only authored copy/icons here.
import { t, type MsgKey } from "./i18n";
import { getItem } from "./itemRegistry";

export const itemDisplayName = (id: string): string => {
  const item = getItem(id);
  return item ? t(item.displayNameKey as MsgKey) : id;
};

/** Semantic emoji hook; consumers resolve it through emojiIcon rather than drawing icon chrome. */
export const itemSemanticIcon = (id: string): string => getItem(id)?.icon ?? "question";
