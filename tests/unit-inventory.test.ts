import { describe, expect, it } from "vitest";
import { getUnit } from "../src/content/catalog";
import { materializeCombat, simulate, snapshotFighter, snapshotWithResources } from "../src/core/combat";
import { createRun, unequipItem, unequipAll, unequipQuote, sell } from "../src/core/run";
import { inspectOwnedUnit, findOwnedUnit, leftSynergyBonus } from "../src/core/unitInventory";
import { environmentFor } from "../src/core/environment";
import { playerCombatBonus } from "../src/core/run";
import { sellValue } from "../src/core/economy";
import { createBridge } from "../src/app/bridge";
import { inspectSave } from "../src/core/save";
import { projectLiveDiagnostics, unitDiagnostics } from "../src/core/inspection";

const fixture = () => {
  const run = createRun(42);
  run.aiMode = "MEDIUM";
  run.gold = 30; run.round = 4;
  const unit = { uid: "own", baseId: "jaguar_hunt", star: 2 as const, equips: ["eq_warmog_armor", "eq_blue_buff"], traits: [{ id: "fighter_crushing_guard", seed: 1 }] };
  run.board[12] = unit;
  return { run, unit };
};

describe("owned creature inspection", () => {
  it("uses current-star base stats and exactly the canonical battle-start modifiers without mutation", () => {
    const { run, unit } = fixture();
    const before = JSON.stringify(run);
    const inspection = inspectOwnedUnit(run, unit.uid)!;
    expect(inspection.base.maxHp).toBe(Math.round(getUnit(unit.baseId).stats.hp * 1.6));
    const fighter = materializeCombat([{ ...unit, row: 2, col: 2 }], [], {
      leftPersistent: playerCombatBonus(run), environment: environmentFor(run.round), synergy: { L: leftSynergyBonus(run) },
    })[0]!;
    expect(inspection.boosted).toEqual(snapshotFighter(fighter));
    expect(JSON.stringify(run)).toBe(before);
    expect(inspection.sources.find((source) => source.kind === "environment")!.after.def).toBeLessThan(inspection.base.def + 4);
  });

  it("resolves instance uid after bench compaction and never reads another copy of the same species", () => {
    const { run, unit } = fixture();
    run.board[12] = null;
    run.bench = [{ ...unit, uid: "other" }, unit];
    expect(findOwnedUnit(run, "own")?.index).toBe(1);
    run.bench.splice(0, 1);
    expect(findOwnedUnit(run, "own")?.index).toBe(0);
    expect(inspectOwnedUnit(run, "own")?.where).toBe("bench");
    expect(inspectOwnedUnit(run, "missing")).toBeNull();
  });

  it("does not grant formation synergy to bench units", () => {
    const { run, unit } = fixture();
    run.board[12] = null; run.bench = [unit];
    const source = inspectOwnedUnit(run, unit.uid)!.sources.find((entry) => entry.kind === "synergy")!;
    expect(source.after).toEqual(source.before);
  });

  it("quotes and charges a minimum of one gold per item after discounts; failure is atomic", () => {
    const { run, unit } = fixture();
    run.unequipDiscount = 999;
    expect(unequipQuote(run, "board", 12)).toEqual([1, 1]);
    run.gold = 1;
    const before = JSON.stringify(run);
    expect(unequipAll(run, "board", 12)).toBe(false);
    expect(JSON.stringify(run)).toBe(before);
    expect(unequipItem(run, "board", 12, 0)).toBe(true);
    expect(run.gold).toBe(0);
    expect(unit.equips).toEqual(["eq_blue_buff"]);
    expect(run.itemBag).toContain("eq_warmog_armor");
  });

  it("selling the creature returns all equipment free even with no gold and a full bag", () => {
    const { run, unit } = fixture();
    run.gold = 0; run.itemBag = Array(10).fill("tear");
    expect(sell(run, "board", 12)).toBe(true);
    expect(run.board[12]).toBeNull();
    expect(run.itemBag.slice(-2)).toEqual(["eq_warmog_armor", "eq_blue_buff"]);
    expect(run.gold).toBe(sellValue(getUnit(unit.baseId).tier, unit.star));
  });

  it("snapshots expose effective temporary modifiers and copy status payloads", () => {
    const fighter = materializeCombat([{ uid: "a", baseId: "jaguar_hunt", star: 1, row: 0, col: 4 }], [])[0]!;
    fighter.hp = fighter.maxHp / 2;
    fighter.mods.push({ stat: "def", value: 8, pct: false, turns: 2 }, { stat: "atk", value: -20, pct: true, turns: 1 });
    fighter.status.poison = { value: 8, turns: 2 };
    const snapshot = snapshotFighter(fighter);
    expect(snapshot.def).toBe(fighter.def + 8);
    expect(snapshot.atk).toBe(Math.round(fighter.atk * .8 * 1.5));
    fighter.status.poison.turns = 0; fighter.mods[0].value = 99;
    expect(snapshot.status.poison.turns).toBe(2);
    expect(snapshot.mods[0].value).toBe(8);
    const live = snapshotWithResources(snapshot, { ...snapshot, hp: fighter.maxHp / 4 }, "FIGHTER");
    expect(live.atk).toBe(Math.round(fighter.atk * .8 * 1.75));
  });

  it("inspection capture preserves deterministic combat results and provides independent live frames", () => {
    const left = [{ uid: "a", baseId: "jaguar_hunt", star: 1, row: 0, col: 4 }];
    const right = [{ uid: "b", baseId: "toad_poison", star: 1, row: 0, col: 5 }];
    const captured = simulate(materializeCombat(left, right), { seed: 9, captureInspection: true });
    const plain = simulate(materializeCombat(left, right), { seed: 9 });
    expect(captured.events).toEqual(plain.events);
    expect(captured.winner).toBe(plain.winner);
    const frames = captured.inspectionFrames!;
    expect(frames[0].eventIndex).toBe(0);
    expect(frames.at(-1)?.eventIndex).toBe(captured.events.length);
    expect(frames[0].units.every((unit) => unit.hp === unit.maxHp)).toBe(true);
    expect(frames.some((frame) => frame.units.some((unit) => unit.hp < unit.maxHp))).toBe(true);
    expect(frames.at(-1)?.units.filter((unit) => unit.alive).map((unit) => unit.uid).sort()).toEqual(captured.survivors.map((unit) => unit.uid).sort());
  });

  it("preserves combat effect units, provenance and reaction metadata for enemy inspection", () => {
    const placement = { uid: "enemy-a", baseId: "toad_poison", star: 1 as const, row: 0, col: 5 };
    const fighter = materializeCombat([], [placement])[0]!;
    fighter.status.poison = {
      value: 8, turns: 2,
      source: { skillId: "poison", unitUid: "source", unitBaseId: "jaguar_hunt", unitStar: 2, turns: 2, value: 8 },
    };
    fighter.status.stun = { value: 0, turns: 0 };
    fighter.mods.push({ stat: "atk", value: -20, pct: true, turns: 1, stackKey: "internal" });
    fighter.reflect = { pctByDamageType: { physical: .35, magic: .15 }, turns: 2 };
    fighter.counterTurns = 1;
    fighter.phoenix = { armed: false, used: true, revivePct: .3 };
    fighter.berserk = {
      turns: 2, lifestealPct: .18, firstBasicMultiplier: 1.8, firstBasicPending: true,
      rageOnKill: 2, extendTurnsOnKill: 1, chainedBasicsOnKill: 1, atkBuffStackKey: "private",
    };
    const diagnostics = unitDiagnostics(placement, "R", {}, undefined, fighter);
    expect(diagnostics.readonly).toBe(true);
    expect(diagnostics.effects.find((effect) => effect.key === "poison")).toMatchObject({
      kind: "status", value: 8, sourceUnitBaseId: "jaguar_hunt",
    });
    expect(diagnostics.effects.find((effect) => effect.key === "stun")).toBeUndefined();
    expect(diagnostics.effects.find((effect) => effect.key === "atk")).toEqual({
      kind: "modifier", key: "atk", value: -20, pct: true, turns: 1,
    });
    expect(diagnostics.effects.find((effect) => effect.key === "reflect")).toMatchObject({
      value: .35, reflectByDamageType: { physical: .35, magic: .15 },
    });
    expect(diagnostics.effects.find((effect) => effect.key === "phoenix-used")).toMatchObject({
      turns: 0, value: .3,
    });
    expect(diagnostics.effects.find((effect) => effect.key === "berserk")).toMatchObject({
      firstBasicMultiplier: 1.8, rageOnKill: 2, value: .18,
    });
    expect(JSON.stringify(diagnostics.effects)).not.toContain("internal");
    expect(JSON.stringify(diagnostics.effects)).not.toContain("private");
  });

  it("projects impact-time enemy HP, rage, shield and sourced effects without changing derived stats", () => {
    const placement = { uid: "enemy-live", baseId: "jaguar_hunt", star: 1 as const, row: 0, col: 5 };
    const fighter = materializeCombat([], [placement])[0]!;
    const diagnostics = unitDiagnostics(placement, "R", {}, undefined, fighter);
    const snapshot = snapshotFighter(fighter);
    snapshot.status.poison = {
      value: 6, turns: 2,
      source: { skillId: "poison", unitUid: "source", unitBaseId: "toad_poison", unitStar: 1, turns: 2, value: 6 },
    };
    snapshot.mods.push({ stat: "def", value: -15, pct: true, turns: 1 });
    const displayed = snapshotWithResources(snapshot, {
      hp: Math.floor(snapshot.maxHp / 2), maxHp: snapshot.maxHp,
      rage: 2, rageMax: snapshot.rageMax, shield: 11,
    }, "FIGHTER");
    const projected = projectLiveDiagnostics(diagnostics, displayed);
    expect(projected.base).toEqual(diagnostics.base);
    expect(projected.derived).toEqual(diagnostics.derived);
    expect(projected.live).toMatchObject({ hp: displayed.hp, rage: 2, shield: 11, atk: displayed.atk });
    expect(projected.live.atk).toBeGreaterThan(diagnostics.live.atk);
    expect(projected.effects).toContainEqual({
      kind: "status", key: "poison", turns: 2, value: 6, sourceUnitBaseId: "toad_poison",
    });
    expect(projected.effects).toContainEqual({ kind: "modifier", key: "def", turns: 1, value: -15, pct: true });
    expect(diagnostics.effects).toEqual([]);
    expect(projectLiveDiagnostics(diagnostics, snapshot).live.hp).toBe(snapshot.hp);
  });

  it("bridge unequip-all persists a single accepted transaction and ignores combat edits", () => {
    const values = new Map<string, string>();
    const store = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
    const bridge = createBridge(store);
    const run = bridge.newRun("EndlessPvEClassic", "MEDIUM");
    run.bench = [fixture().unit]; run.gold = 20;
    expect(bridge.unequipAll("bench", 0)).toBe(true);
    expect(run.gold).toBe(11);
    const saved = inspectSave(store);
    expect(saved.status).toBe("valid");
    if (saved.status === "valid") expect(saved.envelope.payload.player?.bench[0].equips).toEqual([]);
    run.phase = "COMBAT";
    const before = JSON.stringify(run);
    expect(bridge.unequipAll("bench", 0)).toBe(false);
    expect(JSON.stringify(run)).toBe(before);
  });
});
