import { describe, expect, it } from "vitest";
import { getUnit } from "../src/content/catalog";
import { skillSpec } from "../src/core/skills";
import { materializeCombat, simulate, type CombatEvent } from "../src/core/combat";

describe("Dơi Tình Yêu catalog (bat_blood)", () => {
  it("is now a tier 3 night-beast mage with the heart-burst skill", () => {
    const u = getUnit("bat_blood");
    expect([u.nameVi, u.tier, u.role, u.faction, u.element]).toEqual(["Dơi Tình Yêu", 3, "MAGE", "BEAST", "NIGHT"]);
    expect([u.stats.hp, u.stats.atk, u.stats.def, u.stats.matk, u.stats.mdef, u.stats.range, u.stats.evade]).toEqual([300, 22, 11, 90, 24, 4, 0.1]);
    expect([u.basic.delivery, u.basic.damageType]).toEqual(["projectile", "magic"]);
    expect([u.skill.nameVi, u.skill.rageCost]).toEqual(["Ma Lực Tình Yêu", [3, 4, 5]]);
    expect(u.skin?.stagesVi).toEqual(["Nhịp Đêm", "Tim Ma Lực", "Nữ Vương Tình Yêu"]);
  });

  it("parses the skill: 3x3 burst on the lowest-HP% enemy, MDEF shred at 2★, self-heal at 3★", () => {
    const [one, two, three] = [1, 2, 3].map((s) => skillSpec("bat_blood", s));
    for (const s of [one, two, three]) {
      expect([s!.side, s!.area, s!.selector]).toEqual(["enemy", "square", "lowest_hp_pct"]);
      expect(s!.damage).toEqual({ base: 18, scale: 0.75, stat: "matk", type: "magic" });
    }
    expect([one!.debuffs, one!.selfHealPctMaxHp]).toEqual([[], 0]);
    expect([two!.debuffs, two!.selfHealPctMaxHp]).toEqual([[{ stat: "mdef", value: 15, pct: false, turns: 2 }], 0]);
    expect([three!.debuffs.length, three!.selfHealPctMaxHp]).toEqual([1, 0.1]);
  });

  it("casts in combat: one cast hits every enemy in the 3x3 around the weakest target", () => {
    const all = materializeCombat(
      [{ uid: "bat", baseId: "bat_blood", star: 1, row: 2, col: 2 }],
      [
        { uid: "weak", baseId: "titan_earth", star: 1, row: 2, col: 6 },
        { uid: "near", baseId: "titan_earth", star: 1, row: 1, col: 7 },
        { uid: "far", baseId: "titan_earth", star: 1, row: 4, col: 9 },
      ],
    );
    for (const f of all) { f.maxHp = 1e6; f.hp = 1e6; }
    all.find((f) => f.uid === "weak")!.hp = 1e5;
    all.find((f) => f.uid === "bat")!.rage = 99;
    const events = simulate(all, { seed: 1 }).events;
    const cast = events.find((e): e is Extract<CombatEvent, { t: "cast" }> => e.t === "cast" && e.src === "bat")!;
    expect(new Set(cast.targets)).toEqual(new Set(["weak", "near"]));
    expect(cast.targets[0]).toBe("weak");
  });
});
