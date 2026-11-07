import { DiscordSDK } from "@discord/embedded-app-sdk";

const DISCORD_ACTIVITY_QUERY_KEYS = Object.freeze(["frame_id", "instance_id", "platform"]);

export function getDiscordClientId(env: ImportMetaEnv = import.meta.env): string {
  const raw = env?.VITE_DISCORD_CLIENT_ID;
  return typeof raw === "string" ? raw.trim() : "";
}


export function hasDiscordActivityQueryParams(search: string = globalThis?.location?.search ?? ""): boolean {
  const params = new URLSearchParams(typeof search === "string" ? search : "");
  return DISCORD_ACTIVITY_QUERY_KEYS.every((key) => {
    const value = params.get(key);
    return typeof value === "string" && value.trim().length > 0;
  });
}

interface DiscordActivityRuntimeOptions {
  env?: ImportMetaEnv;
  search?: string;
  windowObject?: Window & typeof globalThis;
  sdkFactory?: (clientId: string) => DiscordSDK;
}

export function isDiscordActivityEnvironment({
  env = import.meta.env,
  search = globalThis?.location?.search ?? "",
  windowObject = globalThis?.window
}: DiscordActivityRuntimeOptions = {}): boolean {
  return Boolean(windowObject && getDiscordClientId(env) && hasDiscordActivityQueryParams(search));
}

export function createDiscordActivityRuntime({
  env = import.meta.env,
  search = globalThis?.location?.search ?? "",
  windowObject = globalThis?.window,
  sdkFactory = (clientId: string) => new DiscordSDK(clientId)
}: DiscordActivityRuntimeOptions = {}) {
  const clientId = getDiscordClientId(env);
  const isDiscordActivity = Boolean(windowObject && clientId && hasDiscordActivityQueryParams(search));
  const sdk = isDiscordActivity ? sdkFactory(clientId) : null;

  return {
    clientId,
    isDiscordActivity,
    async ready(): Promise<boolean> {
      if (!sdk) return false;
      await sdk.ready();
      return true;
    },
    async openExternal(url: string): Promise<boolean> {
      if (typeof url !== "string" || !url.trim()) return false;

      if (sdk) {
        try {
          await sdk.commands.openExternalLink({ url });
          return true;
        } catch (error) {
          console.warn("[DiscordActivity] Falling back to window.open for external link", error);
        }
      }

      if (typeof windowObject?.open === "function") {
        windowObject.open(url, "_blank", "noopener,noreferrer");
        return true;
      }

      return false;
    }
  };
}

export const discordActivityRuntime = createDiscordActivityRuntime();

export const isDiscordActivity = discordActivityRuntime.isDiscordActivity;

export function openExternalLink(url: string): Promise<boolean> {
  return discordActivityRuntime.openExternal(url);
}
