import { describe, expect, it } from "vitest";
import { combatTargetPreview, materializeCombat, snapshotFighter, type Fighter, type Placement } from "../src/core/combat";

const left = (uid: string, baseId: string, row: number, col = 4): Placement => ({
  uid, baseId, star: 1, row, col,
});
const right = (uid: string, baseId: string, row: number, col = 5): Placement => ({
  uid, baseId, star: 1, row, col,
});

function readySkill(fighters: Fighter[], uid: string) {
  const fighter = fighters.find((candidate) => candidate.uid === uid)!;
  fighter.rage = fighter.rageMax;
  return fighter;
}

describe("combatTargetPreview", () => {
  it("uses canonical basic targeting and projects only the basic action when skill rage is not ready", () => {
    const fighters = materializeCombat(
      [left("source", "condor_sky", 2)],
      [
        right("near", "titan_earth", 2, 5),
        right("taunter", "titan_earth", 4, 7),
      ],
    );
    const source = fighters.find((fighter) => fighter.uid === "source")!;
    source.status.taunt = { turns: 2, value: 0 };
    source.tauntBy = "taunter";

    expect(combatTargetPreview(fighters, "source")).toMatchObject({
      directUids: ["taunter"],
      splashUids: [],
      skillCasterUid: null,
    });
  });

  it("projects exactly one skill action and classifies the runtime-resolved area as direct plus splash", () => {
    const fighters = materializeCombat(
      [left("source", "condor_sky", 2)],
      [
        right("target-a", "titan_earth", 2, 5),
        right("target-b", "titan_earth", 4, 5),
        right("target-c", "titan_earth", 1, 7),
      ],
    );
    readySkill(fighters, "source");

    const preview = combatTargetPreview(fighters, "source")!;
    expect(preview.skillCasterUid).toBe("source");
    expect(preview.directUids).toHaveLength(1);
    expect(new Set([...preview.directUids, ...preview.splashUids]))
      .toEqual(new Set(["target-a", "target-b", "target-c"]));
    expect(preview.splashUids).not.toContain(preview.directUids[0]);
  });

  it("uses the authored densest-column selector for column_freeze", () => {
    const fighters = materializeCombat(
      [left("source", "beetle_mystic", 0)],
      [
        right("dense-a", "titan_earth", 0, 6),
        right("dense-b", "titan_earth", 3, 6),
        right("sparse", "titan_earth", 0, 5),
      ],
    );
    readySkill(fighters, "source");

    const preview = combatTargetPreview(fighters, "source")!;
    expect(new Set([...preview.directUids, ...preview.splashUids])).toEqual(new Set(["dense-a", "dense-b"]));
    expect(preview.skillCasterUid).toBe("source");
  });

  it("keeps random_unique preview deterministic, unique, and read-only", () => {
    const fighters = materializeCombat(
      [left("source", "albatross_wind", 1)],
      [
        right("r1", "titan_earth", 0, 5),
        right("r2", "titan_earth", 1, 6),
        right("r3", "titan_earth", 2, 7),
        right("r4", "titan_earth", 3, 8),
      ],
    );
    readySkill(fighters, "source");
    const before = fighters.map(snapshotFighter);

    const first = combatTargetPreview(fighters, "source")!;
    const second = combatTargetPreview(fighters, "source")!;

    expect(second).toEqual(first);
    expect(first.directUids).toHaveLength(1);
    expect(first.splashUids).toHaveLength(2);
    expect(new Set([...first.directUids, ...first.splashUids])).toHaveLength(3);
    expect(fighters.map(snapshotFighter)).toEqual(before);
  });

  it("applies the same skill-preview classification from the RIGHT side", () => {
    const fighters = materializeCombat(
      [
        left("left-a", "titan_earth", 0, 4),
        left("left-b", "titan_earth", 2, 4),
        left("left-other", "titan_earth", 4, 2),
      ],
      [right("source", "condor_sky", 2)],
    );
    readySkill(fighters, "source");

    const preview = combatTargetPreview(fighters, "source")!;
    expect(preview.skillCasterUid).toBe("source");
    expect(preview.directUids).toHaveLength(1);
    expect(new Set([...preview.directUids, ...preview.splashUids]))
      .toEqual(new Set(["left-a", "left-b", "left-other"]));
  });

  it("kit preview always exposes the authored heal skill and its rainbow caster at zero rage", () => {
    const fighters = materializeCombat(
      [left("healer", "angel_guardian", 0), left("ally", "titan_earth", 1)],
      [right("enemy", "titan_earth", 1)],
    );
    const ally = fighters.find((fighter) => fighter.uid === "ally")!;
    ally.hp = Math.round(ally.maxHp / 2);

    const preview = combatTargetPreview(fighters, "healer", { kitPreview: true })!;
    expect(preview.skillCasterUid).toBe("healer");
    expect(preview.tags?.some((tag) => tag.kind === "skill" && tag.effect === "heal" && tag.uid === "ally")).toBe(true);
    expect(preview.tags?.some((tag) => tag.kind === "basic" && tag.effect === "damage" && tag.uid === "enemy")).toBe(true);
  });

  it("classifies shield kits with the blue shield family and keeps the immediate action rage-gated", () => {
    const fighters = materializeCombat(
      [left("guard", "butterfly_mirror", 0), left("ally", "titan_earth", 1)],
      [right("enemy", "titan_earth", 1)],
    );
    const kit = combatTargetPreview(fighters, "guard", { kitPreview: true })!;
    expect(kit.skillCasterUid).toBe("guard");
    expect(kit.tags?.some((tag) => tag.effect === "shield")).toBe(true);
    expect(combatTargetPreview(fighters, "guard")?.skillCasterUid).toBeNull();
  });
});
