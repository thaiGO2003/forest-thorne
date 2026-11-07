#!/usr/bin/env node
/**
 * Forest Throne unit budget audit.
 *
 * Checks every unit in src/content/units.json against the stat and skill-damage
 * budgets in ../SKILL.md. Deterministic: no RNG, no network, no game runtime.
 *
 *   node scripts/audit-unit.mjs                  # audit all normal units
 *   node scripts/audit-unit.mjs --id wolf_pack   # detail for one unit
 *   node scripts/audit-unit.mjs --report         # regenerate balance distributions
 *   node scripts/audit-unit.mjs --json           # machine-readable result
 *
 * Exit codes: 0 clean or warnings only, 1 errors, 2 usage/IO failure.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/* ------------------------------------------------------------------ budgets */

/** Median eHP / OFF per tier, measured from the catalog. See references/balance-data.md. */
const TIER_ANCHOR = {
  1: { ehp: 301, off: 64, perHit: 69 },
  2: { ehp: 317, off: 70, perHit: 76 },
  3: { ehp: 363, off: 75, perHit: 103 },
  4: { ehp: 416, off: 87, perHit: 129 },
  5: { ehp: 571, off: 97, perHit: 182 },
};

/** Role spend factors applied to the tier anchor. */
const ROLE_FACTOR = {
  TANKER: { ehp: 1.67, off: 0.65 },
  FIGHTER: { ehp: 1.18, off: 1.01 },
  SUPPORT: { ehp: 1.05, off: 0.99 },
  MAGE: { ehp: 0.94, off: 1.15 },
  ASSASSIN: { ehp: 0.84, off: 1.08 },
  ARCHER: { ehp: 0.85, off: 0.97 },
};

/** Absolute per-stat ceilings; no budget may exceed these. */
const STAT_CAP = {
  1: { hp: 450, atk: 79, def: 49, matk: 81, mdef: 33 },
  2: { hp: 470, atk: 82, def: 49, matk: 93, mdef: 33 },
  3: { hp: 535, atk: 95, def: 49, matk: 99, mdef: 36 },
  4: { hp: 660, atk: 104, def: 54, matk: 114, mdef: 42 },
  5: { hp: 735, atk: 115, def: 65, matk: 124, mdef: 54 },
};

/** Roles whose single-target skill must actually deal damage. */
const DAMAGE_ROLES = new Set(["MAGE", "ASSASSIN", "ARCHER", "FIGHTER"]);

const GATE = {
  nError: [0.7, 1.35],
  nWarn: [0.85, 1.2],
  pError: [0.6, 1.45],
  pWarn: [0.72, 1.3],
  perHitError: [0.5, 1.9],
  perHitWarn: [0.75, 1.5],
  dprError: [0.12, 12],
  dprWarn: [0.25, 8],
};

const SECONDARY = { crit: [0.05, 0.25], evade: [0.05, 0.15], range: [1, 4] };
const ROLES = new Set(Object.keys(ROLE_FACTOR));
const ELEMENTS = new Set(["FIRE", "TIDE", "STONE", "WOOD", "WIND", "NIGHT", "SPIRIT", "SWARM"]);
const FACTIONS = new Set(["AVIAN", "MYTHICAL", "INSECT", "REPTILE", "BEAST", "AQUATIC"]);

/* ------------------------------------------------------------------ parsing */

const FORMULA = /\((\d+(?:\.\d+)?)\s*\+\s*(?:(\d+(?:\.\d+)?)\s*[x×]\s*|(\d+(?:\.\d+)?)%\s*)(ATK|MATK|DEF|MDEF|HP tối đa|HP)\)/;
const STAT_KEY = { ATK: "atk", MATK: "matk", DEF: "def", MDEF: "mdef", HP: "hp", "HP tối đa": "hp" };

