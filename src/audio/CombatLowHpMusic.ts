// Combat low-HP music: fires when a side drops to ≤30% team HP. The later-triggered
// side pauses the previous track and takes over; disposed when combat ends.
import type { SettingsStore } from "../core/settings";
import { normalizedMasterVolume } from "./SoundEffects";

export const LOW_HP_THRESHOLD = 0.3;
const MUSIC_GAIN = 0.55;

export interface CombatLowHpMusic {
  update(allyRatio: number, enemyRatio: number): void;
  dispose(): void;
}

export function createCombatLowHpMusic(options: {
  settings: SettingsStore;
  allySrc: string;
  enemySrc: string;
}): CombatLowHpMusic {
  let settings = options.settings.get();
  let current: "ally" | "enemy" | null = null;
  let last: "ally" | "enemy" | null = null;
  const triggered = { ally: false, enemy: false };
  let disposed = false;
  const audio = { ally: null as HTMLAudioElement | null, enemy: null as HTMLAudioElement | null };
  const unsub = options.settings.subscribe((next) => {
    settings = next;
    for (const side of ["ally", "enemy"] as const) {
      const el = audio[side];
      if (el) el.volume = MUSIC_GAIN * normalizedMasterVolume(settings);
    }
  });

  const ensure = (side: "ally" | "enemy") => {
    let el = audio[side];
    if (!el) {
      el = new Audio(side === "ally" ? options.allySrc : options.enemySrc);
      el.loop = true;
      audio[side] = el;
    }
    return el;
  };

  const play = (side: "ally" | "enemy") => {
    if (disposed || current === side) return;
    if (current) {
      const prev = audio[current];
      try { prev?.pause(); } catch { /* no-op */ }
    }
    current = side;
    const el = ensure(side);
    el.volume = MUSIC_GAIN * normalizedMasterVolume(settings);
    try { el.currentTime = 0; void el.play().catch(() => { /* autoplay gate */ }); }
    catch { /* no-op */ }
  };

  return {
    update(allyRatio, enemyRatio) {
      if (disposed) return;
      if (!triggered.enemy && enemyRatio <= LOW_HP_THRESHOLD) { triggered.enemy = true; last = "enemy"; }
      if (!triggered.ally && allyRatio <= LOW_HP_THRESHOLD) { triggered.ally = true; last = "ally"; }
      if (last) play(last);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unsub();
      for (const side of ["ally", "enemy"] as const) {
        const el = audio[side];
        if (el) { try { el.pause(); } catch { /* no-op */ } audio[side] = null; }
      }
      current = null;
    },
  };
}
