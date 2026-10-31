---
name: build-game-units
description: Author, retune, or audit Forest Throne unit stats and skill damage against gold-tier and role budgets. Use when adding a unit to src/content/units.json, changing hp/atk/def/matk/mdef, crit, evade, range or rage, writing or editing starDetailVi damage formulas, checking power creep, or reviewing the catalog for one-shot and AoE outliers.
---

# Build Game Units

Balance is a budget, not a feeling. Every unit spends the same tier currency: gold cost equals tier, tier equals shop availability, and a unit's stats plus skill damage must fit what that tier can afford. Author numbers from the budget tables below, then prove the result with `scripts/audit-unit.mjs`.

## Read the pipeline before touching numbers

| Concern | Source of truth |
| --- | --- |
| Unit data | `src/content/units.json` (generated; do not hand-edit without confirming the generator) |
| Types | `src/content/catalog.ts` (`UnitDef`, `UnitStats`, `UnitSkill`, `Role`) |
| Stat materialization | `src/core/combat.ts` (`freshFighter`) |
| Damage pipeline | `src/core/combat.ts` (`strike`, `basicAttack`) |
| Skill text parsing | `src/core/skills.ts` (`SkillSpec`) |
| Star scaling, odds, sell | `src/core/economy.ts` |
| Counters, synergies | `src/core/synergy.ts` |

Never restate these formulas in content or UI. If a number disagrees with the runtime, the runtime wins.

## Canonical math

Do not re-derive these; they are fixed by the engine.

**Stat materialization** (per star `m`):

```
maxHp = round(hp * m)        atk  = round(atk * m)   def  = round(def * m)
matk  = round(matk * m)      mdef = round(mdef * m)
crit  = ROLE_CRIT[role] + stats.crit
evade = min(0.6, ROLE_EVADE[role] + stats.evade + (star - 1) * 0.05)
critDmg = stats.critDmg ?? 1.5      accuracy = stats.accuracy ?? 0.95
```

`m` is `STAR_STAT = [-, 1.0, 1.6, 2.5]`. Skill damage uses `STAR_SKILL = [-, 1.0, 1.2, 1.4]`; status chances use `STAR_EFFECT_CHANCE = [-, 1.0, 1.4, 2.0]`; DoT ticks use `STAR_DOT = [-, 1.0, 1.3, 1.6]`. `stats.crit` and `stats.evade` are **bonuses on top of the role base**, not absolute values.

**Basic attack**: `raw = atk` (or `matk` for MAGE/SUPPORT/magic delivery). One attack, one target, can miss.

**Skill damage**: `raw = round((base + scale * stat) * STAR_SKILL[star] * goldMult)`, then that raw is applied to every target of the skill.

- `goldMult = min(2, 1 + (gold - 10) / 2 / 100)` — 1.0 at 10 gold or less.
- Skills always land; only basic physical attacks roll to miss.
- `rageMax` in combat comes from `skill.rageCost[star - 1]`, **not** `stats.rageMax`. Treat `stats.rageMax` as legacy metadata.

**Resolution**:

```
element counter: x1.5 (x0.5 vs TANKER, x1.0 if attacker is TANKER)
class counter:   x1.5 per edge
crit:            x critDmg, ignores DEF/MDEF
otherwise:       x 100 / (100 + DEF)  or  100 / (100 + MDEF)
```

Because crit bypasses mitigation and counter edges multiply, a skill formula is already multiplied by up to `1.5 x 1.5 x 1.5 = 3.375` in the worst case. Budget raw damage for the average case, never the best case.

## Stat budget

A unit is priced by tier, so its stats are priced by tier too. Two numbers define the budget:

- `eHP = hp * (1 + (def + mdef) / 200)` — survivability against an even mix of physical and magic damage.
- `OFF = max(atk, matk)` — the stat the unit actually attacks with.

### Tier anchors

| Tier (gold) | eHP anchor | OFF anchor | Shop peak level |
| --- | --- | --- | --- |
| 1 | 301 | 64 | 1 |
| 2 | 317 | 70 | 8 |
| 3 | 363 | 75 | 15 |
| 4 | 416 | 87 | 20 |
| 5 | 571 | 97 | 25 |

