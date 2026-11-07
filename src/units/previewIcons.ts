// Planning hover badge language (A96 feedback): the fist always marks the basic attack and the
// authored role marker marks the skill. One unit can be hit by both actions in the same projection,
// so badges stack per target instead of replacing each other.
import type { Role } from "../content/catalog";
import type { CombatPreviewEffect, CombatPreviewTag } from "../core/combat";
import { BASIC_ATTACK_ICON, ICONS, SKILL_ICONS } from "../core/emojiIcon";

/** Effect-driven markers keep "green = heal / blue = shield" readable without role knowledge. */
const EFFECT_ICONS: Partial<Record<CombatPreviewEffect, string>> = {
  heal: ICONS.regen,
  shield: ICONS.shield,
  debuff: ICONS.atkDown,
  control: ICONS.freeze,
  buff: ICONS.augment,
};

export interface PreviewIcon {
  char: string;
  /** Tile palette key: basic attacks keep the gold family, skills use their semantic effect. */
  kind: "basic" | CombatPreviewEffect;
}

export interface PreviewIconStack {
  uid: string;
  icons: PreviewIcon[];
  primary: boolean;
}

/** Basic attacks are always a fist; skills are the caster's authored marker unless the effect is semantic. */
export function previewIconChar(tag: CombatPreviewTag, role?: Role): string {
  if (tag.kind === "basic") return BASIC_ATTACK_ICON;
  return EFFECT_ICONS[tag.effect] ?? SKILL_ICONS[role ?? "FIGHTER"];
}

/** Groups per-action tags by target so a unit shows every marker that applies to it (e.g. fist + dagger). */
export function groupPreviewIcons(tags: readonly CombatPreviewTag[], role?: Role): PreviewIconStack[] {
  const stacks = new Map<string, PreviewIconStack>();
  for (const tag of tags) {
    const uid = tag.uid.trim();
    if (!uid) continue;
    let stack = stacks.get(uid);
    if (!stack) {
      stack = { uid, icons: [], primary: false };
      stacks.set(uid, stack);
    }
    if (tag.primary) stack.primary = true;
    const icon: PreviewIcon = {
      char: previewIconChar(tag, role),
      kind: tag.kind === "basic" ? "basic" : tag.effect,
    };
    if (!stack.icons.some((entry) => entry.char === icon.char && entry.kind === icon.kind)) stack.icons.push(icon);
  }
  return [...stacks.values()];
}
