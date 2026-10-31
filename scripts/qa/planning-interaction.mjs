// Gate: Planning interaction parity (WBS-059 unit detail + occupied-tile hover).
//
// One process covers the whole matrix: ally hover/click, enemy hover/click, modal escape,
// and the tactical-hover tint parity between both sides. Run after touching planning input,
// board labels, unit detail or arena highlights.
//
// Usage: node scripts/qa/planning-interaction.mjs [url]
import {
  openApp, seedPlanning, screenPoint, hover, click, moveAway, tileSnapshot, diffTiles,
  check, finishGate, waitFor, DEFAULT_URL,
} from "./lib.mjs";

const url = process.argv[2] ?? DEFAULT_URL;
const gate = "planning-interaction";
const { browser, page, errors } = await openApp(url);
const checks = [];
const meta = { url, viewport: page.viewportSize() };

try {
  await seedPlanning(page, {
    gold: 24,
    board: [{ index: 12, uid: "qa-ally", baseId: "jaguar_hunt", star: 2 }],
    bench: [{ uid: "qa-bench", baseId: "toad_poison", star: 2 }],
  });

  const enemies = await page.evaluate(() => {
    const run = window.__app.bridge.run();
    return (run.enemyPreview ?? []).map((unit) => ({ uid: unit.uid, baseId: unit.baseId, col: unit.col, row: unit.row }));
  });
  meta.enemies = enemies;
  const enemyUid = enemies[0]?.uid ?? null;

  await check(checks, "planning mounts with the seeded fixture", async () => {
    const state = await page.evaluate(() => {
      const run = window.__app.bridge.run();
      return {
        route: document.getElementById("app")?.dataset.route,
        ally: run.board[12]?.uid ?? null,
        bench: run.bench[0]?.uid ?? null,
        enemies: (run.enemyPreview ?? []).length,
      };
    });
    if (state.route !== "planning") throw new Error(`route is ${state.route}`);
    if (state.ally !== "qa-ally") throw new Error(`board[12] is ${state.ally}`);
    if (!state.enemies) throw new Error("enemy preview is empty");
    return state;
  });

  await check(checks, "ally hover opens the summary tooltip", async () => {
    await hover(page, "qa-ally");
    await waitFor(page, () => document.querySelector(".tooltip")?.dataset.open === "true", { timeout: 4000, label: "ally tooltip" });
    const title = await page.evaluate(() => document.querySelector(".tooltip .tt-title")?.textContent?.trim() ?? "");
    if (!title) throw new Error("tooltip has no title");
    return title;
  });

  await check(checks, "ally click opens the owned inventory", async () => {
    await click(page, "qa-ally");
    await waitFor(page, () => Boolean(document.querySelector('[data-modal="unit-inventory"]')), { timeout: 5000, label: "owned inventory modal" });
    return "unit-inventory";
  });

  await check(checks, "escape closes the ally modal", async () => {
    await page.keyboard.press("Escape");
    await waitFor(page, () => !document.querySelector("[data-modal]"), { timeout: 4000, label: "modal closed" });
  });

  if (!enemyUid) throw new Error("no rendered enemy to inspect");
  await check(checks, "enemy hover opens the summary tooltip", async () => {
    await hover(page, enemyUid);
    await waitFor(page, () => document.querySelector(".tooltip")?.dataset.open === "true", { timeout: 4000, label: "enemy tooltip" });
    const title = await page.evaluate(() => document.querySelector(".tooltip .tt-title")?.textContent?.trim() ?? "");
    if (!title) throw new Error("tooltip has no title");
    return title;
  });

  await check(checks, "enemy click opens the read-only detail", async () => {
    await click(page, enemyUid);
    await waitFor(page, () => Boolean(document.querySelector('[data-modal="enemy-unit-detail"]')), { timeout: 5000, label: "enemy detail modal" });
    const actions = await page.locator('[data-modal="enemy-unit-detail"]').getByRole("button", { name: /Bán thú|Gắn trang bị|Chọn/ }).count();
    if (actions) throw new Error(`enemy detail exposes ${actions} purchase/sell action(s)`);
    return "enemy-unit-detail";
  });

  await check(checks, "escape closes the enemy modal", async () => {
    await page.keyboard.press("Escape");
    await waitFor(page, () => !document.querySelector("[data-modal]"), { timeout: 4000, label: "modal closed" });
  });

  await check(checks, "occupied-tile hover tint matches for allies and enemies", async () => {
    const allyPoint = await screenPoint(page, "qa-ally");
    const enemyPoint = await screenPoint(page, enemyUid);
    await moveAway(page);
    const base = await tileSnapshot(page);
    if (!base.length) throw new Error("tactical tiles expose no instance colors");
    await hover(page, "qa-ally");
    const ally = await tileSnapshot(page);
    await moveAway(page);
    const restored = await tileSnapshot(page);
    await hover(page, enemyUid);
    const foe = await tileSnapshot(page);
    const allyChanged = diffTiles(base, ally);
    const foeChanged = diffTiles(restored, foe);
    if (allyChanged.length !== 1) throw new Error(`ally hover tinted ${allyChanged.length} tiles (expected 1) at ${JSON.stringify(allyPoint)}`);
    if (foeChanged.length !== 1) throw new Error(`enemy hover tinted ${foeChanged.length} tiles (expected 1) at ${JSON.stringify(enemyPoint)}`);
    const round = (color) => color.map((value) => Number(value.toFixed(3)));
    const allyColor = round(allyChanged[0].color);
    const foeColor = round(foeChanged[0].color);
    if (allyColor.some((value, channel) => Math.abs(value - foeColor[channel]) > 0.02)) {
      throw new Error(`enemy hover RGB ${JSON.stringify(foeColor)} differs from ally ${JSON.stringify(allyColor)}`);
    }
    return { ally: allyColor, enemy: foeColor };
  });
} finally {
  await browser.close();
}

finishGate({ gate, checks, errors, meta });
