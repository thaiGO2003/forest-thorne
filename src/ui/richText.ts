// Shared descriptive rich text: effect keywords and their values are tinted by effect tone and
// followed by the matching emoji ("Tự hồi 10% HP tối đa 💚"). Used by every DOM surface that shows
// authored prose (unit detail, hover tooltip, Library) so wording treatment stays consistent.
import { h } from "./kit";

export type RichTone = "physical" | "magic" | "true" | "heal" | "shield" | "element" | "buff" | "debuff" | "control";

export const richSpan = (text: string, tone: string): HTMLElement => h("span", `rich rich-${tone}`, text);

/** Keywords read as a heading inside prose: only the first letter is uppercased (vi-aware). */
export const capitalizeKeyword = (text: string): string =>
  text ? text.charAt(0).toLocaleUpperCase("vi") + text.slice(1) : text;

const PATTERNS: { re: RegExp; emoji: string; tone: RichTone | "auto" }[] = [
  { re: /\(\s*\d+(?:[.,]\d+)?\s*\+\s*\d+(?:[.,]\d+)?%\s*(?:ATK|MATK|DEF|MDEF|HP(?:\s+tối đa)?)\s*\)/gi, emoji: "", tone: "auto" },
  { re: /(?:Tự\s+)?[Hh]ồi\s+\d+(?:[.,]\d+)?%\s*HP(?:\s+tối đa)?/g, emoji: "💚", tone: "heal" },
  { re: /[Hh]ồi\s+máu\s+bằng\s+\d+(?:[.,]\d+)?%\s+sát thương/gi, emoji: "💚", tone: "heal" },
  { re: /[Nn]hận\s+\d+(?:[.,]\d+)?\s+khiên/gi, emoji: "🛡️", tone: "shield" },
  { re: /[Gg]iảm\s+\d+(?:[.,]\d+)?%\s+sát thương nhận(?:\s+vào)?(?:\s+trong\s+\d+\s+lượt)?/g, emoji: "🛡️", tone: "shield" },
  { re: /(?:[Tt]hanh tẩy|[Xx]óa)\s+(?:tối đa\s+)?\d+\s+hiệu ứng[^.]*/g, emoji: "✨", tone: "buff" },
  { re: /(?:chảy máu|nhiễm độc|thiêu đốt)\s+\d+(?:[.,]\d+)?(?:\s*\/\s*lượt)?/gi, emoji: "🩸", tone: "element" },
  { re: /(?:choáng|đóng băng|ngủ|khiêu khích)(?:\s+\d+\s+lượt)?/gi, emoji: "💫", tone: "control" },
];

export function inferRichTone(text: string): RichTone {
  const formula = /\(\s*\d+(?:[.,]\d+)?\s*\+\s*\d+(?:[.,]\d+)?%\s*(ATK|MATK|DEF|MDEF|HP)/i.exec(text);
  if (formula) {
    const stat = formula[1]!.toUpperCase();
    if (stat === "MATK") return "magic";
    if (stat === "HP") return "heal";
    return "physical";
  }
  if (/\b(tự\s+)?hồi\b|hồi máu|HP tối đa/i.test(text)) return "heal";
  if (/khiên/i.test(text)) return "shield";
  if (/MATK|sát thương phép|\bphép\b/i.test(text)) return "magic";
  return "physical";
}

/** Build a fragment with tinted effect phrases and their emoji appended after the phrase. */
export function decorateDescription(text: string, fallbackTone: RichTone = inferRichTone(text)): DocumentFragment {
  const frag = document.createDocumentFragment();
  let index = 0;
  while (index < text.length) {
    let best: { rule: (typeof PATTERNS)[number]; match: RegExpExecArray } | null = null;
    for (const rule of PATTERNS) {
      rule.re.lastIndex = index;
      const match = rule.re.exec(text);
      if (match && (!best || match.index < best.match.index)) best = { rule, match };
    }
    if (!best) { frag.append(text.slice(index)); break; }
    if (best.match.index > index) frag.append(text.slice(index, best.match.index));
    const tone = best.rule.tone === "auto" ? fallbackTone : best.rule.tone;
    frag.append(richSpan(capitalizeKeyword(best.match[0]), tone));
    if (best.rule.emoji) frag.append(` ${best.rule.emoji}`);
    index = best.match.index + best.match[0].length;
  }
  return frag;
}

/** Replace an element's children with decorated copy; keeps plain text untouched. */
export function setRichDescription(el: HTMLElement, text: string, tone?: RichTone): void {
  el.replaceChildren(decorateDescription(text, tone));
}
