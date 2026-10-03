import { describe, expect, it } from "vitest";
import { createModeRun, type RunState } from "../src/core/run";
import {
  PVP_FORTRESS_WIN_GOLD,
  createPvpFortressState,
  freshestPvpFortressSnapshot,
  isPvpFortressSnapshotStale,
  pairPvpFortressRound,
  pvpEnemyPreview,
  pvpSnapshotLeader,
  startPvpFortressCombat,
  submitPvpFortressReport,
  type PvpFortressMatchup,
  type PvpFortressReport,
} from "../src/network/pvpFortress";

const players = (...slots: string[]): Record<string, RunState> => Object.fromEntries(
  slots.map((slot, index) => [slot, createModeRun(index + 1, "FortressPvP4")]),
);

function reportFor(matchup: PvpFortressMatchup, winnerSide: "LEFT" | "RIGHT" | "DRAW", alive = 0): PvpFortressReport {
  if (matchup.type === "real") {
    const opponent = matchup.reporterSlot === matchup.slotA ? matchup.slotB : matchup.slotA;
    return {
      slot: matchup.reporterSlot,
      pairId: matchup.pairId,
      round: matchup.round,
      matchupType: "real",
      opponentSlot: opponent,
      ghostOwnerSlot: null,
      result: {
        winnerSide,
        round: matchup.round,
        leftAlive: winnerSide === "LEFT" ? alive : 0,
        leftTotal: 5,
        rightAlive: winnerSide === "RIGHT" ? alive : 0,
        rightTotal: 5,
      },
    };
  }
  return {
    slot: matchup.fighterSlot,
    pairId: matchup.pairId,
    round: matchup.round,
    matchupType: "ghost",
    opponentSlot: matchup.ghostOwnerSlot,
    ghostOwnerSlot: matchup.ghostOwnerSlot,
    result: {
      winnerSide,
      round: matchup.round,
      leftAlive: winnerSide === "LEFT" ? alive : 0,
      leftTotal: 5,
      rightAlive: winnerSide === "RIGHT" ? alive : 0,
      rightTotal: 5,
    },
  };
}

