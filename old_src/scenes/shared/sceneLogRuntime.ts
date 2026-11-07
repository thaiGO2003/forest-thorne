import { getLocale, t } from "../../i18n/index.js";

type LogCategory = "COMBAT" | "SHOP" | "CRAFT" | "EVENT";

interface LogPlayerLike {
  round?: number;
  [key: string]: unknown;
}

interface LogSceneLike {
  player?: LogPlayerLike;
  phase?: unknown;
  logHistory: unknown[];
  logs: unknown[];
  [key: string]: unknown;
}

type LogEntry = {
  id: string;
  round: number;
  phase: unknown;
  category: LogCategory;
  title: string;
  summary: string;
  details: string[];
  icon: string | null;
  tone: string;
  meta: unknown;
  message: string;
  previewText: string;
};

type LogPayload = {
  title?: unknown;
  summary?: unknown;
  message?: unknown;
  previewText?: unknown;
  details?: unknown;
  category?: LogCategory | string;
  icon?: unknown;
  tone?: unknown;
  meta?: unknown;
  [key: string]: unknown;
};

type LogInferCategory = (message: string) => LogCategory;

interface PushLogOptions {
  historyLimit?: number;
  previewLimit?: number;
  inferCategory?: LogInferCategory;
}

interface FormatLogOptions {
  maxLines?: number;
  bullet?: string;
  emptyText?: string;
}

interface CombatActionLogOptions {
  kind?: "basic" | "skill" | string;
  attacker?: { name?: unknown } | null;
  target?: { name?: unknown } | null;
  skill?: { name?: unknown; effectLabel?: unknown; effect?: unknown } | null;
  range?: number;
  damageType?: string;
  pattern?: string | null;
  targetCount?: number;
}

interface DamageLogOptions {
  attacker?: { name?: unknown } | null;
  defender?: { name?: unknown } | null;
  damageType?: string;
  reason?: string | null;
  damageLeft?: number;
  absorbed?: number;
  isCrit?: boolean;
  wasMiss?: boolean;
  hitChance?: number | null;
  hpAfter?: number | null;
  hpMax?: number | null;
  shieldAfter?: number | null;
}

interface RoundRewardLogOptions {
  round: number;
  outcome?: "WIN" | "LOSE" | "DRAW" | string;
  baseGold?: number;
  starBonus?: number;
  extraGold?: number;
  assassinBountyGold?: number;
  xpEarned?: number;
  damageTaken?: number;
  playerHearts?: number | null;
  goldAfter?: number | string | null;
}

interface RoundIncomeLogOptions {
  round: number;
  gain: number;
  base: number;
  interest: number;
  streak: number;
  fixedIncome?: number;
  fixedIncomeLabel?: string;
  goldAfter?: number | null;
}

interface LootLogOptions {
  title?: string;
  lootLabel: string;
  sourceLines?: string[];
}

