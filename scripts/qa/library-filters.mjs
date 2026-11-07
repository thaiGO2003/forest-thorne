// Gate: Library unit search and filter row layout. Guards the clipped "Tìm thú" placeholder
// and horizontal overflow of the search + role/faction/tier chips at the default viewport.
import { DEFAULT_URL, check, finishGate, frames, openApp, seedPlanning, waitFor } from "./lib.mjs";

const url = process.argv[2] ?? DEFAULT_URL;
const gate = "library-filters";
const { browser, page, errors } = await openApp(url);
const checks = [];

try {
  await seedPlanning(page, { gold: 60, round: 4, board: [], bench: [] });
  await page.evaluate(() => window.__app.openPanel("library"));
  await waitFor(page, () => Boolean(document.querySelector(".lib-filters")), { timeout: 10_000, label: "library filters" });
  await frames(page, 2);

  await check(checks, "search placeholder fits inside its field", async () => {
    const metrics = await page.evaluate(() => {
      const input = document.querySelector(".lib-search input");
      if (!(input instanceof HTMLInputElement)) throw new Error("missing library search input");
      const style = getComputedStyle(input);
      return {
        fontSize: parseFloat(style.fontSize),
        lineHeight: parseFloat(style.lineHeight),
        clientHeight: input.clientHeight,
        scrollHeight: input.scrollHeight,
        clientWidth: input.clientWidth,
        scrollWidth: input.scrollWidth,
      };
    });
    if (metrics.fontSize > metrics.clientHeight || metrics.lineHeight > metrics.clientHeight) {
      throw new Error(JSON.stringify(metrics));
    }
    if (metrics.scrollHeight > metrics.clientHeight || metrics.scrollWidth > metrics.clientWidth + 1) {
      throw new Error(JSON.stringify(metrics));
    }
    return metrics;
  });

  await check(checks, "filter row does not overflow horizontally", async () => {
    const metrics = await page.evaluate(() => {
      const bar = document.querySelector(".lib-filters");
      if (!(bar instanceof HTMLElement)) throw new Error("missing filter row");
      return {
        clientWidth: bar.clientWidth,
        scrollWidth: bar.scrollWidth,
        height: bar.clientHeight,
        chips: document.querySelectorAll(".lib-chip").length,
      };
    });
    if (metrics.scrollWidth > metrics.clientWidth + 1) throw new Error(JSON.stringify(metrics));
    if (metrics.chips < 18) throw new Error(JSON.stringify(metrics));
    return metrics;
  });

  await check(checks, "reset restores the empty search and unselected chips", async () => {
    await page.locator(".lib-search input").fill("báo");
    await page.locator(".lib-chip").first().click();
    await page.waitForTimeout(250);
    await page.locator(".lib-reset").click();
    await page.waitForTimeout(350);
    const state = await page.evaluate(() => ({
      value: document.querySelector(".lib-search input")?.value,
      selected: document.querySelectorAll('.lib-chips [aria-pressed="true"]').length,
    }));
    if (state.value !== "" || state.selected !== 0) throw new Error(JSON.stringify(state));
    return state;
  });
} finally {
  await page.screenshot({ path: `${process.env.QA_OUT ?? "/tmp/forest-qa"}/library-filters.png` }).catch(() => {});
  await browser.close();
}

finishGate({ gate, checks, errors, meta: { url } });
