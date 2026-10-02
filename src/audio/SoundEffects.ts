import type { Settings, SettingsStore } from "../core/settings";
import {
  DEFAULT_UNIT_SFX_PROFILE,
  resolveUnitSfxProfile,
  type UnitSfxProfile,
} from "../data/unitSfxProfiles";

export const SFX_EVENTS = [
  "hit", "skill", "buy", "reroll", "victory", "defeat", "draw", "heal", "ko", "click",
] as const;
export type SemanticSfxEvent = (typeof SFX_EVENTS)[number];

const SFX_ALIASES: Readonly<Record<string, SemanticSfxEvent>> = {
  attack: "hit",
  shop_buy: "buy",
  buy_unit: "buy",
  shop_reroll: "reroll",
  win: "victory",
  lose: "defeat",
  loss: "defeat",
};

export const SFX_FALLBACK_FREQUENCY: Readonly<Record<SemanticSfxEvent, number>> = {
  hit: 170,
  skill: 420,
  buy: 620,
  reroll: 520,
  victory: 760,
  defeat: 135,
  draw: 310,
  heal: 540,
  ko: 95,
  click: 360,
};

export const DEFAULT_SFX_SAMPLE_KEYS: Readonly<Record<SemanticSfxEvent, string>> = {
  hit: "sfx_hit",
  skill: "sfx_skill",
  buy: "sfx_buy",
  reroll: "sfx_reroll",
  victory: "sfx_victory",
  defeat: "sfx_defeat",
  draw: "sfx_draw",
  heal: "sfx_heal",
  ko: "sfx_ko",
  click: "sfx_click",
};

export interface SamplePlayback {
  has(key: string): boolean;
  play(key: string, volume: number, pitch: number): boolean;
}

export interface SoundEffectsOptions {
  settings: Pick<SettingsStore, "get">;
  samples?: SamplePlayback | null;
  audioContext?: AudioContext | null;
  sampleKeys?: Partial<Record<SemanticSfxEvent, string>>;
}

export function normalizeSfxEvent(value: unknown): SemanticSfxEvent | null {
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase();
  if ((SFX_EVENTS as readonly string[]).includes(key)) return key as SemanticSfxEvent;
  return SFX_ALIASES[key] ?? null;
}

export function normalizedMasterVolume(settings: Pick<Settings, "audioEnabled" | "audioMuted" | "volumeLevel">): number {
  if (!settings.audioEnabled || settings.audioMuted) return 0;
  return Math.min(1, Math.max(0, settings.volumeLevel / 10));
}

function createDefaultAudioContext(): AudioContext | null {
  if (typeof AudioContext === "undefined") return null;
  try {
    return new AudioContext();
  } catch {
    return null;
  }
}

export class SoundEffects {
  private readonly settings: Pick<SettingsStore, "get">;
  private readonly samples: SamplePlayback | null;
  private readonly sampleKeys: Readonly<Record<SemanticSfxEvent, string>>;
  private readonly ownsAudioContext: boolean;
  private audioContext: AudioContext | null | undefined;

  constructor(options: SoundEffectsOptions) {
    this.settings = options.settings;
    this.samples = options.samples ?? null;
    this.ownsAudioContext = options.audioContext === undefined;
    this.audioContext = options.audioContext;
    this.sampleKeys = { ...DEFAULT_SFX_SAMPLE_KEYS, ...options.sampleKeys };
  }

  play(
    eventLike: SemanticSfxEvent | string,
    options: { unitId?: string | null; profile?: UnitSfxProfile | null } = {},
  ): boolean {
    const event = normalizeSfxEvent(eventLike);
    if (!event) return false;
    const master = normalizedMasterVolume(this.settings.get());
    if (master <= 0) return false;
    const profile = options.profile
      ?? (options.unitId ? resolveUnitSfxProfile(options.unitId) : DEFAULT_UNIT_SFX_PROFILE);
    const base = event === "ko" ? 0.95 : 0.7;
    const volume = Math.min(1, master * base);
    const sampleKey = this.sampleKeys[event];
    if (this.samples?.has(sampleKey)) {
      try {
        if (this.samples.play(sampleKey, volume, profile.pitch)) return true;
      } catch {
        // Fall through to the oscillator path.
      }
    }
    return this.playFallbackTone(event, volume, profile);
  }

  dispose(): void {
    if (this.ownsAudioContext && this.audioContext && this.audioContext.state !== "closed") {
      void this.audioContext.close().catch(() => undefined);
    }
    this.audioContext = null;
  }

  private playFallbackTone(
    event: SemanticSfxEvent,
    volume: number,
    profile: UnitSfxProfile,
  ): boolean {
    const context = this.audioContext === undefined
      ? (this.audioContext = createDefaultAudioContext())
      : this.audioContext;
    if (!context) return false;
    try {
      if (context.state === "suspended") void context.resume().catch(() => undefined);
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = profile.waveform;
      oscillator.frequency.value = SFX_FALLBACK_FREQUENCY[event] * profile.pitch;
      gain.gain.setValueAtTime(Math.min(0.16, volume * 0.16), context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.08);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.085);
      return true;
    } catch {
      return false;
    }
  }
}