function foldLogText(message: string): string {
  return String(message ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function normalizeLogDetails(details: unknown): string[] {
  if (!details) return [];
  const source = Array.isArray(details) ? details : [details];
  return source
    .flatMap((entry) => Array.isArray(entry) ? entry : [entry])
    .map((entry: unknown) => String(entry ?? "").trim())
    .filter(Boolean);
}

function extractPayloadText(payload: unknown): string {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const record = payload as LogPayload;
    const parts: unknown[] = [
      record.title,
      record.summary,
      record.message,
      record.previewText,
      ...normalizeLogDetails(record.details)
    ];
    return parts.filter(Boolean).join(" ");
  }
  return String(payload ?? "");
}

function damageTypeLabel(damageType: string): string {
  if (damageType === "magic") return t("log.damageType.magic");
  if (damageType === "true") return t("log.damageType.true");
  return t("log.damageType.physical");
}

function isEnglish(): boolean {
  return getLocale() === "en";
}

function getLocaleMissText(): string {
  return isEnglish() ? "dodges the attack from" : "né đòn của";
}

function getDamageSummary(actorName: string, defenderName: string, dealt: number, damageType: string, blocked: number): string {
  if (dealt > 0) {
    if (isEnglish()) {
      return `💥 ${actorName} deals ${dealt} ${damageTypeLabel(damageType)} damage to ${defenderName}${blocked > 0 ? ` (${blocked} blocked by shield)` : ""}.`;
    }
    return `💥 ${actorName} gây ${dealt} ST ${damageTypeLabel(damageType)} lên ${defenderName}${blocked > 0 ? ` (${blocked} bị khiên chặn)` : ""}.`;
  }
  return isEnglish()
    ? `🛡️ ${defenderName} blocks ${blocked} damage from ${actorName}.`
    : `🛡️ ${defenderName} chặn ${blocked} sát thương từ ${actorName}.`;
}

function getDamageTitle(defenderName: string, dealt: number, damageType: string): string {
  if (dealt > 0) {
    return isEnglish()
      ? `${defenderName} takes ${dealt} ${damageTypeLabel(damageType)} damage`
      : `${defenderName} chịu ${dealt} ST ${damageTypeLabel(damageType)}`;
  }
  return isEnglish() ? `${defenderName} blocks all damage` : `${defenderName} chặn toàn bộ sát thương`;
}

function getRoundDrawTitle(round: number): string {
  return isEnglish() ? `Draw round ${round}` : `Hòa vòng ${round}`;
}

function getRoundDrawSummary(round: number): string {
  return isEnglish()
    ? `🤝 Draw round ${round}. Both sides still have units left.`
    : `🤝 Hòa vòng ${round}. Hai bên vẫn còn quân.`;
}

function getRoundLoseTitle(round: number): string {
  return isEnglish() ? `Lost round ${round}` : `Thua vòng ${round}`;
}

function getRoundLoseSummary(round: number, damageTaken: number): string {
  if (isEnglish()) {
    return `💀 Lost round ${round}.${damageTaken > 0 ? ` -${damageTaken} hearts.` : ""}`;
  }
  return `💀 Thua vòng ${round}.${damageTaken > 0 ? ` -${damageTaken} tim.` : ""}`;
}

function getRoundWinTitle(round: number): string {
  return isEnglish() ? `Won round ${round}` : `Thắng vòng ${round}`;
}

function getRoundWinSummary(round: number, totalGold: number, xpEarned: number): string {
  return isEnglish()
    ? `🎁 Won round ${round}: +${totalGold} gold${xpEarned > 0 ? `, +${xpEarned} XP` : ""}.`
    : `🎁 Thắng vòng ${round}: +${totalGold} vàng${xpEarned > 0 ? `, +${xpEarned} XP` : ""}.`;
}

function getRoundWinPreview(round: number, totalGold: number): string {
  return isEnglish()
    ? `🎁 Won round ${round}: +${totalGold} gold.`
    : `🎁 Thắng vòng ${round}: +${totalGold} vàng.`;
}

function getNoWinGoldText(): string {
  return isEnglish() ? "No round-win gold awarded." : "Không nhận vàng thắng vòng.";
}

function getPlayerHeartsText(playerHearts: number, remaining: boolean = false): string {
  if (isEnglish()) {
    return remaining ? `Player hearts remaining: ${playerHearts}` : `Current player hearts: ${playerHearts}`;
  }
  return remaining ? `Tim người chơi còn lại: ${playerHearts}` : `Tim người chơi hiện tại: ${playerHearts}`;
}

function getHeartsLostText(damageTaken: number): string {
  return isEnglish() ? `Hearts lost: -${damageTaken}` : `Tim mất: -${damageTaken}`;
}

function getGoldSourceText(baseGold: number): string {
  return isEnglish() ? `Round gold source: +${baseGold} from enemy units` : `Nguồn vàng vòng: +${baseGold} theo số tướng địch`;
}

function getEnemyStarBonusText(starBonus: number): string {
  return isEnglish() ? `Enemy star bonus: +${starBonus}` : `Thưởng sao địch: +${starBonus}`;
}

function getExtraGoldText(extraGold: number): string {
  return isEnglish() ? `Extra gold / augment: +${extraGold}` : `Thưởng thêm / pháp ấn: +${extraGold}`;
}

function getAssassinBountyText(assassinBountyGold: number): string {
  return isEnglish() ? `Assassin bounty: +${assassinBountyGold}` : `Thưởng kết liễu Sát thủ: +${assassinBountyGold}`;
}

function getXpEarnedText(xpEarned: number): string {
  return isEnglish() ? `XP gained: +${xpEarned}` : `Kinh nghiệm nhận: +${xpEarned}`;
}

function getGoldAfterText(goldAfter: number | string): string {
  return isEnglish() ? `Gold after reward: ${goldAfter}` : `Vàng sau cộng: ${goldAfter}`;
}

function getIncomeTitle(round: number): string {
  return isEnglish() ? `Start-of-round income ${round}` : `Thu nhập đầu vòng ${round}`;
}

function getIncomeSummary(round: number, gain: number): string {
  return isEnglish() ? `💵 Round ${round}: +${gain} income gold.` : `💵 Vòng ${round}: +${gain} vàng thu nhập.`;
}

function getIncomePreview(round: number, gain: number): string {
  return isEnglish() ? `💵 Round ${round}: +${gain} gold.` : `💵 Vòng ${round}: +${gain} vàng.`;
}

function getIncomeDetail(labelEn: string, labelVi: string, value: number): string {
  return `${isEnglish() ? labelEn : labelVi}: +${value}`;
}

function getGoldAfterIncomeText(goldAfter: number): string {
  return isEnglish() ? `Gold after income: ${goldAfter}` : `Vàng sau nhận: ${goldAfter}`;
}

function buildPreviewText(entry: unknown): string {
  if (!entry) return "";
  if (typeof entry === "string") return entry;
  const record = entry as Partial<LogEntry>;
  return String(record.previewText ?? record.summary ?? record.message ?? record.title ?? "").trim();
}

function inferCategoryFromText(message: string): LogCategory {
  const text = foldLogText(message);
  if (
    text.includes("giao tranh") ||
    text.includes("thang") ||
    text.includes("thua") ||
    text.includes("danh") ||
    text.includes("don") ||
    text.includes("dung ky nang") ||
    text.includes("tu chien") ||
    text.includes("combat")
  ) {
    return "COMBAT";
  }
  if (
    text.includes("mua") ||
    text.includes("shop") ||
    text.includes("roll") ||
    text.includes("xp") ||
    text.includes("khoa")
  ) {
    return "SHOP";
  }
  if (
    text.includes("ghep") ||
    text.includes("vat pham") ||
    text.includes("craft")
  ) {
    return "CRAFT";
  }
  return "EVENT";
}

function createStructuredLogEntry(
  scene: LogSceneLike,
  payload: unknown,
  category: LogCategory | string | null,
  inferCategory: LogInferCategory
): LogEntry {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const record = payload as LogPayload;
    const title = String(record.title ?? record.summary ?? record.message ?? record.previewText ?? t("log.eventFallback")).trim();
    const summary = String(record.summary ?? record.message ?? title).trim();
    const previewText = String(record.previewText ?? summary ?? title).trim();
    const details = normalizeLogDetails(record.details);
    const rawCategory = record.category ?? category ?? inferCategory(extractPayloadText(payload));
    const resolvedCategory: LogCategory = (rawCategory === "COMBAT" || rawCategory === "SHOP" || rawCategory === "CRAFT" || rawCategory === "EVENT")
      ? rawCategory
      : "EVENT";
    return {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      round: scene.player?.round ?? 1,
      phase: scene.phase,
      category: resolvedCategory,
      title,
      summary,
      details,
      icon: (record.icon as string | null) ?? null,
      tone: (record.tone as string) ?? "info",
      meta: record.meta ?? null,
      message: summary,
      previewText
    };
  }

  const safeMessage = String(payload ?? "");
  const rawCategory = category ?? inferCategory(safeMessage);
  const resolvedCategory: LogCategory = (rawCategory === "COMBAT" || rawCategory === "SHOP" || rawCategory === "CRAFT" || rawCategory === "EVENT")
    ? rawCategory
    : "EVENT";
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    round: scene.player?.round ?? 1,
    phase: scene.phase,
    category: resolvedCategory,
    title: safeMessage,
    summary: safeMessage,
    details: [],
    icon: null,
    tone: "info",
    meta: null,
    message: safeMessage,
    previewText: safeMessage
  };
}

