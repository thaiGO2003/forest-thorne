// Interaction and layout smoke for owned creature inventory against a running dev server.
// pnpm exec node scripts/inventory-smoke.mjs [url] [output-directory]
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const url = process.argv[2] ?? "http://127.0.0.1:5199/";
const output = process.argv[3] ?? "/tmp/forest-inventory";
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: "chromium", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const errors = [];

async function seed(page) {
  await page.evaluate(() => {
    const app = window.__app;
    const run = app.bridge.newRun("EndlessPvEClassic", "MEDIUM");
    run.gold = 24; run.round = 4;
    run.board[12] = { uid: "inventory-demo", baseId: "jaguar_hunt", star: 2, equips: ["eq_warmog_armor"], traits: [{ id: "fighter_crushing_guard", seed: 1 }] };
    run.bench = [{ uid: "bench-demo", baseId: "toad_poison", star: 2, equips: [], traits: [] }];
    run.itemBag = ["eq_blue_buff", "eq_warmog_armor"];
    app.bridge.checkpoint("EVENT", "Inventory smoke fixture");
    app.go("planning");
  });
  await page.evaluate(() => new Promise((resolve) => {
    const off = window.__stage.onFrame(() => { off(); requestAnimationFrame(resolve); });
  }));
  await page.waitForTimeout(300);
}

async function clickCreature(page, uid) {
  for (let attempt = 0; attempt < 3; attempt++) {
  let point;
  try { point = await page.evaluate(async ({ uid, attempt }) => {
    const THREE = await import("/node_modules/.vite/deps/three.js");
    const stage = window.__stage;
    stage.scene.updateMatrixWorld(true);
    stage.camera.updateMatrixWorld();
    const root = stage.scene.children.find((child) => child.userData.uid === uid);
    if (!root) throw new Error(`Missing visual ${uid}`);
    const meshes = [];
    root.traverseVisible((object) => { if (object.isMesh) meshes.push(object); });
    const boxes = meshes.map((mesh) => new THREE.Box3().setFromObject(mesh));
    boxes.sort((a, b) => {
      const as = a.getSize(new THREE.Vector3()), bs = b.getSize(new THREE.Vector3());
      return bs.x * bs.y * bs.z - as.x * as.y * as.z;
    });
    const bounds = stage.renderer.domElement.getBoundingClientRect();
    const candidates = [];
    const rejected = [];
    const roots = stage.scene.children.filter((child) => child.userData.uid);
    for (const box of boxes) {
      const center = box.getCenter(new THREE.Vector3()).project(stage.camera);
      const x = bounds.left + (center.x + 1) * bounds.width / 2, y = bounds.top + (1 - center.y) * bounds.height / 2;
      const element = document.elementFromPoint(x, y);
      if (element !== stage.renderer.domElement) { rejected.push({ x, y, element: element?.className }); continue; }
      const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(center.x, center.y), stage.camera);
      const hits = ray.intersectObjects(roots, true);
      const target = hits.flatMap((hit) => {
        let object = hit.object, result = null;
        while (object && object !== stage.scene) {
          if (!object.visible) return [];
          result = object.userData.uid ?? result; object = object.parent;
        }
        return result ? [result] : [];
      })[0];
      if (target === uid) candidates.push({ x, y });
      else rejected.push({ x, y, target });
    }
    if (!candidates.length) throw new Error(`No unobstructed point on ${uid}: ${JSON.stringify(rejected.slice(0, 4))}`);
    return candidates[Math.min(attempt, candidates.length - 1)];
  }, { uid, attempt }); } catch (error) { if (attempt === 2) throw error; await page.waitForTimeout(300); continue; }
  await page.mouse.click(point.x, point.y);
  try {
    await page.waitForSelector('[data-modal="unit-inventory"]', { timeout: 2000 });
    if (await page.locator(".ui-inventory").getAttribute("data-uid") === uid) return;
    await page.keyboard.press("Escape");
  } catch { /* Idle/combat poses can move between projection and pointer delivery; try another visible mesh. */ }
  }
  throw new Error(`Could not open the inventory for ${uid}`);
}

