// Unit id → authored rig. Only units with a finished bespoke composition are registered here.
// Ids without art yet resolve to `pendingArt`: an explicit "art in progress" signpost, deliberately
// NOT a creature, so an unfinished id can never pass as a generic animal (A90 acceptance).
import { getUnit } from "../content/catalog";
import { createUnitVisual, defineUnit, type Star, type UnitRigDef, type UnitVisual } from "./rig";
import antGuard from "./roster/antGuard";
import badgerStone from "./roster/badgerStone";
import craneBlessing from "./roster/craneBlessing";
import crowStorm from "./roster/crowStorm";
import dovePeace from "./roster/dovePeace";
import fireflyHeal from "./roster/fireflyHeal";
import foxFlame from "./roster/foxFlame";
import jaguarHunt from "./roster/jaguarHunt";
import komodoBite from "./roster/komodoBite";
import newtFire from "./roster/newtFire";
import ramCharge from "./roster/ramCharge";
import salamanderFlame from "./roster/salamanderFlame";
import scorpionShadow from "./roster/scorpionShadow";
import spiderVenom from "./roster/spiderVenom";
import tigerFang from "./roster/tigerFang";
import toadPoison from "./roster/toadPoison";
import triceratopsCharge from "./roster/triceratopsCharge";

export const RIGS: Readonly<Record<string, UnitRigDef<unknown>>> = {
  ant_guard: antGuard,
  badger_stone: badgerStone,
  crane_blessing: craneBlessing,
  crow_storm: crowStorm,
  dove_peace: dovePeace,
  firefly_heal: fireflyHeal,
  fox_flame: foxFlame,
  jaguar_hunt: jaguarHunt,
  komodo_bite: komodoBite,
  newt_fire: newtFire,
  ram_charge: ramCharge,
  salamander_flame: salamanderFlame,
  scorpion_shadow: scorpionShadow,
  spider_venom: spiderVenom,
  tiger_fang: tigerFang,
  toad_poison: toadPoison,
  triceratops_charge: triceratopsCharge,
};

const TIER_PLANK = [0x9aa0a6, 0x9aa0a6, 0x4caf50, 0x3d8fe0, 0xa05ad8, 0xf0b030, 0xd8433a];

/** Signpost shown for catalog ids whose bespoke rig has not been authored yet. */
function pendingArt(id: string): UnitRigDef<unknown> {
  const tier = getUnit(id).tier;
  return defineUnit({
    id, motion: "ground", height: 9,
    build(k) {
      const post = k.part("post");
      post.box([0, 3, 0], [1.2, 6, 1.2], 0x6b4226);
      post.box([0, 0.3, 0], [3, 0.6, 3], 0x3b2414);
      const sign = k.part("sign", post, [0, 6.6, 0]);
      sign.box([0, 0, 0], [6, 3.4, 0.8], 0x8f5b32);
      sign.box([0, 0, 0.45], [5, 2.4, 0.1], TIER_PLANK[tier] ?? 0x9aa0a6);
      sign.box([0, 1.9, 0], [6.4, 0.5, 1], 0x3b2414);
      return { sign };
    },
    pose(r, c) { r.sign.group.rotation.z = Math.sin(c.time * 1.3) * 0.05; },
  });
}

export const hasRig = (id: string) => id in RIGS;

export function createUnit(id: string, star: Star, skin: string | null = null): UnitVisual {
  return createUnitVisual(RIGS[id] ?? pendingArt(id), star, skin);
}
