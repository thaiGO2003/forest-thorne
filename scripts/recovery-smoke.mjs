// Exercise the recovered production entry, current HUD and persisted combat handoff.
// Start Vite first; Windows uses installed Edge. Else set BROWSER_EXECUTABLE or install Chromium.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const url = process.argv[2] ?? "http://127.0.0.1:5199/";
const output = resolve(process.argv[3] ?? "_tmp/recovery-smoke");
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true,
  ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : process.platform === "win32" ? { channel: "msedge" } : {}),
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultTimeout(30000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url);
  await page.waitForSelector('#app[data-route="menu"][data-boot="ready"]');
  await page.screenshot({ path: resolve(output, "desktop-menu.png") });
  await page.getByRole("button", { name: "Trò chơi mới", exact: true }).click();
  await page.getByLabel("Độ khó").selectOption("MEDIUM");
  await page.getByRole("button", { name: "Bắt đầu chơi", exact: true }).click();
  await page.waitForSelector(".ft-planning-hud");
  await page.locator(".ft-shop-bar > div:last-child > div").first().click();
  await page.waitForFunction(() => window.__app.bridge.run().bench.length === 1);

  const cellPoint = async (bench) => page.evaluate(async (isBench) => {
    const { benchPerimeter, toVisual } = await import("/src/board/geometry.ts");
    const { cellToWorld } = await import("/src/world/arena.ts");
    const stage = window.__app.stage;
    const world = cellToWorld(isBench ? benchPerimeter("solo")[0] : toVisual(2, 2), "solo");
    const point = stage.camera.position.clone().set(world.x, .15, world.z).project(stage.camera);
    const rect = stage.renderer.domElement.getBoundingClientRect();
    return { x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2 };
  }, bench);
  const bench = await cellPoint(true);
  await page.mouse.click(bench.x, bench.y);
  await page.waitForSelector(".ft-unit-card");
  const cell = await cellPoint(false);
  await page.mouse.click(cell.x, cell.y);
  await page.waitForFunction(() => window.__app.bridge.run().board[12] !== null);
  assert.equal(await page.evaluate(() => {
    const bar = document.querySelector(".ft-shop-bar");
    const chrome = bar.querySelector(".ui-chrome-canvas");
    return Math.abs(chrome.getBoundingClientRect().height - bar.getBoundingClientRect().height) < 2;
  }), true, "Shop chrome must not cover the arena");
  await page.screenshot({ path: resolve(output, "desktop-planning.png") });

  // Actual state changes from the newer HUD must survive reload through the recovered bridge.
  const savedUid = await page.evaluate(() => window.__app.bridge.run().board[12].uid);
  await page.reload();
  await page.waitForSelector('#app[data-route="menu"]');
  await page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
  await page.waitForSelector(".ft-planning-hud");
  assert.equal(await page.evaluate(() => window.__app.bridge.run().board[12].uid), savedUid);
  await page.getByRole("button", { name: "⚙️", exact: true }).click();
  await page.waitForSelector('[data-modal="settings"]');
  const goldBeforeBlockedKey = await page.evaluate(() => window.__app.bridge.run().gold);
  await page.keyboard.press("d");
  assert.equal(await page.evaluate(() => window.__app.bridge.run().gold), goldBeforeBlockedKey);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator('[data-modal="settings"]').count(), 0);
  await page.getByRole("button", { name: "⚔️ Bắt đầu", exact: true }).click();
  await page.waitForSelector('#app[data-route="combat"]');
  for (let index = 0; index < 10; index++) await page.locator(".cb-speed").click();
  await page.screenshot({ path: resolve(output, "desktop-combat.png") });
  await page.waitForSelector('[data-modal="combat-result"]', { timeout: 60000 });
  await page.keyboard.press("Escape");
  assert.equal(await page.locator('[data-modal="combat-result"]').count(), 1);
  await page.screenshot({ path: resolve(output, "desktop-result.png") });
  assert.equal(await page.evaluate(() => window.__app.bridge.run().round), 2);
  await page.locator(".cb-next").click();
  await page.waitForSelector(".ft-planning-hud");
  assert.equal(await page.evaluate(() => window.__app.bridge.run().round), 2);
  await page.getByRole("button", { name: "☰ Menu", exact: true }).click();
  await page.getByRole("button", { name: "Thư viện", exact: true }).click();
  await page.waitForSelector(".lib-card");
  await page.locator(".lib-card").first().click();
  await page.waitForSelector(".portrait-canvas");
  await page.screenshot({ path: resolve(output, "desktop-library.png") });
  await page.keyboard.press("Escape");
  const exported = await page.evaluate(() => localStorage.getItem("forest_throne_progress_v1"));
  page.on("dialog", (dialog) => dialog.accept(dialog.type() === "prompt" ? exported : undefined));
  await page.getByRole("button", { name: "⚙ Cài đặt", exact: true }).click();
  await page.getByRole("button", { name: "Xóa tiến trình lượt chơi", exact: true }).click();
  await page.waitForFunction(() => window.__app.bridge.run() === null);
  assert.equal(await page.getByRole("button", { name: "Tiếp tục", exact: true }).isDisabled(), true);
  await page.getByRole("button", { name: "⚙ Cài đặt", exact: true }).click();
  await page.getByRole("button", { name: "Nhập dữ liệu lưu", exact: true }).click();
  await page.waitForFunction(() => localStorage.getItem("forest_throne_progress_v1") !== null);
  await page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
  await page.waitForSelector(".ft-planning-hud");
  assert.equal(await page.evaluate(() => window.__app.bridge.run().round), 2);
  await page.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  mobile.on("pageerror", (error) => errors.push(error.message));
  await mobile.goto(url);
  await mobile.waitForSelector('#app[data-route="menu"]');
  await mobile.screenshot({ path: resolve(output, "mobile-menu.png") });
  await mobile.getByRole("button", { name: "Trò chơi mới", exact: true }).click();
  await mobile.getByRole("button", { name: "Bắt đầu chơi", exact: true }).click();
  await mobile.waitForSelector(".ft-planning-hud");
  await mobile.getByRole("button", { name: "Bỏ qua hướng dẫn", exact: true }).click();
  await mobile.screenshot({ path: resolve(output, "mobile-planning.png") });
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await mobile.close();
  assert.deepEqual(errors, []);
  console.log("Recovery browser smoke passed: menu, pointer deploy, persistence, modal input, combat/result, library, clear/import and mobile.");
} finally { await browser.close(); }
