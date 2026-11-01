// Shared unit copy that must not leak authored English mix into Vietnamese UI lines.
import type { UnitDef } from "../content/catalog";
import { t, type MsgKey } from "./i18n";

/** Localized basic-attack summary (delivery × damage type), replacing `basic.textVi`. */
export function basicAttackCopy(unit: UnitDef): string {
  const delivery = unit.basic.delivery === "melee" ? "melee" : "ranged";
  const damage = unit.basic.damageType === "magic" ? "Magic" : "Physical";
  return t(`unit.basic.${delivery}${damage}` as MsgKey);
}