export function inferSharedLogCategory(message: string): LogCategory {
  return inferCategoryFromText(extractPayloadText(message));
}

export function pushSharedSceneLog(
  scene: LogSceneLike,
  message: unknown,
  category: LogCategory | string | null = null,
  options: PushLogOptions = {}
): LogEntry {
  const {
    historyLimit = 300,
    previewLimit = 6,
    inferCategory = inferSharedLogCategory
  } = options;

  const entry = createStructuredLogEntry(scene, message, category, inferCategory);
  scene.logHistory.push(entry);
  while (scene.logHistory.length > historyLimit) scene.logHistory.shift();

  const previewText = buildPreviewText(entry);
  scene.logs.push(previewText);
  while (scene.logs.length > previewLimit) scene.logs.shift();
  return entry;
}

export function formatSharedLogPreview(logs: unknown[], options: FormatLogOptions = {}): string {
  const {
    maxLines = 1,
    bullet = "• ",
    emptyText = t("log.none")
  } = options;
  if (!logs?.length) return emptyText;

  const visibleLines = logs.slice(-Math.max(1, maxLines));
  return visibleLines
    .map((entry) => `${bullet}${buildPreviewText(entry)}`)
    .join("\n");
}

export function buildSharedCombatActionLog({
  kind = "basic",
  attacker,
  target,
  skill = null,
  range = 1,
  damageType = "physical",
  pattern = null,
  targetCount = 1
}: CombatActionLogOptions = {}): LogEntry {
  const actorName = String(attacker?.name ?? t("log.beastFallback"));
  const targetName = String(target?.name ?? t("log.targetFallback"));
  if (kind === "skill") {
    const skillName = String(skill?.name ?? t("log.skillNameFallback"));
    const effectLabel = String(skill?.effectLabel || skill?.effect || t("log.effectFallback"));
    const details = [
      t("log.detailSkill", { value: skillName }),
      t("log.detailEffect", { value: effectLabel }),
      t("log.detailMainTarget", { value: targetName })
    ];
    if (Number.isFinite(targetCount) && targetCount > 1) {
      details.push(t("log.detailEstimatedCoverage", { value: targetCount }));
    }
    if (pattern) details.push(t("log.detailActionPattern", { value: pattern }));
    return {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      round: 0,
      phase: null,
      category: "COMBAT",
      title: t("log.actionSkillTitle", { actor: actorName, skill: skillName }),
      summary: t("log.actionSkillSummary", { actor: actorName, skill: skillName, target: targetName }),
      previewText: t("log.actionSkillPreview", { actor: actorName, skill: skillName }),
      details,
      icon: "✨",
      tone: "info",
      meta: null,
      message: t("log.actionSkillSummary", { actor: actorName, skill: skillName, target: targetName })
    };
  }

  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    round: 0,
    phase: null,
    category: "COMBAT",
    icon: "⚔️",
    tone: "info",
    title: t("log.actionBasicTitle", { actor: actorName, target: targetName }),
    summary: t("log.actionBasicSummary", { actor: actorName, target: targetName }),
    previewText: t("log.actionBasicPreview", { actor: actorName, target: targetName }),
    details: [
      t("log.detailActionType", { value: damageType === "magic" ? t("log.detailMagic") : t("log.detailPhysical") }),
      t("log.detailRange", { value: range }),
      pattern ? t("log.detailActionPattern", { value: pattern }) : null
    ].filter((entry): entry is string => typeof entry === "string"),
    meta: null,
    message: t("log.actionBasicSummary", { actor: actorName, target: targetName })
  };
}

