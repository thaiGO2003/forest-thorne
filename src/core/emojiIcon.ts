// Semantic icon authority for presentation (§36, A61). Every screen resolves the same meaning to the
// same glyph. Unicode is the always-available fallback; remote emoji-api enrichment is a logic-side
// concern (VITE_EMOJI_API_KEY) and may later swap glyphs in place without changing layout.

export const ICONS = {
  empty: "",
  gold: "🪙", xp: "✨", heart: "❤️", level: "⬆️", round: "🗓️", streakWin: "🔥", streakLoss: "🥶",
  reroll: "🔄", lock: "🔒", unlock: "🔓", start: "⚔️", sell: "💰", info: "📜",
  library: "📖", tech: "🌳", craft: "⚒️", recipe: "📕", inventory: "🎒", history: "🕰️", settings: "⚙️",
  synergy: "🔗", augment: "💎", language: "🌐", achievements: "🏆", mods: "🧩", tribute: "🎖️",
  social: "💬", donate: "☕", version: "🏷️", debug: "🐞", cortisol: "🧘",
  rage: "⚡", hp: "❤️", atk: "🗡️", def: "🛡️", matk: "🔮", mdef: "🧿", range: "🎯", crit: "💥", evade: "💨",
  // Roles
  TANKER: "🛡️", ASSASSIN: "🗡️", ARCHER: "🏹", MAGE: "🔮", SUPPORT: "💚", FIGHTER: "⚔️",
  // Factions
  BEAST: "🐾", AVIAN: "🪶", INSECT: "🐞", REPTILE: "🦎", AQUATIC: "🐟", MYTHICAL: "🐉",
  // Elements
  STONE: "🪨", WIND: "🌪️", FIRE: "🔥", TIDE: "🌊", NIGHT: "🌙", SPIRIT: "👻", SWARM: "🐝", WOOD: "🌿",
  // Statuses
  burn: "🔥", poison: "☠️", bleed: "🩸", freeze: "❄️", stun: "💫", sleep: "💤", silence: "🤐",
  shield: "🛡️", taunt: "📣", healBlock: "🚫", atkUp: "💪", atkDown: "🥀", defUp: "🧱", defDown: "🪓",
  regen: "🌱", reflect: "🪞", immune: "✳️", disease: "🦠", slow: "🐌", haste: "⚡",
} as const;

export type IconName = keyof typeof ICONS;

const PICTO = /\p{Extended_Pictographic}/u;

/**
 * Resolve a semantic name or raw glyph to the displayed character.
 * Blank → empty; known name → mapped glyph; unknown pictograph → itself; unknown text → ❔.
 */
export function icon(name: string | null | undefined): string {
  const key = (name ?? "").trim();
  if (!key) return "";
  if (key in ICONS) return ICONS[key as IconName];
  return PICTO.test(key) ? key : "❔";
}
