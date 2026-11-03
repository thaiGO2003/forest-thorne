// Units with a finished bespoke rig. The game hides every other catalog entry from the Library,
// shop, encounters and saves until its visual is authored. Keep this list in sync with
// src/units/registry.ts (covered by tests/unit-visual-gate.test.ts).
export const VISUAL_UNIT_IDS: readonly string[] = [
  "jaguar_hunt",
  "toad_poison",
  "frog_alchemy",
  "bat_blood",
  "ant_guard",
  "rabbit_blood",
  "crane_blessing",
  "weasel_quick",
  "hawk_hunter",
];

const VISUAL_UNITS = new Set<string>(VISUAL_UNIT_IDS);

/** True when the unit has a bespoke authored rig. */
export const hasUnitVisual = (id: string): boolean => VISUAL_UNITS.has(id);
