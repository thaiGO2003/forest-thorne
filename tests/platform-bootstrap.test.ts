import { describe, expect, it, vi } from "vitest";
import {
  APP_DISPLAY_VERSION,
  APP_LAST_UPDATED,
  APP_VERSION,
  APP_VERSION_TAG,
  formatAppVersion,
  normalizeAppVersion,
} from "../src/core/appMeta";
import { BOOT_WATCHDOG_MS, createBootWatchdog } from "../src/app/bootWatchdog";
import {
  initializeDiscordActivity,
  isDiscordEmbeddedActivity,
  openExternalHttpUrl,
} from "../src/platform/discordActivity";

describe("app metadata", () => {
  it("uses package.json as version authority and formats only x.y.0", () => {
    expect(APP_VERSION).toBe("0.1.0");
    expect(APP_DISPLAY_VERSION).toBe("0.1");
    expect(APP_VERSION_TAG).toBe("v0.1");
    expect(APP_LAST_UPDATED).toBe("N/A");
    expect(normalizeAppVersion(" ")).toBe("0.0.0");
    expect(formatAppVersion("2.5.0")).toBe("2.5");
    expect(formatAppVersion("2.5.1")).toBe("2.5.1");
    expect(formatAppVersion("2.5.0-beta.1")).toBe("2.5.0-beta.1");
  });
});

describe("Discord activity", () => {
  const href = "https://game.test/?frame_id=f&instance_id=i&platform=desktop";

  it("requires browser, client id and all three Discord query values", async () => {
    expect(isDiscordEmbeddedActivity({ windowExists: true, clientId: "123", href })).toBe(true);
    expect(isDiscordEmbeddedActivity({ windowExists: false, clientId: "123", href })).toBe(false);
    expect(isDiscordEmbeddedActivity({ windowExists: true, clientId: "", href })).toBe(false);
    expect(isDiscordEmbeddedActivity({ windowExists: true, clientId: "123", href: "https://game.test/?frame_id=f" })).toBe(false);

    const calls: string[] = [];
    const sdk = await initializeDiscordActivity({
      windowExists: true,
      clientId: " 123 ",
      href,
      createSdk(clientId) {
        calls.push(`create:${clientId}`);
        return { ready: async () => { calls.push("ready"); } };
      },
    });
    expect(sdk).not.toBeNull();
    expect(calls).toEqual(["create:123", "ready"]);
  });

  it("accepts only http(s), prefers SDK and falls back to browser open", async () => {
    const browserOpen = vi.fn();
    const sdkOpen = vi.fn(async () => undefined);
    expect(await openExternalHttpUrl("javascript:alert(1)", { window: { open: browserOpen } })).toBe(false);
    expect(await openExternalHttpUrl("https://example.com/path", {
      sdk: { ready: async () => undefined, commands: { openExternalLink: sdkOpen } },
      window: { open: browserOpen },
    })).toBe(true);
    expect(sdkOpen).toHaveBeenCalledWith({ url: "https://example.com/path" });
    expect(browserOpen).not.toHaveBeenCalled();

    const failingSdk = vi.fn(async () => { throw new Error("discord unavailable"); });
    expect(await openExternalHttpUrl("http://example.com", {
      sdk: { ready: async () => undefined, commands: { openExternalLink: failingSdk } },
      window: { open: browserOpen },
    })).toBe(true);
    expect(browserOpen).toHaveBeenCalledWith("http://example.com/", "_blank", "noopener,noreferrer");
  });
});

describe("boot watchdog", () => {
  it("fires at 10 seconds only while boot has neither completed nor created an app", () => {
    let callback: (() => void) | null = null;
    let delay = 0;
    let timedOut = 0;
    createBootWatchdog({
      isBootComplete: () => false,
      hasAppInstance: () => false,
      onTimeout: () => { timedOut++; },
      setTimer(fn, ms) { callback = fn; delay = ms; return 1 as unknown as ReturnType<typeof setTimeout>; },
      clearTimer: () => undefined,
    });
    expect(delay).toBe(BOOT_WATCHDOG_MS);
    expect(callback).not.toBeNull();
    (callback as unknown as () => void)();
    expect(timedOut).toBe(1);
  });
});
