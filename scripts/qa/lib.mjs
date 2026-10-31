// Deterministic browser acceptance harness.
//
// Why: a gate that is verified one assertion per agent turn costs a full model round-trip
// (~$0.12 and 30-120s) for every mouse move. This harness runs the whole matrix in one Node
// process and returns a single JSON verdict, so the agent pays one tool call per gate.
//
// Usage: node scripts/qa/<gate>.mjs [url]
// Output: /tmp/forest-qa/<gate>-<iso>.json plus a compact console table; exit 1 on failure.
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";

export const QA_OUT = process.env.QA_OUT ?? "/tmp/forest-qa";
export const DEFAULT_URL = process.env.QA_URL ?? "http://127.0.0.1:5199/";

const LAUNCH_ARGS = [
  "--use-angle=swiftshader-webgl",
  "--enable-unsafe-swiftshader",
  "--ignore-gpu-blocklist",
  "--mute-audio",
];

export async function openApp(url = DEFAULT_URL, options = {}) {
  const browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS });
  const page = await browser.newPage({ viewport: options.viewport ?? { width: 1280, height: 800 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  // SwiftShader plus 54 kit images: boot legitimately takes 20-60s. Wait for the dev seam,
  // never for a fixed timeout, so slow hardware cannot flake the gate.
  await waitFor(page, () => Boolean(window.__app), { timeout: 120_000, label: "app boot" });
  // QA-only render budget: SwiftShader draws the full scene on CPU, so uncapped quality makes
  // every CDP round-trip wait on a frame. This never ships; it only shortens the gate.
  await page.evaluate(() => window.__app.bridge.settings.save({
    quality: "low", fpsLimit: 30, renderScale: 0.5, shadowsEnabled: false,
    audioEnabled: false, musicEnabled: false, ambientEnabled: false, uiSfxEnabled: false,
  }));
  return { browser, page, errors };
}

/** Poll a page predicate with timers: waitForFunction's rAF polling stalls on hidden pages. */
export async function waitFor(page, predicate, { timeout = 20_000, interval = 150, label = "condition" } = {}) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeout) {
    try {
      last = await page.evaluate(predicate);
      if (last) return last;
    } catch (error) {
      last = error?.message ?? String(error);
    }
    await page.waitForTimeout(interval);
  }
  throw new Error(`Timeout waiting for ${label} after ${timeout}ms (last=${JSON.stringify(last)})`);
}

export const frames = (page, count = 2) => page.evaluate((n) => new Promise((resolve) => {
  let left = n;
  const step = () => { left -= 1; if (left <= 0) resolve(); else requestAnimationFrame(step); };
  requestAnimationFrame(step);
}), count);

/**
 * Seed a deterministic run and enter Planning with the same fixture every time.
 * Retries once: an HMR reload from a concurrent dev-server edit would otherwise abort the gate.
 */
export async function seedPlanning(page, { board = [], bench = [], gold = 24, round = 4 } = {}, { attempts = 2 } = {}) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await waitFor(page, () => Boolean(window.__app), { timeout: 120_000, label: "app boot" });
      await page.evaluate(({ board, bench, gold, round }) => {
        const app = window.__app;
        const run = app.bridge.newRun("EndlessPvEClassic", "MEDIUM");
        run.gold = gold;
        run.round = round;
        for (const unit of board) {
          run.board[unit.index] = { uid: unit.uid, baseId: unit.baseId, star: unit.star ?? 1, equips: unit.equips ?? [] };
        }
        run.bench = bench.map((unit) => ({ uid: unit.uid, baseId: unit.baseId, star: unit.star ?? 1, equips: [], traits: [] }));
        app.bridge.checkpoint("EVENT", "QA fixture");
        app.go("planning");
      }, { board, bench, gold, round });
      await waitFor(page, () => window.__app?.route() === "planning", { timeout: 20_000, label: "planning route" });
      await frames(page, 3);
      return;
    } catch (error) {
      if (attempt >= attempts) throw error;
      await page.goto(page.url(), { waitUntil: "domcontentloaded" });
    }
  }
}

