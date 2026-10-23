import type { CombatUnit } from "../../systems/AISystem.js";
import type { BoardUnit } from "../../systems/BoardSystem.js";
import {
  distanceToFrontline as _distanceToFrontline,
  distanceToBackline as _distanceToBackline
} from "../../core/gameUtils.js";
import {
  getUnitStatFallback as _getUnitStatFallback,
  getEffectiveAtk as _getEffectiveAtk,
  getEffectiveDef as _getEffectiveDef,
  getEffectiveMatk as _getEffectiveMatk,
  getEffectiveMdef as _getEffectiveMdef
} from "../../core/combatCalc.js";

export function planningDistanceToFrontline(_scene: unknown, unit: BoardUnit): number {
  return _distanceToFrontline(unit as unknown as Parameters<typeof _distanceToFrontline>[0]);
}

export function planningDistanceToBackline(_scene: unknown, unit: BoardUnit): number {
  return _distanceToBackline(unit as unknown as Parameters<typeof _distanceToBackline>[0]);
}

export function getPlanningUnitStatFallback(
  _scene: unknown,
  unit: CombatUnit | null | undefined,
  statKey: string,
  defaultValue: number = 0
): number {
  return _getUnitStatFallback(unit as unknown as Parameters<typeof _getUnitStatFallback>[0], statKey, defaultValue);
}

export function getPlanningEffectiveAtk(_scene: unknown, unit: CombatUnit | null | undefined): number {
  return _getEffectiveAtk(unit as unknown as Parameters<typeof _getEffectiveAtk>[0]);
}

export function getPlanningEffectiveDef(_scene: unknown, unit: CombatUnit | null | undefined): number {
  return _getEffectiveDef(unit as unknown as Parameters<typeof _getEffectiveDef>[0]);

}

export function getPlanningEffectiveMatk(_scene: unknown, unit: CombatUnit | null | undefined): number {
  return _getEffectiveMatk(unit as unknown as Parameters<typeof _getEffectiveMatk>[0]);

}

export function getPlanningEffectiveMdef(_scene: unknown, unit: CombatUnit | null | undefined): number {
  return _getEffectiveMdef(unit as unknown as Parameters<typeof _getEffectiveMdef>[0]);
}
