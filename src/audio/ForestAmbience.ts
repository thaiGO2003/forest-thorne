import type { SettingsStore } from "../core/settings";
import { normalizedMasterVolume } from "./SoundEffects";

export interface ForestAmbience {
  setActive(active: boolean): void;
  dispose(): void;
}

export interface ForestAmbienceEventTarget {
  readonly hidden?: boolean;
  addEventListener(type: "pointerdown" | "keydown" | "visibilitychange", listener: () => void): void;
  removeEventListener(type: "pointerdown" | "keydown" | "visibilitychange", listener: () => void): void;
}

export interface ForestAmbienceOptions {
  settings: SettingsStore;
  createAudioContext?: () => AudioContext | null;
  eventTarget?: ForestAmbienceEventTarget | null;
  random?: () => number;
}

interface AmbientVoice {
  source: AudioScheduledSourceNode;
  nodes: AudioNode[];
  timer: number | NodeJS.Timeout | undefined;
}

const MAX_AMBIENT_VOICES = 4;
const BREEZE_SECONDS = 1.4;

function defaultAudioContext(): AudioContext | null {
  const root = globalThis as typeof globalThis & {
    webkitAudioContext?: new () => AudioContext;
  };
  const Ctor = root.AudioContext ?? root.webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

export function createForestAmbience(options: ForestAmbienceOptions): ForestAmbience {
  const target = options.eventTarget === undefined
    ? (typeof document === "undefined" ? null : document as ForestAmbienceEventTarget)
    : options.eventTarget;
  const random = options.random ?? Math.random;
  let settings = options.settings.get();
  let desiredActive = false;
  let disposed = false;
  let unlocked = false;
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let breezeBuffer: AudioBuffer | null = null;
  let tickTimer: number | NodeJS.Timeout | undefined;
  let resumeInFlight = false;
  let suspendInFlight = false;
  let gesturesInstalled = false;
  const voices = new Set<AmbientVoice>();

  const wanted = () => !disposed && desiredActive && !target?.hidden
    && settings.ambientEnabled && normalizedMasterVolume(settings) > 0;

  const clearTick = () => {
    clearTimeout(tickTimer);
    tickTimer = undefined;
  };

  const releaseVoice = (voice: AmbientVoice, stop: boolean) => {
    if (!voices.delete(voice)) return;
    clearTimeout(voice.timer);
    voice.source.onended = null;
    if (stop) {
      try { voice.source.stop(); } catch { /* already ended */ }
    }
    for (const node of voice.nodes) {
      try { node.disconnect(); } catch { /* browser/context already closed */ }
    }
  };

  const stopVoices = () => {
    clearTick();
    for (const voice of voices) releaseVoice(voice, true);
  };

  const removeGestures = () => {
    if (!gesturesInstalled || !target) return;
    target.removeEventListener("pointerdown", onGesture);
    target.removeEventListener("keydown", onGesture);
    gesturesInstalled = false;
  };

  const installGestures = () => {
    if (gesturesInstalled || !target || !wanted()) return;
    target.addEventListener("pointerdown", onGesture);
    target.addEventListener("keydown", onGesture);
    gesturesInstalled = true;
  };

  const setMasterVolume = () => {
    if (!context || !master) return;
    try {
      // Sparse wildlife/breeze details should sit well beneath music and interaction SFX.
      master.gain.setTargetAtTime(normalizedMasterVolume(settings) * 0.16, context.currentTime, 0.12);
    } catch { /* context may have been closed externally */ }
  };

  const trackVoice = (source: AudioScheduledSourceNode, nodes: AudioNode[], seconds: number) => {
    const voice: AmbientVoice = { source, nodes, timer: undefined };
    voices.add(voice);
    source.onended = () => releaseVoice(voice, false);
    // Safari/host stubs can miss onended; a finite fallback still bounds every node.
    voice.timer = setTimeout(() => releaseVoice(voice, false), Math.ceil(seconds * 1000) + 350);
    return voice;
  };

  const playBird = (audio: AudioContext, bus: GainNode) => {
    let oscillator: OscillatorNode | null = null;
    let envelope: GainNode | null = null;
    let tracked: AmbientVoice | null = null;
    try {
      const now = audio.currentTime;
      const duration = 0.22 + random() * 0.2;
      const base = 560 + random() * 610;
      oscillator = audio.createOscillator();
      envelope = audio.createGain();
      oscillator.type = random() < 0.75 ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(base, now);
      oscillator.frequency.exponentialRampToValueAtTime(base * (1.1 + random() * 0.25), now + duration * 0.42);
      oscillator.frequency.exponentialRampToValueAtTime(base * (0.88 + random() * 0.12), now + duration);
      envelope.gain.setValueAtTime(0.0001, now);
      envelope.gain.linearRampToValueAtTime(0.06 + random() * 0.045, now + duration * 0.22);
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(envelope);
      envelope.connect(bus);
      tracked = trackVoice(oscillator, [oscillator, envelope], duration);
      oscillator.start(now);
      oscillator.stop(now + duration);
    } catch {
      if (tracked) releaseVoice(tracked, true);
      else {
        try { oscillator?.stop(); } catch { /* source not started */ }
        try { oscillator?.disconnect(); } catch { /* no-op */ }
        try { envelope?.disconnect(); } catch { /* no-op */ }
      }
    }
  };

  const playBreeze = (audio: AudioContext, bus: GainNode) => {
    if (!breezeBuffer) return;
    let source: AudioBufferSourceNode | null = null;
    let filter: BiquadFilterNode | null = null;
    let envelope: GainNode | null = null;
    let tracked: AmbientVoice | null = null;
    try {
      const now = audio.currentTime;
      source = audio.createBufferSource();
      source.buffer = breezeBuffer;
      filter = audio.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 320 + random() * 480;
      filter.Q.value = 0.35;
      envelope = audio.createGain();
      envelope.gain.setValueAtTime(0.0001, now);
      envelope.gain.linearRampToValueAtTime(0.025, now + 0.48);
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + BREEZE_SECONDS);
      source.connect(filter);
      filter.connect(envelope);
      envelope.connect(bus);
      tracked = trackVoice(source, [source, filter, envelope], BREEZE_SECONDS);
      source.start(now, 0, BREEZE_SECONDS);
      source.stop(now + BREEZE_SECONDS);
    } catch {
      if (tracked) releaseVoice(tracked, true);
      else {
        try { source?.stop(); } catch { /* source not started */ }
        try { source?.disconnect(); } catch { /* no-op */ }
        try { filter?.disconnect(); } catch { /* no-op */ }
        try { envelope?.disconnect(); } catch { /* no-op */ }
      }
    }
  };

  const scheduleNext = () => {
    clearTick();
    if (!wanted() || !unlocked || !context || context.state !== "running" || !master) return;
    tickTimer = setTimeout(() => {
      tickTimer = undefined;
      if (!wanted() || !context || context.state !== "running" || !master) return;
      if (voices.size < MAX_AMBIENT_VOICES) {
        if (random() < 0.2) playBreeze(context, master);
        else playBird(context, master);
      }
      scheduleNext();
    }, 2200 + random() * 5200);
  };

  const releaseClosedContext = () => {
    if (context?.state !== "closed") return;
    const closed = context;
    stopVoices();
    closed.removeEventListener("statechange", sync);
    try { master?.disconnect(); } catch { /* closed context */ }
    context = null;
    master = null;
    breezeBuffer = null;
    unlocked = false;
    resumeInFlight = false;
    suspendInFlight = false;
  };

  const sync = () => {
    if (disposed) return;
    releaseClosedContext();
    if (!wanted()) {
      removeGestures();
      stopVoices();
      if (master && context) {
        try { master.gain.setValueAtTime(0, context.currentTime); } catch { /* no-op */ }
      }
      if (context?.state === "running" && !suspendInFlight) {
        const audio = context;
        suspendInFlight = true;
        try {
          void Promise.resolve(audio.suspend()).catch(() => {}).finally(() => {
            if (disposed || context !== audio) return;
            suspendInFlight = false;
            if (wanted()) sync();
          });
        } catch { suspendInFlight = false; }
      }
      return;
    }
    setMasterVolume();
    if (!unlocked || !context) {
      installGestures();
      return;
    }
    if (context.state === "running") {
      removeGestures();
      if (!suspendInFlight && tickTimer === undefined) scheduleNext();
    } else if (context.state === "suspended") {
      resumeContext();
    } else {
      stopVoices();
      installGestures();
    }
  };

  const resumeContext = () => {
    if (!context || !wanted() || resumeInFlight || disposed) return;
    const audio = context;
    resumeInFlight = true;
    try {
      Promise.resolve(audio.resume()).then(() => {
        if (disposed || context !== audio) return;
        resumeInFlight = false;
        if (audio.state === "running") {
          unlocked = true;
          sync();
        } else {
          stopVoices();
          installGestures();
        }
      }).catch(() => {
        if (disposed || context !== audio) return;
        resumeInFlight = false;
        if (context === audio) {
          stopVoices();
          installGestures();
        }
      });
    } catch {
      resumeInFlight = false;
      stopVoices();
      installGestures();
    }
  };

  function onGesture() {
    if (!wanted() || disposed) return;
    releaseClosedContext();
    if (!context) {
      try {
        context = (options.createAudioContext ?? defaultAudioContext)();
        if (!context) return;
        master = context.createGain();
        master.gain.value = 0;
        master.connect(context.destination);
        // One reusable burst of shaped noise: short, occasional breezes rather than a looping hiss.
        breezeBuffer = context.createBuffer(1, Math.ceil(context.sampleRate * BREEZE_SECONDS), context.sampleRate);
        const samples = breezeBuffer.getChannelData(0);
        let previous = 0;
        for (let i = 0; i < samples.length; i++) {
          previous = previous * 0.78 + (random() * 2 - 1) * 0.22;
          samples[i] = previous;
        }
        context.addEventListener("statechange", sync);
      } catch {
        try { master?.disconnect(); } catch { /* no-op */ }
        try { void Promise.resolve(context?.close()).catch(() => {}); } catch { /* no-op */ }
        context = null;
        master = null;
        breezeBuffer = null;
        return;
      }
    }
    if (context.state === "running") {
      unlocked = true;
      sync();
    } else {
      resumeContext();
    }
  }

  const unsubscribe = options.settings.subscribe((next) => {
    settings = next;
    sync();
  });
  target?.addEventListener("visibilitychange", sync);

  return {
    setActive(active) {
      if (disposed || desiredActive === active) return;
      desiredActive = active;
      sync();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      target?.removeEventListener("visibilitychange", sync);
      removeGestures();
      context?.removeEventListener("statechange", sync);
      stopVoices();
      try { master?.disconnect(); } catch { /* no-op */ }
      try { void Promise.resolve(context?.close()).catch(() => {}); } catch { /* no-op */ }
      context = null;
      master = null;
      breezeBuffer = null;
    },
  };
}
