// Run against `pnpm preview`: production boot + installed worker + offline shell reload.
import { chromium } from "playwright-core";
import assert from "node:assert/strict";
const browser = await chromium.launch({ headless: true,
  ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : process.platform === "win32" ? { channel: "msedge" } : {}),
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
try {
  const context = await browser.newContext();
  const page = await context.newPage(), errors = [];
  page.setDefaultTimeout(30000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(process.argv[2] ?? "http://127.0.0.1:5200/");
  await page.waitForSelector('#app[data-route="menu"][data-boot="ready"]');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  const version = await page.evaluate(async () => {
    const worker = navigator.serviceWorker.controller;
    // Worker replies to event.source, so listen on the service-worker container.
    const message = new Promise((resolve) => navigator.serviceWorker.addEventListener("message", (event) => resolve(event.data), { once: true }));
    worker.postMessage({ type: "CLIENT_VERSION", version: "0.1.0" });
    return message;
  });
  assert.equal(version.matches, true);
  // The first load precedes worker control; warm the built assets under its control.
  await page.reload();
  await page.waitForSelector('#app[data-route="menu"]');
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector('#app[data-route="menu"][data-boot="ready"]');
  await page.getByRole("button", { name: "Trò chơi mới", exact: true }).click();
  await page.getByRole("button", { name: "Bắt đầu chơi", exact: true }).click();
  await page.waitForSelector(".ft-planning-hud");
  assert.deepEqual(errors, []);
  console.log("Production smoke passed: built menu/planning, matching service worker and offline reload.");
} finally { await browser.close(); }
