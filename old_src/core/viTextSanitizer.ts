const BANNED_VI_JARGON_REGEX = /\b(buff|carry|debuff|support|tanker|backline|frontline|ranged|caster|execute|fallback|punish|frontliner|backliner|heal|bruiser)\b|\b(hồi cũ|trước đây|giống bản cũ)\b/i;

type DeepCloneable = string | number | boolean | null | undefined | DeepCloneable[] | { [key: string]: DeepCloneable };

function cloneDeep(value: DeepCloneable): DeepCloneable {
  if (Array.isArray(value)) return value.map(cloneDeep);
  if (value && typeof value === "object") {
    const copy: Record<string, DeepCloneable> = {};
    for (const [key, nested] of Object.entries(value)) copy[key] = cloneDeep(nested);
    return copy;
  }
  return value;
}

function preserveCapitalization(replacement: string, original: string): string {
  if (!replacement) return replacement;
  if (!original) return replacement;
  if (original === original.toUpperCase()) return replacement.toUpperCase();
  const first = original.charAt(0);
  if (first && first === first.toUpperCase()) {
    return `${replacement.charAt(0).toUpperCase()}${replacement.slice(1)}`;
  }
  return replacement;
}

type ReplacementOrFn = string | ((match: string, ...groups: string[]) => string);

function replaceWithCase(text: string, pattern: RegExp, replacement: ReplacementOrFn): string {
  return text.replace(pattern, (...args: string[]) => {
    const match = args[0];
    const resolved = typeof replacement === "function"
      ? replacement(match, ...args.slice(1))
      : replacement;
    return preserveCapitalization(resolved, match);
  });
}

type PhraseReplacement = readonly [RegExp, string];
type WordReplacement = readonly [RegExp, string];

const PHRASE_REPLACEMENTS: readonly PhraseReplacement[] = [
  [/\bhồi cũ\b/gi, ""],
  [/\btrước đây\b/gi, ""],
  [/\bgiống bản cũ\b/gi, ""],
  [/\btự hồi và heal\b/gi, "tự hồi máu và hồi máu"],
  [/\bcarry nhiều nộ hoặc máu thấp\b/gi, "mục tiêu có nhiều nộ nhất hoặc đang thấp máu"],
  [/\bcarry nhiều nộ\b/gi, "mục tiêu có nhiều nộ nhất"],
  [/\bcarry tuyến sau\b/gi, "mục tiêu ở cột cuối cùng phía địch có sức tấn công cao nhất"],
  [/\bcarry vật lý\b/gi, "mục tiêu đánh vật lý có ATK cao nhất"],
  [/\bcarry đánh tay\b/gi, "mục tiêu đánh thường có ATK cao"],
  [/\bbackline máu mỏng\b/gi, "mục tiêu ở cột cuối cùng phía địch có máu thấp"],
  [/\bpháp sư hoặc support\b/gi, "pháp sư hoặc con hỗ trợ"],
  [/\bcaster hoặc support\b/gi, "pháp sư hoặc con hỗ trợ"],
  [/\bthời lượng buff\b/gi, "thời lượng hiệu lực"],
  [/\bđã dính debuff\b/gi, "đang chịu hiệu ứng bất lợi"],
  [/\bdính debuff\b/gi, "chịu hiệu ứng bất lợi"],
  [/\bngưỡng execute\b/gi, "ngưỡng kết liễu"],
  [/\bsát thủ execute\b/gi, "sát thủ kết liễu"],
  [/\bbuff hàng ngang\b/gi, "tăng hiệu quả theo hàng ngang"],
  [/\bbuff DEF\b/gi, "tăng DEF"],
  [/\bbuff MDEF\b/gi, "tăng MDEF"],
  [/\bbuff ATK\b/gi, "tăng ATK"],
  [/\bưu tiên carry\b/gi, "ưu tiên mục tiêu chủ lực"],
  [/\btanker hoặc frontliner\b/gi, "mục tiêu đỡ đòn hoặc mục tiêu ở cột đầu tiên phía địch"],
  [/\bfrontliner nhiều máu nhất\b/gi, "mục tiêu ở cột đầu tiên phía địch có máu cao nhất"],
  [/\bbackliner kháng phép thấp nhất\b/gi, "mục tiêu ở cột cuối cùng phía địch có kháng phép thấp nhất"],
  [/\bbackliner\b/gi, "mục tiêu ở cột cuối cùng phía địch"],
  [/\bfrontliner\b/gi, "mục tiêu ở cột đầu tiên phía địch"]
];

const WORD_REPLACEMENTS: readonly WordReplacement[] = [
  [/\bbackline\b/gi, "tuyến sau"],
  [/\bfrontline\b/gi, "tuyến trước"],
  [/\bcarry\b/gi, "mục tiêu chủ lực"],
  [/\bdebuff\b/gi, "hiệu ứng bất lợi"],
  [/\bsupport\b/gi, "hỗ trợ"],
  [/\btanker\b/gi, "đỡ đòn"],
  [/\branged\b/gi, "đánh xa"],
  [/\bcaster\b/gi, "pháp sư"],
  [/\bexecute\b/gi, "kết liễu"],
  [/\bfallback\b/gi, "phương án dự phòng"],
  [/\bpunish\b/gi, "trừng phạt"],
  [/\bheal\b/gi, "hồi máu"],
  [/\bbruiser\b/gi, "đấu sĩ"]
];

export function containsVietnamesePlayerJargon(text: unknown): boolean {
  return BANNED_VI_JARGON_REGEX.test(String(text ?? ""));
}

export function sanitizeVietnamesePlayerText(text: unknown): string {
  if (typeof text !== "string") return String(text ?? "");
  let sanitized = text;

  PHRASE_REPLACEMENTS.forEach(([pattern, replacement]) => {
    sanitized = replaceWithCase(sanitized, pattern, replacement);
  });

  sanitized = replaceWithCase(sanitized, /\btự buff\b/gi, "tự tăng sức mạnh");
  sanitized = replaceWithCase(sanitized, /\bđược buff\b/gi, "được tăng sức mạnh");
  sanitized = replaceWithCase(sanitized, /\bbuff\b/gi, "tăng sức mạnh");

  WORD_REPLACEMENTS.forEach(([pattern, replacement]) => {
    sanitized = replaceWithCase(sanitized, pattern, replacement);
  });

  sanitized = sanitized
    .replace(/\s+([,.;!?])/g, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s*;\s*/g, "; ")
    .replace(/\s*\.(?!\d)\s*/g, ". ")
    .replace(/\s+/g, " ")
    .trim();

  return sanitized;
}

interface FieldMap {
  [key: string]: unknown;
}

export function sanitizeVietnameseFieldMap<T extends FieldMap>(value: T): T {
  const copy = cloneDeep(value as DeepCloneable) as T;

  function walk(node: unknown): void {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!node || typeof node !== "object") return;

    Object.entries(node as Record<string, unknown>).forEach(([key, nested]) => {
      if (typeof nested === "string" && /Vi$/.test(key)) {
        (node as Record<string, unknown>)[key] = sanitizeVietnamesePlayerText(nested);
        return;
      }
      if (Array.isArray(nested) || (nested && typeof nested === "object")) {
        walk(nested);
      }
    });
  }

  walk(copy);
  return copy;
}
