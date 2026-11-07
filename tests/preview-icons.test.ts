import { describe, expect, it } from "vitest";
import { ICONS, SKILL_ICONS } from "../src/core/emojiIcon";
import type { CombatPreviewTag } from "../src/core/combat";
import { groupPreviewIcons, previewIconChar } from "../src/units/previewIcons";

const basic = (uid: string, primary = true): CombatPreviewTag => ({ uid, effect: "damage", kind: "basic", primary });
const skill = (uid: string, effect: CombatPreviewTag["effect"] = "damage", primary = false): CombatPreviewTag =>
  ({ uid, effect, kind: "skill", primary });

describe("planning preview badges", () => {
  it("always marks basic attacks with the fist, whatever the acting role", () => {
    expect(ICONS.fist).toBe("👊");
    for (const role of ["ASSASSIN", "FIGHTER", "ARCHER", "MAGE", "TANKER", "SUPPORT"] as const) {
      expect(previewIconChar(basic("enemy"), role)).toBe(ICONS.fist);
    }
  });

  it("keeps the dagger for ASSASSIN skills and gives FIGHTER a different weapon", () => {
    expect(previewIconChar(skill("enemy"), "ASSASSIN")).toBe(ICONS.dagger);
    expect(previewIconChar(skill("enemy"), "FIGHTER")).toBe(ICONS.axe);
    expect(SKILL_ICONS.ASSASSIN).not.toBe(SKILL_ICONS.FIGHTER);
    expect(SKILL_ICONS.ASSASSIN).toBe("🗡️");
  });

  it("keeps semantic effect markers for heal, shield, buff, debuff and control skills", () => {
    expect(previewIconChar(skill("ally", "heal"), "SUPPORT")).toBe(ICONS.regen);
    expect(previewIconChar(skill("ally", "shield"), "TANKER")).toBe(ICONS.shield);
    expect(previewIconChar(skill("ally", "buff"), "SUPPORT")).toBe(ICONS.augment);
    expect(previewIconChar(skill("enemy", "debuff"), "MAGE")).toBe(ICONS.atkDown);
    expect(previewIconChar(skill("enemy", "control"), "MAGE")).toBe(ICONS.freeze);
  });

  it("stacks both markers when one unit is the target of the basic and the skill", () => {
    const stacks = groupPreviewIcons([skill("enemy", "damage", true), basic("enemy", false)], "ASSASSIN");
    expect(stacks).toHaveLength(1);
    expect(stacks[0]!.primary).toBe(true);
    expect(stacks[0]!.icons.map((icon) => icon.char)).toEqual([ICONS.dagger, ICONS.fist]);
    expect(stacks[0]!.icons.map((icon) => icon.kind)).toEqual(["damage", "basic"]);
  });

  it("keeps separate stacks per target and ignores blank ids or repeated glyphs", () => {
    const stacks = groupPreviewIcons([
      basic("enemy-a"),
      skill("enemy-a", "damage"),
      skill("enemy-a", "damage"),
      skill("enemy-b", "heal"),
      basic(""),
    ], "FIGHTER");
    expect(stacks.map((stack) => stack.uid)).toEqual(["enemy-a", "enemy-b"]);
    expect(stacks[0]!.icons.map((icon) => icon.char)).toEqual([ICONS.fist, ICONS.axe]);
    expect(stacks[1]!.icons.map((icon) => icon.char)).toEqual([ICONS.regen]);
  });
});
