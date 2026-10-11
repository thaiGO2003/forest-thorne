export function normalizeAppVersion(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "0.0.0000-00/00";
}

export function formatAppVersion(value: unknown): string {
  return normalizeAppVersion(value);
}

export const APP_VERSION = normalizeAppVersion(__APP_VERSION__);
export const APP_DISPLAY_VERSION = formatAppVersion(APP_VERSION);
export const APP_VERSION_TAG = "v" + APP_DISPLAY_VERSION;
export const APP_LAST_UPDATED =
  typeof __APP_LAST_UPDATED__ === "string" && __APP_LAST_UPDATED__.trim()
    ? __APP_LAST_UPDATED__.trim()
    : "N/A";
