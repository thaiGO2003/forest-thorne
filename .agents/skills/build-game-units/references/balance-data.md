# Forest Throne — unit balance data

Measured snapshot of `src/content/units.json` (120 normal units, 5 bosses) used to derive the budgets in `../SKILL.md`.

- Snapshot date: 2026-10-31
- Scope: normal units only. Bosses are authored encounters and are excluded from every table.
- Regenerate with `node scripts/audit-unit.mjs --report` after any catalog change. Do not hand-tune these tables to match a single unit.

## How the numbers were derived

```
eHP = hp * (1 + (def + mdef) / 200)     // exact for an even physical/magic split,
                                        // since mitigation is 100 / (100 + DEF|MDEF)
OFF = max(atk, matk)                    // the stat the unit attacks with
```

Tier anchors are the medians of `eHP` and `OFF` across all normal units of that tier. Role factors are the mean, over tiers 1-5, of `role median / tier median` (tiers with fewer than two units of the role are skipped). Medians are used instead of means so a single outlier cannot move the anchor.

## Tier anchors

| Tier | n | eHP median | OFF median | HP | ATK | DEF | MATK | MDEF |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 17 | 301 | 64 | 250 | 52 | 16 | 16 | 20 |
| 2 | 26 | 317 | 70 | 268 | 47 | 15 | 17 | 22 |
| 3 | 27 | 363 | 75 | 309 | 72 | 18 | 18 | 18 |
| 4 | 28 | 416 | 87 | 340 | 59 | 19 | 21 | 25 |
| 5 | 22 | 571 | 97 | 431 | 91 | 22 | 26 | 36 |

Growth T1 to T5: `eHP x1.90`, `OFF x1.52`.

## Role shape

| Role | n | eHP factor | OFF factor |
| --- | --- | --- | --- |
| TANKER | 20 | 1.67 | 0.65 |
| FIGHTER | 21 | 1.18 | 1.01 |
| SUPPORT | 20 | 1.05 | 0.99 |
| MAGE | 20 | 0.94 | 1.15 |
| ASSASSIN | 19 | 0.84 | 1.08 |
| ARCHER | 20 | 0.85 | 0.97 |

ASSASSIN and ARCHER eHP drift below budget at high tiers; that is the intended fragility, and the reason the `N` gate has a `0.70` floor instead of `0.85`.

## Role x tier stat medians

Raw medians, for authors who want a reference unit rather than a budget calculation.

| Role | T1 | T2 | T3 | T4 | T5 |
| --- | --- | --- | --- | --- | --- |
| ARCHER | HP240 ATK52 DEF12 MATK10 MDEF14 | HP262 ATK68 DEF14 MATK13 MDEF14 | HP280 ATK74 DEF14 MATK14 MDEF14 | HP323 ATK82 DEF15 MATK17 MDEF15 | HP357 ATK98 DEF20 MATK21 MDEF20 |
| ASSASSIN | HP235 ATK73 DEF15 MATK18 MDEF13 | HP258 ATK76 DEF17 MATK20 MDEF15 | HP282 ATK88 DEF18 MATK22 MDEF16 | HP297 ATK90 DEF18 MATK23 MDEF17 | HP337 ATK102 DEF19 MATK26 MDEF18 |
| FIGHTER | HP282 ATK64 DEF22 MATK14 MDEF18 | HP331 ATK70 DEF22 MATK17 MDEF18 | HP362 ATK77 DEF24 MATK18 MDEF18 | HP417 ATK90 DEF28 MATK20 MDEF22 | HP497 ATK99 DEF50 MATK23 MDEF36 |
| MAGE | HP220 ATK19 DEF11 MATK73 MDEF21 | HP266 ATK18 DEF10 MATK80 MDEF22 | HP311 ATK23 DEF12 MATK91 MDEF24 | HP310 ATK23 DEF13 MATK105 MDEF25 | HP480 ATK33 DEF25 MATK108 MDEF40 |
| SUPPORT | HP252 ATK23 DEF15 MATK64 MDEF26 | HP286 ATK25 DEF15 MATK69 MDEF27 | HP331 ATK29 DEF17 MATK74 MDEF28 | HP372 ATK30 DEF19 MATK88 MDEF31 | HP450 ATK38 DEF22 MATK94 MDEF45 |
| TANKER | HP367 ATK43 DEF32 MATK10 MDEF25 | HP427 ATK47 DEF34 MATK12 MDEF27 | HP420 ATK48 DEF40 MATK14 MDEF31 | HP560 ATK58 DEF45 MATK17 MDEF35 | HP680 ATK60 DEF58 MATK20 MDEF48 |

Note the T5 FIGHTER and T5 MAGE rows: high-tier units in this catalog already trade HP for DEF/MDEF. Budget `eHP`, not `hp`.

## Per-stat envelope (min..max observed)

Used to set the hard caps in `../SKILL.md` (cap = observed max, rounded up, then forced monotonic).

| Tier | HP | ATK | DEF | MATK | MDEF |
| --- | --- | --- | --- | --- | --- |
| 1 | 218-413 | 17-73 | 10-45 | 10-75 | 13-30 |
| 2 | 240-433 | 17-76 | 10-35 | 10-86 | 13-28 |
| 3 | 242-495 | 21-88 | 11-42 | 12-91 | 12-33 |
| 4 | 260-610 | 22-96 | 12-50 | 14-105 | 14-38 |
| 5 | 305-680 | 27-106 | 14-60 | 17-114 | 12-50 |

