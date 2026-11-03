// Bí Ngô Ma Vương (catalog id wolf_alpha, kept for save compatibility) — bespoke rig from the
// "Bí Ngô Ma Vương" sheet. Armored pumpkin overlord: glowing jack-o'-lantern head with a gold crown and
// purple gem, dark plate armor with gold trim, gold skull pauldrons, a purple cape, purple soul-fire on
// the shoulders and a long purple flame sword.
// Idle: watch → breathe → cape sway → dark aura · Combat idle: guard / hold / menace ·
// Move: step → step → march · Attack: raise → sword sweep (impact) → recover · Skill: gather dark fire →
// burst → flaming sweep (impact) → aftershock · Hit: struck → stagger → steady ·
// Death: weakens → kneels and slumps → fades to void. 2★ taller crown + cape trim; 3★ flame aura and
// burning blade edge.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, type DeathCtx } from "../rig";
import { beats, blinkAt, clamp01, win } from "./beats";

const C = {
  pumpkin: 0xf08a20, pumpkinD: 0xc0601a, stem: 0x4a7a2a, glow: 0xffd040, armor: 0x3a3448, armorD: 0x24202e,
  gold: 0xe8b83a, goldD: 0xa87818, gem: 0xc040ff, cape: 0x5a2a8a, capeD: 0x3a1a5a, fire: 0xb060ff, blade: 0x9a40ff,
  bladeL: 0xe0b0ff, bone: 0xf0e6c8,
};
const HIP_Y = 2.8;

interface Limb { part: Part; side: 1 | -1 }
interface Parts { hips: Part; torso: Part; head: Part; lids: Part; cape: Part; fire: Part; sword: Part; arms: Limb[]; legs: Limb[] }

