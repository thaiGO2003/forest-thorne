// Unit id → authored rig. Only units with a finished bespoke composition are registered here.
// Ids without art yet resolve to `pendingArt`: an explicit "art in progress" signpost, deliberately
// NOT a creature, so an unfinished id can never pass as a generic animal (A90 acceptance).
import { getUnit } from "../content/catalog";
import { createUnitVisual, defineUnit, type Star, type UnitRigDef, type UnitVisual } from "./rig";
import jaguarHunt from "./roster/jaguarHunt";
import toadPoison from "./roster/toadPoison";
import frogAlchemy from "./roster/frogAlchemy";
import weaselWind from "./roster/weaselWind";
import batLove from "./roster/batLove";
import antGuard from "./roster/antGuard";
import rabbitBlood from "./roster/rabbitBlood";
import roosterRapper from "./roster/roosterRapper";
import butterflyFrost from "./roster/butterflyFrost";
import woodpeckerShield from "./roster/woodpeckerShield";
import kirinVolt from "./roster/kirinVolt";
import spiderSpirit from "./roster/spiderSpirit";

import elephantTide from "./roster/elephantTide";
import hawkLance from "./roster/hawkLance";
import snakeSoul from "./roster/snakeSoul";
import beetleNibble from "./roster/beetleNibble";
import monkeySage from "./roster/monkeySage";
import pumpkinKing from "./roster/pumpkinKing";
import deerNurse from "./roster/deerNurse";
import squirrelMonk from "./roster/squirrelMonk";
import ferretBlades from "./roster/ferretBlades";
import sharkOctopus from "./roster/sharkOctopus";
import oxMountain from "./roster/oxMountain";
import foxSlingshot from "./roster/foxSlingshot";
import saolaFrost from "./roster/saolaFrost";
import boarGlutton from "./roster/boarGlutton";
import timeCloth from "./roster/timeCloth";
import pigCharm from "./roster/pigCharm";
import bullRage from "./roster/bullRage";
import hedgehogSun from "./roster/hedgehogSun";
import duckKing from "./roster/duckKing";
import elfSheep from "./roster/elfSheep";
import frostButterfly from "./roster/frostButterfly";
import vikingBison from "./roster/vikingBison";
import butterflyAssassin from "./roster/butterflyAssassin";
import coconutCannon from "./roster/coconutCannon";
export const RIGS: Readonly<Record<string, UnitRigDef<unknown>>> = {
  jaguar_hunt: jaguarHunt,
  toad_poison: toadPoison,
  frog_alchemy: frogAlchemy,
  // Phong Liêm Dứu keeps the legacy catalog id so existing saves still resolve.
  weasel_quick: weaselWind,
  // Dơi Tình Yêu keeps the legacy catalog id so existing saves still resolve.
  bat_blood: batLove,
  ant_guard: antGuard,
  rabbit_blood: rabbitBlood,
  crane_blessing: roosterRapper,
  ice_mage: butterflyFrost,
  woodpecker_drill: woodpeckerShield,
  kirin_thunder: kirinVolt,
  spider_venom: spiderSpirit,
  elephant_guard: elephantTide,
  hawk_hunter: hawkLance,
  // The six reworks below keep their legacy catalog ids so existing saves still resolve.
  storm_mage: snakeSoul,
  beetle_mystic: beetleNibble,
  monkey_spear: monkeySage,
  wolf_alpha: pumpkinKing,
  deer_song: deerNurse,
  fairy_forest: squirrelMonk,
  ferret_shadow: ferretBlades,
  octopus_mind: sharkOctopus,
  ox_mountain: oxMountain,
  fox_flame: foxSlingshot,
  worm_ice: saolaFrost,
  bear_ancient: boarGlutton,
  wisp_light: timeCloth,
  hippo_maul: pigCharm,
  yak_highland: bullRage,
  cat_goldbow: hedgehogSun,
  swan_grace: duckKing,
  dryad_tree: elfSheep,
  moth_dust: frostButterfly,
  buffalo_mist: vikingBison,
  mosquito_toxic: butterflyAssassin,
  pelican_bomb: coconutCannon,
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