try {
  for (const [name, viewport] of Object.entries({ desktop: { width: 1280, height: 720 }, mobile: { width: 390, height: 844 } })) {
    const page = await browser.newPage({ viewport });
    page.on("pageerror", (error) => errors.push(`${name}: ${error.message}`));
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForSelector('#app[data-boot="ready"]', { timeout: 60000 });
    await seed(page);
    await clickCreature(page, "inventory-demo");
    const modal = page.locator('[data-modal="unit-inventory"]');
    assert.equal(await modal.locator('[role="meter"]').count(), 21);
    assert.equal(await modal.getByRole("button", { name: /Bán thú/ }).count(), 1);
    assert.equal(await modal.getByRole("button", { name: /Bán trang bị/ }).count(), 0);
    const bounds = await modal.boundingBox();
    assert(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width + 1 && bounds.y + bounds.height <= viewport.height + 1);
    assert(await modal.getByRole("button", { name: "Chọn", exact: true }).isVisible());
    assert(await modal.getByRole("button", { name: /Bán thú/ }).isVisible());
    const overflows = await modal.evaluate((element) => [...element.querySelectorAll(".ui-inventory-content,.ui-inventory-footer")].map((el) => el.scrollWidth > el.clientWidth + 1));
    assert.deepEqual(overflows, [false, false]);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${output}/${name}.png` });
    console.log(`${name}: layout verified`);

    const blue = modal.locator(".ui-inventory-item").filter({ hasText: "Bùa Xanh" });
    await blue.getByRole("button", { name: "Gắn trang bị", exact: true }).click();
    assert.deepEqual(await page.evaluate(() => window.__app.bridge.run().board[12].equips), ["eq_warmog_armor", "eq_blue_buff"]);
    await modal.getByRole("button", { name: "Tháo tất cả · 9 vàng", exact: true }).click();
    assert.equal(await page.evaluate(() => window.__app.bridge.run().gold), 15);
    assert.deepEqual(await page.evaluate(() => window.__app.bridge.run().board[12].equips), []);
    console.log(`${name}: equip and paid unequip verified`);
    await modal.getByRole("button", { name: /Bán thú/ }).click();
    await modal.getByRole("button", { name: "Hủy", exact: true }).click();
    assert(await page.evaluate(() => Boolean(window.__app.bridge.run().board[12])));
    await modal.getByRole("button", { name: "Chọn", exact: true }).click();
    assert.equal(await page.locator('[data-modal="unit-inventory"]').count(), 0);

    // Re-open by instance and sell, checking the equipment refund and saved state.
    await seed(page);
    await clickCreature(page, "inventory-demo");
    await modal.getByRole("button", { name: /Bán thú/ }).click();
    await modal.getByRole("button", { name: "Xác nhận", exact: true }).click();
    assert.deepEqual(await page.evaluate(() => {
      const run = window.__app.bridge.run();
      return { sold: run.board[12] === null, gold: run.gold, returned: run.itemBag.filter((id) => id === "eq_warmog_armor").length };
    }), { sold: true, gold: 27, returned: 2 });
    console.log(`${name}: sale confirmation and equipment refund verified`);

    // Bench creatures open their own inventory too (mobile shop may cover the bench at default pan).
    if (name === "desktop") {
      await seed(page);
      await clickCreature(page, "bench-demo");
      assert.equal(await modal.locator(".ui-inventory-name").innerText(), "Cóc Độc");
      await page.keyboard.press("Escape");
      assert.equal(await page.evaluate(() => window.__app.modals.active()), null);
      await clickCreature(page, "inventory-demo");
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Bắt đầu", exact: true }).click();
      await page.waitForTimeout(1000);
      await clickCreature(page, "inventory-demo");
      assert(await modal.getByRole("button", { name: /Bán thú/ }).isDisabled());
      assert(await modal.getByRole("button", { name: /Tháo tất cả/ }).isDisabled());
      assert.match(await modal.locator(".ui-inventory-notice").innerText(), /Đang giao tranh/);
      await page.waitForFunction(() => {
        const nowHp = document.querySelector('[data-column="2"][data-stat="hp"]');
        const initialHp = document.querySelector('[data-column="1"][data-stat="hp"]');
        const nowRage = document.querySelector('[data-column="2"][data-stat="rage"]');
        const initialRage = document.querySelector('[data-column="1"][data-stat="rage"]');
        return nowHp && initialHp && nowRage && initialRage &&
          (Number(nowHp.getAttribute("aria-valuenow")) < Number(initialHp.getAttribute("aria-valuenow")) ||
          Number(nowRage.getAttribute("aria-valuenow")) > Number(initialRage.getAttribute("aria-valuenow")));
      }, null, { timeout: 30000 });
      console.log("desktop: live combat resources and edit locks verified");
    }
    await page.close();
    console.log(`${name}: owned inventory interactions and layout passed`);
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
