import packageJson from "../../package.json";

function toVersionTag(version: string): string {
  const normalized = String(version ?? "").trim();
  return normalized ? `v${normalized}` : "v0.0.0";
}

export const APP_VERSION = String(packageJson.version ?? "0.0.0").trim() || "0.0.0";
export const APP_VERSION_TAG = toVersionTag(APP_VERSION);
export const APP_LAST_UPDATED = String(packageJson.lastUpdated ?? "").trim() || "N/A";
