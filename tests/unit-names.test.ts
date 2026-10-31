import { describe, expect, it } from "vitest";
import { getUnit } from "../src/content/catalog";
import { resolveVietnameseEvolutionName, unitEvolutionName } from "../src/content/unitNames";

describe("Vietnamese unit evolution names", () => {
  it("uses authored overrides before generated names", () => {
    const deer = getUnit("deer_song");
    expect(unitEvolutionName(deer, 1)).toBe("Nai Thần Ca");
    expect(unitEvolutionName(deer, 2)).toBe("Nai Hòa Điệu");
    expect(unitEvolutionName(deer, 3)).toBe("Lộc Linh Thánh Ca");
  });

  it("generates tribe-prefixed names when no override exists", () => {
    const crab = getUnit("crab_shell");
    expect(unitEvolutionName(crab, 1)).toBe(crab.nameVi);
    expect(unitEvolutionName(crab, 2)).toBe("Triều Cua Giáp");
    expect(unitEvolutionName(crab, 3)).toBe("Hải Cua Giáp");
  });

  it("keeps fallbacks deterministic for unknown tribe/class data", () => {
    expect(resolveVietnameseEvolutionName("unknown", "Linh Thú", "UNKNOWN", "UNKNOWN", 2)).toBe("Linh Thú Kích");
    expect(resolveVietnameseEvolutionName("unknown", "", "UNKNOWN", "UNKNOWN", 3)).toBe("Thánh Linh thú");
    expect(resolveVietnameseEvolutionName("unknown", "Linh Thú", "UNKNOWN", "UNKNOWN", 99)).toBe("Thánh Linh Thú");
    expect(resolveVietnameseEvolutionName("unknown", "Linh Thú", "UNKNOWN", "UNKNOWN", Number.NaN)).toBe("Linh Thú");
  });
});
