interface SpeechApiResult {
  speechSynthesis: SpeechSynthesis;
  SpeechUtterance: typeof SpeechSynthesisUtterance;
}

interface WindowWithSpeech extends Window {
  __speechVoicesHooked?: boolean;
  SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance;
}

function resolveBrowserSpeechApi(win: WindowWithSpeech | Window | null | undefined): SpeechApiResult | null {
  const winWithSpeech = win as WindowWithSpeech | null | undefined;
  const speechSynthesis = winWithSpeech?.speechSynthesis;
  const SpeechUtterance = winWithSpeech?.SpeechSynthesisUtterance ?? globalThis.SpeechSynthesisUtterance;
  if (!speechSynthesis || typeof speechSynthesis.speak !== "function" || typeof SpeechUtterance !== "function") {
    return null;
  }
  return { speechSynthesis, SpeechUtterance };
}

export function canUseBrowserSpeechSynthesis(win: Window | null | undefined = globalThis.window): boolean {
  return Boolean(resolveBrowserSpeechApi(win));
}

export function resolveBrowserSpeechLang(localeOrLang: string = "vi"): string {
  const raw = String(localeOrLang ?? "").trim().toLowerCase();
  if (!raw) return "vi-VN";
  if (raw.startsWith("vi")) return "vi-VN";
  if (raw.startsWith("en")) return "en-US";
  if (raw.includes("-")) return raw;
  return "vi-VN";
}

function getVoiceLang(voice: SpeechSynthesisVoice | null | undefined): string {
  return String(voice?.lang ?? "").trim().toLowerCase();
}

function getVoiceName(voice: SpeechSynthesisVoice | null | undefined): string {
  return String(voice?.name ?? "").trim();
}

export function pickVoiceForLang(lang: string, voices: SpeechSynthesisVoice[] = []): SpeechSynthesisVoice | null {
  const normalizedLang = resolveBrowserSpeechLang(lang);
  const langLower = normalizedLang.toLowerCase();
  const langPrefix = langLower.split("-")[0];
  const safeVoices = Array.isArray(voices) ? voices.filter(Boolean) : [];

  const pick = (...predicates: Array<(voice: SpeechSynthesisVoice) => boolean>): SpeechSynthesisVoice | null => {
    for (const predicate of predicates) {
      const match = safeVoices.find(predicate);
      if (match) return match;
    }
    return null;
  };

  if (langPrefix === "vi") {
    return pick(
      (voice) => getVoiceLang(voice) === "vi-vn" && voice.localService === true,
      (voice) => getVoiceLang(voice) === "vi-vn",
      (voice) => getVoiceLang(voice).startsWith("vi"),
      (voice) => /vietnamese|ti[eê]ng việt|việt|hoaimy|hoài my/i.test(getVoiceName(voice))
    );
  }

  if (langPrefix === "en") {
    return pick(
      (voice) => getVoiceLang(voice) === "en-us" && voice.localService === true,
      (voice) => getVoiceLang(voice) === "en-us",
      (voice) => getVoiceLang(voice).startsWith("en")
    );
  }

  return pick(
    (voice) => getVoiceLang(voice) === langLower,
    (voice) => getVoiceLang(voice).startsWith(langPrefix)
  );
}

export function pickVietnameseVoice(voices: SpeechSynthesisVoice[] = []): SpeechSynthesisVoice | null {
  return pickVoiceForLang("vi-VN", voices);
}

function ensureVoiceListHook(win: WindowWithSpeech, speechSynthesis: SpeechSynthesis): void {
  if (!speechSynthesis || win.__speechVoicesHooked) return;
  win.__speechVoicesHooked = true;
  const refresh = (): void => {
    speechSynthesis.getVoices?.();
  };
  speechSynthesis.addEventListener?.("voiceschanged", refresh);
  refresh();
}

