/**
 * i18n Manager
 *
 * Lightweight internationalization for Forest Throne.
 * Default locale is Vietnamese ("vi").
 *
 * Usage:
 *   import { t, setLocale, getLocale } from "../i18n/index.js";
 *   t("ui.close")            // → "Đóng" (vi) or "Close" (en)
 *   t("log.levelUp", { level: 5 }) // → "Lên level 5."
 *   setLocale("en");          // Switch to English
 */

import vi from "./vi.js";
import en from "./en.js";
import { THREE_I18N_VI, THREE_I18N_EN } from "./three.js";

type Locale = "vi" | "en";
type TranslationParams = Record<string, unknown>;
type TranslationDictionary = Record<string, string>;

const locales: Record<Locale, TranslationDictionary> = {
    vi: { ...vi, ...THREE_I18N_VI },
    en: { ...en, ...THREE_I18N_EN }
};
let currentLocale: Locale = "vi";

/**
 * Set the active locale.
 * @param {string} locale - Locale code ("vi", "en", etc.)
 */
export function setLocale(locale: string): void {
    if (isLocale(locale)) {
        currentLocale = locale;
    } else {
        console.warn(`[i18n] Unknown locale "${locale}", keeping "${currentLocale}".`);
    }
}

/**
 * Get the currently active locale code.
 * @returns {string}
 */
export function getLocale(): Locale {
    return currentLocale;
}

/**
 * Translate a key, optionally interpolating {param} placeholders.
 *
 * @param {string} key   - Translation key, e.g. "ui.close"
 * @param {Object} [params] - Key-value pairs for interpolation
 * @returns {string} Translated string, or the raw key if not found
 *
 * @example
 *   t("log.levelUp", { level: 5 }) // "Lên level 5."
 */
export function t(key: string, params: TranslationParams = {}, _locale?: string): string {
    const dict = locales[currentLocale] ?? locales.vi;
    return translateFromDict(dict, key, params, currentLocale);
}

function translateFromDict(
    dict: TranslationDictionary,
    key: string,
    params: TranslationParams = {},
    locale: Locale = currentLocale
): string {
    let text = dict[key];

    // Fallback to Vietnamese if key missing in current locale
    if (text === undefined && locale !== "vi") {
        text = locales.vi[key];
    }

    // If still missing, return the key itself (makes debugging easy)
    if (text === undefined) {
        return key;
    }

    // Interpolate {param} placeholders
    if (params && typeof params === "object") {
        for (const [k, v] of Object.entries(params)) {
            text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        }
    }

    return text;
}

export function translateForLocale(locale: string, key: string, params: TranslationParams = {}): string {
    const normalized: Locale = isLocale(locale) ? locale : "vi";
    const dict = locales[normalized] ?? locales.vi;
    return translateFromDict(dict, key, params, normalized);
}

/**
 * Get an array of available locale codes.
 * @returns {string[]}
 */
export function getAvailableLocales(): Locale[] {
    return Object.keys(locales).filter(isLocale);
}

/**
 * Get the display name for a locale code.
 * @param {string} code
 * @returns {string}
 */
export function getLocaleLabel(code: string): string {
    const labels: Record<Locale, string> = { vi: "Tiếng Việt", en: "English" };
    return isLocale(code) ? labels[code] : code;
}

function isLocale(locale: string): locale is Locale {
    return Object.prototype.hasOwnProperty.call(locales, locale);
}