Growth from T1 to T5 is about `x1.9` eHP and `x1.5` offense. That is the whole power curve. A unit that exceeds it is not "a strong T5"; it is a T6 sold at T5 price.

### Role shape

Multiply the tier anchor by the role factors. Role identity is a **shape**, not a bonus: a tanker spends its budget on eHP and pays with offense.

| Role | eHP factor | OFF factor | Identity |
| --- | --- | --- | --- |
| TANKER | 1.67 | 0.65 | Soaks; low damage, high DEF/MDEF |
| FIGHTER | 1.18 | 1.01 | Bruiser; balanced |
| SUPPORT | 1.05 | 0.99 | Utility caster; MDEF-leaning |
| MAGE | 0.94 | 1.15 | Glass caster; MATK, low DEF |
| ASSASSIN | 0.84 | 1.08 | Fragile diver; high ATK/crit |
| ARCHER | 0.85 | 0.97 | Ranged; range 3-4 pays for stats |

So a T4 TANKER budget is `eHP 695 / OFF 57`, and a T4 MAGE budget is `eHP 391 / OFF 100`.

### Splitting the budget into five stats

1. Pick `hp`, then set `def`/`mdef` so that `hp * (1 + (def + mdef) / 200)` lands on the eHP budget. High DEF means low HP; the product is what matters.
2. Set the primary offense stat to the OFF budget. The unused offense stat stays at or below `0.5 x OFF` (casters keep ATK low; bruisers keep MATK low).
3. Give DEF/MDEF in role proportion: TANKER/FIGHTER lean DEF, MAGE/SUPPORT lean MDEF, ASSASSIN/ARCHER stay low on both.
4. Secondary stats stay inside authored ranges: `crit` 0.05-0.25, `evade` 0.05-0.15, `critDmg` 1.5, `accuracy` 0.95, `range` 1-4.

### Gates

With `N = eHP / budget_eHP`, `O = OFF / budget_OFF`, `P = N * O`:

- **Error** if `N` or `O` falls outside `[0.70, 1.35]`, or `P` outside `[0.60, 1.45]`.
- **Warn** if `N` or `O` falls outside `[0.85, 1.20]`, or `P` outside `[0.72, 1.30]`.

`P` is the anti-power-creep gate: a unit may be tanky *or* hard-hitting, not both. Trading one for the other is free; buying both is a violation.

### Hard caps

No single stat may exceed these regardless of budget:

| Tier | HP | ATK | DEF | MATK | MDEF |
| --- | --- | --- | --- | --- | --- |
| 1 | 450 | 79 | 49 | 81 | 33 |
| 2 | 470 | 82 | 49 | 93 | 33 |
| 3 | 535 | 95 | 49 | 99 | 36 |
| 4 | 660 | 104 | 54 | 114 | 42 |
| 5 | 735 | 115 | 65 | 124 | 54 |

Bosses are outside this system: they are authored encounters, not shop units. Never copy boss stats into a normal unit.

## Skill damage budget

The skill is where power creep actually enters. A unit can pass every stat gate and still one-shot a board.

### Expected targets (`E`)

Count targets from the authored `countVi`/`shapeVi`, then multiply by repeat count:

| Shape | `E` |
| --- | --- |
| single target | 1 |
| row or column (5 cells per side) | up to 5 |
| square 3x3 | up to 9 |
| "toàn bộ" (all enemies/allies) | 8 (realistic board) |
| "N phát" / "N lần" | multiply by `N` |

`E` is an audit input, not a damage multiplier you apply to the formula. The runtime applies `raw` per target; `E` only exists so budgets can compare a nuke with a sweep.

### Per-hit reference

| Tier | per-hit ref | Error band | Warn band |
| --- | --- | --- | --- |
| 1 | 69 | 35-131 | 52-104 |
| 2 | 76 | 38-144 | 57-114 |
| 3 | 103 | 52-196 | 77-155 |
| 4 | 129 | 65-245 | 97-194 |
| 5 | 182 | 91-346 | 137-273 |

The ceiling is what stops one-shots: at T5, 346 raw against a ~350 HP archer is already a kill before crit. The floor only applies to single-target (`E == 1`) damage skills on MAGE/ASSASSIN/ARCHER/FIGHTER; TANKER and SUPPORT may trade damage for utility, and multi-hit or multi-target skills are judged on damage per rage instead.

