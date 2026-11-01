import { describe, expect, it } from "vitest";
import { getUnit } from "../src/content/catalog";
import { unitDiagnostics } from "../src/core/inspection";
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
    expect(content.meters?.[0]).toMatchObject({ value: 523, max: 523, shield: 12 });
    expect(content.meters?.[1]).toMatchObject({ value: 2, max: 3 });
    expect(content.badges?.some((b) => b.text === "Địch")).toBe(true);
    expect(content.badges?.some((b) => b.text.includes("Giá bán"))).toBe(true);
    expect(content.columns?.flat().some((section) => section.lines.some((line) => line.includes("Xuyên Tâm")))).toBe(true);
    expect(content.columns?.flat().some((section) => section.lines.some((line) => line.includes("Giáp Warmog")))).toBe(true);
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
});