export default defineUnit<Parts>({
  id: "wolf_alpha",
  motion: "ground",
  height: 11,
  durations: { idle: 4.5, attack: 0.9, skill: 1.7, hit: 0.5, move: 0.7 },
  impact: { attack: 0.55, skill: 0.62 },
  blend: 0.1,

  build(k, { star }) {
    const hips = k.part("hips", null, [0, HIP_Y, 0]);
    hips.box([0, 0, 0], [2.6, 1.0, 1.8], C.armorD).box([0, 0.2, 0.92], [0.7, 0.6, 0.1], C.gold);
    const legs: Limb[] = ([1, -1] as const).map((side) => {
      const part = k.part(side > 0 ? "legR" : "legL", hips, [side * 0.8, -0.1, 0]);
      part.box([0, -1.1, 0], [1.1, 2.0, 1.1], C.armor).box([0, -1.0, 0.58], [0.7, 0.5, 0.08], C.gold)
        .box([0, -2.3, 0.2], [1.2, 0.6, 1.5], C.armorD);
      return { part, side };
    });
    const torso = k.part("torso", hips, [0, 0.4, 0]);
    torso.box([0, 1.3, 0], [3.0, 2.6, 2.0], C.armor).box([0, 1.3, 1.02], [1.8, 2.0, 0.08], C.armorD)
      .box([0, 1.6, 1.08], [0.6, 0.6, 0.08], C.gem, { mat: "glow" }).box([0, 0.85, 1.08], [0.5, 0.5, 0.08], C.gem, { mat: "glow" })
      .box([0, 2.55, 0], [3.1, 0.2, 2.1], C.gold).box([0, 0.1, 0], [3.1, 0.25, 2.1], C.gold)
      .pair([1.75, 2.4, 0], [1.2, 0.9, 1.6], C.gold).pair([1.75, 2.35, 0.82], [0.6, 0.6, 0.08], C.bone);
    const cape = k.part("cape", torso, [0, 2.4, -1.05]);
    cape.box([0, -2.2, -0.2], [3.2, 4.4, 0.25], C.cape).box([0, -2.2, -0.05], [2.6, 4.0, 0.1], C.capeD).pair([1.75, 0.1, 0.2], [0.6, 0.5, 0.6], C.cape);
    if (star >= 2) cape.box([0, -4.3, -0.2], [3.3, 0.25, 0.3], C.gold).pair([1.62, -2.2, -0.2], [0.2, 4.4, 0.3], C.gold);
    const fire = k.part("fire", torso, [0, 3.0, 0]);
    fire.pair([1.8, 0.4, -0.2], [0.6, 0.9, 0.6], C.fire, { mat: "glow" }).pair([2.0, 1.1, -0.3], [0.35, 0.6, 0.35], C.fire, { mat: "glow" });
    if (star >= 3) for (const [x, y] of [[0, 1.6], [1.2, 1.2], [-1.2, 1.2], [0.6, 2.4], [-0.6, 2.4]] as const) fire.box([x, y, -1.6], [0.6, 1.0, 0.25], C.fire, { mat: "glow" });
    const head = k.part("head", torso, [0, 2.7, 0.1]);
    head.box([0, 1.3, 0], [3.2, 2.6, 3.0], C.pumpkin).pair([0.9, 1.3, 0], [0.25, 2.65, 3.05], C.pumpkinD).box([0, 1.3, 0], [0.25, 2.65, 3.05], C.pumpkinD)
      .pair([0.75, 1.65, 1.52], [0.8, 0.6, 0.08], C.glow, { mat: "glow" }).box([0, 0.75, 1.52], [2.0, 0.4, 0.08], C.glow, { mat: "glow" })
      .pair([0.5, 1.0, 1.52], [0.35, 0.3, 0.08], C.glow, { mat: "glow" }).box([0.2, 2.75, -0.2], [0.4, 0.5, 0.4], C.stem).box([0.6, 3.05, -0.2], [0.8, 0.3, 0.3], C.stem);
    head.box([0, 2.75, 0], [2.6, 0.5, 2.4], C.gold).box([0, 2.75, 1.22], [0.5, 0.5, 0.08], C.gem, { mat: "glow" });
    for (const x of [-1.0, 0, 1.0]) head.box([x, 3.15 + (x === 0 ? 0.2 : 0), 1.0], [0.4, 0.5 + (x === 0 ? 0.4 : 0) + (star >= 2 ? 0.3 : 0), 0.3], C.gold);
    // Lids: dark pumpkin flaps that dim the glowing eyes on blinks.
    const lids = k.part("lids", head, [0, 1.95, 1.55]);
    lids.pair([0.75, -0.3, 0], [0.85, 0.6, 0.06], C.pumpkinD);
    const arms: Limb[] = ([1, -1] as const).map((side) => {
      const part = k.part(side > 0 ? "armR" : "armL", torso, [side * 1.9, 2.1, 0]);
      part.box([side * 0.2, -0.9, 0], [0.9, 1.8, 0.9], C.armor).box([side * 0.2, -1.2, 0], [0.95, 0.3, 0.95], C.gold).box([side * 0.2, -1.95, 0.1], [0.9, 0.7, 0.9], C.armorD);
      return { part, side };
    });
    const sword = k.part("sword", arms[0]!.part, [0.2, -1.95, 0.4]);
    sword.box([0, 0, -0.2], [0.3, 0.3, 0.9], C.armorD).box([0, 0, 0.35], [1.4, 0.3, 0.3], C.gold).box([0, 0, 0.35], [0.4, 0.4, 0.35], C.gem, { mat: "glow" })
      .box([0, 0, 2.9], [0.25, 0.9, 4.8], C.blade, { mat: "glow" }).box([0, 0.15, 5.5], [0.25, 0.5, 0.6], C.blade, { mat: "glow" });
    if (star >= 3) sword.box([0, 0.5, 2.9], [0.3, 0.2, 4.6], C.bladeL, { mat: "glow" });
    return { hips, torso, head, lids, cape, fire, sword, arms, legs };
  },

  pose(r, c) {
    const { hips, torso, head, lids, cape, fire, sword, arms, legs } = r;
    const T = c.time;
    let lid = blinkAt(T, c.sig);
    const [armR, armL] = [arms[0]!, arms[1]!];
    const stride = (w: number, amp: number) => {
      for (const l of legs) l.part.group.rotation.x = Math.sin(w + (l.side > 0 ? 0 : Math.PI)) * amp;
      armL.part.group.rotation.x = Math.sin(w) * amp * 0.6;
    };
    cape.group.rotation.x = -Math.abs(Math.sin(T * 1.5)) * 0.08;
    fire.group.scale.set(1, 1 + Math.sin(T * 7) * 0.12, 1);
    armR.part.group.rotation.x = -0.3;

    switch (c.state) {
      case "idle": {
        if (c.combat) {
          const [guard, hold, menace] = beats(T, c.sig, 0x9b0e);
          armR.part.group.rotation.x = -0.5 * guard - 0.3 - 0.4 * menace;
          sword.group.rotation.x = -0.3 * guard;
          torso.group.rotation.x = 0.08 * hold + 0.12 * menace;
          head.group.rotation.y = Math.sin(T * 0.9 + c.sig * 3) * 0.25 * hold;
          fire.group.scale.setScalar(1 + 0.35 * menace);
          lid = Math.max(lid, 0.3 * menace);
        } else {
          // watch (0–.25) → breathe (.25–.5) → cape sway (.5–.75) → dark aura (.75–1).
          const ph = c.p % 1;
          const breathe = win(ph, 0.25, 0.5, 0.05), sway = win(ph, 0.5, 0.76, 0.05), aura = win(ph, 0.74, 1, 0.05);
          head.group.rotation.y = Math.sin(T * 0.6) * 0.2 * (1 - breathe);
          torso.group.scale.set(1 + 0.03 * breathe, 1 + 0.04 * breathe, 1);
          cape.group.rotation.x = -0.25 * sway * (0.5 + 0.5 * Math.sin(T * 3));
          cape.group.rotation.z = Math.sin(T * 2) * 0.08 * sway;
          fire.group.scale.setScalar(1 + 0.5 * aura);
        }
        break;
      }
      case "move": {
        const g = c.combat ? 1 : ramp(c.p, 0.8, 1.8);
        const w = T * (7 + 3 * g);
        stride(w, 0.4 + 0.1 * g);
        hips.group.position.y += Math.abs(Math.sin(w)) * 0.15;
        torso.group.rotation.x = 0.1 + 0.08 * g;
        torso.group.rotation.y = Math.sin(w) * 0.08;
        cape.group.rotation.x = -0.25 - 0.15 * g;
        break;
      }
      case "attack": {
        // raise (0–.4) → sweep (impact .55) → recover.
        const p = c.p;
        const raise = ramp(p, 0, 0.4) * (1 - ramp(p, 0.45, 0.55));
        const sweep = ramp(p, 0.45, 0.55) * (1 - ramp(p, 0.72, 1));
        armR.part.group.rotation.x = -0.3 - 1.3 * raise + 0.6 * sweep;
        armR.part.group.rotation.z = 0.3 * raise;
        torso.group.rotation.y = 0.4 * raise - 0.5 * sweep;
        sword.group.rotation.y = -0.6 * sweep;
        hips.group.position.z += 0.5 * sweep;
        break;
      }
      case "skill": {
        // gather (0–.3) → burst (.25–.45) → flaming sweep (impact .62) → aftershock (.7–1).
        const p = c.p;
        const gather = win(p, 0, 0.32, 0.06), burst = win(p, 0.25, 0.5, 0.04);
        const sweep = win(p, 0.5, 0.75, 0.04), shock = win(p, 0.7, 1, 0.06);
        torso.group.rotation.x = -0.15 * gather + 0.2 * sweep;
        torso.group.rotation.y = 0.6 * gather - 0.7 * sweep;
        armR.part.group.rotation.x = -0.3 - 1.0 * gather - 0.5 * burst + 1.0 * sweep;
        sword.group.rotation.y = -0.7 * sweep;
        hips.group.position.y += 0.5 * burst + Math.abs(Math.sin(c.t * 30)) * 0.08 * shock;
        fire.group.scale.setScalar(1 + 0.6 * gather + 0.8 * burst);
        lid = Math.max(lid, 0.4 * gather);
        break;
      }
      case "hit": {
        const p = c.p;
        const k = ramp(p, 0, 0.12) * (1 - ramp(p, 0.45, 0.88));
        const shake = (1 - ramp(p, 0, 0.24)) * Math.sin(c.t * 70);
        hips.group.position.z += -0.5 * k;
        torso.group.rotation.x = -0.2 * k;
        torso.group.rotation.z = shake * 0.05;
        head.group.rotation.x = -0.15 * k;
        lid = Math.max(lid, 0.85 * k + (p < 0.08 ? 1 : 0));
        break;
      }
    }
    lids.group.scale.y = 0.05 + 0.95 * clamp01(lid);
  },

  death: {
    // Suy yếu (0–.3) → tan rã: kneels and slumps forward (.2–.6) → hóa hư vô (.7–1, shrink-out).
    seconds: 1.3,
    vanishAt: 0.7,
    pose(r: Parts, c: DeathCtx) {
      const { hips, torso, head, lids, fire, arms, legs } = r;
      const p = c.p;
      const weak = ramp(p, 0, 0.3), fold = ramp(p, 0.1, 0.4), kneel = ramp(p, 0.22, 0.55);
      hips.group.position.y += -1.1 * kneel + bell(p, 0.55, 0.65) * 0.1;
      for (const l of legs) l.part.group.rotation.x = -1.2 * fold;
      torso.group.rotation.x = 0.1 * weak + 0.4 * kneel;
      arms[0]!.part.group.rotation.x = -0.6 * kneel;
      arms[1]!.part.group.rotation.x = 0.2 * weak;
      head.group.rotation.x = 0.35 * kneel;
      fire.group.scale.setScalar(1 - 0.8 * weak);
      lids.group.scale.y = 0.05 + 0.95 * Math.max(ramp(p, 0.2, 0.45), bell(p, 0, 0.08));
    },
  },
});
