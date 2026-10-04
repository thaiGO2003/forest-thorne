import type { CombatResult, Side } from "./combat";

export interface CombatUnitTally {
  uid: string;
  baseId: string;
  star: number;
  side: Side;
  damageDealt: number;
  damageTaken: number;
  healingDone: number;
  healingReceived: number;
  contribution: number;
}

export interface CombatSideTally {
  damageDealt: number;
  damageTaken: number;
  healingDone: number;
  healingReceived: number;
}

export interface CombatTally {
  units: CombatUnitTally[];
  sides: Record<Side, CombatSideTally>;
  /** HP damage caused by environment/system events that have no unit source. */
  unattributedDamage: number;
  mvpUid: string | null;
  mvpBySide: Record<Side, string | null>;
}

const emptySideTally = (): CombatSideTally => ({
  damageDealt: 0,
  damageTaken: 0,
  healingDone: 0,
  healingReceived: 0,
});

function chooseMvp(units: CombatUnitTally[]): string | null {
  if (units.length === 0) return null;
  return [...units].sort((a, b) =>
    b.contribution - a.contribution
    || b.damageDealt - a.damageDealt
    || b.healingDone - a.healingDone
    || a.uid.localeCompare(b.uid),
  )[0]!.uid;
}

/**
 * WBS-032 headless combat statistics derived only from the canonical event log.
 * Damage uses exact HP loss (`hpDamage`), so shield absorption and overkill do not inflate totals.
 */
export function buildCombatTally(result: CombatResult): CombatTally {
  const units = result.participants.map((participant): CombatUnitTally => ({
    ...participant,
    damageDealt: 0,
    damageTaken: 0,
    healingDone: 0,
    healingReceived: 0,
    contribution: 0,
  }));
  const byUid = new Map(units.map((unit) => [unit.uid, unit]));
  let unattributedDamage = 0;

  for (const event of result.events) {
    if (event.t === "basic" || event.t === "skill" || event.t === "dot") {
      const damage = Math.max(0, event.hpDamage);
      const target = byUid.get(event.dst);
      if (target) target.damageTaken += damage;
      const source = event.t === "dot" ? (event.src ? byUid.get(event.src) : undefined) : byUid.get(event.src);
      if (source) source.damageDealt += damage;
      else if (damage > 0) unattributedDamage += damage;
      continue;
    }

    if (event.t === "heal" || event.t === "revive") {
      const amount = Math.max(0, event.t === "heal" ? event.amount : event.hp);
      const source = byUid.get(event.src);
      const target = byUid.get(event.dst);
      if (source) source.healingDone += amount;
      if (target) target.healingReceived += amount;
    }
  }

  for (const unit of units) unit.contribution = unit.damageDealt + unit.healingDone;

  const sides: Record<Side, CombatSideTally> = { L: emptySideTally(), R: emptySideTally() };
  for (const unit of units) {
    const side = sides[unit.side];
    side.damageDealt += unit.damageDealt;
    side.damageTaken += unit.damageTaken;
    side.healingDone += unit.healingDone;
    side.healingReceived += unit.healingReceived;
  }

  return {
    units,
    sides,
    unattributedDamage,
    mvpUid: chooseMvp(units),
    mvpBySide: {
      L: chooseMvp(units.filter((unit) => unit.side === "L")),
      R: chooseMvp(units.filter((unit) => unit.side === "R")),
    },
  };
}
