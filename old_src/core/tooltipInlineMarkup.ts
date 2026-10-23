export const TOOLTIP_ACTIVE_OPEN = "[[active]]";
export const TOOLTIP_ACTIVE_CLOSE = "[[/active]]";

export function highlightTooltipActiveText(value: string) {
  return `${TOOLTIP_ACTIVE_OPEN}${String(value ?? "")}${TOOLTIP_ACTIVE_CLOSE}`;
}

export function hasTooltipHighlightMarkup(value: string) {
  return String(value ?? "").includes(TOOLTIP_ACTIVE_OPEN);
}

export function stripTooltipHighlightMarkup(value: string) {
  return String(value ?? "").replace(/\[\[active\]\]([\s\S]*?)\[\[\/active\]\]/g, "$1");
}

export function parseTooltipHighlightSegments(value: string) {
  const text = String(value ?? "");
  const segments: Array<{ text: string; active: boolean }> = [];
  const pattern = /\[\[active\]\]([\s\S]*?)\[\[\/active\]\]/g;
  let cursor = 0;
  let match = pattern.exec(text);
  while (match) {
    if (match.index > cursor) {
      segments.push({
        text: text.slice(cursor, match.index),
        active: false
      });
    }
    if (match[1]) {
      segments.push({
        text: match[1],
        active: true
      });
    }
    cursor = match.index + match[0].length;
    match = pattern.exec(text);
  }
  if (cursor < text.length) {
    segments.push({
      text: text.slice(cursor),
      active: false
    });
  }
  return segments.filter((segment) => segment.text);
}
