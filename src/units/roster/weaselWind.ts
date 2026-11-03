// Phong Liêm Dứu (catalog id weasel_quick, kept for save compatibility) — bespoke rig from the approved
// "Phong Liêm Dứu" reference sheet. Low crouching cream weasel with teal fur patches and mask, a teal
// wind-swirl scarf, gold bracers, a wind sickle in each paw and a huge spiral tail.
// Idle: breathe → tail flick → sharpen sickles → alert · Combat idle: guard / wind circle / ready,
// picked per beat by a deterministic hash · Move: steps blending into a low wind glide · Attack: wind up →
// sickle swing on impact → follow-through · Skill: brace → sickles spin → tornado spin (impact) → pull
// pose → settle · Hit: block with sickles → pushed back → recover · Death: kneel → collapse → vanish.
// 2★ adds a glowing wind ring; 3★ adds gold shoulder armour and a gold crest.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, type DeathCtx } from "../rig";

const C = {
  cream: 0xf2e8d2, creamD: 0xd8c9a8, teal: 0x2fa596, tealD: 0x1d7468, pink: 0xf2a0a8,
  eye: 0x18261f, white: 0xffffff, gold: 0xe0b03a, goldD: 0xa87a1c, steel: 0x6e7680,
  blade: 0x9ff6ee, scarf: 0x2a8a7e, wind: 0x7ff0e0,
};

/** Hips pivot height: soles rest on y ≈ 0.05 with straight legs. */
const HIPS_Y = 3.05;
const THIGH = 1.4, SHIN = 1.2, FOOT_H = 0.4, LEG = THIGH + SHIN + FOOT_H;
const HIP_X = 0.9;
/** Seconds of follow-through lag per tail segment. */
const TAIL_LAG = 0.08;

interface Leg { thigh: Part; shin: Part; foot: Part }
interface Arm { arm: Part; fore: Part; side: 1 | -1 }
interface WeaselParts {
  hips: Part; torso: Part; head: Part; jaw: Part; lids: Part; ears: Part[];
  arms: Arm[]; legs: Leg[]; tail: Part[]; scarf: Part; ring: Part | null;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const win = (p: number, a: number, b: number, e: number) => ramp(p, a, a + e) * (1 - ramp(p, b - e, b));

/** Knee-forward two-link solve: hip → ankle shortened by `drop`, ankle under the hip, foot level. */
function poseLeg(l: Leg, drop: number, swing = 0, lift = 0) {
  const d = Math.max(0, drop + lift);
  let a = 0, b = 0;
  if (d > 0) {
    const h = Math.max(0.5, THIGH + SHIN - d);
    a = Math.acos(Math.min(1, (THIGH * THIGH + h * h - SHIN * SHIN) / (2 * THIGH * h)));
    b = Math.asin(Math.min(1, (THIGH / SHIN) * Math.sin(a)));
  }
  l.thigh.group.rotation.x += -a + swing;
  l.shin.group.rotation.x += a + b;
  l.foot.group.rotation.x += -b - swing;
}
/** Plant both legs after the hips moved by `dy` (≤0 lowers) and `dz` (forward shift → legs swing back). */
function plant(legs: readonly Leg[], dy: number, dz = 0) {
  const swing = Math.asin(Math.max(-0.5, Math.min(0.5, dz / LEG)));
  const extra = LEG * (1 - Math.cos(swing));
  for (let i = 0; i < legs.length; i++) poseLeg(legs[i]!, -dy + extra, swing);
}

/** Spiral tail: each segment curls further; sway/flick ripple base → tip with a time lag. */
function poseTail(tail: readonly Part[], time: number, sway: number, speed: number, flick = 0) {
  for (let i = 0; i < tail.length; i++) {
    const g = tail[i]!.group, tt = time - i * TAIL_LAG;
    g.rotation.y += Math.sin(tt * speed) * sway * (0.4 + i * 0.25);
    g.rotation.x += flick * Math.sin(tt * 14) * (0.1 + i * 0.05);
  }
}

/** Sickle arms: `raise` lifts forward (−), `out` opens sideways, `bend` folds the elbow, `twist` turns the blade. */
function poseArm(a: Arm, raise: number, out: number, bend: number, twist = 0) {
  a.arm.group.rotation.x += raise;
  a.arm.group.rotation.z += a.side * out;
  a.fore.group.rotation.x += -bend;
  a.fore.group.rotation.y += a.side * twist;
}

const blinkAt = (time: number, sig: number) => bell((time + sig * 4.7) % 3.5, 0, 0.14);

function beat(n: number, sig: number): number {
  let h = Math.imul(n ^ 0x51ed27, 0x85ebca6b) ^ Math.floor(sig * 3967);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) % 3;
}

