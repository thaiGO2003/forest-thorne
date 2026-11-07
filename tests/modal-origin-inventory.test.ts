import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright-core";
import { createServer, type ViteDevServer } from "vite";
import type { App } from "../src/app/app";

describe("Planning owned-inventory modal origins", () => {
  let server: ViteDevServer;
  let browser: Browser;
  let page: Page;
  let previousNodeEnv: string | undefined;

  beforeAll(async () => {
    previousNodeEnv = process.env.NODE_ENV;
    // The QA app seam is guarded by import.meta.env.DEV; external production NODE_ENV
    // must not silently turn this real-browser fixture into an untestable page.
    process.env.NODE_ENV = "development";
    server = await createServer({
      root: process.cwd(),
      mode: "development",
      server: { host: "127.0.0.1", port: 0, hmr: false },
    });
    await server.listen();
    const address = server.httpServer?.address();
    if (!address || typeof address === "string") throw new Error("Vite did not bind a TCP port");

    browser = await chromium.launch({
      headless: true,
      args: ["--use-angle=swiftshader-webgl", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--mute-audio"],
    });
    page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => Boolean((window as Window & { __app?: App }).__app),
      null,
      { polling: 150, timeout: 120_000 },
    );
    await page.evaluate(() => {
      const app = (window as Window & { __app?: App }).__app!;
      app.bridge.settings.save({
        quality: "low",
        fpsLimit: 30,
        renderScale: 0.5,
        shadowsEnabled: false,
        audioEnabled: false,
        musicEnabled: false,
        ambientEnabled: false,
        uiSfxEnabled: false,
      });
    });
  }, 160_000);

  afterAll(async () => {
    await page?.close();
    await browser?.close();
    await server?.close();
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  });

  beforeEach(async () => {
    await page.evaluate(() => {
      const app = (window as Window & { __app?: App }).__app!;
      app.modals.closeActive("replace");
      app.go("menu");
      const run = app.bridge.newRun("EndlessPvEClassic", "MEDIUM");
      run.round = 4;
      run.gold = 24;
      run.board[12] = {
        uid: "qa-ally", baseId: "jaguar_hunt", star: 2, equips: [], traits: [],
      };
      run.bench = [{
        uid: "qa-bench", baseId: "jaguar_hunt", star: 1, equips: [], traits: [],
      }];
      app.bridge.checkpoint("EVENT", "Modal origin regression fixture");
      app.go("planning");
    });
    await page.waitForFunction(
      () => (window as Window & { __app?: App }).__app?.route() === "planning",
      null, { polling: 150, timeout: 20_000 },
    );
  }, 30_000);

  async function openLibraryFromOwnedUnit() {
    await page.evaluate(() => (window as Window & { __app?: App }).__app!.presentation.openOwnedInventory?.("qa-ally"));
    expect(await page.locator('[data-modal="unit-inventory"] .ui-inventory[data-uid="qa-ally"]').count()).toBe(1);
    const opener = page.locator('[data-modal="unit-inventory"] .ui-inventory-footer button').last();
    await opener.focus();
    // Native keyboard activation avoids WebGL-heavy pointer hit-testing delays.
    await opener.press("Enter", { timeout: 8_000 });
    expect(await page.locator('[data-modal="library"]').count()).toBe(1);
    expect(await page.locator(".modal-back").count()).toBe(1);
  }

  it("returns Library → owned inventory → Planning and restores the original Planning focus", async () => {
    await page.evaluate(() => {
      const app = (window as Window & { __app?: App }).__app!;
      const opener = app.layers.hud.querySelector<HTMLElement>("button,[tabindex]")!;
      opener.dataset.qaOrigin = "true";
      opener.focus();
    });
    await openLibraryFromOwnedUnit();
    await page.locator(".modal-back").press("Enter", { timeout: 8_000 });
    expect(await page.locator('[data-modal="unit-inventory"] .ui-inventory').getAttribute("data-uid")).toBe("qa-ally");
    await page.locator(".modal-back").press("Enter", { timeout: 8_000 });
    expect(await page.locator(".modal-root").count()).toBe(0);
    expect(await page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.qaOrigin)).toBe("true");
  }, 90_000);

  it("focuses the Planning HUD when the original opener is not focusable", async () => {
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
      (window as Window & { __app?: App }).__app!.presentation.openOwnedInventory?.("qa-ally");
    });
    await page.locator(".modal-back").press("Enter", { timeout: 8_000 });
    expect(await page.evaluate(() => {
      const app = (window as Window & { __app?: App }).__app!;
      return app.layers.hud.contains(document.activeElement);
    })).toBe(true);
  }, 90_000);

  it("restores the exact owned UID and freshly equipped item instead of stale Library-opening data", async () => {
    await openLibraryFromOwnedUnit();
    await page.evaluate(() => {
      const run = (window as Window & { __app?: App }).__app!.bridge.run()!;
      run.board[12]!.equips = ["eq_blue_buff"];
    });
    await page.locator(".modal-back").press("Enter", { timeout: 8_000 });

    const inventory = page.locator('[data-modal="unit-inventory"] .ui-inventory');
    expect(await inventory.getAttribute("data-uid")).toBe("qa-ally");
    expect((await inventory.locator(".ui-inventory-equipment .ui-inventory-item-name").allTextContents()).some((name) => name.includes("Bùa Xanh"))).toBe(true);
    expect(await inventory.locator(".ui-inventory-equipment .ui-inventory-section-head").textContent()).toContain("1/3");
    expect(await page.locator(".modal-root").count()).toBe(1);
    await page.waitForFunction(() => document.activeElement?.textContent?.includes("Thư viện") === true, null, { polling: 100, timeout: 5_000 });
  }, 90_000);

  it("does not resurrect a removed UID or another unit of the same species on Back", async () => {
    await openLibraryFromOwnedUnit();
    await page.evaluate(() => {
      const run = (window as Window & { __app?: App }).__app!.bridge.run()!;
      run.board[12] = null;
    });
    await page.locator(".modal-back").press("Enter", { timeout: 8_000 });

    expect(await page.locator(".modal-root").count()).toBe(0);
    const state = await page.evaluate(() => {
      const app = (window as Window & { __app?: App }).__app!;
      return {
        route: app.route(),
        modal: app.modals.active(),
        benchUid: app.bridge.run()?.bench[0]?.uid ?? null,
        inventory: document.querySelector(".ui-inventory")?.getAttribute("data-uid") ?? null,
        focusedInHud: app.layers.hud.contains(document.activeElement),
      };
    });
    expect(state).toEqual({
      route: "planning",
      modal: null,
      benchUid: "qa-bench",
      inventory: null,
      focusedInHud: true,
    });
  }, 90_000);
});
