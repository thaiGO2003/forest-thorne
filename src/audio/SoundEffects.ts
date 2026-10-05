import type { Settings, SettingsStore } from "../core/settings";

export const SEMANTIC_SFX_EVENTS = [
  "hit", "skill", "buy", "reroll", "victory", "defeat", "draw", "heal", "ko", "click",
] as const;

export type SemanticSfxEvent = (typeof SEMANTIC_SFX_EVENTS)[number];

const EVENT_SET = new Set<string>(SEMANTIC_SFX_EVENTS);
const SFX_ALIASES: Readonly<Record<string, SemanticSfxEvent>> = {
  attack: "hit",
  shop_buy: "buy",
  buy_unit: "buy",
  shop_reroll: "reroll",
  win: "victory",
  lose: "defeat",
  loss: "defeat",
};

const FALLBACK_FREQUENCIES: Readonly<Record<SemanticSfxEvent, number>> = {
  hit: 180,
  skill: 360,
  buy: 520,
  reroll: 420,
  victory: 660,
  defeat: 130,
  draw: 260,
  heal: 540,
  ko: 95,
  click: 300,
};

export interface SfxSamplePlayer {
  has(key: string): boolean;
  play(key: string, volume: number): void | Promise<void>;
}

export interface SfxOscillatorNodeLike {
  type: OscillatorType;
  frequency: { value: number };
  connect(destination: unknown): unknown;
  start(when?: number): void;
  stop(when?: number): void;
}

export interface SfxGainNodeLike {
  gain: {
    setValueAtTime(value: number, time: number): void;
    exponentialRampToValueAtTime(value: number, time: number): void;
  };
  connect(destination: unknown): unknown;
}

export interface SfxAudioContextLike {
  readonly currentTime: number;
  readonly destination: unknown;
  readonly state?: string;
  resume?(): void | Promise<void>;
  close?(): void | Promise<void>;
  createOscillator(): SfxOscillatorNodeLike;
  createGain(): SfxGainNodeLike;
}

export interface UnitSfxProfile {
  sampleKey?: string;
  waveform?: OscillatorType;
  pitchMultiplier?: number;
  gainMultiplier?: number;
}

export type SfxPlaybackKind = "sample" | "oscillator" | "none";

export interface SemanticSfxManager {
  play(event: string, profile?: UnitSfxProfile): Promise<SfxPlaybackKind>;
  dispose(): void;
}

export interface SemanticSfxOptions {
  settings: SettingsStore;
  samples?: SfxSamplePlayer;
  eventSamples?: Partial<Record<SemanticSfxEvent, string>>;
  createAudioContext?: () => SfxAudioContextLike | null;
}

export function normalizeSemanticSfxEvent(event: string): SemanticSfxEvent | null {
  const normalized = event.trim().toLowerCase();
  if (EVENT_SET.has(normalized)) return normalized as SemanticSfxEvent;
  return SFX_ALIASES[normalized] ?? null;
}

export function normalizedMasterVolume(settings: Pick<Settings, "audioEnabled" | "audioMuted" | "volumeLevel">): number {
  if (!settings.audioEnabled || settings.audioMuted) return 0;
  return Math.min(1, Math.max(0, settings.volumeLevel / 10));
}

function defaultAudioContextFactory(): SfxAudioContextLike | null {
  const root = globalThis as typeof globalThis & {
    AudioContext?: new () => AudioContext;
    webkitAudioContext?: new () => AudioContext;
  };
  const AudioContextCtor = root.AudioContext ?? root.webkitAudioContext;
  return AudioContextCtor ? new AudioContextCtor() : null;
}

function finitePositive(value: number | undefined, fallback = 1): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

export function createSemanticSfxManager(options: SemanticSfxOptions): SemanticSfxManager {
  let currentSettings = options.settings.get();
  let context: SfxAudioContextLike | null | undefined;
  let disposed = false;
  const unsubscribe = options.settings.subscribe((next) => { currentSettings = next; });

  const getContext = () => {
    if (context !== undefined) return context;
    try { context = (options.createAudioContext ?? defaultAudioContextFactory)(); }
    catch { context = null; }
    return context;
  };

  return {
    async play(rawEvent, profile = {}) {
      if (disposed) return "none";
      const event = normalizeSemanticSfxEvent(rawEvent);
      if (!event) return "none";

      const master = normalizedMasterVolume(currentSettings);
      if (master <= 0) return "none";
      const baseGain = event === "ko" ? 0.8 : 0.6;
      const gain = Math.min(1, master * baseGain * finitePositive(profile.gainMultiplier));
      const sampleKey = profile.sampleKey ?? options.eventSamples?.[event];

      if (sampleKey && options.samples?.has(sampleKey)) {
        try {
          await options.samples.play(sampleKey, gain);
          return "sample";
        } catch {
          // A failed sample remains eligible for the procedural fallback.
        }
      }

      const audioContext = getContext();
      if (!audioContext) return "none";
      try {
        if (audioContext.state === "suspended") await audioContext.resume?.();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        const now = audioContext.currentTime;
        oscillator.type = profile.waveform ?? "sine";
        oscillator.frequency.value = FALLBACK_FREQUENCIES[event] * finitePositive(profile.pitchMultiplier);
        gainNode.gain.setValueAtTime(Math.max(0.0001, gain), now);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.08);
        return "oscillator";
      } catch {
        return "none";
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      const ownedContext = context;
      context = null;
      if (ownedContext) {
        try { void ownedContext.close?.(); } catch { /* no-op */ }
      }
    },
  };
}