describe("PvP Fortress pairing and payloads", () => {
  it("creates two real pairs for four players and avoids immediate rematches when possible", () => {
    const last = { P1: "P2", P2: "P1", P3: "P4", P4: "P3" };
    const matchups = pairPvpFortressRound(["P1", "P2", "P3", "P4"], 8, last, () => 0);
    expect(matchups).toHaveLength(2);
    expect(matchups.every((matchup) => matchup.type === "real")).toBe(true);
    const pairs = matchups.map((matchup) => matchup.type === "real"
      ? [matchup.slotA, matchup.slotB].sort().join(":")
      : "ghost");
    expect(pairs).not.toContain("P1:P2");
    expect(pairs).not.toContain("P3:P4");
    expect(new Set(matchups.map((matchup) => matchup.pairId)).size).toBe(2);
  });

  it("creates one real match and exactly one ghost fighter for three alive players", () => {
    const matchups = pairPvpFortressRound(["P1", "P2", "P3"], 2, {}, () => 0.4);
    expect(matchups.filter((matchup) => matchup.type === "real")).toHaveLength(1);
    expect(matchups.filter((matchup) => matchup.type === "ghost")).toHaveLength(1);
    const ghost = matchups.find((matchup) => matchup.type === "ghost")!;
    expect(ghost.pairId).toBe(`round:2:ghost:${ghost.fighterSlot}:${ghost.ghostOwnerSlot}`);
  });

  it("converts occupied player board cells into right-side enemy preview cells", () => {
    const player = createModeRun(3, "FortressPvP4");
    player.board[7] = { uid: "u7", baseId: "wolf", star: 2, equips: ["item-a"] };
    expect(pvpEnemyPreview(player)).toEqual([expect.objectContaining({
      uid: "pvp:u7", baseId: "wolf", star: 2, row: 1, col: 7, equips: ["item-a"],
    })]);
  });

  it("freezes ghost equipment, traits, synergies and player combat stats at pairing time", () => {
    const roster = players("P1", "P2", "P3");
    for (const run of Object.values(roster)) {
      run.board[0] = {
        uid: "archer-a",
        baseId: "albatross_wind",
        star: 2,
        equips: ["item-a"],
        traits: [{ id: "archer_heart_pierce", seed: 17 }],
      };
      run.board[1] = {
        uid: "archer-b",
        baseId: "albatross_wind",
        star: 1,
        equips: ["item-b"],
        traits: [{ id: "archer_hawk_eye", seed: 23 }],
      };
      run.teamAtkPct = 7;
      run.teamMatkPct = 3;
      run.startingRage = 2;
      run.extraClassCount = 2;
      run.extraTribeCount = 2;
      run.techLevels = { mil: 1 };
      run.gold = 37;
    }

    const started = startPvpFortressCombat(createPvpFortressState(Object.keys(roster)), roster, () => 0.25);
    const ghost = started.state.currentMatchups.find((matchup) => matchup.type === "ghost")!;
    const owner = roster[ghost.ghostOwnerSlot]!;
    const payload = started.payloadBySlot[ghost.fighterSlot]!;
    const snapshot = payload.opponentSnapshot;

    expect(snapshot.placements).toHaveLength(2);
    expect(snapshot.placements[0]).toMatchObject({
      baseId: "albatross_wind",
      star: 2,
      equips: ["item-a"],
      traits: [{ id: "archer_heart_pierce", seed: 17 }],
    });
    expect(snapshot.bonus).toMatchObject({ atkPct: 57, matkPct: 9, evadePct: 8, startRage: 2 });
    expect(snapshot.synergies).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "class", key: "ARCHER", count: 4, active: 4 }),
      expect.objectContaining({ kind: "faction", key: "AVIAN", count: 4, active: 4 }),
    ]));
    expect(snapshot.gold).toBe(37);
    expect(payload.run.enemyPreview).toEqual(snapshot.placements);
    expect(payload.run.enemyPreview).not.toBe(snapshot.placements);

    owner.board[0]!.equips.push("late-item");
    owner.board[0]!.traits![0]!.seed = 999;
    owner.board[1] = null;
    owner.teamAtkPct = 999;
    owner.extraClassCount = 0;
    owner.extraTribeCount = 0;
    owner.techLevels.mil = 0;
    owner.gold = 999;

    expect(snapshot.placements[0]).toMatchObject({
      equips: ["item-a"],
      traits: [{ id: "archer_heart_pierce", seed: 17 }],
    });
    expect(snapshot.placements).toHaveLength(2);
    expect(snapshot.bonus).toMatchObject({ atkPct: 57, matkPct: 9, evadePct: 8, startRage: 2 });
    expect(snapshot.gold).toBe(37);
  });
});

