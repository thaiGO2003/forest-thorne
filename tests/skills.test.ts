import { describe, expect, it } from "vitest";
import { UNITS } from "../src/content/catalog";
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
  it("materializes canonical denial and auto-by-role offense status payloads", () => {
    expect(parseSkill("Mục tiêu bị giảm 25% ATK hoặc MATK theo vai trò trong 3 lượt.").offenseDebuff)
      .toEqual({ value: 25, pct: true, turns: 3 });
    expect(parseSkill("Mục tiêu bị giảm 35% hồi máu trong 2 lượt.").healReduction)
      .toEqual({ pct: 35, turns: 2 });
    expect(parseSkill("Mục tiêu không thể nhận khiên mới trong 2 lượt.").shieldLockTurns).toBe(2);
    expect(parseSkill("Hồi 30 HP và thanh tẩy tối đa 2 hiệu ứng bất lợi cho 1 đồng minh.").cleanseCount).toBe(2);
  });
  it("keeps authored control probability instead of turning chance riders into guaranteed control", () => {
    expect(parseSkill("Gây sát thương và có 35% ru ngủ 1 lượt.").controls)
      .toEqual([{ kind: "sleep", turns: 1, chance: 0.35 }]);
    expect(parseSkill("Gây sát thương và làm choáng 2 lượt.").controls)
      .toEqual([{ kind: "stun", turns: 2, chance: 1 }]);
  });
  it("materializes independent shape and ordered multi-hit damage formulas", () => {
    expect(skillSpec("roc_legend", 1).area).toBe("cross");
    expect(skillSpec("salamander_flame", 1).area).toBe("cone");
    expect(skillSpec("lynx_echo", 1).damageHits).toHaveLength(2);
    expect(skillSpec("wraith_shadow", 1).damageHits).toHaveLength(2);
    expect(skillSpec("kangaroo_kick", 1).damageHits).toHaveLength(1);
  });
  it("ally % heal targets lowest HP allies; self buff stays self", () => {
    expect(parseSkill("Hồi dần 15% HP tối đa trong 2 lượt cho 2 đồng minh có % máu thấp nhất."))
      .toMatchObject({ side: "ally", count: 2, pickLowestHp: true, heal: { pctMaxHp: 0.15 } });
    expect(parseSkill("Cuộn tròn, tăng 20 DEF và 20 MDEF trong 2 lượt."))
      .toMatchObject({ side: "self", buffs: [{ stat: "def", value: 20, turns: 2 }, { stat: "mdef", value: 20, turns: 2 }] });
  });
  it("bosses always resolve to a battlefield-wide damaging skill", () => {
    for (const b of UNITS.filter((u) => u.boss)) expect(skillSpec(b.id, 1)).toMatchObject({ side: "enemy", area: "all", damage: expect.any(Object) });
  });

  it("clamps requested star and derives selectors from the current-star authored detail", () => {
    expect(skillSpec("albatross_wind", 0)).toEqual(skillSpec("albatross_wind", 1));
    expect(skillSpec("albatross_wind", 99)).toEqual(skillSpec("albatross_wind", 3));
    expect(skillSpec("albatross_wind", 1).selector).toBe("random_unique");
    expect(skillSpec("albatross_wind", 2).selector).toBe("highest_atk_backline");
    expect(skillSpec("cobra_venom", 1).selector).toBe("lowest_mdef_backline");
    expect(skillSpec("cat_goldbow", 1).selector).toBe("highest_max_hp_front");
    expect(skillSpec("eagle_marksman", 1).selector).toBe("backline_caster");
  });
});
