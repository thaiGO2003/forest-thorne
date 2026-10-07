export interface DiscordActivitySdk {
  ready(): Promise<void>;
  commands?: {
    openExternalLink?: (args: { url: string }) => Promise<unknown> | unknown;
  };
}

export interface DiscordActivityDetection {
  windowExists: boolean;
  clientId: string | undefined;
  href: string;
}

export function isDiscordEmbeddedActivity(input: DiscordActivityDetection): boolean {
  if (!input.windowExists || !input.clientId?.trim()) return false;
  try {
    const query = new URL(input.href).searchParams;
    return ["frame_id", "instance_id", "platform"].every((key) => Boolean(query.get(key)?.trim()));
  } catch {
    return false;
  }
}

export interface InitializeDiscordActivityOptions extends DiscordActivityDetection {
  createSdk(clientId: string): DiscordActivitySdk;
}

export async function initializeDiscordActivity(
  options: InitializeDiscordActivityOptions,
): Promise<DiscordActivitySdk | null> {
  if (!isDiscordEmbeddedActivity(options)) return null;
  const sdk = options.createSdk(options.clientId!.trim());
  await sdk.ready();
  return sdk;
}

export function parseExternalHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export interface ExternalLinkWindow {
  open(url: string, target: string, features: string): unknown;
}

export async function openExternalHttpUrl(
  value: string,
  options: {
    sdk?: DiscordActivitySdk | null;
    window?: ExternalLinkWindow | null;
  } = {},
): Promise<boolean> {
  const url = parseExternalHttpUrl(value);
  if (!url) return false;

  const sdkOpen = options.sdk?.commands?.openExternalLink;
  if (sdkOpen) {
    try {
      await sdkOpen({ url: url.href });
      return true;
    } catch {
      // Browser fallback below is part of the platform contract.
    }
  }

  if (!options.window) return false;
  try {
    options.window.open(url.href, "_blank", "noopener,noreferrer");
    return true;
  } catch {
    return false;
  }
}
