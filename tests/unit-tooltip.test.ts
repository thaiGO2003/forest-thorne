import { describe, expect, it } from "vitest";
import { BOSSES, getUnit, UNITS } from "../src/content/catalog";
import { unitDiagnostics } from "../src/core/inspection";
import { skillSpec } from "../src/core/skills";
import { unitTooltipContent } from "../src/ui/unitTooltip";

describe("A96 rich unit tooltip model", () => {
  const unit = getUnit("albatross_wind");

  it("builds the old_src header, chips, meters and all three mode bodies", () => {
    const content = unitTooltipContent(unit, { star: 2, cost: 4 });
    expect(content.title).toContain("Hải Âu");
    expect(content.subtitle).toContain("Xạ thủ");
    expect(content.icon).toBeTruthy();
    expect(content.badges?.some((b) => b.text === "Bậc 4")).toBe(true);
    expect(content.badges?.some((b) => b.text === "Giá mua 4")).toBe(true);
    expect(content.badges?.some((b) => b.text === "2★")).toBe(true);
    expect(content.badges?.some((b) => b.secondary)).toBe(true);
    expect(content.meters?.map((m) => m.key)).toEqual(["hp", "rage"]);
    expect(content.meters?.[0]).toMatchObject({ kind: "bar", value: 523, max: 523 });
    expect(content.meters?.[1]).toMatchObject({ kind: "pips", max: 3 });
    expect(content.lines?.length).toBeGreaterThanOrEqual(5);
    expect(content.sections?.length).toBeGreaterThanOrEqual(2);
    expect(content.columns).toHaveLength(4);
    expect(content.columns?.flat().some((section) => section.title === "Chiêu thức")).toBe(true);
    expect(content.description).toBe(unit.pitchVi);
  });

  it("uses live diagnostics for HP, shield, rage, side and variant traits", () => {
    const diagnostics = unitDiagnostics({
      uid: "qa-tooltip",
      baseId: unit.id,
      star: 2,
      row: 1,
      col: 2,
      equips: ["eq_warmog_armor"],
      traits: [{ id: "archer_heart_pierce", seed: 1 }],
    }, "R");
    diagnostics.live.rage = 2;
    diagnostics.live.shield = 12;

    const content = unitTooltipContent(unit, { diagnostics });
    expect(content.meters?.[0]).toMatchObject({ value: 601, max: 601, shield: 12 });
    expect(content.meters?.[1]).toMatchObject({ value: 2, max: 3 });
    expect(content.badges?.some((b) => b.text === "Địch")).toBe(true);
    expect(content.badges?.some((b) => b.text.includes("Giá bán"))).toBe(true);
    expect(content.columns?.flat().some((section) => section.lines.some((line) => line.includes("Xuyên Tâm")))).toBe(true);
    expect(content.columns?.flat().some((section) => section.lines.some((line) => line.includes("Giáp Máu")))).toBe(true);
  });

  it("renders active statuses as chips and summary lines", () => {
    const diagnostics = unitDiagnostics({ uid: "qa-status", baseId: unit.id, star: 2, row: 0, col: 0, equips: [], traits: [] }, "L");
    diagnostics.effects = [
      { kind: "status", key: "burn", turns: 2, value: 12 },
      { kind: "modifier", key: "atk", turns: 3, value: -20, pct: true },
    ];

    const content = unitTooltipContent(unit, { diagnostics });
    expect(content.statuses).toHaveLength(2);
    expect(content.statuses?.[0]?.text).toContain("Thiêu đốt");
    expect(content.statuses?.[1]?.text).toContain("ATK");
    expect(content.statuses?.[1]?.text).toContain("-20%");
    expect(content.statuses?.[1]?.text).toContain("3");
    expect(content.sections?.some((section) => section.title === "Hiệu ứng đang dính")).toBe(true);
  });
  it("exposes complete ordered skill milestones with star-specific rage, formula and current marker for all 127 units", () => {
    expect(UNITS).toHaveLength(127);
    for (const def of UNITS) for (const active of [1, 2, 3] as const) {
      const content = unitTooltipContent(def, { star: active });
      const wide = content.columns?.[3]?.[0];
      const narrow = content.expandedSections?.at(-1);
      expect(wide, `${def.id} skill column`).toBeDefined();
      expect(narrow, `${def.id} mobile skill`).toBe(wide);
      expect(wide?.stars?.map((entry) => entry.star)).toEqual([1, 2, 3]);
      expect(wide?.stars?.filter((entry) => entry.current).map((entry) => entry.star)).toEqual([active]);
      expect(wide?.stars?.filter((entry) => entry.label.includes("(hiện tại)"))
        .map((entry) => entry.star)).toEqual([active]);
      for (const milestone of [1, 2, 3] as const) {
        const entry = wide?.stars?.[milestone - 1];
        expect(entry?.lines[0], `${def.id} ${milestone}★ source text`).toBe(def.skill.starDetailVi[milestone - 1]);
        expect(entry?.label, `${def.id} ${milestone}★ rage`).toContain(`Nộ ${def.skill.rageCost[milestone - 1]}`);
        const damage = skillSpec(def.id, milestone).damage;
        if (damage) {
          expect(entry?.lines[1]).toContain(`${damage.base} + ${Math.round(damage.scale * 100)}% ${damage.stat.toUpperCase()}`);
        } else {
          expect(entry?.lines).toHaveLength(1);
        }
      }
      expect(wide?.lines).toHaveLength(1);
      expect(wide?.metadata?.length).toBe([
        def.skill.targetVi, def.skill.shapeVi, def.skill.countVi, def.skill.durationVi,
      ].filter(Boolean).length);
      expect(content.sections?.at(-1)?.title).toBe("Kỹ hiện tại");
      expect(content.sections?.at(-1)?.lines[1]).toBeTruthy();
      expect(content.lines?.length).toBeGreaterThan(0);
    }
  });

  it("preserves repeated authored boss milestones separately with independent rage cost", () => {
    expect(BOSSES).toHaveLength(5);
    for (const boss of BOSSES) {
      const stars = unitTooltipContent(boss).columns?.[3]?.[0]?.stars;
      expect(stars?.map((entry) => entry.lines[0])).toEqual(boss.skill.starDetailVi);
      // Each boss has two distinct authored strings across three levels; render duplicates faithfully.
      expect(new Set(stars?.map((entry) => entry.lines[0])).size).toBe(2);
      expect(new Set(stars?.map((entry) => entry.label.match(/Nộ \d+/)?.[0])).size).toBe(3);
    }
  });
});
