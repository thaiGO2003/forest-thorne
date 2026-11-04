// Vua Vịt Vàng (catalog id swan_grace, kept for save compatibility) — bespoke rig from the "Vua Vịt
// Vàng" sheet. Yellow duck king with a wide orange beak, a gold crown with red gems, a red royal robe
// with spotted white ermine collar and hem, a big ruby medallion on a gold chain and only one arm left
// (the left sleeve is pinned empty) — the right hand throws gold coins that orbit around him.
// Idle: stand → strut → spin coins · Combat idle: alert / raise the hand / golden aura · Move: step →
// run → waddle sprint · Attack: wind up → throw gold (impact) → gold hits · Skill: summon gold → gather
// power → gold rain (impact) → burst → lucky charm · Hit: struck → slide back → steady · Death: falls →
// drops coins → turns to gold. 2★ more coins and a gold bracer; 3★ glowing golden wings and crown gems.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, type DeathCtx } from "../rig";
import { beats, blinkAt, clamp01, win } from "./beats";

const C = {
  duck: 0xf8d030, duckD: 0xd8a820, beak: 0xf08a20, beakD: 0xc06a14, eye: 0x2a1408, robe: 0xa82028, robeD: 0x7a141c, fur: 0xfaf4ea,
  spot: 0x2a2a2a, gold: 0xf0b030, goldD: 0xb07a20, ruby: 0xe0203a, coin: 0xffd040, wing: 0xffe070,
};
const HIP_Y = 2.15;

interface Limb { part: Part; side: 1 | -1 }
interface Parts { hips: Part; torso: Part; head: Part; lids: Part; arm: Part; coins: Part; wings: Part | null; legs: Limb[] }