describe("PvP Fortress round authority", () => {
  it("applies survivor damage exactly once and awards exactly three gold to a real winner", () => {
    const roster = players("P1", "P2");
    const started = startPvpFortressCombat(createPvpFortressState(Object.keys(roster)), roster, () => 0);
    const matchup = started.state.currentMatchups[0]!;
    expect(matchup.type).toBe("real");
    const reporter = matchup.reporterSlot;
    const opponent = matchup.type === "real" && reporter === matchup.slotA ? matchup.slotB : matchup.type === "real" ? matchup.slotA : "";
    const beforeGold = roster[reporter]!.gold;
    const resolved = submitPvpFortressReport(started.state, reportFor(matchup, "LEFT", 4), roster);
    expect(resolved.resolved).toBe(true);
    expect(resolved.state.castleHpBySlot[opponent]).toBe(96);
    expect(resolved.players[reporter]!.gold - beforeGold).toBe(PVP_FORTRESS_WIN_GOLD);

    const duplicate = submitPvpFortressReport(resolved.state, reportFor(matchup, "LEFT", 4), resolved.players);
    expect(duplicate.accepted).toBe(false);
    expect(duplicate.players[reporter]!.gold).toBe(resolved.players[reporter]!.gold);
  });

  it("draw deals no damage and pays no winner gold", () => {
    const roster = players("P1", "P2");
    const started = startPvpFortressCombat(createPvpFortressState(Object.keys(roster)), roster, () => 0);
    const matchup = started.state.currentMatchups[0]!;
    const beforeGold = Object.fromEntries(Object.entries(roster).map(([slot, run]) => [slot, run.gold]));
    const resolved = submitPvpFortressReport(started.state, reportFor(matchup, "DRAW", 5), roster);
    expect(resolved.state.castleHpBySlot).toEqual({ P1: 100, P2: 100 });
    expect(Object.fromEntries(Object.entries(resolved.players).map(([slot, run]) => [slot, run.gold]))).toEqual(beforeGold);
  });

  it("ghost loss damages only the fighter castle and never the ghost owner's live castle", () => {
    const roster = players("P1", "P2", "P3");
    let started = startPvpFortressCombat(createPvpFortressState(Object.keys(roster)), roster, () => 0.25);
    const ghost = started.state.currentMatchups.find((matchup) => matchup.type === "ghost")!;
    const real = started.state.currentMatchups.find((matchup) => matchup.type === "real")!;
    const ghostOwnerBefore = started.state.castleHpBySlot[ghost.ghostOwnerSlot];

    const first = submitPvpFortressReport(started.state, reportFor(real, "DRAW"), roster);
    started = { ...started, state: first.state };
    const resolved = submitPvpFortressReport(started.state, reportFor(ghost, "RIGHT", 2), first.players);
    expect(resolved.resolved).toBe(true);
    expect(resolved.state.castleHpBySlot[ghost.fighterSlot]).toBe(98);
    expect(resolved.state.castleHpBySlot[ghost.ghostOwnerSlot]).toBe(ghostOwnerBefore);
  });

  it("declares a champion only when exactly one castle remains above zero", () => {
    const roster = players("P1", "P2");
    const initial = createPvpFortressState(Object.keys(roster));
    initial.castleHpBySlot.P2 = 1;
    const started = startPvpFortressCombat(initial, roster, () => 0);
    const matchup = started.state.currentMatchups[0]!;
    const reporter = matchup.reporterSlot;
    const opponent = matchup.type === "real" && reporter === matchup.slotA ? matchup.slotB : matchup.type === "real" ? matchup.slotA : "";
    const winnerSide = opponent === "P2" ? "LEFT" : "RIGHT";
    const resolved = submitPvpFortressReport(started.state, reportFor(matchup, winnerSide, 1), roster);
    expect(resolved.state.aliveSlots).toEqual(["P1"]);
    expect(resolved.state.championSlot).toBe("P1");
    expect(resolved.state.phase).toBe("finished");
    expect(resolved.state.round).toBe(1);
  });
});

describe("PvP Fortress combat snapshots", () => {
  it("selects freshest snapshots, marks only >10s old stale and computes display lead", () => {
    const base = {
      pairId: "round:1:pair:P1:P2",
      slot: "P1",
      opponentSlot: "P2",
      leftAlive: 2,
      rightAlive: 2,
      leftHpTotal: 50,
      rightHpTotal: 40,
    };
    const freshest = freshestPvpFortressSnapshot([
      { ...base, timestamp: 1_000 },
      { ...base, slot: "P2", timestamp: 5_000 },
    ]);
    expect(freshest?.slot).toBe("P2");
    expect(isPvpFortressSnapshotStale(freshest!, 15_000)).toBe(false);
    expect(isPvpFortressSnapshotStale(freshest!, 15_001)).toBe(true);
    expect(pvpSnapshotLeader(freshest!)).toBe("LEFT");
  });
});