export default defineUnit<WeaselParts>({
  id: "weasel_quick",
  motion: "ground",
  height: 9,
  durations: { idle: 4.5, attack: 0.8, skill: 1.6, hit: 0.5, move: 0.6 },
  impact: { attack: 0.5, skill: 0.55 },
  blend: 0.1,

  build(k, { star }) {
    const hips = k.part("hips", null, [0, HIPS_Y, 0]);
    hips.box([0, 0.3, -0.2], [2.4, 1.4, 2.2], C.cream);

    const torso = k.part("torso", hips, [0, 0.7, 0.2]);
    torso.box([0, 0.9, 0.2], [2.6, 2.2, 2.2], C.cream, { rot: [0.35, 0, 0] })
      .box([0, 1.3, -0.2], [2.4, 0.9, 1.6], C.teal, { rot: [0.35, 0, 0] }); // teal back patch

    const scarf = k.part("scarf", torso, [0, 1.9, 0.6]);
    scarf.box([0, 0, 0], [3.0, 0.8, 2.4], C.scarf)
      .box([0, -0.6, 1.1], [1.6, 1.0, 0.3], C.scarf)
      .box([0, -0.6, 1.27], [0.7, 0.7, 0.06], C.wind, { mat: "glow" }); // swirl emblem

    const head = k.part("head", torso, [0, 2.3, 0.9]);
    head.box([0, 0.8, 0.4], [3.0, 2.2, 2.4], C.cream)
      .box([0, 1.45, 0.3], [3.1, 0.9, 2.3], C.teal) // teal cap / mask top
      .pair([0.9, 0.95, 1.62], [0.95, 0.6, 0.06], C.tealD) // mask around the eyes
      .pair([0.9, 0.95, 1.66], [0.45, 0.45, 0.06], C.eye)
      .pair([0.8, 1.05, 1.7], [0.15, 0.15, 0.04], C.white)
      .box([0, 0.35, 1.7], [1.4, 0.8, 0.3], C.creamD) // muzzle
      .box([0, 0.6, 1.88], [0.4, 0.3, 0.08], C.eye); // nose
    const lids = k.part("lids", head, [0, 1.25, 1.7]);
    lids.pair([0.9, -0.3, 0], [0.55, 0.6, 0.06], C.teal);
    const jaw = k.part("jaw", head, [0, 0.1, 1.5]);
    jaw.box([0, -0.1, 0.1], [1.2, 0.35, 0.4], C.creamD).box([0, 0.05, 0.25], [0.8, 0.1, 0.2], C.pink);
    const ears = ([1, -1] as const).map((side) => {
      const e = k.part(side > 0 ? "earR" : "earL", head, [side * 1.05, 1.95, 0.2]);
      e.box([0, 0.4, 0], [0.8, 0.9, 0.4], C.teal).box([0, 0.35, 0.21], [0.4, 0.5, 0.04], C.pink);
      return e;
    });

    const arms: Arm[] = ([1, -1] as const).map((side) => {
      const arm = k.part(side > 0 ? "armR" : "armL", torso, [side * 1.45, 1.5, 0.6]);
      arm.box([0, -0.6, 0], [0.75, 1.3, 0.75], C.cream);
      const fore = k.part(side > 0 ? "sickleR" : "sickleL", arm, [0, -1.2, 0]);
      fore.box([0, -0.4, 0], [0.8, 0.9, 0.8], C.gold) // bracer
        .box([0, -0.4, 0.42], [0.4, 0.4, 0.06], C.goldD)
        .box([0, -0.95, 0.15], [0.7, 0.4, 0.8], C.cream) // paw
        .box([0, -1.0, 0.75], [0.25, 0.25, 0.9], C.steel) // grip
        .box([side * 0.05, -0.55, 1.45], [0.14, 1.4, 0.4], C.blade, { mat: "glow", rot: [0.4, 0, 0] }) // curved blade
        .box([side * 0.05, 0.2, 1.75], [0.14, 0.7, 0.3], C.blade, { mat: "glow", rot: [0.9, 0, 0] });
      return { arm, fore, side };
    });

    const legs: Leg[] = ([1, -1] as const).map((side) => {
      const thigh = k.part(side > 0 ? "thighR" : "thighL", hips, [side * HIP_X, 0, 0]);
      thigh.box([0, -0.6, 0], [1.0, 1.5, 1.2], C.cream);
      const shin = k.part(side > 0 ? "shinR" : "shinL", thigh, [0, -THIGH, 0]);
      shin.box([0, -0.6, 0], [0.75, 1.25, 0.8], C.tealD);
      const foot = k.part(side > 0 ? "footR" : "footL", shin, [0, -SHIN, 0]);
      foot.box([0, -FOOT_H / 2, 0.3], [0.9, FOOT_H, 1.4], C.tealD)
        .box([0, -FOOT_H / 2 + 0.05, 1.05], [0.8, 0.25, 0.15], C.white);
      return { thigh, shin, foot };
    });

    // Spiral tail: segments curl up and forward over the back.
    const tail: Part[] = [];
    let parent = hips;
    const SEG: [number, number, number, number][] = [[0, 0.6, -1.2, 1.5], [0, 1.0, -0.6, 1.7], [0, 1.3, 0.3, 1.6], [0, 0.4, 1.0, 1.3]];
    SEG.forEach(([x, y, z, s], i) => {
      const seg = k.part(`tail${i}`, parent, i === 0 ? [0, 0.5, -1.2] : [x, y, z]);
      seg.box([0, s / 2, 0], [s, s, s], i % 2 ? C.cream : C.creamD);
      if (i === 2) seg.box([0, s / 2, -s / 2 - 0.05], [s * 0.7, s * 0.4, 0.1], C.teal);
      tail.push(seg);
      parent = seg;
    });

    let ring: Part | null = null;
    if (star >= 2) {
      ring = k.part("ring", null, [0, 0.06, 0]);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        ring.box([Math.cos(a) * 2.9, 0, Math.sin(a) * 2.9], [1.5, 0.1, 0.3], C.wind, { mat: "glow", rot: [0, -a + Math.PI / 2, 0] });
      }
    }
    if (star >= 3) {
      head.box([0, 2.05, 0.6], [1.4, 0.35, 1.4], C.gold).box([0, 2.4, 1.0], [0.4, 0.7, 0.3], C.gold, { rot: [0.3, 0, 0] });
      for (const a of arms) a.arm.box([0, 0.1, 0], [1.1, 0.5, 1.1], C.gold).box([0, -0.2, 0], [1.2, 0.12, 1.2], C.goldD);
    }
    return { hips, torso, head, jaw, lids, ears, arms, legs, tail, scarf, ring };
  },

  pose(r, c) {
    const { hips, torso, head, jaw, lids, ears, arms, legs, tail, scarf, ring } = r;
    const T = c.time;
    const armR = arms[0]!, armL = arms[1]!;
    let lid = blinkAt(T, c.sig);
    if (ring) ring.group.rotation.y = T * 0.9;

    switch (c.state) {
      case "idle": {
        if (c.combat) {
          const s = T * 0.39 + c.sig * 2.1, n = Math.floor(s), m = ramp(s - n, 0.72, 1);
          const a = beat(n, c.sig), b = beat(n + 1, c.sig);
          const guard = (a === 0 ? 1 - m : 0) + (b === 0 ? m : 0);
          const circle = (a === 1 ? 1 - m : 0) + (b === 1 ? m : 0);
          const ready = (a === 2 ? 1 - m : 0) + (b === 2 ? m : 0);
          const dy = -0.5 - 0.2 * ready + Math.sin(T * 2.6) * 0.06;
          hips.group.position.y += dy;
          plant(legs, dy);
          torso.group.rotation.x = 0.1 + 0.08 * ready;
          poseArm(armR, -1.0 - 0.3 * guard, 0.2, 1.0 + 0.3 * guard, 0.3 * circle * Math.sin(T * 6));
          poseArm(armL, -0.8 - 0.3 * guard, 0.25, 1.1 + 0.3 * guard, -0.3 * circle * Math.sin(T * 6));
          head.group.rotation.y = (Math.sin(T * 0.9 + c.sig * 3) * 0.25 + Math.sin(T * 2.3) * 0.05) * (1 - 0.6 * ready);
          head.group.rotation.x = -0.05 * ready;
          jaw.group.rotation.x = 0.15 * ready * Math.max(0, Math.sin(T * 5));
          for (const e of ears) e.group.rotation.x = -0.3 * ready;
          poseTail(tail, T, 0.15 + 0.15 * circle, 3 + 3 * circle);
          if (ring) ring.group.rotation.y = T * (0.9 + 2.5 * circle);
          lid = Math.max(lid, 0.25 * ready);
        } else {
          // breathe (0–.25) → tail flick (.25–.5) → sharpen sickles (.5–.75) → alert (.75–1).
          const ph = c.p % 1;
          const flick = win(ph, 0.25, 0.5, 0.05), sharpen = win(ph, 0.5, 0.76, 0.06), alert = win(ph, 0.74, 1, 0.06);
          const dy = -0.15 - Math.sin(T * 1.9) * 0.05;
          hips.group.position.y += dy;
          plant(legs, dy);
          torso.group.scale.set(1 + Math.sin(T * 1.9) * 0.015, 1 + Math.sin(T * 1.9) * 0.02, 1);
          torso.group.rotation.x = 0.04 - 0.06 * alert;
          // Sharpen: right sickle scrapes along the left one.
          const scrape = Math.sin(c.t * 10) * sharpen;
          poseArm(armR, -0.4 - 0.7 * sharpen, 0.1 - 0.5 * sharpen, 0.4 + 0.6 * sharpen + 0.2 * scrape);
          poseArm(armL, -0.3 - 0.6 * sharpen, 0.15 - 0.3 * sharpen, 0.5 + 0.5 * sharpen);
          head.group.rotation.y = Math.sin(T * 0.6) * 0.1 + 0.3 * alert * Math.sin(c.t * 2.5);
          head.group.rotation.x = 0.15 * sharpen - 0.1 * alert;
          for (let i = 0; i < ears.length; i++) {
            const tw = (T + c.sig * 3 + i * 1.6) % (3.2 + i);
            ears[i]!.group.rotation.z = (i ? 1 : -1) * (bell(tw, 0, 0.12) * 0.25) ;
            ears[i]!.group.rotation.x = -0.25 * alert;
          }
          poseTail(tail, T, 0.08, 2, flick);
        }
        break;
      }
      case "move": {
        // No velocity in PoseCtx: combat always glides; out of combat steps blend into the glide.
        const g = c.combat ? 1 : ramp(c.p, 0.8, 1.8), wk = 1 - g;
        const w = c.p * Math.PI * 2 * (0.5 * wk + g);
        const dy = -0.2 * wk - 0.5 * g + Math.abs(Math.sin(w)) * 0.1 * wk;
        hips.group.position.y += dy;
        torso.group.rotation.x = 0.1 * wk + 0.4 * g;
        for (let i = 0; i < legs.length; i++) {
          const ph = w + (i ? Math.PI : 0);
          poseLeg(legs[i]!, -dy, Math.sin(ph) * (0.35 * wk + 0.5 * g), Math.max(0, Math.cos(ph)) * (0.6 * wk + 0.8 * g));
        }
        poseArm(armR, -0.4 * wk + 0.6 * g, 0.15, 0.5 * wk + 0.2 * g);
        poseArm(armL, -0.4 * wk + 0.6 * g, 0.15, 0.5 * wk + 0.2 * g);
        head.group.rotation.x = -0.3 * g;
        for (const e of ears) e.group.rotation.x = -0.5 * g;
        poseTail(tail, T, 0.1 * wk + 0.05 * g, 4 + 4 * g);
        tail[0]!.group.rotation.x += -0.4 * g; // tail streams back in the glide
        scarf.group.rotation.x = -0.3 * g;
        break;
      }
      case "attack": {
        // chuẩn bị (0–.42) → vung liềm (impact .5) → phóng liềm gió (follow-through).
        const p = c.p;
        const wind = ramp(p, 0, 0.4) * (1 - ramp(p, 0.4, 0.5));
        const swing = ramp(p, 0.4, 0.56), recover = ramp(p, 0.62, 0.95);
        const lunge = ramp(p, 0.38, 0.5) * (1 - recover);
        const dy = -0.3 * wind - 0.3 * lunge, dz = -0.3 * wind + 0.8 * lunge;
        hips.group.position.y += dy;
        hips.group.position.z += dz;
        plant(legs, dy, -0.3 * wind);
        torso.group.rotation.x = 0.2 * lunge;
        torso.group.rotation.y = (0.5 * wind - 0.6 * swing) * (1 - recover);
        poseArm(armR, (-1.8 * wind + 1.6 * swing) * (1 - recover) - 0.3, (0.8 * wind) * (1 - recover), 0.6 * wind);
        poseArm(armL, -0.6, 0.25, 1.0);
        jaw.group.rotation.x = 0.3 * ramp(p, 0.42, 0.5) * (1 - ramp(p, 0.6, 0.8));
        for (const e of ears) e.group.rotation.x = -0.5 * (wind + lunge);
        poseTail(tail, T, 0.2 + 0.3 * swing * (1 - recover), 8);
        break;
      }
      case "skill": {
        // trụ vững (0–.2) → xoay lưỡi liềm (.2–.45) → lốc xoáy (.45–.65, impact .55) → hút về (.62–.82) → kết thúc.
        const p = c.p;
        const brace = win(p, 0, 0.9, 0.12);
        const spinUp = ramp(p, 0.2, 0.45), whirl = win(p, 0.45, 0.66, 0.04), pull = win(p, 0.62, 0.84, 0.05);
        const dy = -0.6 * brace;
        hips.group.position.y += dy;
        plant(legs, dy);
        // Tornado: the whole upper body spins one and a half turns about the vertical axis.
        torso.group.rotation.y = Math.PI * 3 * ramp(p, 0.42, 0.68);
        torso.group.rotation.x = 0.15 * brace - 0.1 * whirl;
        const blades = Math.sin(c.t * 24) * spinUp * (1 - pull);
        poseArm(armR, -1.2 * spinUp + 0.4 * pull, 1.2 * whirl + 0.3 * spinUp, 0.4 + 0.8 * pull, blades);
        poseArm(armL, -1.2 * spinUp + 0.4 * pull, 1.2 * whirl + 0.3 * spinUp, 0.4 + 0.8 * pull, -blades);
        head.group.rotation.x = -0.15 * whirl + 0.1 * pull;
        jaw.group.rotation.x = 0.3 * whirl + 0.2 * pull;
        for (const e of ears) e.group.rotation.x = -0.5 * (whirl + pull);
        poseTail(tail, T, 0.3 * whirl, 10);
        tail[0]!.group.rotation.y += Math.PI * 2 * whirl * 0.15;
        if (ring) ring.group.scale.setScalar(1 + 0.6 * whirl - 0.3 * pull);
        lid = Math.max(lid, 0.3 * brace);
        break;
      }
      case "hit": {
        // chặn đòn (sickles crossed) → bị đẩy lùi → lấy lại thế.
        const p = c.p;
        const k = ramp(p, 0, 0.12) * (1 - ramp(p, 0.45, 0.88));
        const shake = (1 - ramp(p, 0, 0.24)) * Math.sin(c.t * 70);
        const dy = -0.3 * k, dz = -0.7 * k;
        hips.group.position.y += dy;
        hips.group.position.z += dz;
        plant(legs, dy, dz);
        torso.group.rotation.x = -0.15 * k;
        poseArm(armR, -1.3 * k, -0.3 * k, 1.2 * k);
        poseArm(armL, -1.3 * k, -0.3 * k, 1.2 * k);
        head.group.rotation.y = shake * 0.12;
        lid = Math.max(lid, 0.8 * k + (p < 0.08 ? 1 : 0));
        for (const e of ears) e.group.rotation.x = 0.4 * k;
        poseTail(tail, T, 0.3 * k, 14);
        break;
      }
    }
    lids.group.scale.y = 0.05 + 0.95 * clamp01(lid);
  },

  death: {
    // quỳ gối (0–.3) → gục xuống (.25–.55) → tan vào gió (.7–1, rig shrink-out).
    seconds: 1.2,
    vanishAt: 0.7,
    pose(r: WeaselParts, c: DeathCtx) {
      const { hips, torso, head, lids, ears, arms, legs, tail } = r;
      const p = c.p;
      const kneel = ramp(p, 0, 0.3), slump = ramp(p, 0.25, 0.55);
      // Kneel: legs fold until the hips sit low; slump: the torso folds forward onto the folded legs.
      const drop = (LEG - 1.05) * kneel;
      hips.group.position.y -= drop;
      for (let i = 0; i < legs.length; i++) poseLeg(legs[i]!, drop);
      torso.group.rotation.x = 0.9 * slump;
      head.group.rotation.x = 0.3 * slump;
      for (let i = 0; i < arms.length; i++) poseArm(arms[i]!, -0.6 * slump, 0.5 * slump, 0.6 * slump);
      for (const e of ears) e.group.rotation.x = 0.6 * slump;
      lids.group.scale.y = 0.05 + 0.95 * Math.max(ramp(p, 0.3, 0.5), bell(p, 0, 0.08));
      for (let i = 0; i < tail.length; i++) tail[i]!.group.rotation.x = -0.25 * slump * (i === 0 ? 1 : 0.6);
    },
  },
});