## Secondary stats

| Stat | Observed values | Rule |
| --- | --- | --- |
| `crit` | 0.05, 0.08, 0.10, 0.20, 0.25 | Additive on role base; keep <= 0.25 |
| `critDmg` | 1.5 | Do not raise on a single unit |
| `evade` | 0.05-0.15 | Additive on role base, capped 0.6 in combat |
| `accuracy` | 0.95 | Uniform |
| `range` | 1, 3, 4 | Melee 1, mid 3, back 4 |
| `rageMax` | 3, 4, 5 | Legacy; combat reads `skill.rageCost` |

## Skill damage

92 of 120 normal units have a parseable damage formula in `starDetailVi[0]`. The remaining 28 are pure utility (shield, heal, buff, control) and are outside the damage gates.

| Tier | parsed | per-hit median | per-hit p10-p90 | per-hit / stat median | DPR median |
| --- | --- | --- | --- | --- | --- |
| 1 | 12 | 69 | 58-76 | 1.08 | 37 |
| 2 | 19 | 76 | 59-87 | 1.01 | 68 |
| 3 | 21 | 103 | 40-127 | 1.30 | 67 |
| 4 | 21 | 129 | 83-154 | 1.55 | 127 |
| 5 | 19 | 182 | 78-286 | 1.96 | 221 |

`per-hit / stat` climbs with tier because high-tier skills scale harder off a bigger stat. That is the intended curve; the per-hit band, not the ratio, is the gate.

### Highest total-output skills (E from shape x repeats)

| Unit | Tier | Per hit | E | Rage | Total per rage |
| --- | --- | --- | --- | --- | --- |
| `gorilla_smash` | 4 | 143 | 9 | 1 | 1287 |
| `roc_legend` | 5 | 232 | 5 | 1 | 1160 |
| `thunderbird_storm` | 5 | 215 | 4 | 1 | 860 |
| `phoenix_arrow` | 5 | 191 | 5 | 2 | 478 |
| `pelican_bomb` | 4 | 99 | 9 | 2 | 446 |
| `dragon_breath` | 5 | 167 | 8 | 3 | 445 |
| `wraith_shadow` | 5 | 219 | 2 | 1 | 438 |
| `kirin_thunder` | 5 | 162 | 8 | 3 | 432 |

These are the catalog's current tempo ceiling. `gorilla_smash` sits above the 8x warn line; it is the reference point for "strongest allowed sweep", not a target.

### Lowest total-output skills

| Unit | Tier | Role | Per hit | E | Rage | Total per rage |
| --- | --- | --- | --- | --- | --- | --- |
| `turtle_mire` | 3 | TANKER | 29 | 1 | 3 | 10 |
| `golem_stone` | 3 | TANKER | 32 | 1 | 3 | 11 |
| `crow_storm` | 1 | ARCHER | 60 | 1 | 4 | 15 |
| `snail_fortress` | 3 | TANKER | 52 | 1 | 3 | 17 |
| `angel_guardian` | 5 | SUPPORT | 68 | 1 | 3 | 23 |

TANKER and SUPPORT sit here by design; the low DPR floor only applies to damage-primary roles.

## Economy context

These are why tier anchors look the way they do. Source: `src/core/economy.ts`.

- Buy price = tier; sell = `tier x 1 / 3 / 5` at 1/2/3 stars.
- Shop tier peaks at levels `1 / 8 / 15 / 20 / 25`.
- `STAR_STAT = 1.0 / 1.6 / 2.5`, `STAR_SKILL = 1.0 / 1.2 / 1.4`, `STAR_EFFECT_CHANCE = 1.0 / 1.4 / 2.0`.
- Deploy cap `clamp(level + 2, 3, 25)`; board is 5 rows x 10 cols, 5 columns per side.
- A 3-star T1 (`3 gold` invested per copy, 9 gold total for the third star) has `2.5x` stats but only `1.4x` skill damage. Star-ups are the main power spike; a unit's 1-star budget must assume it will be 3-starred.

## Known catalog outliers

Present in the snapshot, from `node scripts/audit-unit.mjs`:

- `ram_charge` (T1 TANKER): `O = 1.44` — **error**. A tanker carrying bruiser-level ATK.
- `reaper_void`, `wraith_shadow` (T5 ASSASSIN): `N ~ 0.76`, `P ~ 0.68`, and per-hit `1.6x` the tier ref — fragile but with near-finisher burst.
- `panther_void`, `trex_bite` (T5): per-hit `1.57x` ref, just under the warn ceiling.
- `mantis_blade` (T3 ASSASSIN): `P = 1.31`, buying both eHP and offense.
- `hydra_swamp`, `titan_earth` (T4 TANKER): `N ~ 1.21-1.26`, above the soft eHP line.
- `gorilla_smash` (T4 FIGHTER): total per rage `1287`, above the 8x warn line.
- `crow_storm` (T1 ARCHER): DPR `15`, below the damage-role floor for a rage-4 skill.
- `otter_river`, `shark_frenzy`, `tiger_fang` (FIGHTER): `N ~ 0.73-0.82`, under budget survivability.

Fix these by trading stats inside their budget, not by raising the tier anchor.