function readSpeechVoices(speechSynthesis: SpeechSynthesis, win: WindowWithSpeech): SpeechSynthesisVoice[] {
  ensureVoiceListHook(win, speechSynthesis);
  return typeof speechSynthesis.getVoices === "function"
    ? speechSynthesis.getVoices().filter(Boolean)
    : [];
}

interface DeliverSpeechOptions {
  cancelCurrent?: boolean;
}

function deliverSpeech(speechSynthesis: SpeechSynthesis, utterance: SpeechSynthesisUtterance, options: DeliverSpeechOptions = {}): void {
  const { cancelCurrent = true } = options;
  if (cancelCurrent && typeof speechSynthesis.cancel === "function") {
    speechSynthesis.cancel();
  }
  speechSynthesis.speak(utterance);
}

interface BuildUtteranceOptions {
  lang: string;
  rate: number;
  pitch: number;
  volume: number;
  voice: SpeechSynthesisVoice | null;
}

function buildUtterance(
  SpeechUtterance: { new (text: string): SpeechSynthesisUtterance },
  text: string,
  options: BuildUtteranceOptions
): SpeechSynthesisUtterance {
  const { lang, rate, pitch, volume, voice } = options;
  const utterance = new SpeechUtterance(text);
  utterance.lang = lang;
  utterance.rate = rate;
  utterance.pitch = pitch;
  utterance.volume = volume;
  if (voice) {
    utterance.voice = voice;
    if (voice.lang) utterance.lang = voice.lang;
  }
  return utterance;
}

interface SpeakWithBrowserVoiceOptions {
  win?: Window | null | undefined;
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  cancelCurrent?: boolean;
}

export function speakWithBrowserVoice(text: string, options: SpeakWithBrowserVoiceOptions = {}): boolean {
  const {
    win = globalThis.window,
    lang = "vi-VN",
    rate = 1,
    pitch = 1,
    volume = 1,
    cancelCurrent = true
  } = options;

  const safeText = String(text ?? "").trim();
  if (!safeText) return false;
  const api = resolveBrowserSpeechApi(win);
  if (!api) return false;

  const { speechSynthesis, SpeechUtterance } = api;
  const typedWin = (win ?? globalThis.window) as WindowWithSpeech;
  const resolvedLang = resolveBrowserSpeechLang(lang);
  const numericRate = Number.isFinite(rate) ? rate : 1;
  const numericPitch = Number.isFinite(pitch) ? pitch : 1;
  const numericVolume = Number.isFinite(volume) ? volume : 1;

  let usedPreferredVoice = false;
  const speakTracked = (): boolean => {
    const voices = readSpeechVoices(speechSynthesis, typedWin);
    const preferredVoice = pickVoiceForLang(resolvedLang, voices);
    const utterance = buildUtterance(SpeechUtterance, safeText, {
      lang: preferredVoice?.lang ?? resolvedLang,
      rate: numericRate,
      pitch: numericPitch,
      volume: numericVolume,
      voice: preferredVoice ?? null
    });
    try {
      deliverSpeech(speechSynthesis, utterance, { cancelCurrent });
      if (preferredVoice) usedPreferredVoice = true;
      return true;
    } catch {
      return false;
    }
  };

  const voices = readSpeechVoices(speechSynthesis, typedWin);
  if (voices.length > 0 || typeof speechSynthesis.addEventListener !== "function") {
    return speakTracked();
  }

  const onVoicesChanged = (): void => {
    speechSynthesis.removeEventListener?.("voiceschanged", onVoicesChanged);
    if (!usedPreferredVoice) {
      speakTracked();
    }
  };
  speechSynthesis.addEventListener("voiceschanged", onVoicesChanged);
  return speakTracked();
}

export function warmupBrowserSpeechVoices(win: Window | null | undefined = globalThis.window): boolean {
  const api = resolveBrowserSpeechApi(win);
  if (!api) return false;
  readSpeechVoices(api.speechSynthesis, (win ?? globalThis.window) as WindowWithSpeech);
  return true;
}
