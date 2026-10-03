// Voxel Unit Model Factory (spec §22, A24, A90).
// Maps catalog species, faction, and star level to procedural rigs.
import * as THREE from "three";
import { getUnit, type UnitDef } from "../../content/catalog";
import { buildUnit, signature, type Pose, type Rig, type UnitModel } from "./kit";
import { quadruped, type QuadSpec } from "./quadruped";
import { bird, type BirdSpec } from "./bird";
import { arthropod, type ArthroSpec } from "./arthropod";
import { serpent, type SerpentSpec } from "./serpent";

const ELEMENT_TINTS: Record<string, number> = {
  FIRE: 0xee5522,
  TIDE: 0x3388dd,
  STONE: 0x998877,
  WIND: 0x55ccaa,
  WOOD: 0x55aa44,
  NIGHT: 0x442266,
  SPIRIT: 0x9966cc,
};

export function createUnitModel(baseId: string, star: 1 | 2 | 3 = 1, uid = baseId): UnitModel {
  const def = getUnit(baseId);
  const sig = signature(uid);
  const tint = ELEMENT_TINTS[def.element] ?? 0x88aa44;

  const author = resolveAuthor(def, tint);
  const glow = star === 3 ? 0xffcc00 : star === 2 ? 0x66bbff : 0;
  const model = buildUnit(baseId, sig, author, glow);

  // Star and Boss scale
  const starScale = star === 3 ? 1.4 : star === 2 ? 1.2 : 1.0;
  const bossScale = def.boss ? 1.8 : 1.0;
  model.root.scale.multiplyScalar(starScale * bossScale);

  // If star >= 2, add subtle star badge above head
  if (star > 1) {
    const starGeom = new THREE.SphereGeometry(0.08, 6, 6);
    const starMat = new THREE.MeshBasicMaterial({ color: glow });
    for (let i = 0; i < star; i++) {
      const mesh = new THREE.Mesh(starGeom, starMat);
      mesh.position.set((i - (star - 1) / 2) * 0.18, 1.4 * starScale * bossScale, 0);
      model.root.add(mesh);
    }
  }

  return model;
}

function resolveAuthor(def: UnitDef, elementTint: number): (r: Rig) => Pose {
  const spec = def.species.toLowerCase();
  const fac = def.faction;

  if (fac === "AVIAN" || spec.includes("chim") || spec.includes("dieu") || spec.includes("bang") || spec.includes("qua")) {
    const isRaptor = spec.includes("dai_bang") || spec.includes("dieu") || spec.includes("hawk");
    const isOwl = spec.includes("owl") || spec.includes("cu");
    const isWater = spec.includes("swan") || spec.includes("heron") || spec.includes("flamingo");

    const bSpec: BirdSpec = {
      plume: elementTint,
      belly: 0xf5f0e6,
      wing: elementTint,
      beak: 0xf5a623,
      size: isRaptor ? 7 : 5,
      hover: isRaptor ? 6 : 0,
      neck: isWater ? 6 : 2,
      leg: isWater ? 6 : 3,
      beakShape: isRaptor ? "hook" : isWater ? "long" : "short",
      crest: isRaptor ? "crown" : "none",
      owl: isOwl,
    };
    return bird(bSpec);
  }

  if (fac === "INSECT" || spec.includes("kien") || spec.includes("ong") || spec.includes("nhen") || spec.includes("bo")) {
    const isWasp = spec.includes("ong") || spec.includes("wasp");
    const isScorpion = spec.includes("bo_cap") || spec.includes("scorpion");
    const isSpider = spec.includes("nhen") || spec.includes("spider");

    const aSpec: ArthroSpec = {
      shell: elementTint,
      under: 0x332211,
      dark: 0x111111,
      size: isScorpion ? 6 : 5,
      legs: isSpider ? 8 : 6,
      wings: isWasp ? 2 : 0,
      hover: isWasp ? 4 : 0,
      antennae: true,
      pincers: isScorpion || spec.includes("crab") || spec.includes("cua"),
      stinger: isScorpion ? "scorpion" : isWasp ? "wasp" : "none",
    };
    return arthropod(aSpec);
  }

  if (spec.includes("ran") || spec.includes("snake") || spec.includes("viper") || spec.includes("hydra")) {
    const sSpec: SerpentSpec = {
      scale: elementTint,
      belly: 0xf2ebd9,
      dark: 0x223322,
      segments: spec.includes("hydra") ? 7 : 5,
      thickness: def.boss ? 6 : 3.5,
      hood: spec.includes("cobra") || spec.includes("ho_mang"),
      rattle: spec.includes("rattle"),
    };
    return serpent(sSpec);
  }

  // Default: Quadruped (Beast, Reptile, Stone Golem/Tatu, etc.)
  const isFeline = spec.includes("tiger") || spec.includes("leopard") || spec.includes("cat") || spec.includes("jaguar");
  const isCanine = spec.includes("wolf") || spec.includes("fox") || spec.includes("dog") || spec.includes("soi");
  const isBovine = spec.includes("ox") || spec.includes("bull") || spec.includes("buffalo") || spec.includes("bison");
  const isRhino = spec.includes("rhino") || spec.includes("te_giac");
  const isPangolin = spec.includes("tatu") || spec.includes("pangolin") || spec.includes("armadillo");

  const qSpec: QuadSpec = {
    coat: elementTint,
    belly: 0xeee4d3,
    dark: 0x2a221b,
    len: isBovine ? 10 : 8,
    wid: isBovine ? 6 : 5,
    hgt: isBovine ? 6 : 5,
    leg: isFeline ? 5 : 4,
    head: isBovine ? 5 : 4,
    snout: isCanine ? 3 : 1,
    ears: isCanine ? "fox" : isFeline ? "cat" : "round",
    horns: isBovine ? "bull" : isRhino ? "rhino" : undefined,
    shell: isPangolin,
    stripes: isFeline,
  };
  return quadruped(qSpec);
}
