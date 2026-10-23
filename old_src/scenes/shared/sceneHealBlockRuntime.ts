interface HealBlockTarget {
  statuses?: {
    healBlockTurns?: number;
    healBlockSourceId?: string | number | null;
  };
}

interface HealBlockUnit {
  uid: string | number;
  alive?: boolean;
}

type CombatUnitQuery = (side: string) => HealBlockUnit[];

type HealBlockScene = {
  getCombatUnits?: CombatUnitQuery;
};

function clearHealBlockStatus(target: HealBlockTarget): void {
  if (!target?.statuses) return;
  target.statuses.healBlockTurns = 0;
  target.statuses.healBlockSourceId = null;
}

function findCombatUnitByUid(scene: HealBlockScene | null | undefined, uid: string | number): HealBlockUnit | null {
  if (!scene || !uid || typeof scene.getCombatUnits !== "function") return null;
  for (const side of ["LEFT", "RIGHT"]) {
    const unit = (scene.getCombatUnits(side) ?? []).find((candidate) => candidate?.uid === uid);
    if (unit) return unit;
  }
  return null;
}

export function isHealBlockActive(scene: HealBlockScene | null | undefined, target: HealBlockTarget | null | undefined): boolean {
  const turns = Number(target?.statuses?.healBlockTurns ?? 0);
  if (!target?.statuses || turns <= 0) return false;
  const sourceId = target.statuses.healBlockSourceId ?? null;
  if (!sourceId) return true;
  const source = findCombatUnitByUid(scene, sourceId);
  if (source?.alive) return true;
  clearHealBlockStatus(target);
  return false;
}

export function resetHealBlockIfExpired(target: HealBlockTarget | null | undefined): boolean {
  if (Number(target?.statuses?.healBlockTurns ?? 0) > 0) return false;
  clearHealBlockStatus(target as HealBlockTarget);
  return true;
}
