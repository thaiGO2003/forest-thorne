import { describe, expect, it } from "vitest";
import { AUGMENTS, AUGMENT_BY_ID } from "../src/core/augments";
import { augmentCopy, augmentGroupLabel, augmentGroupRank, augmentValueText } from "../src/content/augmentText";
import { ROUND_ENVIRONMENT_CYCLE } from "../src/core/environment";
import { environmentCopy } from "../src/content/environmentText";

describe("augment copy", () => {
  it("gives every catalog augment a real name instead of its machine id", () => {
    for (const def of AUGMENTS) {
      const copy = augmentCopy(def.id);
      expect(copy.name.length, def.id).toBeGreaterThan(0);
      // The Information modal regressed by printing `xp_discount_4`; never allow that again.
      expect(copy.name, def.id).not.toBe(def.id);
      expect(copy.name, def.id).not.toMatch(/^[a-z0-9_]+$/);
      expect(copy.summary.length, def.id).toBeGreaterThan(0);
    }
  });

  it("formats flat, percentage and rate values with the right unit", () => {
    const flat = AUGMENT_BY_ID.get("gold_cache_1")!;
    expect(augmentValueText(flat)).toBe("+4");
    expect(augmentValueText(AUGMENT_BY_ID.get("xp_discount_2")!)).toBe("−1");

    const percent = AUGMENT_BY_ID.get("team_atk_2")!;
    expect(augmentValueText(percent)).toBe("+7%");

    const rate = AUGMENT_BY_ID.get("interest_flow_3")!;
    expect(augmentValueText(rate)).toBe("+2%");
  });

  it("falls back cleanly for ids that no longer exist", () => {
    const copy = augmentCopy("retired_mod_9");
    expect(copy.name).not.toBe("retired_mod_9");
    expect(copy.summary).toContain("retired_mod_9");
    expect(copy.value).toBe("");
  });

  it("orders groups economy → formation → combat → synergy", () => {
    expect(augmentGroupRank("ECONOMY")).toBeLessThan(augmentGroupRank("FORMATION"));
    expect(augmentGroupRank("FORMATION")).toBeLessThan(augmentGroupRank("COMBAT"));
    expect(augmentGroupRank("COMBAT")).toBeLessThan(augmentGroupRank("SYNERGY"));
    expect(augmentGroupLabel("ECONOMY")).toBe("Kinh tế");
  });
});

describe("environment copy", () => {
  it("describes concrete own-element and other-element rules for every weather", () => {
    for (const environment of ROUND_ENVIRONMENT_CYCLE) {
      const copy = environmentCopy(environment);
      expect(copy.own.length, environment).toBeGreaterThan(0);
      expect(copy.other.length, environment).toBeGreaterThan(0);
      for (const line of [...copy.own, ...copy.other]) {
        expect(line.length).toBeGreaterThan(0);
        expect(line).not.toMatch(/undefined|NaN/);
      }
    }
  });

  it("keeps the own-element branch distinct from the penalty branch", () => {
    const stone = environmentCopy("STONE");
    expect(stone.own.join(" ")).toContain("khiên");
    expect(stone.other.join(" ")).not.toBe(stone.own.join(" "));
  });
});
