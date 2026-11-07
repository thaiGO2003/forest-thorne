import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright-core";
import { createServer, type ViteDevServer } from "vite";

// Exercise the real DOM and crafting views in Chromium without booting the 3D game.
describe("crafting local navigation", () => {
  let server: ViteDevServer;
  let browser: Browser;
  let page: Page;
  let origin: string;

  beforeAll(async () => {
    server = await createServer({ configFile: false, appType: "custom", root: process.cwd(), server: { port: 0, host: "127.0.0.1", hmr: false } });
    server.middlewares.use("/__craft_history", (_req, res) => {
      res.setHeader("Content-Type", "text/html");
      res.end('<!doctype html><html><head><style>.craft-graph-zoom { width: 100px; height: 50px; overflow: auto } .craft-graph { min-width: 1000px; min-height: 1000px }</style></head><body><div class="modal-root"><div id="host"></div></div></body></html>');
    });
    await server.listen();
    const address = server.httpServer!.address();
    if (!address || typeof address === "string") throw new Error("Vite did not bind a TCP port");
    origin = `http://127.0.0.1:${address.port}`;
    browser = await chromium.launch({ headless: true });
  }, 30_000);

  afterEach(async () => { await page?.close(); });
  afterAll(async () => { await browser?.close(); await server?.close(); });

  async function mount() {
    page = await browser.newPage();
    await page.goto(`${origin}/__craft_history`);
    await page.evaluate(async () => {
      const path = "/src/ui/crafting/workbench.ts";
      const { mountCraftWorkbench } = await (new Function("specifier", "return import(specifier)"))(path);
      // This import crosses into the browser's Vite module graph; a Node import cannot provide its DOM.
      const state = { phase: "PLANNING", craftTableLevel: 3, itemBag: ["bark", "tear", "crystal"] };
      const app = {
        bridge: { run: () => state, craftStaging: () => Array(9).fill(null), onChange: () => () => {} },
        tooltip: { hide: () => {}, bind: () => () => {} },
      };
      const workbench = mountCraftWorkbench(app, document.querySelector("#host")!);
      Object.assign(window, { disposeCraftFixture: () => workbench.dispose() });
    });
  }

  it("returns item → library → workbench, retaining the suspended library state", async () => {
    await mount();
    const result = await page.evaluate(() => {
      const get = <T extends HTMLElement>(selector: string): T => {
        const el = document.querySelector<T>(selector);
        if (!el) throw new Error(`Missing ${selector}`);
        return el;
      };
      const opener = get<HTMLButtonElement>(".craft-library-button");
      opener.focus();
      opener.click();
      const library = get<HTMLElement>(".craft-overlay");
      const search = get<HTMLInputElement>(".craft-library-search input");
      const card = get<HTMLButtonElement>(".craft-graph-card");
      const query = card.querySelector("strong")!.textContent!;
      search.value = query;
      search.dispatchEvent(new Event("input", { bubbles: true }));
      get<HTMLButtonElement>(".craft-graph-card").click();
      const selected = get<HTMLElement>('.craft-graph-card[data-selected="true"]').dataset.output;
      const scroll = get<HTMLElement>(".craft-graph-zoom");
      scroll.scrollTop = 120;
      scroll.scrollLeft = 80;
      search.focus();
      get<HTMLButtonElement>(".craft-library-info").click();
      const suspended = { hidden: library.style.display, inert: library.inert, overlays: document.querySelectorAll(".craft-overlay").length };
      get<HTMLButtonElement>(".craft-overlay:not([style*='display: none']) .craft-overlay-back").click();
      const restored = {
        sameLibrary: get(".craft-overlay") === library,
        input: search.value,
        selected: get<HTMLElement>('.craft-graph-card[data-selected="true"]').dataset.output,
        scrollTop: scroll.scrollTop,
        scrollLeft: scroll.scrollLeft,
        focused: document.activeElement === search,
        hidden: library.style.display,
        inert: library.inert,
        modalClass: get(".modal-root").classList.contains("craft-overlay-open"),
      };
      get<HTMLButtonElement>(".craft-overlay-back").click();
      return {
        query, selected, suspended, restored,
        overlaysAfterBack: document.querySelectorAll(".craft-overlay").length,
        workbenchInert: get(".crafting-workbench").inert,
        openerFocused: document.activeElement === opener,
        modalClass: get(".modal-root").classList.contains("craft-overlay-open"),
      };
    });
    expect(result.suspended).toEqual({ hidden: "none", inert: true, overlays: 2 });
    expect(result.restored).toEqual({ sameLibrary: true, input: result.query, selected: result.selected, scrollTop: 120, scrollLeft: 80, focused: true, hidden: "", inert: false, modalClass: true });
    expect(result.overlaysAfterBack).toBe(0);
    expect(result.workbenchInert).toBe(false);
    expect(result.openerFocused).toBe(true);
    expect(result.modalClass).toBe(false);
  });

  for (const depth of [1, 2]) for (const method of ["Escape", "close"] as const) {
    it(`${method} dismisses the entire child flow at depth ${depth}`, async () => {
      await mount();
      const result = await page.evaluate(({ depth, method }) => {
        const get = <T extends HTMLElement>(selector: string): T => {
          const el = document.querySelector<T>(selector);
          if (!el) throw new Error(`Missing ${selector}`);
          return el;
        };
        const opener = get<HTMLButtonElement>(".craft-library-button");
        opener.focus();
        opener.click();
        if (depth === 2) {
          get<HTMLButtonElement>(".craft-graph-card").click();
          get<HTMLButtonElement>(".craft-library-info").click();
        }
        if (method === "Escape") window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
        else get<HTMLButtonElement>(".craft-overlay:not([style*='display: none']) .kit-close").click();
        return {
          overlays: document.querySelectorAll(".craft-overlay").length,
          inert: get(".crafting-workbench").inert,
          focused: document.activeElement === opener,
          modalClass: get(".modal-root").classList.contains("craft-overlay-open"),
        };
      }, { depth, method });
      expect(result).toEqual({ overlays: 0, inert: false, focused: true, modalClass: false });
    });
  }

  it("cleans up overlays and local history over 50 open/back/dismiss cycles", async () => {
    await mount();
    const result = await page.evaluate(() => {
      const get = <T extends HTMLElement>(selector: string): T => {
        const el = document.querySelector<T>(selector);
        if (!el) throw new Error(`Missing ${selector}`);
        return el;
      };
      const root = get(".modal-root");
      const baseline = root.querySelectorAll("*").length;
      const failures: number[] = [];
      for (let i = 0; i < 50; i++) {
        get<HTMLButtonElement>(".craft-library-button").click();
        get<HTMLButtonElement>(".craft-graph-card").click();
        get<HTMLButtonElement>(".craft-library-info").click();
        get<HTMLButtonElement>(".craft-overlay:not([style*='display: none']) .craft-overlay-back").click();
        get<HTMLButtonElement>(".craft-overlay-back").click();
        const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
        window.dispatchEvent(escape);
        if (escape.defaultPrevented || root.querySelectorAll(".craft-overlay").length || root.querySelectorAll("*").length !== baseline || root.classList.contains("craft-overlay-open") || get(".crafting-workbench").inert) failures.push(i);
      }
      if (!("disposeCraftFixture" in window) || typeof window.disposeCraftFixture !== "function") throw new Error("Missing fixture disposer");
      window.disposeCraftFixture();
      return { failures, remaining: root.querySelectorAll(".crafting-workbench, .craft-overlay").length };
    });
    expect(result).toEqual({ failures: [], remaining: 0 });
  }, 60_000);
});
