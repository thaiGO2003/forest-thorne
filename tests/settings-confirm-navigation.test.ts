import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright-core";
import { createServer, type ViteDevServer } from "vite";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { App } from "../src/app/app";

describe("Settings return-to-menu navigation", () => {
  let server: ViteDevServer;
  let browser: Browser;
  let page: Page;
  let cacheDir: string;
  let previousNodeEnv: string | undefined;

  beforeAll(async () => {
    previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    cacheDir = await mkdtemp(join(tmpdir(), "forest-settings-vite-"));
    server = await createServer({ root: process.cwd(), mode: "development", cacheDir, optimizeDeps: { noDiscovery: true }, server: { host: "127.0.0.1", port: 0, hmr: false } });
    await server.listen();
    const address = server.httpServer?.address();
    if (!address || typeof address === "string") throw new Error("Vite did not bind a TCP port");
    browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader-webgl", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--mute-audio"] });
    page = await browser.newPage({ viewport: { width: 390, height: 600 } });

    // Weak keys ensure the instrumentation itself does not retain removed modal nodes.
    // Enumerate only live DOM nodes at measurement time; detached nodes are not evidence of a leak.
    await page.addInitScript(() => {
      type Listener = EventListenerOrEventListenerObject;
      type Entry = { listener: Listener; wrapped: EventListener; capture: boolean };
      const entries = new WeakMap<EventTarget, Map<string, Entry[]>>();
      const add = EventTarget.prototype.addEventListener;
      const remove = EventTarget.prototype.removeEventListener;
      EventTarget.prototype.addEventListener = function (type, listener, options) {
        if (!listener) return add.call(this, type, listener, options);
        const capture = typeof options === "boolean" ? options : Boolean(options?.capture);
        const signal = typeof options === "object" ? options?.signal : undefined;
        if (signal?.aborted) return;
        let byType = entries.get(this);
        if (!byType) entries.set(this, byType = new Map());
        let list = byType.get(type);
        if (!list) byType.set(type, list = []);
        if (list.some((entry) => entry.listener === listener && entry.capture === capture)) return;
        const target = this;
        const entry: Entry = {
          listener, capture,
          wrapped(event) {
            if (typeof options === "object" && options?.once) {
              const index = list!.indexOf(entry);
              if (index !== -1) list!.splice(index, 1);
            }
            if (typeof listener === "function") listener.call(target, event);
            else listener.handleEvent(event);
          },
        };
        list.push(entry);
        add.call(this, type, entry.wrapped, options);
        if (signal) {
          const weakTarget = new WeakRef(this);
          const weakEntry = new WeakRef(entry);
          add.call(signal, "abort", () => {
            const active = weakTarget.deref();
            const activeList = active && entries.get(active)?.get(type);
            const activeEntry = weakEntry.deref();
            const index = activeEntry ? activeList?.indexOf(activeEntry) ?? -1 : -1;
            if (index !== -1) activeList!.splice(index, 1);
          }, { once: true });
        }
      };
      EventTarget.prototype.removeEventListener = function (type, listener, options) {
        const capture = typeof options === "boolean" ? options : Boolean(options?.capture);
        const list = entries.get(this)?.get(type);
        const index = list?.findIndex((entry) => entry.listener === listener && entry.capture === capture) ?? -1;
        if (index !== -1) {
          const [entry] = list!.splice(index, 1);
          return remove.call(this, type, entry!.wrapped, options);
        }
        return remove.call(this, type, listener, options);
      };
      (window as Window & { __listenerCounts?: () => { window: number; document: number; connected: number } }).__listenerCounts = () => {
        const count = (target: EventTarget) => [...(entries.get(target)?.values() ?? [])].reduce((sum, list) => sum + list.length, 0);
        return {
          window: count(window), document: count(document),
          connected: [...document.querySelectorAll("*")].reduce((sum, node) => sum + count(node), 0),
        };
      };
    });
    await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean((window as Window & { __app?: App }).__app), null, { timeout: 120_000 });
    await page.evaluate(() => {
      const app = (window as Window & { __app?: App }).__app!;
      app.bridge.settings.save({ quality: "low", fpsLimit: 30, renderScale: 0.5, shadowsEnabled: false, audioEnabled: false, musicEnabled: false, ambientEnabled: false, uiSfxEnabled: false });
    });
  }, 160_000);

  afterAll(async () => {
    await page?.close();
    await browser?.close();
    await server?.close();
    if (cacheDir) await rm(cacheDir, { recursive: true, force: true });
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  });

  for (const dismissal of ["back", "cancel", "close", "escape"] as const) {
    it(`restores selected tab, option, focus and nonzero scroll after ${dismissal}`, async () => {
      const before = await page.evaluate(() => {
        const app = (window as Window & { __app?: App }).__app!;
        app.modals.closeActive("replace");
        app.go("menu");
        app.openPanel("settings");
        const root = document.querySelector<HTMLElement>('[data-modal="settings"]')!;
        const toggle = root.querySelector<HTMLButtonElement>(".settings-body .toggle-btn")!;
        const previousPressed = toggle.getAttribute("aria-pressed");
        toggle.click();
        const option = { enabled: app.bridge.settings.get().audioEnabled, muted: app.bridge.settings.get().audioMuted };
        const optionPressed = root.querySelector<HTMLButtonElement>(".settings-body .toggle-btn")!.getAttribute("aria-pressed");
        const tabs = root.querySelector<HTMLElement>(".tabs")!;
        const keys = tabs.querySelectorAll<HTMLButtonElement>("button")[2]!;
        keys.click();
        const body = root.querySelector<HTMLElement>(".settings-body")!;
        const focus = body.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")[2]!;
        focus.focus({ preventScroll: true });
        body.scrollTop = 120;
        tabs.scrollLeft = 80;
        const state = { option, bodyScroll: body.scrollTop, tabScroll: tabs.scrollLeft, focusText: focus.textContent, selected: keys.getAttribute("aria-pressed") };
        root.querySelector<HTMLButtonElement>(".modal-header-action")!.click();
        return { state, previousPressed, optionPressed };
      });
      expect(before.optionPressed).not.toBe(before.previousPressed);
      expect(before.state.selected).toBe("true");
      expect(before.state.bodyScroll).toBeGreaterThan(0);
      expect(before.state.tabScroll).toBeGreaterThan(0);
      expect(await page.locator('[data-modal="return-menu-confirm"]').count()).toBe(1);
      if (dismissal === "escape") await page.keyboard.press("Escape");
      else {
        const selector = dismissal === "back" ? ".modal-back" : dismissal === "cancel" ? ".dialog-actions button:first-child" : ".modal-close";
        await page.locator(`[data-modal="return-menu-confirm"] ${selector}`).evaluate((button: HTMLElement) => button.click());
      }
      const after = await page.evaluate(() => {
        const app = (window as Window & { __app?: App }).__app!;
        const root = document.querySelector<HTMLElement>('[data-modal="settings"]')!;
        return {
          option: { enabled: app.bridge.settings.get().audioEnabled, muted: app.bridge.settings.get().audioMuted },
          bodyScroll: root.querySelector<HTMLElement>(".settings-body")!.scrollTop,
          tabScroll: root.querySelector<HTMLElement>(".tabs")!.scrollLeft,
          focusText: document.activeElement?.textContent,
          selected: root.querySelectorAll<HTMLButtonElement>(".tabs button")[2]!.getAttribute("aria-pressed"),
        };
      });
      expect(after).toEqual(before.state);
      expect(await page.locator(".modal-root").count()).toBe(1);
    }, 90_000);
  }

  it("restores header focus after keyboard activation", async () => {
    await page.evaluate(() => {
      const app = (window as Window & { __app?: App }).__app!;
      app.modals.closeActive("replace");
      app.openPanel("settings");
    });
    const header = page.locator('[data-modal="settings"] .modal-header-action');
    await header.focus();
    await header.press("Enter");
    await page.locator('[data-modal="return-menu-confirm"] .modal-back').evaluate((button: HTMLElement) => button.click());
    expect(await page.evaluate(() => document.activeElement?.classList.contains("modal-header-action"))).toBe(true);
  }, 90_000);

  it("keeps active listener, canvas and history counts stable over 60 confirmation/Back cycles", async () => {
    const snapshots = await page.evaluate(() => {
      const app = (window as Window & { __app?: App }).__app!;
      app.modals.closeActive("replace");
      app.go("menu");
      app.openPanel("settings");
      const cycle = () => {
        document.querySelector<HTMLButtonElement>('[data-modal="settings"] .modal-header-action')!.click();
        document.querySelector<HTMLButtonElement>('[data-modal="return-menu-confirm"] .modal-back')!.click();
      };
      const listenerCounts = (window as Window & { __listenerCounts?: () => { window: number; document: number; connected: number } }).__listenerCounts;
      if (!listenerCounts) throw new Error("Listener instrumentation is unavailable");
      const snapshot = () => ({
        listeners: listenerCounts(),
        canvases: document.querySelectorAll("canvas").length,
        historyLength: history.length,
        historyState: JSON.stringify(history.state),
        modal: app.modals.active(),
        modalCount: document.querySelectorAll(".modal-root").length,
      });
      cycle();
      const baseline = snapshot();
      for (let i = 0; i < 60; i++) cycle();
      return { baseline, after: snapshot() };
    });
    console.info("Settings lifecycle snapshots:", JSON.stringify(snapshots));
    expect(snapshots.baseline.modal).toBe("settings");
    expect(snapshots.baseline.modalCount).toBe(1);
    expect(snapshots.after).toEqual(snapshots.baseline);
  }, 90_000);
});