/** Screen point on the largest unobstructed mesh of a rendered unit. */
export function screenPoint(page, uid) {
  return page.evaluate(async ({ uid }) => {
    const THREE = await import("/node_modules/.vite/deps/three.js");
    const stage = window.__stage;
    stage.scene.updateMatrixWorld(true);
    stage.camera.updateMatrixWorld();
    const roots = stage.scene.children.filter((child) => child.userData.uid);
    const root = roots.find((child) => child.userData.uid === uid);
    if (!root) return null;
    const meshes = [];
    root.traverseVisible((object) => { if (object.isMesh) meshes.push(object); });
    const boxes = meshes.map((mesh) => new THREE.Box3().setFromObject(mesh));
    boxes.sort((a, b) => {
      const as = a.getSize(new THREE.Vector3());
      const bs = b.getSize(new THREE.Vector3());
      return bs.x * bs.y * bs.z - as.x * as.y * as.z;
    });
    const canvas = stage.renderer.domElement.getBoundingClientRect();
    const rejected = [];
    for (const box of boxes) {
      const center = box.getCenter(new THREE.Vector3()).project(stage.camera);
      const x = canvas.left + ((center.x + 1) * canvas.width) / 2;
      const y = canvas.top + ((1 - center.y) * canvas.height) / 2;
      if (document.elementFromPoint(x, y) !== stage.renderer.domElement) {
        rejected.push({ x: Math.round(x), y: Math.round(y), reason: "covered" });
        continue;
      }
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(center.x, center.y), stage.camera);
      const hit = ray.intersectObjects(roots, true).flatMap((entry) => {
        let object = entry.object;
        let owner = null;
        while (object && object !== stage.scene) {
          if (!object.visible) return [];
          owner = object.userData.uid ?? owner;
          object = object.parent;
        }
        return owner ? [owner] : [];
      })[0];
      if (hit === uid) return { x, y };
      rejected.push({ x: Math.round(x), y: Math.round(y), reason: `hits ${hit ?? "nothing"}` });
    }
    throw new Error(`No pickable screen point for ${uid}: ${JSON.stringify(rejected.slice(0, 4))}`);
  }, { uid });
}

export async function hover(page, uid) {
  const point = await screenPoint(page, uid);
  await page.mouse.move(point.x, point.y);
  await page.waitForTimeout(180);
  return point;
}

export async function click(page, uid) {
  const point = await screenPoint(page, uid);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(120);
  return point;
}

/** Move the pointer off the board so the transient highlights restore. */
export async function moveAway(page) {
  await page.mouse.move(4, 4);
  await page.waitForTimeout(180);
}

/** Linear RGB of every tactical tile instance, as a flat Float array. */
export async function tileSnapshot(page) {
  return page.evaluate(() => {
    const tiles = window.__stage.arena.tiles;
    return tiles.instanceColor ? Array.from(tiles.instanceColor.array) : [];
  });
}

/** Tile instances whose color changed between two snapshots. */
export function diffTiles(before, after, epsilon = 1e-3) {
  const changed = [];
  for (let i = 0; i + 2 < Math.min(before.length, after.length); i += 3) {
    const color = [after[i], after[i + 1], after[i + 2]];
    if (color.some((value, channel) => Math.abs(value - before[i + channel]) > epsilon)) {
      changed.push({ index: i / 3, color });
    }
  }
  return changed;
}

export async function check(checks, name, run) {
  const started = Date.now();
  try {
    const detail = await run();
    checks.push({ name, ok: true, ms: Date.now() - started, detail: detail ?? null });
    return true;
  } catch (error) {
    checks.push({ name, ok: false, ms: Date.now() - started, detail: error?.message ?? String(error) });
    return false;
  }
}

/** Print the verdict, persist the evidence, and exit non-zero when any check failed. */
export function finishGate({ gate, checks, errors = [], meta = {} }) {
  const failed = checks.filter((entry) => !entry.ok);
  const report = { gate, pass: failed.length === 0 && errors.length === 0, ranAt: new Date().toISOString(), meta, checks, errors };
  mkdirSync(QA_OUT, { recursive: true });
  const file = `${QA_OUT}/${gate}-${report.ranAt.replace(/[:.]/g, "-")}.json`;
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  for (const entry of checks) {
    const detail = entry.detail == null ? "" : ` — ${typeof entry.detail === "string" ? entry.detail : JSON.stringify(entry.detail)}`;
    console.log(`${entry.ok ? "PASS" : "FAIL"}  ${entry.name} (${entry.ms}ms)${detail}`);
  }
  for (const error of errors) console.log(`FAIL  browser error — ${error}`);
  console.log(`${report.pass ? "GATE PASS" : "GATE FAIL"}  ${gate} — ${checks.length - failed.length}/${checks.length} checks, report ${file}`);
  process.exit(report.pass ? 0 : 1);
}
