// Gate: Cóc Độc presentation (Sương Độc rig, library actions, poison counter, pool marker).
//
// Verifies the parts that unit tests cannot see:
// - the library detail offers the toad's five action previews and the 1★/3★ builds render,
// - the skill copy is the new field mechanic (no stale "Nhổ Độc" / single-target text),
// - the billboard draws a poison counter only when points > 0,
// - the board view mounts a persistent poison pool and removes it on expiry.
//
// Usage: node scripts/qa/toad-poison.mjs [url]
import { mkdirSync } from "node:fs";
import { openApp, waitFor, check, finishGate, frames, DEFAULT_URL } from "./lib.mjs";

const url = process.argv[2] ?? DEFAULT_URL;
const gate = "toad-poison";
const { browser, page, errors } = await openApp(url);
const checks = [];
const out = process.env.QA_OUT ?? "/tmp/forest-qa";
mkdirSync(out, { recursive: true });
const meta = { url, viewport: page.viewportSize() };

try {
  await check(checks, "library opens the toad detail panel", async () => {
    await page.evaluate(() => window.__app.openPanel("library", "toad_poison"));
    await waitFor(page, () => Boolean(document.querySelector(".lib-detail")), { timeout: 20_000, label: "toad detail" });
    return { detail: await page.locator(".lib-detail").count() };
  });

  await check(checks, "toad detail exposes five action previews and the field skill copy", async () => {
    const text = await page.locator(".lib-detail").innerText();
    if (!text.includes("Sương Độc")) throw new Error("skill name is not Sương Độc");
    if (/Nhổ Độc/.test(text)) throw new Error("stale Nhổ Độc copy is still rendered");
    if (!/3 bãi độc/.test(text)) throw new Error("field count copy missing");
    if (!/2 vòng/.test(text)) throw new Error("two-cycle duration copy missing");
    const buttons = await page.locator(".lib-actions button").count();
    if (buttons < 6) throw new Error(`expected idle/attack/skill/hit/move + beast form, got ${buttons}`);
    return { buttons };
  });

  await check(checks, "star milestones show the 20% and 40% occupied-cell chances", async () => {
    const stars = page.locator(".lib-stars button");
    const count = await stars.count();
    if (count < 3) throw new Error(`star selector has ${count} buttons`);
    await stars.nth(1).click();
    await page.waitForTimeout(250);
    const two = await page.locator(".lib-detail").innerText();
    if (!/20%/.test(two)) throw new Error("2★ detail is missing the 20% chance");
    await stars.nth(2).click();
    await page.waitForTimeout(450);
    const three = await page.locator(".lib-detail").innerText();
    if (!/40%/.test(three)) throw new Error("3★ detail is missing the 40% chance");
    return { twoStars: /20%/, threeStars: /40%/ };
  });

  await check(checks, "1★ and 3★ toad models render in the preview stage", async () => {
    const stars = page.locator(".lib-stars button");
    await stars.nth(0).click();
    await page.waitForTimeout(350);
    await frames(page, 4);
    await page.screenshot({ path: `${out}/toad-1star.png` });
    await stars.nth(2).click();
    await page.waitForTimeout(450);
    await frames(page, 4);
    const label = await page.locator(".lib-name").innerText();
    await page.screenshot({ path: `${out}/toad-3star.png` });
    return { label };
  });

  await check(checks, "skill preview plays the Sương Độc pose", async () => {
    const actions = page.locator(".lib-actions button");
    await actions.nth(2).click(); // idle, attack, skill, hit, move
    await page.waitForTimeout(420);
    await page.screenshot({ path: `${out}/toad-3star-skill.png` });
    const selected = await actions.nth(2).getAttribute("aria-pressed");
    if (selected !== "true") throw new Error(`skill button not selected: ${selected}`);
  });

  await check(checks, "billboard shows a poison counter only when points exist", async () => {
    const result = await page.evaluate(async () => {
      const mod = await import("/src/units/billboard.ts");
      const anchor = { add() {} };
      const bb = mod.createBillboard(anchor);
      const state = {
        name: "Cóc Độc", star: 3, hp: 80, maxHp: 220, rage: 2, rageMax: 5, side: "L",
        statuses: [], poison: 0,
      };
      const canvas = bb.sprite.material.map.image;
      const ctx = canvas.getContext("2d");
      const dpr = canvas.width / mod.BILLBOARD_W;
      const sample = () => {
        const w = Math.round(70 * dpr), h = Math.round(44 * dpr);
        const x = Math.round((mod.BILLBOARD_W / 2 - 35) * dpr), y = 0;
        const data = ctx.getImageData(x, y, w, h).data;
        let opaque = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i] > 8) opaque++;
        return opaque;
      };
      bb.set(state);
      for (let i = 0; i < 12; i++) await new Promise((r) => requestAnimationFrame(r));
      const empty = sample();
      bb.set({ ...state, poison: 4 });
      for (let i = 0; i < 12; i++) await new Promise((r) => requestAnimationFrame(r));
      const filled = sample();
      bb.dispose();
      return { empty, filled };
    });
    if (result.filled <= result.empty) throw new Error(`poison badge did not draw: ${JSON.stringify(result)}`);
    if (result.empty > 200) throw new Error(`counter leaks at zero points: ${result.empty} px`);
    return result;
  });

  await check(checks, "board view mounts and clears a two-cycle poison pool", async () => {
    await page.keyboard.press("Escape");
    await waitFor(page, () => !document.querySelector("[data-modal]"), { timeout: 5000, label: "library closed" });
    const mounted = await page.evaluate(async () => {
      const mod = await import("/src/units/boardView.ts");
      const stage = window.__stage;
      const board = mod.createBoardView(stage);
      window.__qaBoard = board;
      const count = () => {
        let n = 0;
        stage.scene.traverse((o) => {
          if (o.isMesh && o.material?.color?.getHex?.() === 0x6fe62a) n++;
        });
        return n;
      };
      const before = count();
      board.setPoisonField(6, 2, true);
      board.setPoisonField(7, 1, true);
      board.setPoisonField(8, 3, true);
      await new Promise((resolve) => setTimeout(resolve, 400));
      return { before, mounted: count(), center: board.cellCenter(6, 2) };
    });
    await page.screenshot({ path: `${out}/toad-pools.png` });
    const cleared = await page.evaluate(() => {
      const stage = window.__stage;
      const board = window.__qaBoard;
      board.setPoisonField(6, 2, false);
      board.setPoisonField(7, 1, false);
      board.setPoisonField(8, 3, false);
      let n = 0;
      stage.scene.traverse((o) => {
        if (o.isMesh && o.material?.color?.getHex?.() === 0x6fe62a) n++;
      });
      board.dispose();
      window.__qaBoard = null;
      return n;
    });
    const result = { ...mounted, cleared };
    if (result.mounted <= result.before) throw new Error(`no pool mounted: ${JSON.stringify(result)}`);
    if (result.cleared !== result.before) throw new Error(`pool not cleared: ${JSON.stringify(result)}`);
    if (!Number.isFinite(result.center?.x) || !Number.isFinite(result.center?.z)) throw new Error("pool cell has no world centre");
    return result;
  });
} finally {
  await browser.close();
}

finishGate({ gate, checks, errors, meta });
