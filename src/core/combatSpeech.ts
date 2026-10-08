import type { BrowserSpeechOptions } from "./browserSpeech";

export type CombatSpeechKind =
  | "basic_attack"
  | "ordinary_skill"
  | "support_auto_cast"
  | "tanker_auto_cast"
  | "death";

export interface CombatSpeechRule {
  priority: number;
  minimumGapMs: number;
  sameKeyGapMs: number;
  interruptFloorMs: number;
  cancelCurrent: boolean;
}

export const COMBAT_SPEECH_RULES: Readonly<Record<CombatSpeechKind, CombatSpeechRule>> = {
  basic_attack: { priority: 1, minimumGapMs: 1250, sameKeyGapMs: 1600, interruptFloorMs: 180, cancelCurrent: false },
  ordinary_skill: { priority: 2, minimumGapMs: 450, sameKeyGapMs: 1100, interruptFloorMs: 180, cancelCurrent: true },
  support_auto_cast: { priority: 3, minimumGapMs: 650, sameKeyGapMs: 1400, interruptFloorMs: 160, cancelCurrent: true },
  tanker_auto_cast: { priority: 3, minimumGapMs: 650, sameKeyGapMs: 1400, interruptFloorMs: 160, cancelCurrent: true },
  death: { priority: 4, minimumGapMs: 300, sameKeyGapMs: 900, interruptFloorMs: 100, cancelCurrent: true },
};

export type CombatSpeechSide = "LEFT" | "RIGHT" | "UNKNOWN";

export interface CombatSpeechEvent {
  kind: CombatSpeechKind;
  unitId: string;
  unitName: string;
  side?: CombatSpeechSide;
  targetId?: string;
  targetName?: string;
  targetSide?: CombatSpeechSide;
  skillLabel?: string;
  effectLabel?: string;
}

export type CombatSpeechSpeaker = (
  text: string,
  options: BrowserSpeechOptions,
) => boolean;

function compactSpeechText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[<>{}*_#~]/g, " ")
    .split("[").join(" ")
    .split("]").join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function sideLabel(side: CombatSpeechSide | undefined): string {
  if (side === "LEFT") return "phe ta";
  if (side === "RIGHT") return "phe địch";
  return "";
}

function namedSide(name: string, side: CombatSpeechSide | undefined): string {
  return [compactSpeechText(name), sideLabel(side)].filter(Boolean).join(" ");
}

export function combatSpeechKey(event: CombatSpeechEvent): string {
  const unit = compactSpeechText(event.unitId) || compactSpeechText(event.unitName);
  const target = compactSpeechText(event.targetId) || compactSpeechText(event.targetName);
  if (event.kind === "basic_attack") return `attack:${unit}`;
  if (event.kind === "ordinary_skill") {
    return `skill:${unit}:${compactSpeechText(event.skillLabel)}`;
  }
  if (event.kind === "support_auto_cast" || event.kind === "tanker_auto_cast") {
    return `${event.kind}:${unit}:${target}:${compactSpeechText(event.effectLabel)}`;
  }
  return `death:${unit}`;
}

export function combatSpeechText(event: CombatSpeechEvent): string {
  const actor = namedSide(event.unitName, event.side);
  const target = namedSide(event.targetName ?? "", event.targetSide);
  const skill = compactSpeechText(event.skillLabel) || "kỹ năng";
  const effect = compactSpeechText(event.effectLabel) || "hiệu ứng";
  if (event.kind === "basic_attack") return compactSpeechText(`${actor} đánh thường`);
  if (event.kind === "death") return compactSpeechText(`${actor} bị tiêu diệt`);
  if (event.kind === "ordinary_skill") return compactSpeechText(`${actor} dùng ${skill}`);
  if (event.kind === "support_auto_cast") {
    return compactSpeechText(`${actor} hỗ trợ ${target} bằng ${effect}`);
  }
  return compactSpeechText(`${actor} tự kích hoạt ${effect} lên ${target || actor}`);
}

export class CombatSpeechAnnouncer {
  private lastTimestamp = Number.NEGATIVE_INFINITY;
  private lastKey = "";
  private lastPriority = 0;
  private readonly lastTimestampByKey = new Map<string, number>();

  constructor(
    private readonly speaker: CombatSpeechSpeaker,
    private readonly now: () => number = () => typeof performance !== "undefined" ? performance.now() : Date.now(),
  ) {}

  announce(event: CombatSpeechEvent, locale = "vi"): boolean {
    const rule = COMBAT_SPEECH_RULES[event.kind];
    const timestamp = this.now();
    const elapsed = timestamp - this.lastTimestamp;
    const key = combatSpeechKey(event);
    const sameKeyElapsed = timestamp - (this.lastTimestampByKey.get(key) ?? Number.NEGATIVE_INFINITY);
    if (sameKeyElapsed < rule.sameKeyGapMs) return false;
    if (Number.isFinite(this.lastTimestamp)) {
      const requiredGap = rule.priority > this.lastPriority
        ? rule.interruptFloorMs
        : rule.minimumGapMs;
      if (elapsed < requiredGap) return false;
    }
    const text = combatSpeechText(event);
    if (!text) return false;
    const queued = this.speaker(text, {
      lang: locale,
      rate: 0.94,
      pitch: 1.04,
      volume: 1,
      cancelCurrent: rule.cancelCurrent,
    });
    if (!queued) return false;
    this.lastTimestamp = timestamp;
    this.lastKey = key;
    this.lastPriority = rule.priority;
    this.lastTimestampByKey.set(key, timestamp);
    return true;
  }

  reset(): void {
    this.lastTimestamp = Number.NEGATIVE_INFINITY;
    this.lastKey = "";
    this.lastPriority = 0;
    this.lastTimestampByKey.clear();
  }
}