/** A skill deals damage only when the text says it inflicts damage, not when it merely mentions it. */
const isUtility = (text) => !/gây\s*[\[(]/i.test(text);

function expectedTargets(unit) {
  const text = `${unit.skill?.countVi ?? ""} ${unit.skill?.shapeVi ?? ""}`;
  if (/toàn bộ/i.test(text)) return 8;
  let n = 1;
  const count = /(\d+)\s*(?:mục tiêu|kẻ địch|ô|hàng|cột)/i.exec(text);
  if (count) n = Number(count[1]);
  else if (/3x3|vuông 3/i.test(text)) n = 9;
  else if (/cột|hàng/i.test(text)) n = 5;
  return n;
}

function repeatCount(text) {
  const m = /(\d+)\s*(?:phát|lần|nhát|đòn)\b/i.exec(text);
  return m ? Math.max(1, Number(m[1])) : 1;
}

function parseSkill(unit) {
  const text = unit.skill?.starDetailVi?.[0] ?? "";
  const m = FORMULA.exec(text);
  if (!m) {
    return { text, parsed: false, utility: !/gây\s*[\[(]/i.test(text) };
  }
  const stat = STAT_KEY[m[4]];
  const scale = m[2] ? Number(m[2]) : Number(m[3]) / 100;
  const base = Number(m[1]);
  const statValue = unit.stats?.[stat] ?? 0;
  // A parsed formula is damage only when the text says so around it; shield/heal formulas parse too.
  const clause = text.slice(m.index, m.index + 160);
  const dealsDamage = /sát thương/i.test(clause) || /gây\s*[\[(]/i.test(text);
  return {
    text,
    parsed: true,
    stat,
    base,
    scale,
    perHit: Math.round(base + statValue * scale),
    targets: expectedTargets(unit) * repeatCount(text),
    utility: !dealsDamage,
  };
}

/* -------------------------------------------------------------------- maths */

const eHP = (s) => s.hp * (1 + (s.def + s.mdef) / 200);
const offense = (s) => Math.max(s.atk, s.matk);
const round = (v, d = 0) => Number(v.toFixed(d));

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)))];
};

function budget(unit) {
  const anchor = TIER_ANCHOR[unit.tier];
  const factor = ROLE_FACTOR[unit.role];
  if (!anchor || !factor) return null;
  return {
    ehp: anchor.ehp * factor.ehp,
    off: anchor.off * factor.off,
    perHit: anchor.perHit,
  };
}

/* -------------------------------------------------------------------- audit */

function auditUnit(unit) {
  const findings = [];
  const add = (level, code, message) => findings.push({ level, code, message });

  if (!ROLES.has(unit.role)) add("error", "role", `unknown role "${unit.role}"`);
  if (!ELEMENTS.has(unit.element)) add("error", "element", `unknown element "${unit.element}"`);
  if (!FACTIONS.has(unit.faction)) add("error", "faction", `unknown faction "${unit.faction}"`);

  const stars = unit.skill?.starDetailVi;
  const rage = unit.skill?.rageCost;
  if (!Array.isArray(stars) || stars.length !== 3) add("error", "stars", "starDetailVi must have 3 entries");
  if (!Array.isArray(rage) || rage.length !== 3) {
    add("error", "rage", "rageCost must have 3 entries");
  } else {
    rage.forEach((value, i) => {
      if (!Number.isInteger(value) || value < 1 || value > 5) add("error", "rage", `rageCost[${i}] = ${value} outside 1..5`);
      if (i > 0 && value < rage[i - 1]) add("error", "rage", `rageCost decreases at star ${i + 1}`);
    });
  }

  for (const [stat, [lo, hi]] of Object.entries(SECONDARY)) {
    const value = unit.stats?.[stat];
    if (value === undefined) continue;
    if (value < lo || value > hi) add("warn", "secondary", `${stat} = ${value} outside ${lo}..${hi}`);
  }

  // Bosses are authored encounters, not shop units: no tier budget applies.
  if (unit.boss) return { findings, metrics: { boss: true, tier: unit.tier, role: unit.role } };

  const b = budget(unit);
  const caps = STAT_CAP[unit.tier];
  if (!b || !caps) {
    add("error", "tier", `no budget for tier ${unit.tier}`);
    return { findings, metrics: null };
  }

  for (const [stat, cap] of Object.entries(caps)) {
    const value = unit.stats?.[stat];
    if (typeof value !== "number") add("error", "stat", `missing stats.${stat}`);
    else if (value > cap) add("error", "cap", `${stat} ${value} exceeds tier cap ${cap}`);
  }

  const ehp = eHP(unit.stats);
  const off = offense(unit.stats);
  const n = ehp / b.ehp;
  const o = off / b.off;
  const p = n * o;
  const outside = (value, [lo, hi]) => value < lo || value > hi;

  if (outside(n, GATE.nError)) add("error", "ehp", `eHP ${Math.round(ehp)} = ${round(n, 2)}x budget ${Math.round(b.ehp)}`);
  else if (outside(n, GATE.nWarn)) add("warn", "ehp", `eHP ${Math.round(ehp)} = ${round(n, 2)}x budget ${Math.round(b.ehp)}`);
  if (outside(o, GATE.nError)) add("error", "off", `OFF ${off} = ${round(o, 2)}x budget ${Math.round(b.off)}`);
  else if (outside(o, GATE.nWarn)) add("warn", "off", `OFF ${off} = ${round(o, 2)}x budget ${Math.round(b.off)}`);
  if (outside(p, GATE.pError)) add("error", "budget", `N x O = ${round(p, 2)} outside ${GATE.pError.join("..")}`);
  else if (outside(p, GATE.pWarn)) add("warn", "budget", `N x O = ${round(p, 2)} outside ${GATE.pWarn.join("..")}`);

  const skill = parseSkill(unit);
  let dpr = null;
  if (skill.utility) {
    // Utility skills are judged by the effect they produce, not by damage budgets.
  } else if (!skill.parsed) {
    add("warn", "formula", "damage skill has no parsable (base + scale x STAT) formula; the engine applies no skill damage");
  } else {
    const ratio = skill.perHit / b.perHit;
    dpr = (skill.perHit * skill.targets) / (rage?.[0] ?? 3);
    const dprRatio = dpr / b.perHit;

    if (ratio > GATE.perHitError[1]) add("error", "perHit", `per-hit ${skill.perHit} = ${round(ratio, 2)}x ref ${b.perHit}`);
    else if (ratio > GATE.perHitWarn[1]) add("warn", "perHit", `per-hit ${skill.perHit} = ${round(ratio, 2)}x ref ${b.perHit}`);

    const singleTargetDamage = skill.targets === 1 && DAMAGE_ROLES.has(unit.role);
    if (singleTargetDamage) {
      if (ratio < GATE.perHitError[0]) add("error", "perHit", `single-target per-hit ${skill.perHit} = ${round(ratio, 2)}x ref ${b.perHit}`);
      else if (ratio < GATE.perHitWarn[0]) add("warn", "perHit", `single-target per-hit ${skill.perHit} = ${round(ratio, 2)}x ref ${b.perHit}`);
    }

    if (dprRatio > GATE.dprError[1]) add("error", "dpr", `DPR ${Math.round(dpr)} = ${round(dprRatio, 1)}x ref ${b.perHit}`);
    else if (dprRatio > GATE.dprWarn[1]) add("warn", "dpr", `DPR ${Math.round(dpr)} = ${round(dprRatio, 1)}x ref ${b.perHit}`);

    if (DAMAGE_ROLES.has(unit.role)) {
      if (dprRatio < GATE.dprError[0]) add("error", "dpr", `DPR ${Math.round(dpr)} = ${round(dprRatio, 2)}x ref ${b.perHit}`);
      else if (dprRatio < GATE.dprWarn[0]) add("warn", "dpr", `DPR ${Math.round(dpr)} = ${round(dprRatio, 2)}x ref ${b.perHit}`);
    }
  }

  return {
    findings,
    metrics: {
      tier: unit.tier,
      role: unit.role,
      ehp: Math.round(ehp),
      budgetEhp: Math.round(b.ehp),
      n: round(n, 2),
      off,
      budgetOff: Math.round(b.off),
      o: round(o, 2),
      p: round(p, 2),
      perHit: skill.parsed ? skill.perHit : null,
      stat: skill.parsed ? skill.stat : null,
      targets: skill.parsed ? skill.targets : null,
      rage: rage?.[0] ?? null,
      dpr: dpr === null ? null : Math.round(dpr),
      utility: skill.parsed ? skill.utility : isUtility(skill.text),
    },
  };
}

/* --------------------------------------------------------------------- CLI */

function usage() {
  console.log(`Forest Throne unit budget audit

  node scripts/audit-unit.mjs [options]

  --units <path>     catalog to audit (default: repo src/content/units.json)
  --id <id[,id]>     audit only these unit ids (repeatable)
  --tier <1..5>      audit only this tier
  --include-boss     include boss units
  --all              print every audited unit, not just findings
  --report           print measured distributions instead of findings
  --json             emit JSON
  --strict           exit 1 when warnings remain
  --help             this text`);
}

function parseArgs(argv) {
  const opts = { ids: [], units: null, tier: null, includeBoss: false, all: false, report: false, json: false, strict: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (value === undefined) fail(`missing value for ${arg}`);
      return value;
    };
    if (arg === "--units") opts.units = next();
    else if (arg === "--id") opts.ids.push(...next().split(",").map((s) => s.trim()).filter(Boolean));
    else if (arg === "--tier") opts.tier = Number(next());
    else if (arg === "--include-boss") opts.includeBoss = true;
    else if (arg === "--all") opts.all = true;
    else if (arg === "--report") opts.report = true;
    else if (arg === "--json") opts.json = true;
    else if (arg === "--strict") opts.strict = true;
    else if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else fail(`unknown option ${arg}`);
  }
  return opts;
}

