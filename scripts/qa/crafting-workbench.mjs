// Gate: crafting workbench drag/drop, item sheet, long-press tooltip, filters and recipe library.
// Usage: node scripts/qa/crafting-workbench.mjs [url]
import {
  DEFAULT_URL, check, finishGate, frames, openApp, seedPlanning, waitFor,
} from "./lib.mjs";

const url = process.argv[2] ?? DEFAULT_URL;
const gate = "crafting-workbench";
const { browser, page, errors } = await openApp(url);
const checks = [];

const center = async (selector, index = 0) => {
  const box = await page.locator(selector).nth(index).boundingBox();
  if (!box) throw new Error(`no box for ${selector}[${index}]`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};
const clickSelector = async (selector, index = 0) => {
  const point = await center(selector, index);
  await page.mouse.click(point.x, point.y);
};
const domClick = (selector, index = 0) => page.evaluate(({ selector, index }) => {
  const el = document.querySelectorAll(selector)[index];
  if (!(el instanceof HTMLElement)) throw new Error(`missing ${selector}[${index}]`);
  el.click();
}, { selector, index });

try {
  await seedPlanning(page, { gold: 60, round: 4, board: [], bench: [] });
  await page.evaluate(() => {
    const app = window.__app;
    const run = app.bridge.run();
    app.bridge.skipTutorial();
    run.craftTableLevel = 3;
    run.itemBag = ["tear", "tear", "bark", "bark", "crystal", "belt", "feather", "claw", "eq_bramble_vest"];
    app.bridge.checkpoint("EVENT", "Crafting QA fixture");
  });
  await page.evaluate(() => window.__app.openPanel("craft"));
  await waitFor(page, () => Boolean(document.querySelector(".crafting-workbench")), { timeout: 15_000, label: "craft workbench" });
  await frames(page, 2);

  await check(checks, "workbench exposes table, output, bag, recipes and library", async () => {
    const state = await page.evaluate(() => ({
      cells: document.querySelectorAll(".craft-cell").length,
      output: Boolean(document.querySelector(".craft-output")),
      commit: Boolean(document.querySelector(".craft-commit")),
      tiles: document.querySelectorAll(".craft-item-tile").length,
      recipes: document.querySelectorAll(".craft-recipe-row").length,
      library: Boolean(document.querySelector(".craft-library-button")),
    }));
    if (state.cells !== 9 || !state.output || !state.commit) throw new Error(JSON.stringify(state));
    if (!state.tiles || !state.recipes || !state.library) throw new Error(JSON.stringify(state));
    return state;
  });

  await check(checks, "dragging a bag item onto the table stages it and previews the output", async () => {
    const from = await center('.craft-item-tile[data-item="bark"]');
    const to = await center('.craft-cell[data-craft-cell="0"]');
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
    await waitFor(page, () => window.__app.bridge.craftStaging()[0] === "bark", { timeout: 5000, label: "bark staged" });
    return page.evaluate(() => ({
      staging: window.__app.bridge.craftStaging(),
      output: document.querySelector(".craft-output-name")?.textContent,
      feedback: document.querySelector(".crafting-feedback")?.textContent,
    }));
  });

  await check(checks, "clicking an item opens its sheet with table actions", async () => {
    await page.evaluate(() => document.querySelector(".craft-clear")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await page.waitForTimeout(300);
    await clickSelector('.craft-item-tile[data-item="bark"]');
    await waitFor(page, () => Boolean(document.querySelector(".craft-overlay-panel.is-item")), { timeout: 5000, label: "item sheet" });
    const labels = await page.evaluate(() => [...document.querySelectorAll(".craft-sheet-actions .kit-btn")].map((b) => b.getAttribute("aria-label")));
    if (!labels.includes("Đặt vào bàn") || !labels.includes("Thư viện chế tạo")) throw new Error(JSON.stringify(labels));
    await domClick(".craft-sheet-actions .kit-btn", labels.indexOf("Đặt vào bàn"));
    await waitFor(page, () => window.__app.bridge.craftStaging().some(Boolean), { timeout: 5000, label: "place from sheet" });
    return labels;
  });

  await check(checks, "clicking a filled cell can remove it from the table", async () => {
    await clickSelector('.craft-cell[data-craft-cell="0"]');
    await waitFor(page, () => Boolean(document.querySelector(".craft-overlay-panel.is-item")), { timeout: 5000, label: "cell sheet" });
    const labels = await page.evaluate(() => [...document.querySelectorAll(".craft-sheet-actions .kit-btn")].map((b) => b.getAttribute("aria-label")));
    if (!labels.includes("Lấy ra khỏi bàn")) throw new Error(JSON.stringify(labels));
    await domClick(".craft-sheet-actions .kit-btn", labels.indexOf("Lấy ra khỏi bàn"));
    await waitFor(page, () => window.__app.bridge.craftStaging().every((id) => !id), { timeout: 5000, label: "cell cleared" });
    return labels;
  });

  await check(checks, "long press shows the item tooltip without opening the sheet", async () => {
    await page.evaluate(() => {
      const tile = document.querySelector(".craft-item-tile");
      const rect = tile.getBoundingClientRect();
      tile.dispatchEvent(new PointerEvent("pointerdown", {
        bubbles: true, cancelable: true, pointerId: 91, pointerType: "touch", isPrimary: true,
        button: 0, buttons: 1, clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2,
      }));
    });
    await waitFor(page, () => document.querySelector(".tooltip")?.dataset.open === "true", { timeout: 3000, label: "held tooltip" });
    const title = await page.evaluate(() => document.querySelector(".tooltip .tt-title")?.textContent ?? "");
    await page.evaluate(() => {
      document.querySelector(".craft-item-tile")?.dispatchEvent(new PointerEvent("pointerup", {
        bubbles: true, cancelable: true, pointerId: 91, pointerType: "touch", button: 0,
      }));
    });
    await page.waitForTimeout(200);
    const sheet = await page.evaluate(() => Boolean(document.querySelector(".craft-overlay-panel.is-item")));
    if (sheet) throw new Error("long press opened the sheet");
    return title;
  });

  await check(checks, "bag and recipe filters search immediately", async () => {
    const bagSearch = page.locator('input[data-focus="bag"]');
    await bagSearch.fill("gỗ");
    await page.waitForTimeout(300);
    const tiles = await page.evaluate(() => [...document.querySelectorAll(".craft-item-tile")].map((t) => t.dataset.item));
    if (tiles.length !== 1 || tiles[0] !== "bark") throw new Error(JSON.stringify(tiles));
    await page.locator('input[data-focus="recipe"]').fill("giáp");
    await page.waitForTimeout(300);
    const recipes = await page.evaluate(() => [...document.querySelectorAll(".craft-recipe-copy strong")].map((s) => s.textContent));
    if (!recipes.includes("Giáp Gai")) throw new Error(JSON.stringify(recipes));
    await bagSearch.fill("");
    await page.locator('input[data-focus="recipe"]').fill("");
    await page.waitForTimeout(300);
    return { tiles, recipes };
  });

  await check(checks, "auto-fill, output preview and the bottom Chế button commit the recipe", async () => {
    await page.evaluate(() => document.querySelector(".craft-clear")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await page.waitForTimeout(250);
    await page.evaluate(() => document.querySelector(".craft-recipe-row .craft-fill")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await waitFor(page, () => document.querySelector(".craft-output-name")?.textContent === "Bùa Xanh", { timeout: 5000, label: "output preview" });
    const disabled = await page.evaluate(() => document.querySelector(".craft-commit")?.getAttribute("aria-disabled"));
    if (disabled !== "false") throw new Error(`commit disabled=${disabled}`);
    await page.evaluate(() => document.querySelector(".craft-commit")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await waitFor(page, () => window.__app.bridge.run()?.itemBag.includes("eq_blue_buff"), { timeout: 5000, label: "crafted buff" });
    return page.evaluate(() => ({
      bag: window.__app.bridge.run()?.itemBag,
      staging: window.__app.bridge.craftStaging(),
      feedback: document.querySelector(".crafting-feedback")?.textContent,
    }));
  });

  await check(checks, "recipe library opens with tier columns, category rail and relationship tree", async () => {
    await page.evaluate(() => document.querySelector(".craft-library-button")?.click());
    await waitFor(page, () => Boolean(document.querySelector(".craft-overlay-panel.is-library")), { timeout: 5000, label: "craft library" });
    const first = await page.evaluate(() => ({
      rail: document.querySelectorAll(".craft-graph-rail-button").length,
      railActive: document.querySelector('.craft-graph-rail-button[data-selected="true"]')?.getAttribute("data-category"),
      columns: [...document.querySelectorAll(".craft-graph-column")].map((c) => ({
        tier: c.dataset.tier,
        cards: c.querySelectorAll(".craft-graph-card").length,
      })),
      note: document.querySelector(".craft-library-note")?.textContent,
      empty: document.querySelector(".craft-graph-detail-empty")?.textContent?.trim(),
      headHidden: document.querySelector(".modal-root")?.classList.contains("craft-overlay-open"),
    }));
    if (first.rail !== 3) throw new Error(`rail=${first.rail}`);
    if (first.railActive !== "offense") throw new Error(`active=${first.railActive}`);
    if (first.columns.length !== 3) throw new Error(JSON.stringify(first.columns));
    if (first.columns.reduce((n, c) => n + c.cards, 0) !== 57) throw new Error(JSON.stringify(first.columns));
    if (!first.note?.includes("205")) throw new Error(`note=${first.note}`);
    if (!first.empty?.includes("Chọn một công thức")) throw new Error(`empty=${first.empty}`);
    if (!first.headHidden) throw new Error("underlying modal head still visible");

    await page.evaluate(() => document.querySelectorAll(".craft-graph-card")[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await page.waitForTimeout(300);
    const selected = await page.evaluate(() => ({
      name: document.querySelector(".craft-library-hero-copy h3")?.textContent,
      tree: document.querySelectorAll(".craft-tree-row").length,
      sections: document.querySelectorAll(".craft-library-sec").length,
    }));
    if (!selected.name || !selected.tree) throw new Error(JSON.stringify(selected));

    await page.evaluate(() => document.querySelectorAll(".craft-graph-rail-button")[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await page.waitForTimeout(300);
    const defense = await page.evaluate(() => ({
      active: document.querySelector('.craft-graph-rail-button[data-selected="true"]')?.getAttribute("data-category"),
      cards: [...document.querySelectorAll(".craft-graph-column")].reduce((n, c) => n + c.querySelectorAll(".craft-graph-card").length, 0),
      empty: Boolean(document.querySelector(".craft-graph-detail-empty")),
    }));
    if (defense.active !== "defense" || !defense.cards || !defense.empty) throw new Error(JSON.stringify(defense));

    await page.keyboard.press("Escape");
    await waitFor(page, () => !document.querySelector(".craft-overlay"), { timeout: 5000, label: "overlay closed" });
    const craftAlive = await page.evaluate(() => Boolean(document.querySelector(".crafting-workbench")));
    if (!craftAlive) throw new Error("craft workbench closed with the overlay");
    return { first, selected, defense };
  });

  await check(checks, "main Library recipes tab embeds the same graph", async () => {
    await page.keyboard.press("Escape");
    await waitFor(page, () => !document.querySelector(".crafting-workbench"), { timeout: 5000, label: "craft modal closed" });
    await page.evaluate(() => window.__app.openPanel("library"));
    await waitFor(page, () => Boolean(document.querySelector(".lib-tabs")), { timeout: 5000, label: "library modal" });
    await page.evaluate(() => [...document.querySelectorAll(".lib-tabs .kit-btn")]
      .find((b) => b.getAttribute("aria-label")?.includes("Chế tạo"))?.click());
    await waitFor(page, () => Boolean(document.querySelector(".craft-library-embed .craft-graph")), { timeout: 5000, label: "embedded graph" });
    const embedded = await page.evaluate(() => ({
      note: document.querySelector(".craft-library-embed .craft-library-note")?.textContent,
      columns: document.querySelectorAll(".craft-library-embed .craft-graph-column").length,
      cards: document.querySelectorAll(".craft-library-embed .craft-graph-card").length,
      empty: document.querySelector(".craft-library-embed .craft-graph-detail-empty")?.textContent?.trim(),
    }));
    if (embedded.columns !== 3 || !embedded.cards) throw new Error(JSON.stringify(embedded));
    if (!embedded.empty?.includes("Chọn một công thức")) throw new Error(JSON.stringify(embedded));
    return embedded;
  });
} finally {
  await page.screenshot({ path: `${process.env.QA_OUT ?? "/tmp/forest-qa"}/crafting-workbench.png` }).catch(() => {});
  await browser.close();
}

finishGate({ gate, checks, errors, meta: { url } });
