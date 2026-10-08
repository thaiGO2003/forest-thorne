import { describe, expect, it } from "vitest";
import {
  HAPTICS_KEY,
  HAPTIC_PATTERNS,
  loadHapticsEnabled,
  saveHapticsEnabled,
  triggerHaptic,
} from "../src/app/Haptics";
import {
  normalizeSpeechLanguage,
  selectBrowserVoice,
  speakWithBrowserVoice,
  warmBrowserVoices,
  type BrowserSpeechEnvironment,
} from "../src/core/browserSpeech";

class MemoryStore {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function makeVoice(name: string, lang: string, localService = false): SpeechSynthesisVoice {
  return {
    default: false,
    lang,
    localService,
    name,
    voiceURI: name,
  };
}

class FakeUtterance {
  lang = "";
  rate = 0;
  pitch = 0;
  volume = 0;
  voice: SpeechSynthesisVoice | null = null;

  constructor(readonly text: string) {}
}

function speechEnvironment(
  initialVoices: SpeechSynthesisVoice[],
): {
  environment: BrowserSpeechEnvironment;
  spoken: FakeUtterance[];
  cancelled: () => number;
  setVoices(voices: SpeechSynthesisVoice[]): void;
  fireVoicesChanged(): void;
} {
  let voices = initialVoices;
  let cancelCount = 0;
  let listener: EventListenerOrEventListenerObject | null = null;
  const spoken: FakeUtterance[] = [];
  const synthesis = {
    getVoices: () => voices,
    speak: (utterance: SpeechSynthesisUtterance) => {
      spoken.push(utterance as unknown as FakeUtterance);
    },
    cancel: () => {
      cancelCount++;
    },
    addEventListener: (
      type: string,
      callback: EventListenerOrEventListenerObject,
    ) => {
      if (type === "voiceschanged") listener = callback;
    },
    removeEventListener: (
      type: string,
      callback: EventListenerOrEventListenerObject,
    ) => {
      if (type === "voiceschanged" && listener === callback) listener = null;
    },
  } as unknown as NonNullable<BrowserSpeechEnvironment["synthesis"]>;

  return {
    environment: {
      synthesis,
      Utterance: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
    },
    spoken,
    cancelled: () => cancelCount,
    setVoices(next) {
      voices = next;
    },
    fireVoicesChanged() {
      if (!listener) return;
      if (typeof listener === "function") listener(new Event("voiceschanged"));
      else listener.handleEvent(new Event("voiceschanged"));
    },
  };
}

describe("haptics", () => {
  it("defaults enabled and persists the canonical preference", () => {
    const store = new MemoryStore();
    expect(loadHapticsEnabled(store)).toBe(true);
    expect(saveHapticsEnabled(false, store)).toBe(true);
    expect(store.getItem(HAPTICS_KEY)).toBe("false");
    expect(loadHapticsEnabled(store)).toBe(false);
    store.setItem(HAPTICS_KEY, "{bad");
    expect(loadHapticsEnabled(store)).toBe(true);
  });

  it("emits canonical presets and normalized direct patterns", () => {
    const patterns: (number | number[])[] = [];
    const vibrate = (pattern: number | number[]): boolean => {
      patterns.push(pattern);
      return true;
    };
    expect(triggerHaptic("starUpgrade", { vibrate })).toBe(true);
    expect(triggerHaptic([10.4, -2, Number.NaN], { vibrate })).toBe(true);
    expect(patterns).toEqual([
      [...HAPTIC_PATTERNS.starUpgrade],
      [10, 0, 0],
    ]);
  });

  it("is a safe no-op when disabled, unsupported or vibration throws", () => {
    expect(triggerHaptic("tap", { enabled: false, vibrate: () => true })).toBe(false);
    expect(triggerHaptic("tap", { vibrate: null })).toBe(false);
    expect(triggerHaptic("tap", {
      vibrate: () => {
        throw new Error("unsupported");
      },
    })).toBe(false);
  });
});

describe("browser speech", () => {
  it("normalizes language and applies deterministic voice preference", () => {
    expect(normalizeSpeechLanguage("")).toBe("vi-VN");
    expect(normalizeSpeechLanguage("vi")).toBe("vi-VN");
    expect(normalizeSpeechLanguage("en-GB")).toBe("en-US");
    expect(normalizeSpeechLanguage("fr-FR")).toBe("fr-FR");
    expect(normalizeSpeechLanguage("jp")).toBe("vi-VN");

    const remoteExact = makeVoice("Remote Vietnamese", "vi-VN", false);
    const localExact = makeVoice("Local Vietnamese", "vi-VN", true);
    const prefix = makeVoice("Vietnamese Prefix", "vi", true);
    expect(selectBrowserVoice([remoteExact, prefix, localExact], "vi")).toBe(localExact);
    expect(selectBrowserVoice([remoteExact, prefix], "vi")).toBe(remoteExact);
    expect(selectBrowserVoice([prefix], "vi")).toBe(prefix);
    expect(selectBrowserVoice([makeVoice("Mai", "zz-ZZ")], "vi")).toMatchObject({ name: "Mai" });
  });

  it("uses defaults, sanitizes non-finite options and cancels by default", () => {
    const voice = makeVoice("Local Vietnamese", "vi-VN", true);
    const fake = speechEnvironment([voice]);
    expect(speakWithBrowserVoice(" Xin chào ", {
      rate: Number.NaN,
      pitch: Number.POSITIVE_INFINITY,
      volume: Number.NEGATIVE_INFINITY,
    }, fake.environment)).toBe(true);
    expect(fake.cancelled()).toBe(1);
    expect(fake.spoken).toHaveLength(1);
    expect(fake.spoken[0]).toMatchObject({
      text: "Xin chào",
      lang: "vi-VN",
      rate: 1,
      pitch: 1,
      volume: 1,
      voice,
    });

    expect(speakWithBrowserVoice("next", { cancelCurrent: false }, fake.environment)).toBe(true);
    expect(fake.cancelled()).toBe(1);
  });

  it("returns false for blank or unsupported speech and warms without speaking", () => {
    const fake = speechEnvironment([]);
    expect(speakWithBrowserVoice("   ", {}, fake.environment)).toBe(false);
    expect(speakWithBrowserVoice("hello", {}, { synthesis: null, Utterance: null })).toBe(false);
    expect(warmBrowserVoices(fake.environment)).toBe(true);
    expect(fake.spoken).toHaveLength(0);
  });

  it("retries once when voices arrive asynchronously", () => {
    const fake = speechEnvironment([]);
    expect(speakWithBrowserVoice("xin chào", {}, fake.environment)).toBe(true);
    expect(fake.spoken).toHaveLength(1);

    fake.setVoices([makeVoice("Local Vietnamese", "vi-VN", true)]);
    fake.fireVoicesChanged();
    fake.fireVoicesChanged();
    expect(fake.spoken).toHaveLength(2);
    expect(fake.spoken[1]?.voice?.name).toBe("Local Vietnamese");
  });
});
