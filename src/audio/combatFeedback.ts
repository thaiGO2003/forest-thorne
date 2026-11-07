// One decision table for combat/shop audio (issue #12). The presentation layer used to compute
// the music context and the SFX key in two independent ternaries, which is how a draw ended up
// playing victory/defeat music while its SFX key said "draw".
import type { MusicContext } from "../data/musicPlaylists";

export type CombatWinner = "LEFT" | "RIGHT" | "DRAW";
export type CombatSfxKey = "victory" | "defeat" | "draw";

export interface CombatFeedback {
  /** Music context for the result screen. "ambient" is the silent context (A45). */
  music: Extract<MusicContext, "victory" | "defeat" | "ambient">;
  sfx: CombatSfxKey;
}

export function combatFeedback(winner: CombatWinner): CombatFeedback {
  if (winner === "LEFT") return { music: "victory", sfx: "victory" };
  if (winner === "RIGHT") return { music: "defeat", sfx: "defeat" };
  // A draw is neither a win nor a loss: keep the SFX cue and do not claim a defeat theme.
  return { music: "ambient", sfx: "draw" };
}

export type ShopOutcome = "buy" | "reroll" | "xp";

/** Shop and XP cues only fire on success; a rejected purchase stays silent. */
export function shopFeedback(kind: ShopOutcome, succeeded: boolean): CombatSfxKey | "buy" | "reroll" | null {
  if (!succeeded) return null;
  return kind === "reroll" ? "reroll" : "buy";
}

export type CombatEventKind = "basic" | "skill" | "heal" | "death";

const COMBAT_EVENT_SFX: Readonly<Record<CombatEventKind, CombatSfxKey | "hit" | "skill" | "heal" | "ko">> = {
  basic: "hit",
  skill: "skill",
  heal: "heal",
  death: "ko",
};

/** Presentation time window (ms) for a shop/combat cue; 0 means "play immediately". */
export function combatEventSfx(kind: string): (typeof COMBAT_EVENT_SFX)[CombatEventKind] | null {
  return (COMBAT_EVENT_SFX as Record<string, (typeof COMBAT_EVENT_SFX)[CombatEventKind]>)[kind] ?? null;
}
