// Port the authored classic item/recipe DB into the rebuild.
//
// The old runtime loaded `data/items/t{1..4}/**/*.js` through import.meta.glob. That tree is not in
// the old_src snapshot, so this script lives in-repo and reads a checked-out homeserver data folder:
//
//   node scripts/port-old-items.mjs "P:/path/to/homeserver-forest-throne-classic/data/items"
//   OLD_ITEMS_DIR="..." node scripts/port-old-items.mjs
//
// Only tiers 1..3 are emitted. T4 items are authored as 3×3 but the old equip rule is
// `tier <= unitStar`; with a 3★ cap they can never be equipped, so the rebuild does not ship dead
// gear. The script counts and reports the skipped T4 files instead of silently truncating them.
// Bonus fields are translated into the rebuild's percentage-point model; the authored old-src
// `logic` payload is kept verbatim for a later runtime port but is not executed by the current
// combat engine.
import { writeFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const source = process.argv[2] ?? process.env.OLD_ITEMS_DIR;
if (!source) {
  console.error("Usage: node scripts/port-old-items.mjs <old-data/items directory>");
  process.exit(1);
}

const BASE = new Set(["bark", "feather", "belt", "claw", "tear", "crystal"]);
/** old bonus key → [rebuild key, multiplier]. Percent bonuses were fractions in old_src. */
const BONUS_MAP = {
  hpPct: ["hpPct", 100],
  atkPct: ["atkPct", 100],
  matkPct: ["matkPct", 100],
  critPct: ["critPct", 100],
  lifestealPct: ["lifestealPct", 100],
  healPct: ["healPct", 100],
  evadePct: ["evadePct", 100],
  defFlat: ["def", 1],
  mdefFlat: ["mdef", 1],
  shieldStart: ["startingShield", 1],
  startingRage: ["startingRage", 1],
  burnOnHit: ["burnOnHit", 1],
  poisonOnHit: ["poisonOnHit", 1],
};

const tiers = ["t1", "t2", "t3", "t4"];
const byId = new Map();
const skipped = [];
let t4 = 0;

for (const tierDir of tiers) {
  const dir = path.join(source, tierDir);
  let names = [];
  try {
    names = (await readdir(dir)).filter((name) => name.endsWith(".js")).sort();
  } catch {
    continue;
  }
  for (const name of names) {
    const mod = await import(pathToFileURL(path.join(dir, name)).href);
    const raw = mod.default;
    if (!raw?.id || !raw.name || !Array.isArray(raw.pattern) || !raw.bonus) {
      throw new Error(`${tierDir}/${name}: unexpected item shape`);
    }
    if (raw.tier === 4) { t4 += 1; continue; }
    if (![1, 2, 3].includes(raw.gridSize) || raw.pattern.length !== raw.gridSize * raw.gridSize) {
      throw new Error(`${tierDir}/${name}: invalid grid ${raw.gridSize} / pattern ${raw.pattern.length}`);
    }
    const bonuses = {};
    for (const [key, value] of Object.entries(raw.bonus)) {
      const mapped = BONUS_MAP[key];
      if (!mapped) throw new Error(`${tierDir}/${name}: unmapped bonus ${key}`);
      if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${tierDir}/${name}: invalid ${key}`);
      const [target, scale] = mapped;
      bonuses[target] = (bonuses[target] ?? 0) + Math.round(value * scale * 10) / 10;
    }
    const item = {
      id: raw.id,
      nameVi: raw.name,
      icon: raw.icon,
      tier: raw.tier,
      size: raw.gridSize,
      pattern: raw.pattern.map((cell) => cell || null),
      bonuses,
      descriptionVi: raw.description,
      logic: raw.logic ?? {},
    };
    const previous = byId.get(item.id);
    if (previous) {
      // The classic glob keyed items by id, so the later tier silently overwrote the earlier one.
      // Keep the highest tier and report the dropped duplicate instead of emitting two items.
      skipped.push({ id: item.id, droppedTier: previous.tier, keptTier: item.tier, file: `${tierDir}/${name}` });
      if (previous.tier >= item.tier) continue;
    }
    byId.set(item.id, item);
  }
}

const items = [...byId.values()].sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));
const equipmentIds = new Set(items.map((item) => `eq_${item.id}`));
const unknownRefs = new Set();
for (const item of items) {
  for (const cell of item.pattern) {
    if (cell && !BASE.has(cell) && !equipmentIds.has(cell)) unknownRefs.add(`${item.id} → ${cell}`);
  }
}
if (unknownRefs.size) {
  console.error(`Unknown pattern references:\n${[...unknownRefs].slice(0, 20).join("\n")}`);
  process.exit(1);
}
const patterns = new Set(items.map((item) => item.pattern.map((cell) => cell ?? "").join("|")));
if (patterns.size !== items.length) {
  console.error(`Duplicate recipe patterns: ${items.length - patterns.size}`);
  process.exit(1);
}

const out = path.resolve("src/content/items.json");
writeFileSync(out, `${JSON.stringify(items, null, 1)}\n`);
console.log(JSON.stringify({
  written: out,
  items: items.length,
  byTier: Object.fromEntries([1, 2, 3].map((tier) => [tier, items.filter((item) => item.tier === tier).length])),
  t4Skipped: t4,
  duplicates: skipped,
}, null, 2));
