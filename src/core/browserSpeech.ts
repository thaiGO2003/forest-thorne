// Browser speech capability and voice selection (mega prompt A49.3).

export interface BrowserSpeechOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  cancelCurrent?: boolean;
}

export interface BrowserSpeechEnvironment {
  synthesis?: Pick<SpeechSynthesis, "getVoices" | "speak" | "cancel" | "addEventListener" | "removeEventListener"> | null;
  Utterance?: typeof SpeechSynthesisUtterance | null;
}

const finiteOrOne = (value: unknown): number => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 1;
};

export function normalizeSpeechLanguage(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "vi-VN";
  const lang = value.trim();
  const lower = lang.toLowerCase();
  if (lower.startsWith("vi")) return "vi-VN";
  if (lower.startsWith("en")) return "en-US";
  if (lang.includes("-")) return lang;
  return "vi-VN";
}

function normalizedVoiceLang(voice: SpeechSynthesisVoice): string {
  return voice.lang.trim().toLowerCase();
}

function vietnameseNameFallback(name: string): boolean {
  const lower = name.toLowerCase();
  const words = lower.split(/[^a-z]+/).filter(Boolean);
  return lower.includes("vietnam")
    || lower.includes("viet")
    || lower.includes("linh")
    || lower.includes("hoai")
    || words.includes("an")
    || words.includes("mai");
}

function englishNameFallback(name: string): boolean {
  return /(english|us english|american)/i.test(name);
}

export function selectBrowserVoice(
  voices: readonly SpeechSynthesisVoice[],
  language: unknown,
): SpeechSynthesisVoice | null {
  const lang = normalizeSpeechLanguage(language);
  const exact = lang.toLowerCase();
  const prefix = exact.split("-")[0]!;
  const exactLocal = voices.find((voice) => normalizedVoiceLang(voice) === exact && voice.localService);
  if (exactLocal) return exactLocal;
  const exactAny = voices.find((voice) => normalizedVoiceLang(voice) === exact);
  if (exactAny) return exactAny;
  const prefixAny = voices.find((voice) => normalizedVoiceLang(voice).startsWith(prefix));
  if (prefixAny) return prefixAny;
  if (prefix === "vi") return voices.find((voice) => vietnameseNameFallback(voice.name)) ?? null;
  if (prefix === "en") return voices.find((voice) => englishNameFallback(voice.name)) ?? null;
  return null;
}

function defaultSpeechEnvironment(): BrowserSpeechEnvironment {
  return {
    synthesis: typeof speechSynthesis !== "undefined" ? speechSynthesis : null,
    Utterance: typeof SpeechSynthesisUtterance !== "undefined" ? SpeechSynthesisUtterance : null,
  };
}

function buildUtterance(
  text: string,
  options: BrowserSpeechOptions,
  synthesis: BrowserSpeechEnvironment["synthesis"],
  Utterance: NonNullable<BrowserSpeechEnvironment["Utterance"]>,
): SpeechSynthesisUtterance {
  const utterance = new Utterance(text);
  utterance.lang = normalizeSpeechLanguage(options.lang);
  utterance.rate = finiteOrOne(options.rate);
  utterance.pitch = finiteOrOne(options.pitch);
  utterance.volume = finiteOrOne(options.volume);
  const voice = synthesis ? selectBrowserVoice(synthesis.getVoices(), utterance.lang) : null;
  if (voice) utterance.voice = voice;
  return utterance;
}

export function speakWithBrowserVoice(
  text: unknown,
  options: BrowserSpeechOptions = {},
  environment: BrowserSpeechEnvironment = defaultSpeechEnvironment(),
): boolean {
  const normalizedText = typeof text === "string" ? text.trim() : "";
  const synthesis = environment.synthesis;
  const Utterance = environment.Utterance;
  if (!normalizedText || !synthesis || typeof synthesis.speak !== "function" || !Utterance) return false;

  const resolved: BrowserSpeechOptions = {
    lang: options.lang ?? "vi-VN",
    rate: options.rate ?? 1,
    pitch: options.pitch ?? 1,
    volume: options.volume ?? 1,
    cancelCurrent: options.cancelCurrent ?? true,
  };

  try {
    if (resolved.cancelCurrent !== false) synthesis.cancel();
    const utterance = buildUtterance(normalizedText, resolved, synthesis, Utterance);
    synthesis.speak(utterance);

    if (synthesis.getVoices().length === 0 && typeof synthesis.addEventListener === "function") {
      const retry = () => {
        synthesis.removeEventListener?.("voiceschanged", retry);
        try {
          const retryUtterance = buildUtterance(normalizedText, resolved, synthesis, Utterance);
          synthesis.speak(retryUtterance);
        } catch {
          // Immediate utterance already succeeded; asynchronous voice retry is best-effort.
        }
      };
      synthesis.addEventListener("voiceschanged", retry, { once: true });
    }
    return true;
  } catch {
    return false;
  }
}

export function warmBrowserVoices(
  environment: BrowserSpeechEnvironment = defaultSpeechEnvironment(),
): boolean {
  try {
    if (!environment.synthesis) return false;
    environment.synthesis.getVoices();
    return true;
  } catch {
    return false;
  }
}
