import type { Settings, SettingsStore } from "../core/settings";

export const SEMANTIC_SFX_EVENTS = [
  "hit", "skill", "buy", "reroll", "victory", "defeat", "draw", "heal", "ko", "click",
] as const;

export type SemanticSfxEvent = (typeof SEMANTIC_SFX_EVENTS)[number];

const EVENT_SET = new Set<string>(SEMANTIC_SFX_EVENTS);
const UI_SFX_EVENTS: Partial<Record<SemanticSfxEvent, true>> = { buy: true, reroll: true, click: true };
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
  onended?: ((this: AudioScheduledSourceNode, event: Event) => void) | null;
  connect(destination: unknown): unknown;
  disconnect?(): void;
  start(when?: number): void;
  stop(when?: number): void;
}

export interface SfxGainNodeLike {
  gain: {
    setValueAtTime(value: number, time: number): void;
    exponentialRampToValueAtTime(value: number, time: number): void;
  };
  connect(destination: unknown): unknown;
  disconnect?(): void;
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

const MAX_SFX_VOICES = 12;
const SFX_DURATION_SECONDS = 0.08;

export function createSemanticSfxManager(options: SemanticSfxOptions): SemanticSfxManager {
  let currentSettings = options.settings.get();
  let context: SfxAudioContextLike | null | undefined;
  let disposed = false;
  interface Voice {
    oscillator: SfxOscillatorNodeLike;
    category: "ui" | "combat";
    gain: SfxGainNodeLike;
    timer: number | NodeJS.Timeout | undefined;
  }
  const voices = new Set<Voice>();

  const releaseVoice = (voice: Voice, stop: boolean) => {
    if (!voices.delete(voice)) return;
    clearTimeout(voice.timer);
    voice.oscillator.onended = null;
    if (stop) {
      try { voice.oscillator.stop(); } catch { /* already stopped or never started */ }
    }
    try { voice.oscillator.disconnect?.(); } catch { /* no-op */ }
    try { voice.gain.disconnect?.(); } catch { /* no-op */ }
  };
  const stopVoices = () => {
    for (const voice of voices) releaseVoice(voice, true);
  };
  const unsubscribe = options.settings.subscribe((next) => {
    currentSettings = next;
    if (normalizedMasterVolume(next) <= 0) stopVoices();
    else for (const voice of voices) {
      if (!(voice.category === "ui" ? next.uiSfxEnabled : next.combatSfxEnabled)) releaseVoice(voice, true);
    }
  });
  const categoryEnabled = (category: "ui" | "combat") => normalizedMasterVolume(currentSettings) > 0
    && (category === "ui" ? currentSettings.uiSfxEnabled : currentSettings.combatSfxEnabled);

  const getContext = () => {
    if (context?.state === "closed") {
      stopVoices();
      context = null;
    }
    if (context) return context;
    try { context = (options.createAudioContext ?? defaultAudioContextFactory)(); }
    catch { context = null; }
    return context;
  };

  return {
    async play(rawEvent, profile = {}) {
      if (disposed) return "none";
      const event = normalizeSemanticSfxEvent(rawEvent);
      if (!event) return "none";
      const category = UI_SFX_EVENTS[event] ? "ui" : "combat";
      if (!categoryEnabled(category)) return "none";
      const baseGain = event === "ko" ? 0.8 : 0.6;
      const sampleKey = profile.sampleKey ?? options.eventSamples?.[event];
      if (sampleKey && options.samples) {
        try {
          if (options.samples.has(sampleKey)) {
            const gain = Math.min(1, normalizedMasterVolume(currentSettings) * baseGain * finitePositive(profile.gainMultiplier));
            await options.samples.play(sampleKey, gain);
            return disposed || !categoryEnabled(category) ? "none" : "sample";
          }
        } catch {
          // A failed sample lookup/play remains eligible for procedural fallback.
        }
      }
      if (disposed || !categoryEnabled(category)) return "none";

      const audioContext = getContext();
      if (!audioContext || audioContext.state === "closed") return "none";
      try {
        if (audioContext.state === "suspended") await audioContext.resume?.();
      } catch {
        return "none";
      }
      // resume() can settle after disposal, muting, or a different settings update.
      if (disposed || !categoryEnabled(category) || audioContext.state === "closed") return "none";
      if (voices.size >= MAX_SFX_VOICES) return "none";

      let oscillator: SfxOscillatorNodeLike | null = null;
      let gainNode: SfxGainNodeLike | null = null;
      let voice: Voice | null = null;
      try {
        oscillator = audioContext.createOscillator();
        gainNode = audioContext.createGain();
        const now = audioContext.currentTime;
        const gain = Math.min(1, normalizedMasterVolume(currentSettings) * baseGain * finitePositive(profile.gainMultiplier));
        oscillator.type = profile.waveform ?? "sine";
        oscillator.frequency.value = FALLBACK_FREQUENCIES[event] * finitePositive(profile.pitchMultiplier);
        gainNode.gain.setValueAtTime(Math.max(0.0001, gain), now);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + SFX_DURATION_SECONDS);
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        const startedVoice: Voice = { oscillator, gain: gainNode, timer: undefined, category };
        voice = startedVoice;
        oscillator.onended = () => releaseVoice(startedVoice, false);
        voices.add(startedVoice);
        oscillator.start(now);
        oscillator.stop(now + SFX_DURATION_SECONDS);
        // Also release mocks and implementations that fail to dispatch "ended".
        if (voices.has(startedVoice)) {
          startedVoice.timer = setTimeout(() => releaseVoice(startedVoice, false), SFX_DURATION_SECONDS * 1000 + 250);
        }
        return "oscillator";
      } catch {
        if (voice) {
          releaseVoice(voice, true);
        } else {
          try { oscillator?.stop(); } catch { /* no-op */ }
          try { oscillator?.disconnect?.(); } catch { /* no-op */ }
          try { gainNode?.disconnect?.(); } catch { /* no-op */ }
        }
        return "none";
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      stopVoices();
      const ownedContext = context;
      context = null;
      if (ownedContext) {
        try { void Promise.resolve(ownedContext.close?.()).catch(() => {}); } catch { /* no-op */ }
      }
    },
  };
}
