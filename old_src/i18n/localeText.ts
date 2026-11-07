import { getLocale, t } from "./index.js";
type Locale = "vi" | "en";
type TextSource = Record<string, unknown>;

interface LocaleFieldOptions {
  locale?: string;
  allowBase?: boolean;
  allowCrossLocale?: boolean;
  fallbackFields?: readonly string[];
  fallback?: string;
}

interface LocaleKeyedTextOptions extends LocaleFieldOptions {
  fallbackKeyFields?: readonly string[];
  params?: Record<string, unknown>;
}

interface LocaleNameOptions extends LocaleKeyedTextOptions {
  fallbackId?: unknown;
}

function normalizeLocale(locale: unknown): Locale {
  return locale === "en" ? "en" : "vi";
}

function toPascalSuffix(locale: unknown): "En" | "Vi" {
  return normalizeLocale(locale) === "en" ? "En" : "Vi";
}

export function prettyIdLabel(id: unknown, fallback = ""): string {
  const text = String(id ?? "").trim();
  if (!text) return fallback;
  return text
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function resolveLocaleField(source: unknown, baseField: string, options: LocaleFieldOptions = {}): string {
  if (!source || typeof source !== "object") return options.fallback ?? "";
  const record = source as TextSource;
  const locale = normalizeLocale(options.locale ?? getLocale());
  const suffix = toPascalSuffix(locale);
  const primaryKey = `${baseField}${suffix}`;
  const fallbackKeys = options.fallbackFields ?? [];
  const orderedKeys: string[] = [];
  const allowCrossLocale = options.allowCrossLocale !== false;

  if (locale === "en") {
    orderedKeys.push(primaryKey);
    if (options.allowBase !== false) orderedKeys.push(baseField);
    if (allowCrossLocale) orderedKeys.push(`${baseField}Vi`);
  } else {
    orderedKeys.push(primaryKey);
    if (options.allowBase !== false) orderedKeys.push(baseField);
    if (allowCrossLocale) orderedKeys.push(`${baseField}En`);
  }
  orderedKeys.push(...fallbackKeys);

  for (const key of orderedKeys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return options.fallback ?? "";
}

export function resolveLocaleKeyedText(
  source: unknown,
  keyField: string,
  fallbackField: string,
  options: LocaleKeyedTextOptions = {}
): string {
  const locale = normalizeLocale(options.locale ?? getLocale());
  const translationKey = resolveLocaleField(source, keyField, {
    locale,
    allowBase: options.allowBase !== false,
    allowCrossLocale: options.allowCrossLocale,
    fallbackFields: options.fallbackKeyFields ?? []
  });
  if (translationKey) {
    const translated = t(translationKey, options.params);
    if (translated && translated !== translationKey) return translated;
  }
  return resolveLocaleField(source, fallbackField, {
    locale,
    allowBase: options.allowBase !== false,
    allowCrossLocale: options.allowCrossLocale,
    fallbackFields: options.fallbackFields ?? [],
    fallback: options.fallback ?? ""
  });
}

export function resolveLocaleLabel(source: unknown, options: LocaleKeyedTextOptions = {}): string {
  return resolveLocaleKeyedText(source, "labelKey", "label", options);
}

export function resolveLocaleName(source: unknown, options: LocaleNameOptions = {}): string {
  const locale = normalizeLocale(options.locale ?? getLocale());
  const fallback = options.fallbackId ? prettyIdLabel(options.fallbackId, options.fallback ?? "") : (options.fallback ?? "");
  return resolveLocaleKeyedText(source, "nameKey", "name", {
    locale,
    allowBase: options.allowBase ?? (locale !== "en"),
    allowCrossLocale: options.allowCrossLocale ?? (locale !== "en"),
    fallbackFields: options.fallbackFields ?? [],
    fallback
  });
}

export function resolveLocaleDescription(source: unknown, options: LocaleKeyedTextOptions = {}): string {
  const locale = normalizeLocale(options.locale ?? getLocale());
  return resolveLocaleKeyedText(source, "summaryKey", "description", {
    ...options,
    locale,
    allowBase: options.allowBase ?? (locale !== "en"),
    allowCrossLocale: options.allowCrossLocale ?? (locale !== "en")
  });
}

export function pickLocaleString(localeOrValue: unknown, ...values: unknown[]): string {
  const locale = typeof localeOrValue === "string" && (localeOrValue === "vi" || localeOrValue === "en")
    ? localeOrValue
    : getLocale();
  const candidates = typeof localeOrValue === "string" && (localeOrValue === "vi" || localeOrValue === "en")
    ? values
    : [localeOrValue, ...values];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const resolved = resolveLocaleField(value, "text", { locale });
      if (resolved) return resolved;
    }
  }
  return "";
}