function fail(message) {
  console.error(`audit-unit: ${message}`);
  process.exit(2);
}

function findCatalog(explicit) {
  if (explicit) {
    const path = resolve(explicit);
    if (!existsSync(path)) fail(`catalog not found: ${path}`);
    return path;
  }
  let dir = HERE;
  for (let i = 0; i < 8; i++) {
    const candidate = join(dir, "src", "content", "units.json");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  fail("could not locate src/content/units.json; pass --units <path>");
}

function loadUnits(path) {
  let raw;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`cannot read ${path}: ${error.message}`);
  }
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.units) ? raw.units : null;
  if (!list) fail(`${path} does not contain a unit array`);
  return list;
}

/* ------------------------------------------------------------------ report */

function report(units) {
  const normal = units.filter((u) => !u.boss);
  console.log(`# Forest Throne balance report\n`);
  console.log(`catalog units: ${units.length}  normal: ${normal.length}  bosses: ${units.length - normal.length}\n`);

  console.log("## Tier anchors\n");
  console.log("| Tier | n | eHP median | OFF median | HP | ATK | DEF | MATK | MDEF |");
  console.log("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const tier of [1, 2, 3, 4, 5]) {
    const group = normal.filter((u) => u.tier === tier);
    if (!group.length) continue;
    const cell = (fn) => Math.round(median(group.map(fn)));
    console.log(
      `| ${tier} | ${group.length} | ${cell((u) => eHP(u.stats))} | ${cell((u) => offense(u.stats))} | ${cell((u) => u.stats.hp)} | ` +
        `${cell((u) => u.stats.atk)} | ${cell((u) => u.stats.def)} | ${cell((u) => u.stats.matk)} | ${cell((u) => u.stats.mdef)} |`,
    );
  }

  console.log("\n## Role factors\n");
  console.log("| Role | n | eHP factor | OFF factor |");
  console.log("| --- | --- | --- | --- |");
  for (const role of Object.keys(ROLE_FACTOR)) {
    const group = normal.filter((u) => u.role === role);
    if (!group.length) continue;
    const ehpRatios = [];
    const offRatios = [];
    for (const tier of [1, 2, 3, 4, 5]) {
      const tierGroup = normal.filter((u) => u.tier === tier);
      const roleGroup = tierGroup.filter((u) => u.role === role);
      if (roleGroup.length < 2) continue;
      ehpRatios.push(median(roleGroup.map((u) => eHP(u.stats))) / median(tierGroup.map((u) => eHP(u.stats))));
      offRatios.push(median(roleGroup.map((u) => offense(u.stats))) / median(tierGroup.map((u) => offense(u.stats))));
    }
    const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
    console.log(`| ${role} | ${group.length} | ${round(mean(ehpRatios), 2)} | ${round(mean(offRatios), 2)} |`);
  }

  console.log("\n## Skill damage\n");
  console.log("| Tier | parsed | per-hit median | per-hit p10-p90 | DPR median | DPR p90 |");
  console.log("| --- | --- | --- | --- | --- | --- |");
  for (const tier of [1, 2, 3, 4, 5]) {
    const group = normal.filter((u) => u.tier === tier);
    const rows = group.map((u) => ({ unit: u, skill: parseSkill(u) })).filter((r) => r.skill.parsed);
    if (!rows.length) continue;
    const perHit = rows.map((r) => r.skill.perHit);
    const dpr = rows.map((r) => (r.skill.perHit * r.skill.targets) / (r.unit.skill?.rageCost?.[0] ?? 3));
    console.log(
      `| ${tier} | ${rows.length}/${group.length} | ${Math.round(median(perHit))} | ${Math.round(percentile(perHit, 0.1))}-${Math.round(percentile(perHit, 0.9))} | ` +
        `${Math.round(median(dpr))} | ${Math.round(percentile(dpr, 0.9))} |`,
    );
  }

  console.log("\nRegenerate the tables in references/balance-data.md from this output; do not hand-edit budgets to match one unit.");
}

