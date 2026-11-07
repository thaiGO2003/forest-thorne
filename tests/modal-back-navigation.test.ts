import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright-core";
import { createServer, type ViteDevServer } from "vite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The host must be imported inside the browser realm: a Node static import has no DOM.
// Exercise the actual host and asset-backed controls in a browser, without booting the game.
let server: ViteDevServer;
let browser: Browser;
let page: Page;
let origin: string;
let cacheDir: string;

beforeAll(async () => {
  cacheDir = mkdtempSync(join(tmpdir(), "modal-navigation-vite-"));
  server = await createServer({
    configFile: false, appType: "custom", cacheDir,
    optimizeDeps: { noDiscovery: true },
    server: { host: "127.0.0.1", port: 0, hmr: false },
  });
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === "string") throw new Error("Vite did not bind a TCP port");
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
}, 60_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
  if (cacheDir) rmSync(cacheDir, { recursive: true, force: true });
});

beforeEach(async () => {
  page = await browser.newPage();
  await page.route(`${origin}/`, (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><html><body><button id=opener>Open</button><div id=layer></div></body></html>" }));
  await page.goto(`${origin}/`);
});

afterEach(async () => { await page?.close(); });

describe("modal navigation", () => {
  it("replaces a modal without dismissing or focusing its opener; stale handles cannot close the replacement", async () => {
    const result = await page.evaluate(async () => {
      const path = "/src/ui/modal.ts";
      const { createModalHost } = await (new Function("specifier", "return import(specifier)"))(path);
      const layer = document.querySelector<HTMLElement>("#layer")!;
      const opener = document.querySelector<HTMLButtonElement>("#opener")!;
      opener.focus();
      let closed = 0;
      let openerFocuses = 0;
      opener.addEventListener("focus", () => openerFocuses++);
      const host = createModalHost(layer);
      const first = host.open({ id: "first", title: "First", onClose: () => closed++ });
      const oldClose = layer.querySelector<HTMLButtonElement>(".modal-close")!;
      host.open({ id: "second", title: "Second" });
      first.close();
      oldClose.click();
      const state = { closed, openerFocuses, active: host.active(), blocking: host.blocking(), roots: layer.querySelectorAll(".modal-root").length, focused: document.activeElement?.getAttribute("aria-label"), scroll: document.body.style.overflow };
      host.closeActive();
      const restored = document.activeElement === opener;
      host.dispose();
      return { ...state, restored, overflow: document.body.style.overflow };
    });
    expect(result).toEqual({ closed: 0, openerFocuses: 0, active: "second", blocking: true, roots: 1, focused: "Second", scroll: "hidden", restored: true, overflow: "" });
  });

  it("restores Back once without calling onClose and leaves root modals without Back", async () => {
    const result = await page.evaluate(async () => {
      const path = "/src/ui/modal.ts";
      const { createModalHost } = await (new Function("specifier", "return import(specifier)"))(path);
      const layer = document.querySelector<HTMLElement>("#layer")!;
      const host = createModalHost(layer);
      let restores = 0, closes = 0;
      host.open({ id: "root", title: "Root" });
      const rootHasBack = !!layer.querySelector(".modal-back");
      host.open({ id: "child", title: "Child", onClose: () => closes++, onBack: { label: "Return to root", restore: () => { restores++; host.open({ id: "root", title: "Root" }); } } });
      const back = layer.querySelector<HTMLButtonElement>(".modal-back")!;
      const label = back.getAttribute("aria-label");
      back.click();
      back.click();
      const state = { rootHasBack, label, restores, closes, active: host.active(), roots: layer.querySelectorAll(".modal-root").length, focused: document.activeElement?.getAttribute("aria-label") };
      host.dispose();
      return state;
    });
    expect(result).toEqual({ rootHasBack: false, label: "Return to root", restores: 1, closes: 0, active: "root", roots: 1, focused: "Root" });
  });

  it("dismisses once on close, Escape, and backdrop, without navigating Back", async () => {
    const result = await page.evaluate(async () => {
      const path = "/src/ui/modal.ts";
      const { createModalHost } = await (new Function("specifier", "return import(specifier)"))(path);
      const layer = document.querySelector<HTMLElement>("#layer")!;
      const host = createModalHost(layer);
      let closes = 0, restores = 0;
      const open = () => host.open({ id: "child", title: "Child", onClose: () => closes++, onBack: { label: "Back", restore: () => restores++ } });
      const first = open();
      const button = layer.querySelector<HTMLButtonElement>(".modal-close")!;
      button.click(); button.click(); first.close();
      open();
      const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
      window.dispatchEvent(escape);
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      open();
      const shade = layer.querySelector<HTMLElement>(".modal-shade")!;
      shade.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      shade.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      const state = { closes, restores, prevented: escape.defaultPrevented, active: host.active(), blocking: host.blocking(), roots: layer.querySelectorAll(".modal-root").length, open: layer.dataset.open };
      host.dispose();
      return state;
    });
    expect(result).toEqual({ closes: 3, restores: 0, prevented: true, active: null, blocking: false, roots: 0, open: "false" });
  });

  it("does not allow Escape or backdrop dismissal of a mandatory modal", async () => {
    const result = await page.evaluate(async () => {
      const path = "/src/ui/modal.ts";
      const { createModalHost } = await (new Function("specifier", "return import(specifier)"))(path);
      const layer = document.querySelector<HTMLElement>("#layer")!;
      const host = createModalHost(layer);
      let closes = 0, restores = 0;
      host.open({ id: "mandatory", title: "Choose", dismissible: false, onClose: () => closes++, onBack: { label: "Back", restore: () => restores++ } });
      const escape = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
      window.dispatchEvent(escape);
      layer.querySelector(".modal-shade")!.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      const state = { active: host.active(), closes, restores, prevented: escape.defaultPrevented, close: !!layer.querySelector(".modal-close"), back: !!layer.querySelector(".modal-back") };
      host.dispose();
      return state;
    });
    expect(result).toEqual({ active: "mandatory", closes: 0, restores: 0, prevented: false, close: false, back: false });
  });

  it("does not focus a disconnected opener or steal focus from a modal opened by onClose", async () => {
    const result = await page.evaluate(async () => {
      const path = "/src/ui/modal.ts";
      const { createModalHost } = await (new Function("specifier", "return import(specifier)"))(path);
      const layer = document.querySelector<HTMLElement>("#layer")!;
      const opener = document.querySelector<HTMLButtonElement>("#opener")!;
      const host = createModalHost(layer);
      opener.focus();
      let focusCalls = 0;
      opener.focus = () => { focusCalls++; };
      host.open({ id: "first", title: "First" });
      opener.remove();
      host.closeActive();
      const disconnectedCalls = focusCalls;
      document.body.append(opener);
      HTMLElement.prototype.focus.call(opener);
      host.open({ id: "second", title: "Second", onClose: () => host.open({ id: "next", title: "Next" }) });
      host.closeActive();
      const state = { disconnectedCalls, focusCalls, active: host.active(), focused: document.activeElement?.getAttribute("aria-label"), roots: layer.querySelectorAll(".modal-root").length };
      host.dispose();
      return state;
    });
    expect(result).toEqual({ disconnectedCalls: 0, focusCalls: 0, active: "next", focused: "Next", roots: 1 });
  });

  it("does not expose a transient empty state when replacing a modal", async () => {
    const result = await page.evaluate(async () => {
      const path = "/src/ui/modal.ts";
      const { createModalHost } = await (new Function("specifier", "return import(specifier)"))(path);
      const layer = document.querySelector<HTMLElement>("#layer")!;
      const host = createModalHost(layer);
      const seen: (string | null)[] = [];
      const unsubscribe = host.onChange((id: string | null) => {
        seen.push(id);
        if (id === null) host.open({ id: "unexpected", title: "Unexpected" });
      });
      host.open({ id: "first", title: "First" });
      host.open({ id: "second", title: "Second" });
      const state = { seen: [...seen], active: host.active(), roots: layer.querySelectorAll(".modal-root").length };
      unsubscribe();
      host.dispose();
      return state;
    });
    expect(result).toEqual({ seen: ["first", "second"], active: "second", roots: 1 });
  });

  it("serializes reentrant change notifications and removes keyboard and change listeners", async () => {
    const result = await page.evaluate(async () => {
      const path = "/src/ui/modal.ts";
      const { createModalHost } = await (new Function("specifier", "return import(specifier)"))(path);
      const layer = document.querySelector<HTMLElement>("#layer")!;
      const add = window.addEventListener.bind(window);
      const remove = window.removeEventListener.bind(window);
      let keydownAdds = 0, keydownRemoves = 0;
      window.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
        if (type === "keydown") keydownAdds++;
        add(type, listener, options);
      }) as typeof window.addEventListener;
      window.removeEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) => {
        if (type === "keydown") keydownRemoves++;
        remove(type, listener, options);
      }) as typeof window.removeEventListener;
      const host = createModalHost(layer);
      const seen: (string | null)[] = [];
      host.onChange((id: string | null) => { if (id === "first") host.open({ id: "second", title: "Second" }); });
      const unsubscribe = host.onChange((id: string | null) => seen.push(id));
      host.open({ id: "first", title: "First" });
      const active = host.active();
      const roots = layer.querySelectorAll(".modal-root").length;
      unsubscribe();
      host.closeActive();
      host.dispose();
      const other = createModalHost(layer);
      other.open({ id: "other", title: "Other" });
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", cancelable: true }));
      const otherActive = other.active();
      other.dispose();
      return { seen, active, roots, otherActive, keydownAdds, keydownRemoves };
    });
    expect(result).toEqual({ seen: ["first", "second"], active: "second", roots: 1, otherActive: null, keydownAdds: 2, keydownRemoves: 2 });
  });
});