export function buildSharedDamageLog({
  attacker,
  defender,
  damageType = "physical",
  reason = null,
  damageLeft = 0,
  absorbed = 0,
  isCrit = false,
  wasMiss = false,
  hitChance = null,
  hpAfter = null,
  hpMax = null,
  shieldAfter = null
}: DamageLogOptions = {}): LogEntry | null {
  const actorName = String(attacker?.name ?? t("log.effectFallback"));
  const defenderName = String(defender?.name ?? t("log.targetFallback"));
  if (wasMiss) {
    const details = [
      t("log.detailSource", { value: reason || (t("log.detailPhysical")) }),
      t("log.detailDamageType", { value: damageTypeLabel(damageType) })
    ];
    if (Number.isFinite(hitChance)) details.push(t("log.detailHitChance", { value: Math.round((hitChance as number) * 100) }));
    return {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      round: 0,
      phase: null,
      category: "COMBAT",
      icon: "🌀",
      tone: "warning",
      title: t("log.actionBasicTitle", { actor: defenderName, target: actorName }),
      summary: `🌀 ${defenderName} ${getLocaleMissText()} ${actorName}.`,
      previewText: `🌀 ${defenderName} ${getLocaleMissText()} ${actorName}.`,
      details,
      meta: null,
      message: `🌀 ${defenderName} ${getLocaleMissText()} ${actorName}.`
    };
  }

  if (damageLeft <= 0 && absorbed <= 0) return null;

  const dealt = Math.max(0, Number.isFinite(damageLeft) ? Math.floor(damageLeft as number) : 0);
  const blocked = Math.max(0, Number.isFinite(absorbed) ? Math.floor(absorbed as number) : 0);
  const summary = getDamageSummary(actorName, defenderName, dealt, damageType, blocked);
  const details = [
    t("log.detailSource", { value: reason || t("log.detailPhysical") }),
    t("log.detailDamageType", { value: damageTypeLabel(damageType) }),
    t("log.detailCrit", { value: isCrit ? t("settings.on") : t("log.valueNone") })
  ];
  if (blocked > 0) details.push(t("log.detailShieldAbsorbed", { value: blocked }));
  if (Number.isFinite(hpAfter) && Number.isFinite(hpMax)) details.push(t("log.detailHpAfter", { value: hpAfter as number, max: hpMax as number }));
  if (Number.isFinite(shieldAfter)) details.push(t("log.detailShieldAfter", { value: shieldAfter as number }));
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    round: 0,
    phase: null,
    category: "COMBAT",
    icon: dealt > 0 ? "💥" : "🛡️",
    tone: dealt > 0 ? "danger" : "info",
    title: getDamageTitle(defenderName, dealt, damageType),
    summary,
    previewText: summary,
    details,
    meta: null,
    message: summary
  };
}