/* -------------------------------------------------------------------- main */

const opts = parseArgs(process.argv.slice(2));
const path = findCatalog(opts.units);
const units = loadUnits(path);

if (opts.report) {
  report(units);
  process.exit(0);
}

let selected = units.filter((u) => opts.includeBoss || !u.boss);
if (opts.tier) selected = selected.filter((u) => u.tier === opts.tier);
if (opts.ids.length) {
  const wanted = new Set(opts.ids);
  selected = selected.filter((u) => wanted.has(u.id));
  if (!selected.length) fail(`no unit matched: ${opts.ids.join(", ")}`);
}

const results = selected.map((unit) => ({ unit, ...auditUnit(unit) }));
const errors = results.filter((r) => r.findings.some((f) => f.level === "error"));
const warns = results.filter((r) => !errors.includes(r) && r.findings.length);

if (opts.json) {
  console.log(
    JSON.stringify(
      {
        catalog: path,
        audited: results.length,
        errors: errors.length,
        warnings: warns.length,
        units: results.map((r) => ({
          id: r.unit.id,
          name: r.unit.nameVi,
          boss: !!r.unit.boss,
          metrics: r.metrics,
          findings: r.findings,
        })),
      },
      null,
      2,
    ),
  );
} else {
  const detail = opts.ids.length > 0 || results.length <= 12;
  const pad = (value, width) => String(value).padEnd(width);

  if (detail) {
    for (const r of results) {
      const m = r.metrics;
      console.log(`\n${r.unit.id} — ${r.unit.nameVi} (T${r.unit.tier} ${r.unit.role}${r.unit.boss ? ", BOSS" : ""})`);
      if (m) {
        if (m.boss) {
          console.log("  boss: outside the shop-unit budget; validate in its encounter instead");
        } else {
          console.log(`  eHP ${m.ehp} / budget ${m.budgetEhp}  N=${m.n}   OFF ${m.off} / budget ${m.budgetOff}  O=${m.o}  N*O=${m.p}`);
          console.log(
            m.perHit === null
              ? "  skill: no damage formula"
              : `  skill: ${m.perHit} ${m.stat} x ${m.targets} target(s) / rage ${m.rage} = DPR ${m.dpr}${m.utility ? "  (utility)" : ""}`,
          );
        }
      }
      if (!r.findings.length) console.log("  ok");
      for (const f of r.findings) console.log(`  ${f.level === "error" ? "ERROR" : "warn "} [${f.code}] ${f.message}`);
    }
    console.log("");
  }

  if (!detail || opts.all) {
    const rows = opts.all ? results : [...errors, ...warns];
    if (rows.length) {
      console.log(pad("unit", 22) + pad("tier", 6) + pad("role", 10) + pad("N", 7) + pad("O", 7) + pad("P", 7) + pad("perHit", 8) + pad("DPR", 7) + "issues");
      for (const r of rows) {
        const m = r.metrics ?? {};
        const issues = r.findings.map((f) => `${f.level === "error" ? "E" : "W"}:${f.code}`).join(",") || "ok";
        console.log(
          pad(r.unit.id, 22) + pad(m.tier ?? "-", 6) + pad(m.role ?? "-", 10) + pad(m.n ?? "-", 7) + pad(m.o ?? "-", 7) +
            pad(m.p ?? "-", 7) + pad(m.perHit ?? "-", 8) + pad(m.dpr ?? "-", 7) + issues,
        );
      }
      console.log("");
    }
  }

  const errorCount = errors.reduce((sum, r) => sum + r.findings.filter((f) => f.level === "error").length, 0);
  const warnCount = warns.reduce((sum, r) => sum + r.findings.length, 0);
  console.log(`audited ${results.length} unit(s): ${errors.length} with errors (${errorCount}), ${warns.length} with warnings (${warnCount})`);
  if (warns.length) console.log("warnings need a fix or a justification in the commit body");
}

const failed = errors.length > 0 || (opts.strict && warns.length > 0);
process.exit(failed ? 1 : 0);
