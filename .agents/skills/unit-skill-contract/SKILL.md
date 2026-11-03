---
name: unit-skill-contract
description: Specify or change a unit skill so data, targeting, RNG, status timing and visuals stay in sync. Use whenever a unit skill is added, reworked or retuned; if the current animation/VFX does not express the described skill and role, implement the visual change in the same task.
---

# Unit skill contract

A skill change is not done when the data entry changes. The resolver, status lifecycle,
targeting, RNG and the read on screen must all describe the same behaviour.

## 1. Write the contract before coding

For every skill and every star level, record:

- **Damage**: type (physical / magic / true), base amount or scaling source, crit eligibility,
  multi-hit split, and any per-target falloff.
- **Timing**: when it fires (cast start, impact, round start, round end, on-kill), how long the
  effect lasts, when it expires, and how it refreshes or stacks.
- **Targets**: role priority first, then the skill's own filter (highest HP, same row, adjacent,
  lowest HP …), then a deterministic ranking. State what happens when the preferred set is empty.
- **Randomness**: only where the design says random. Pick uniformly from the eligible set with the
  gameplay RNG (seeded); never use first-match, rotation or "shuffled once" as a stand-in.
- **Board interaction**: pull, knockback, reposition, collision and occupancy rules; which column
  is tried next when the first is occupied.
- **Statuses**: stun / paralyze / silence / debuff disable created, suppressed or removed, with
  duration, stacking and cleanup boundary (end of action vs end of round).
- **Visual contract**: projectile origin (mouth, sword, horn …), travel path, impact frame, per-star
  VFX, and what the animation must show that the data alone cannot.

If the request does not name a priority target, resolve by role. If it names one, that condition
filters the role-eligible set first.

## 2. Implementation order

1. Skill data / schema (keep existing damage unless the task explicitly retunes it).
2. Combat resolver (damage events, multi-hit, modifiers, crit).
3. Status lifecycle (apply, tick, expire, cleanse, suppression).
4. Targeting and RNG.
5. Animation timing (impact sync with damage events).
6. VFX (projectile, trail, impact, per-star intensity).
7. Tooltip and localization.
8. Targeted tests.

If a step already exists, verify it against the contract instead of rewriting it.

## 3. Visuals are part of the change

When the current animation or VFX cannot express the described skill or the unit's role, code the
visual change in the same task: projectile origin, travel, impact, hit reaction, per-star effect.
A skill that exists only in data and tooltip text is incomplete.

## 4. Acceptance checklist

- [ ] Each star level has an explicit behaviour in data and tests.
- [ ] Role priority and the skill filter are both tested, including an empty preferred set.
- [ ] Random choices are uniform on the eligible set and reproducible with a seed.
- [ ] Multi-hit skills emit one damage event per hit (no merged or double event).
- [ ] Statuses expire at the documented boundary; suppressed debuffs resume correctly.
- [ ] Damage modifiers (falloff, bonus, armor) are applied once and in the documented order.
- [ ] Animation impact frame matches the damage event; VFX origin matches the description.
- [ ] Tooltip text matches the implemented numbers and timing.
- [ ] Targeted tests pass; no unrelated unit data was changed.