export function buildSharedRoundRewardLog({
  round,
  outcome = "WIN",
  baseGold = 0,
  starBonus = 0,
  extraGold = 0,
  assassinBountyGold = 0,
  xpEarned = 0,
  damageTaken = 0,
  playerHearts = null,
  goldAfter = null
}: RoundRewardLogOptions): LogEntry | null {
  if (outcome === "DRAW") {
    return {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      round: 0,
      phase: null,
      category: "EVENT",
      icon: "🤝",
      tone: "info",
      title: getRoundDrawTitle(round),
      summary: getRoundDrawSummary(round),
      previewText: `🤝 ${getRoundDrawTitle(round)}.`,
      details: [
        assassinBountyGold > 0 ? getAssassinBountyText(assassinBountyGold) : null,
        getNoWinGoldText(),
        Number.isFinite(playerHearts) ? getPlayerHeartsText(playerHearts as number, true) : null
      ].filter((entry): entry is string => typeof entry === "string"),
      meta: null,
      message: getRoundDrawSummary(round)
    };
  }

  if (outcome === "LOSE") {
    return {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      round: 0,
      phase: null,
      category: "EVENT",
      icon: "💀",
      tone: "danger",
      title: getRoundLoseTitle(round),
      summary: getRoundLoseSummary(round, damageTaken),
      previewText: getRoundLoseSummary(round, damageTaken),
      details: [
        assassinBountyGold > 0 ? getAssassinBountyText(assassinBountyGold) : null,
        damageTaken > 0 ? getHeartsLostText(damageTaken) : getNoWinGoldText(),
        Number.isFinite(goldAfter) ? getGoldAfterText(goldAfter as number) : null,
        Number.isFinite(playerHearts) ? getPlayerHeartsText(playerHearts as number, true) : null
      ].filter((entry): entry is string => typeof entry === "string"),
      meta: null,
      message: getRoundLoseSummary(round, damageTaken)
    };
  }

  const totalGold = Math.max(0, baseGold + starBonus + extraGold + assassinBountyGold);
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    round: 0,
    phase: null,
    category: "EVENT",
    icon: "🎁",
    tone: "success",
    title: getRoundWinTitle(round),
    summary: getRoundWinSummary(round, totalGold, xpEarned),
    previewText: getRoundWinPreview(round, totalGold),
    details: [
      getGoldSourceText(baseGold),
      getEnemyStarBonusText(starBonus),
      extraGold > 0 ? getExtraGoldText(extraGold) : null,
      assassinBountyGold > 0 ? getAssassinBountyText(assassinBountyGold) : null,
      xpEarned > 0 ? getXpEarnedText(xpEarned) : null,
      Number.isFinite(goldAfter) ? getGoldAfterText(goldAfter as number) : null,
      Number.isFinite(playerHearts) ? getPlayerHeartsText(playerHearts as number, false) : null
    ].filter((entry): entry is string => typeof entry === "string"),
    meta: null,
    message: getRoundWinSummary(round, totalGold, xpEarned)
  };
}

