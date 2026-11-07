import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium } from "playwright-core";
import { createServer } from "vite";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let server, browser, page, origin, cacheDir;

beforeAll(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), "forest-library-vite-"));
  server = await createServer({ configFile: false, appType: "custom", cacheDir, optimizeDeps: { noDiscovery: true }, server: { host: "127.0.0.1", port: 0 } });
  await server.listen();
  const address = server.httpServer.address();
  if (!address || typeof address === "string") throw new Error("Vite did not bind a TCP port");
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
});
afterAll(async () => { await browser?.close(); await server?.close(); if (cacheDir) await rm(cacheDir, { recursive: true, force: true }); });
beforeEach(async () => {
  page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.route(`${origin}/`, (route) => route.fulfill({ contentType: "text/html", body: `<!doctype html><html><head><link rel="stylesheet" href="/src/ui/ui.css"><style>
    /* Make both scroll containers and a one-card page measurable independent of viewport/fonts. */
    .modal-body { height: 120px !important; flex: none !important; overflow: auto !important; }
    .lib { height: auto !important; min-height: 500px !important; }
    .lib-grid { flex: none !important; width: 140px !important; height: 80px !important; display: grid !important; grid-template-columns: 1fr !important; overflow: auto !important; }
    .lib-card { height: 240px !important; }
  </style></head><body><button id="opener">Open</button><div id="layer"></div></body></html>` }));
  await page.goto(`${origin}/`);
  await page.evaluate(async () => {
    const load = new Function("path", "return import(path)");
    const [{ createModalHost }, { mountLibrary }, { UNITS }, { hasUnitVisual }, { t }] = await Promise.all([
      load("/src/ui/modal.ts"), load("/src/ui/library.ts"), load("/src/content/catalog.ts"),
      load("/src/content/unitVisuals.ts"), load("/src/core/i18n.ts"),
    ]);
    // The released visual catalog has no two units sharing all three filters.
    const hawk = UNITS.find((u) => u.id === "hawk_hunter");
    if (!hawk) throw new Error("Missing hawk fixture");
    hawk.faction = "BEAST";
    const timers = new Map();
    const nativeSetTimeout = window.setTimeout.bind(window);
    const nativeClearTimeout = window.clearTimeout.bind(window);
    let timerId = -1;
    window.setTimeout = (fn, delay, ...args) => {
      if (delay >= 4000 && delay <= 9000) { const id = timerId--; timers.set(id, () => fn(...args)); return id; }
      return nativeSetTimeout(fn, delay, ...args);
    };
    window.clearTimeout = (id) => { if (id < 0) timers.delete(id); else nativeClearTimeout(id); };
    // setUnit recreates the real rig and clears its preview action (portraits.ts).
    // This stateful viewer double models that reset instead of merely recording calls.
    const viewerState = { action: "idle", unit: null, star: 1, skin: null };
    const portraits = {
      get: () => null, onReady: () => () => {},
      createViewer: () => ({
        setUnit: (unit, star, skin = null) => Object.assign(viewerState, { unit, star, skin, action: "idle" }),
        setCombat: () => {},
        play: (action) => { viewerState.action = action; },
        moveCamera: () => {}, zoomBy: () => {}, resetView: () => {},
        dispose: () => {},
      }),
    };
    const skinUnit = UNITS.find((u) => u.skin && hasUnitVisual(u.id));
    if (!skinUnit) throw new Error("No visual unit with a skin in the production catalog");
    const profile = { unlockedSkinIds: [skinUnit.skin.id], equippedSkinByUnitId: {} };
    const account = {
      collectionProfile: () => profile,
      equipCollectionSkin: (id, skin) => { if (skin) profile.equippedSkinByUnitId[id] = skin; else delete profile.equippedSkinByUnitId[id]; return true; },
    };
    const tip = { hide: () => {}, bind: () => () => {} };
    const host = createModalHost(document.querySelector("#layer"));
    let view;
    const open = () => {
      const modal = host.open({ id: "library", title: "Library", onClose: () => view?.dispose() });
      view = mountLibrary(modal, portraits, tip, account);
    };
    window.libraryFixture = { open, close: () => host.closeActive(), timers, skinUnit, t, UNITS, hasUnitVisual, profile, viewerState };
    open();
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
});
afterEach(async () => { await page?.close(); });

const settle = (page) => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

describe("Library detail session navigation", () => {
  it("restores query, role, faction, tier, non-first page, both scroll positions and originating card focus", async () => {
    const before = await page.evaluate(() => {
      const f = window.libraryFixture;
      // Rabbit and the fixture-adjusted hawk share these filters and query.
      const candidates = f.UNITS.filter((u) => f.hasUnitVisual(u.id) && u.role === "FIGHTER" && u.faction === "BEAST" && u.tier === 2 && (u.id.includes("a") || u.nameVi.toLowerCase().includes("a")));
      if (candidates.length < 2) throw new Error("Browse fixture requires at least two matching visual units");
      const input = document.querySelector(".lib-input");
      input.value = "a"; input.dispatchEvent(new Event("input", { bubbles: true }));
      const chip = (label) => [...document.querySelectorAll(".lib-chip")].find((el) => el.getAttribute("aria-label") === label);
      for (const label of [f.t("role.FIGHTER"), f.t("faction.BEAST"), f.t("library.tier", { tier: 2 })]) {
        const button = chip(label); if (!button) throw new Error(`Missing filter ${label}`); button.click();
      }
      document.querySelectorAll(".lib-page")[1].click();
      const grid = document.querySelector(".lib-grid"), body = document.querySelector(".modal-body");
      grid.scrollTop = 50; body.scrollTop = 40;
      const card = grid.querySelector("[data-library-unit]");
      card.focus({ preventScroll: true });
      const state = { id: card.dataset.libraryUnit, count: document.querySelector(".lib-count").textContent, previousDisabled: document.querySelector(".lib-page").disabled,
        selected: [...document.querySelectorAll('.lib-chip[aria-pressed="true"]')].map((el) => el.getAttribute("aria-label")),
        gridScroll: grid.scrollTop, modalScroll: body.scrollTop };
      card.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      return state;
    });
    expect(before.gridScroll).toBeGreaterThan(0);
    expect(before.previousDisabled).toBe(false);
    expect(before.modalScroll).toBeGreaterThan(0);
    expect(before.selected).toHaveLength(3);
    await page.locator(".lib-back").evaluate((el) => el.click());
    await settle(page);
    const after = await page.evaluate(() => ({
      query: document.querySelector(".lib-input").value,
      count: document.querySelector(".lib-count").textContent,
      selected: [...document.querySelectorAll('.lib-chip[aria-pressed="true"]')].map((el) => el.getAttribute("aria-label")),
      gridScroll: document.querySelector(".lib-grid").scrollTop,
      modalScroll: document.querySelector(".modal-body").scrollTop,
      id: document.activeElement?.dataset.libraryUnit,
    }));
    expect(after).toEqual({ query: "a", count: before.count, selected: before.selected, gridScroll: before.gridScroll, modalScroll: before.modalScroll, id: before.id });
  });

  it("keeps star, skin and animation through detail changes, but resets transient state on reopening", async () => {
    const result = await page.evaluate(() => {
      const f = window.libraryFixture;
      const input = document.querySelector(".lib-input");
      input.value = f.skinUnit.id; input.dispatchEvent(new Event("input", { bubbles: true }));
      document.querySelector("[data-library-unit]").click();
      const actions = document.querySelectorAll(".lib-actions button");
      actions[2].click(); // attack (idle, beast form, attack)
      document.querySelectorAll(".lib-stars button")[2].click();
      const actionAfterStar = document.querySelectorAll(".lib-actions button")[2].getAttribute("aria-pressed");
      const viewerAfterStar = { ...f.viewerState };
      document.querySelectorAll(".lib-skin-actions button")[2].click(); // owned stage 2
      const actionAfterSkin = document.querySelectorAll(".lib-actions button")[2].getAttribute("aria-pressed");
      const viewerAfterSkin = { ...f.viewerState };
      const selectedSkin = document.querySelectorAll(".lib-skin-actions button")[2].getAttribute("aria-pressed");
      const selectedStar = [...document.querySelectorAll('.lib-stars button')].findIndex((el) => el.getAttribute("aria-pressed") === "true") + 1;
      const activeTimersDuringAttack = f.timers.size;
      document.querySelector(".lib-back").click();
      document.querySelector("[data-library-unit]").click();
      const idleSelected = document.querySelector(".lib-actions button").getAttribute("aria-pressed");
      const timersAfterBack = f.timers.size;
      f.close();
      const timersAfterClose = f.timers.size;
      f.open();
      const rootSearch = document.querySelector(".lib-input").value;
      const rootSelected = document.querySelectorAll('.lib-chip[aria-pressed="true"]').length;
      const search = document.querySelector(".lib-input");
      search.value = f.skinUnit.id; search.dispatchEvent(new Event("input", { bubbles: true }));
      document.querySelector("[data-library-unit]").click();
      return { actionAfterStar, actionAfterSkin, selectedSkin, selectedStar, activeTimersDuringAttack, viewerAfterStar, viewerAfterSkin,
        idleSelected, timersAfterBack, timersAfterClose, rootSearch, rootSelected, rootTimers: f.timers.size, rootViewer: { ...f.viewerState },
        rootStar: document.querySelector(".lib-stars button").getAttribute("aria-pressed"),
        rootIdle: document.querySelector(".lib-actions button").getAttribute("aria-pressed"),
        equippedSkin: document.querySelector(".lib-skin-actions button:nth-child(2)").getAttribute("aria-pressed") };
    });
    expect(result.actionAfterStar).toBe("true");
    expect(result.actionAfterSkin).toBe("true");
    expect(result.viewerAfterStar).toMatchObject({ star: 3, action: "attack" });
    expect(result.viewerAfterSkin).toMatchObject({ star: 2, action: "attack" });
    expect(result.viewerAfterSkin.skin).not.toBeNull();
    expect(result.selectedSkin).toBe("true");
    expect(result.selectedStar).toBe(2);
    expect(result.activeTimersDuringAttack).toBe(0);
    expect(result.idleSelected).toBe("true");
    expect(result.timersAfterBack).toBe(1);
    expect(result.timersAfterClose).toBe(0);
    expect(result.rootSearch).toBe("");
    expect(result.rootSelected).toBe(0);
    expect(result.rootStar).toBe("true");
    expect(result.rootIdle).toBe("true");
    expect(result.rootViewer).toMatchObject({ star: 1, action: "idle" });
    expect(result.equippedSkin).toBe("true");
    expect(result.rootTimers).toBe(1);
  });
});
