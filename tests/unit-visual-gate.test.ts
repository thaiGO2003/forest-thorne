import { describe, expect, it } from "vitest";
import { NORMAL_UNITS, UNIT_BY_ID } from "../src/content/catalog";
import { hasUnitVisual, VISUAL_UNIT_IDS } from "../src/content/unitVisuals";
import { generateEncounter } from "../src/core/encounter";
import { beastDenOffers } from "../src/core/fortress";
import { canonicalShopRoster } from "../src/core/inspection";
import { normalizeEnemyPreview } from "../src/core/preview";
import { createEnvelope, migrate } from "../src/core/save";
import { createRun } from "../src/core/run";
import { tutorialShop } from "../src/core/tutorial";
import { RIGS } from "../src/units/registry";

describe("unit visual gate", () => {
  it("keeps the visible set in sync with the authored rigs", () => {
    expect(new Set(VISUAL_UNIT_IDS)).toEqual(new Set(Object.keys(RIGS)));
    for (const id of VISUAL_UNIT_IDS) {
      expect(UNIT_BY_ID.has(id), id).toBe(true);
      expect(hasUnitVisual(id), id).toBe(true);
    }
    expect(VISUAL_UNIT_IDS.length).toBeLessThan(NORMAL_UNITS.length);
  });

  it("only offers visible units in shop, encounters, fortress and tutorial", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const run = createRun(seed);
      for (const id of run.shop) if (id) expect(hasUnitVisual(id), `shop seed ${seed}: ${id}`).toBe(true);
      const encounter = generateEncounter({ round: 1 + (seed % 30), mode: "MEDIUM", rng: () => 0.5, bossRounds: true });
      for (const unit of encounter.units) expect(hasUnitVisual(unit.baseId), unit.baseId).toBe(true);
    }
    for (const unit of canonicalShopRoster()) expect(hasUnitVisual(unit.id), unit.id).toBe(true);
    for (const id of beastDenOffers(9, 3, () => 0)) expect(hasUnitVisual(id), id).toBe(true);
    for (let round = 1; round <= 8; round++) {
      for (const id of tutorialShop(round, 0, 5) ?? []) {
        if (id) expect(hasUnitVisual(id), `tutorial ${round}: ${id}`).toBe(true);
      }
    }
    expect(normalizeEnemyPreview([{ uid: "x", baseId: "bear_ancient", star: 1, row: 2, col: 7 }])).toEqual([]);
  });

  it("drops unrendered units from migrated saves and returns their equipment", () => {
    const player = createRun(1);
    player.itemBag = ["tear"];
    player.board[0] = { uid: "ghost", baseId: "bear_ancient", star: 1, equips: ["eq_blue_buff"] };
    const migrated = migrate(createEnvelope({ player }, { version: 5 }))!;
    const saved = migrated.envelope.payload.player!;
    expect(saved.board[0]).toBeNull();
    expect(saved.itemBag).toEqual(["tear", "eq_blue_buff"]);
  });
});
