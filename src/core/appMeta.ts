import packageJson from "../../package.json";

type PackageMetadata = {
  version?: unknown;
  lastUpdated?: unknown;
};

const metadata = packageJson as PackageMetadata;

export function normalizeAppVersion(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "0.0.0";
}

export function formatAppVersion(value: unknown): string {
  const version = normalizeAppVersion(value);
  const match = /^(\d+)\.(\d+)\.0$/.exec(version);
  return match ? `${match[1]}.${match[2]}` : version;
}

export const APP_VERSION = normalizeAppVersion(metadata.version);
export const APP_DISPLAY_VERSION = formatAppVersion(APP_VERSION);
export const APP_VERSION_TAG = `v${APP_DISPLAY_VERSION}`;
export const APP_LAST_UPDATED =
  typeof metadata.lastUpdated === "string" && metadata.lastUpdated.trim()
    ? metadata.lastUpdated.trim()
    : "N/A";