### Damage per rage

`DPR = perHit * E / rageCost[0]`

| Tier | DPR ref | Warn above | Error above | Error below |
| --- | --- | --- | --- | --- |
| 1 | 69 | 552 | 828 | 8 |
| 2 | 76 | 608 | 912 | 9 |
| 3 | 103 | 824 | 1236 | 12 |
| 4 | 129 | 1032 | 1548 | 15 |
| 5 | 182 | 1456 | 2184 | 22 |

Rules that follow from this table:

- An AoE may not also be cheap. If `E >= 4`, `rageCost[0] >= 3` unless total `DPR` stays under the warn line.
- A rage-1 skill stays under the per-hit warn ceiling (`1.5x` ref). Cheap skills are tempo tools, not finishers.
- Multi-hit skills (`E >= 3` from repeats) budget per hit, not per skill: `perHit` near the floor and `DPR` inside the band.
- Utility skills (shield, heal, buff, control — text with no `gây (...)` damage clause) skip damage gates entirely; their formula is checked against the effect it produces, not against the per-hit ref.

### Status, DoT and control

- DoT per turn stays at or below `0.15 x` the tier per-hit ref per turn; 2-3 turns is the normal envelope. Author the **1-star** tick: `STAR_DOT = [-, 1.0, 1.3, 1.6]` multiplies it per star, so a 3-star tick is `1.6x` the authored number and the cap applies to the number in `starDetailVi[0]`. This one is an authored check — `audit-unit.mjs` gates damage and DPR, not DoT.
- Hard control (stun/freeze/sleep/silence) above 50% chance belongs on `rageCost[0] >= 3` skills, and `STAR_EFFECT_CHANCE` already triples it at 3 stars — author the 1-star number.
- A skill may have damage plus control, damage plus DoT, or control plus utility. Three payoff axes on one skill is a balance bug.

## Authoring workflow

1. Choose tier from gold cost and role from the unit's combat job. Do not pick stats first.
2. Compute `budget_eHP` and `budget_OFF` from the tier anchor and role factors.
3. Split into `hp`/`def`/`mdef` and `atk`/`matk`; set secondary stats inside their ranges.
4. Write the 1-star `starDetailVi` formula from the per-hit band. Use the `(base + scale x STAT)` form so `src/core/skills.ts` can parse it.
5. Write stars 2 and 3 as `STAR_SKILL`-consistent steps (`1.0 / 1.2 / 1.4`) plus a mechanic change, not a second stat jump.
6. Run the audit. Fix errors; justify every remaining warning in the PR body.
7. Run the game and confirm the unit kills and dies in the expected number of exchanges at its tier.

## Validation gates

```bash
node .agents/skills/build-game-units/scripts/audit-unit.mjs
node .agents/skills/build-game-units/scripts/audit-unit.mjs --id <unit_id>
node .agents/skills/build-game-units/scripts/audit-unit.mjs --report
pnpm typecheck
```

A unit ships only when:

- the audit reports zero errors for it;
- every warning is either fixed or explained in the commit body;
- `starDetailVi` has 3 entries and `rageCost` has 3 entries, non-decreasing, in `1..5`;
- the damage formula parses (no bare numbers, no `%` without a stat);
- the unit survives and kills within the tier's expected exchange count in a real match.

## Anti-power-creep rules

- Never raise a stat without lowering another in the same tier. The budget is closed.
- Never add a new multiplier axis (extra crit, extra counter, extra star scaling) to a single unit. Multipliers live in the engine.
- Skill text is the source of truth and it is parsed by regex. If the parser cannot read it, the mechanic does not exist in combat.
- Buff a weak unit by giving it utility or reach, not by raising `OFF` past the role factor.
- When the whole tier feels weak, raise the tier anchor in `references/balance-data.md` and re-audit the catalog. Do not buff units one by one.
- Re-measure after any catalog change: `--report` prints the current distributions so the reference tables can be regenerated instead of guessed.

## References

- `references/balance-data.md` — measured tier/role/skill distributions, methodology, and how to regenerate.
- `scripts/audit-unit.mjs` — deterministic budget audit (errors exit 1). Its `TIER_ANCHOR`, `ROLE_FACTOR`, `STAT_CAP` and `GATE` constants are the executable form of this document; when a band changes, change both.
