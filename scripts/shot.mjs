// Visual smoke: screenshot the dev server in headless + headed Chromium in parallel.
// Usage: pnpm shot [url] [outDir]   (headed needs a display; script re-execs under xvfb-run when none)
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

if (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
  const r = spawnSync("xvfb-run", ["-a", process.execPath, ...process.argv.slice(1)], { stdio: "inherit" });
  process.exit(r.status ?? 1);
}

const url = process.argv[2] ?? "http://localhost:5199/";
const out = process.argv[3] ?? "/tmp/ftshot";
mkdirSync(out, { recursive: true });

const viewports = { desktop: { width: 1280, height: 720 }, mobile: { width: 390, height: 844 } };
const args = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];

async function run(headless) {
  const browser = await chromium.launch({ headless, args });
  const errors = [];
  try {
    for (const [name, viewport] of Object.entries(viewports)) {
      const page = await browser.newPage({ viewport });
      page.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
      page.on("console", (m) => {
        const where = m.location().url ?? "";
        if (m.type() === "error" && !where.endsWith("/favicon.ico")) errors.push(`${name}: ${m.text()} ${where}`);
      });
      await page.goto(url, { waitUntil: "networkidle" });
      // ponytail: SwiftShader x2 parallel boots slowly; 30s ceiling, lower when GPU available.
      await page.waitForSelector("#app[data-boot=ready]", { timeout: 30_000 });
      await page.waitForTimeout(1500);
      const path = `${out}/${headless ? "headless" : "headed"}-${name}.png`;
      await page.screenshot({ path });
      console.log("shot", path);
      await page.close();
    }
  } finally {
    await browser.close();
  }
  return errors;
}

const results = await Promise.allSettled([run(true), run(false)]);
let failed = false;
for (const [i, r] of results.entries()) {
  const mode = i ? "headed" : "headless";
  if (r.status === "rejected") { failed = true; console.error(mode, "FAILED:", r.reason?.message ?? r.reason); }
  else if (r.value.length) { failed = true; console.error(mode, "page errors:", r.value); }
}
process.exit(failed ? 1 : 0);