export function buildSharedRoundIncomeLog({
  round,
  gain,
  base,
  interest,
  streak,
  fixedIncome = 0,
  fixedIncomeLabel = "Công nghệ / nguồn cố định",
  goldAfter = null
}: RoundIncomeLogOptions): LogEntry {
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    round: 0,
    phase: null,
    category: "EVENT",
    icon: "💵",
    tone: "success",
    title: getIncomeTitle(round),
    summary: getIncomeSummary(round, gain),
    previewText: getIncomePreview(round, gain),
    details: [
      getIncomeDetail("Base", "Cơ bản", base),
      getIncomeDetail("Interest", "Lãi suất", interest),
      getIncomeDetail("Streak", "Chuỗi", streak),
      fixedIncome > 0 ? `${fixedIncomeLabel}: +${fixedIncome}` : null,
      Number.isFinite(goldAfter) ? getGoldAfterIncomeText(goldAfter as number) : null
    ].filter((entry): entry is string => typeof entry === "string"),
    meta: null,
    message: getIncomeSummary(round, gain)
  };
}

export function buildSharedLootLog({
  title = "Nhặt chiến lợi phẩm",
  lootLabel,
  sourceLines = []
}: LootLogOptions): LogEntry {
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    round: 0,
    phase: null,
    category: "EVENT",
    icon: "📦",
    tone: "success",
    title,
    summary: `📦 ${title}: ${lootLabel}.`,
    previewText: `📦 ${title}: ${lootLabel}.`,
    details: sourceLines,
    meta: null,
    message: `📦 ${title}: ${lootLabel}.`
  };
}