export default defineUnit<Parts>({
  id: "swan_grace",
  motion: "ground",
  height: 10,
  durations: { idle: 4.5, attack: 0.85, skill: 1.9, hit: 0.5, move: 0.55 },
  impact: { attack: 0.55, skill: 0.6 },
  blend: 0.1,

  build(k, { star }) {
    const hips = k.part("hips", null, [0, HIP_Y, 0]);
    hips.box([0, 0, 0], [2.8, 1.0, 2.2], C.robe).box([0, -0.55, 0], [3.0, 0.5, 2.4], C.fur);
    for (const [x, z] of [[-1.0, 1.2], [0.4, 1.22], [1.2, 0.5], [-1.2, -0.6], [0.6, -1.22]] as const) hips.box([x, -0.55, z], [0.15, 0.2, 0.06], C.spot);
    const legs: Limb[] = ([1, -1] as const).map((side) => {
      const part = k.part(side > 0 ? "legR" : "legL", hips, [side * 0.6, -0.4, 0]);
      part.box([0, -0.55, 0], [0.5, 1.0, 0.5], C.beak).box([0, -1.45, 0.4], [0.9, 0.3, 1.3], C.beak);
      return { part, side };
    });
    const torso = k.part("torso", hips, [0, 0.4, 0]);
    torso.box([0, 1.0, 0], [2.6, 2.0, 2.0], C.duck).box([0, 1.0, 0.95], [1.4, 1.8, 0.1], C.duckD)
      .pair([1.1, 1.0, 0], [0.5, 2.0, 2.2], C.robe).box([0, 1.0, -1.05], [2.8, 2.0, 0.2], C.robe).box([0, 0.2, -1.1], [2.9, 0.4, 0.3], C.robeD)
      .box([0, 2.1, 0], [3.0, 0.6, 2.4], C.fur).box([0.8, 2.1, 1.2], [0.15, 0.2, 0.06], C.spot).box([-0.7, 2.1, 1.2], [0.15, 0.2, 0.06], C.spot)
      .pair([0.45, 1.6, 1.04], [0.15, 0.8, 0.06], C.gold).box([0, 1.15, 1.06], [0.7, 0.7, 0.12], C.gold).box([0, 1.15, 1.13], [0.45, 0.45, 0.06], C.ruby, { mat: "glow" })
      .box([-1.45, 1.6, 0.2], [0.5, 0.5, 0.6], C.robeD).box([-1.5, 1.6, 0.52], [0.25, 0.25, 0.06], C.gold);
    const head = k.part("head", torso, [0, 2.3, 0]);
    head.box([0, 1.2, 0], [2.6, 2.4, 2.4], C.duck).box([0, 0.7, 1.55], [1.6, 0.4, 1.0], C.beak).box([0, 0.4, 1.45], [1.4, 0.25, 0.8], C.beakD)
      .pair([0.55, 1.4, 1.22], [0.35, 0.45, 0.06], C.eye).pair([0.6, 1.75, 1.24], [0.6, 0.15, 0.06], C.duckD)
      .box([0, 2.55, 0], [2.4, 0.7, 2.2], C.gold).box([0, 2.25, 0], [2.6, 0.3, 2.4], C.fur);
    for (const [x, z] of [[0, 1.1], [1.1, 0], [-1.1, 0], [0, -1.1]] as const) head.box([x, 3.1, z], [0.4, 0.5, 0.4], C.gold).box([x * 1.02, 2.55, z * 1.02], [0.3, 0.3, 0.3], C.ruby, { mat: star >= 3 ? "glow" : "solid" });
    const lids = k.part("lids", head, [0, 1.6, 1.25]);
    lids.pair([0.55, -0.2, 0], [0.4, 0.5, 0.06], C.duck);
    const arm = k.part("arm", torso, [1.45, 1.8, 0.1]);
    arm.box([0.25, -0.7, 0], [0.8, 1.4, 0.8], C.robe).box([0.25, -1.2, 0], [0.95, 0.35, 0.95], C.fur).box([0.25, -1.7, 0.1], [0.75, 0.7, 0.75], C.duck)
      .box([0.25, -2.1, 0.2], [0.25, 0.4, 0.25], C.duck).box([0.55, -1.75, 0.2], [0.25, 0.35, 0.25], C.duck);
    if (star >= 2) arm.box([0.25, -1.45, 0], [0.85, 0.25, 0.85], C.gold);
    const coins = k.part("coins", hips, [0, 2.0, 0]);
    const n = star >= 2 ? 7 : 5;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      coins.box([Math.cos(a) * 2.5, 0.5 * Math.sin(i * 1.9), Math.sin(a) * 2.5], [0.55, 0.55, 0.12], C.coin, { mat: "glow", rot: [0, -a, 0] });
    }
    let wings: Part | null = null;
    if (star >= 3) {
      wings = k.part("wings", torso, [0, 1.4, -1.2]);
      for (let i = 0; i < 4; i++) wings.pair([1.0 + i * 0.5, 0.4 + i * 0.35, -0.2], [0.5, 1.6 - i * 0.25, 0.15], C.wing, { mat: "glow", rot: [0, 0, -0.4 - i * 0.1] });
    }
    return { hips, torso, head, lids, arm, coins, wings, legs };
  },

  pose(r, c) {
    const { hips, torso, head, lids, arm, coins, wings, legs } = r;
    const T = c.time;
    let lid = blinkAt(T, c.sig);
    let orbit = 1.2, rise = 0;
    const stride = (w: number, amp: number) => { for (const l of legs) l.part.group.rotation.x = Math.sin(w + (l.side > 0 ? 0 : Math.PI)) * amp; };
    if (wings) wings.group.rotation.y = Math.sin(T * 2) * 0.1;

    switch (c.state) {
      case "idle": {
        if (c.combat) {
          const [alert, hand, aura] = beats(T, c.sig, 0xd0c1);
          head.group.rotation.y = Math.sin(T * 0.9 + c.sig * 3) * 0.25 * alert;
          arm.group.rotation.x = -1.2 * hand;
          arm.group.rotation.z = 0.2 * hand;
          orbit += 2 * aura;
          rise = 0.3 * aura;
        } else {
          // stand (0–.35) → strut, chest out (.35–.65) → spin coins (.65–1).
          const ph = c.p % 1;
          const strut = win(ph, 0.35, 0.65, 0.05), spin = win(ph, 0.65, 1, 0.05);
          torso.group.rotation.x = -0.12 * strut;
          head.group.rotation.x = -0.15 * strut;
          torso.group.scale.y = 1 + Math.sin(T * 1.6) * 0.02;
          arm.group.rotation.x = -0.8 * spin;
          arm.group.rotation.y = Math.sin(c.t * 8) * 0.3 * spin;
          orbit += 3 * spin;
        }
        break;
      }
      case "move": {
        const g = c.combat ? 1 : ramp(c.p, 0.8, 1.8);
        const w = T * (10 + 5 * g);
        stride(w, 0.5 + 0.1 * g);
        hips.group.position.y += Math.abs(Math.sin(w)) * 0.15;
        torso.group.rotation.z = Math.sin(w) * 0.08;
        torso.group.rotation.x = 0.1 + 0.15 * g;
        arm.group.rotation.x = Math.sin(w) * 0.4;
        break;
      }
      case "attack": {
        // wind up (0–.4) → throw gold (impact .55) → follow-through.
        const p = c.p;
        const wind = ramp(p, 0, 0.4) * (1 - ramp(p, 0.45, 0.55));
        const thr = ramp(p, 0.45, 0.55) * (1 - ramp(p, 0.75, 1));
        arm.group.rotation.x = -2.4 * wind - 1.1 * thr;
        torso.group.rotation.y = 0.3 * wind - 0.25 * thr;
        torso.group.rotation.x = -0.1 * wind + 0.15 * thr;
        orbit += 4 * wind;
        break;
      }
      case "skill": {
        // summon gold (0–.25) → gather (.2–.5) → gold rain (impact .6) → burst (.65–.8) → lucky charm.
        const p = c.p;
        const raise = win(p, 0, 0.62, 0.08), gather = win(p, 0.2, 0.6, 0.05), rain = win(p, 0.55, 0.8, 0.04), charm = win(p, 0.78, 1, 0.06);
        arm.group.rotation.x = -2.8 * raise - 0.9 * rain;
        head.group.rotation.x = -0.35 * raise;
        orbit += 6 * gather + 2 * charm;
        rise = 1.8 * gather - 1.2 * rain + 0.4 * charm;
        hips.group.position.y += 0.15 * gather;
        lid = Math.max(lid, 0.4 * rain);
        if (wings) wings.group.rotation.y = 0.4 * gather;
        break;
      }
      case "hit": {
        const p = c.p;
        const k = ramp(p, 0, 0.12) * (1 - ramp(p, 0.45, 0.88));
        const shake = (1 - ramp(p, 0, 0.24)) * Math.sin(c.t * 70);
        hips.group.position.z += -0.6 * k;
        torso.group.rotation.x = -0.25 * k;
        torso.group.rotation.z = shake * 0.06;
        head.group.rotation.x = -0.2 * k;
        lid = Math.max(lid, 0.85 * k + (p < 0.08 ? 1 : 0));
        break;
      }
    }
    coins.group.rotation.y = T * orbit;
    coins.group.position.y += Math.max(0, rise);
    lids.group.scale.y = 0.05 + 0.95 * clamp01(lid);
  },

  death: {
    // Ngã xuống (0–.4) → rơi vàng: coins drop around him (.2–.6) → tan biến thành vàng (.7–1).
    seconds: 1.2,
    vanishAt: 0.7,
    pose(r: Parts, c: DeathCtx) {
      const { hips, torso, head, lids, legs, arm, coins } = r;
      const p = c.p;
      const fold = ramp(p, 0, 0.3), fall = ramp(p, 0.12, 0.42), lie = ramp(p, 0.2, 0.55);
      hips.group.position.y += -1.1 * fall + bell(p, 0.4, 0.5) * 0.12;
      for (const l of legs) l.part.group.rotation.x = -1.3 * fold;
      torso.group.rotation.x = -1.1 * lie;
      arm.group.rotation.z = 0.7 * lie;
      head.group.rotation.x = 0.3 * lie;
      coins.group.position.y += -1.4 * ramp(p, 0.2, 0.6);
      lids.group.scale.y = 0.05 + 0.95 * Math.max(ramp(p, 0.25, 0.45), bell(p, 0, 0.08));
    },
  },
});
