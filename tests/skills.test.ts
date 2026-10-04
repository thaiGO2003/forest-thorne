import { describe, expect, it } from "vitest";
import { makeFighter } from "../src/core/combat";
import { parseSkill, skillSpec } from "../src/core/skills";

describe("skill parser", () => {
  it("multi-target damage with bleed duration", () => {
    const s = parseSkill("Phóng 3 lông vũ vào 3 kẻ địch ngẫu nhiên không trùng mục tiêu, mỗi lông vũ gây (30 + 1.1 x ATK) sát thương vật lý. Mục tiêu trúng lông vũ bị chảy máu 10 mỗi lượt trong 2 lượt.");
    expect(s).toMatchObject({ side: "enemy", count: 3, damage: { base: 30, scale: 1.1, stat: "atk", type: "physical" }, dots: [{ kind: "bleed", value: 10, turns: 2 }] });
  });
  it("percent scaling, decimal in sentence does not cut duration, magic inferred from MATK", () => {
    const s = parseSkill("Thiêu toàn bộ kẻ địch, gây (42 + 100% MATK) sát thương phép và thiêu đốt 18 mỗi lượt trong 3 lượt.");
    expect(s).toMatchObject({ area: "all", damage: { scale: 1, stat: "matk", type: "magic" }, dots: [{ kind: "burn", turns: 3 }] });
    expect(parseSkill("Mục tiêu đầu chịu (18 + 0.65 x MATK) x Hệ số sao.").damage?.type).toBe("magic");
  });
  it("ally % heal targets lowest HP allies; self buff stays self", () => {
    expect(parseSkill("Hồi dần 15% HP tối đa trong 2 lượt cho 2 đồng minh có % máu thấp nhất."))
      .toMatchObject({ side: "ally", count: 2, pickLowestHp: true, heal: { pctMaxHp: 0.15 } });
    expect(parseSkill("Cuộn tròn, tăng 20 DEF và 20 MDEF trong 2 lượt."))
      .toMatchObject({ side: "self", buffs: [{ stat: "def", value: 20, turns: 2 }, { stat: "mdef", value: 20, turns: 2 }] });
  });
  it("bosses preserve authored targeting without synthesizing missing effect magnitudes", () => {
    expect(skillSpec("boss_ember_dragon", 1)).toMatchObject({
      side: "enemy", area: "all", selector: "frontline_default", damage: null, dots: [],
    });
    expect(skillSpec("boss_storm_phoenix", 1)).toMatchObject({
      side: "enemy", area: "single", selector: "front_cone", damage: null,
    });
    expect(skillSpec("boss_tempest_jelly", 1)).toMatchObject({
      side: "enemy", area: "single", selector: "highest_rage", damage: null,
    });
    expect(skillSpec("boss_earth_colossus", 1)).toMatchObject({
      side: "enemy", area: "all", damage: null, controls: [], shield: null,
    });
    expect(skillSpec("boss_venom_hydra", 1)).toMatchObject({
      side: "self", area: "single", selector: "self", heal: null, selfHealPctMaxHp: 0,
    });
  });

  it("boss rage thresholds come from the authored per-star profiles", () => {
    expect(makeFighter({ uid: "phoenix", baseId: "boss_storm_phoenix", star: 1, row: 2, col: 7 }, "R").rageMax).toBe(2);
    expect(makeFighter({ uid: "dragon", baseId: "boss_ember_dragon", star: 1, row: 2, col: 7 }, "R").rageMax).toBe(3);
  });
});
