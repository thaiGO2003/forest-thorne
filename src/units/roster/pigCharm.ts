// Lợn Quyến Rũ (catalog id hippo_maul, kept for save compatibility) — bespoke rig from the "Lợn Quyến
// Rũ ♀" sheet. Chubby pink pig heroine with a huge magenta curly mane, a gold heart tiara, a pink snout,
// a winking smile, a gold-and-red heart bodice, a pink cape with white fur trim and a giant pink heart
// hammer with gold caps.
// Idle: stand firm → shoulder shrug → blow a heart · Combat idle: alert / guard / shield allies ·
// Move: step → run → sprint · Attack: wind up → swing → smash down (impact) · Skill: radiate aura →
// spreading hearts → charm (impact, wink) → damage cut → love shield · Hit: struck → slide back →
// steady · Death: falls → lies down → fades as hearts. 2★ gold hammer bands and pearl necklace; 3★
// glowing hammer heart, crown gems and extra floating hearts.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, type DeathCtx } from "../rig";
import { beats, blinkAt, clamp01, win } from "./beats";

const C = {
  skin: 0xf6b8b8, skinD: 0xe08a94, snout: 0xf08a9a, nostril: 0xa04a5a, hair: 0xe0407a, hairD: 0xb02a5a, gold: 0xf0b838,
  red: 0xc8203a, cape: 0xe85a8a, fur: 0xfaf2ea, eye: 0x3a1a20, blush: 0xff7aa0, boot: 0x7a3a2a, hammer: 0xf06a9a, heart: 0xff3a7a, pearl: 0xfff4f0,
};
const HIP_Y = 2.5;

interface Limb { part: Part; side: 1 | -1 }
interface Parts { hips: Part; torso: Part; head: Part; lidR: Part; lidL: Part; cape: Part; armR: Part; armL: Part; hammer: Part; hearts: Part; legs: Limb[] }

export default defineUnit<Parts>({
  id: "hippo_maul",
  motion: "ground",
  height: 11,
  durations: { idle: 4.5, attack: 0.95, skill: 1.8, hit: 0.5, move: 0.6 },
  impact: { attack: 0.6, skill: 0.6 },
  blend: 0.1,

  build(k, { star }) {
    const hips = k.part("hips", null, [0, HIP_Y, 0]);
    hips.box([0, 0, 0], [2.6, 1.0, 2.0], C.cape).box([0, -0.4, 0], [2.9, 0.5, 2.3], C.fur).box([0, 0.45, 0], [2.7, 0.25, 2.1], C.gold);
    const legs: Limb[] = ([1, -1] as const).map((side) => {
      const part = k.part(side > 0 ? "legR" : "legL", hips, [side * 0.7, -0.2, 0]);
      part.box([0, -0.9, 0], [1.0, 1.6, 1.0], C.skin).box([0, -1.95, 0.15], [1.15, 0.5, 1.35], C.boot).box([0, -1.6, 0], [1.1, 0.25, 1.1], C.gold);
      return { part, side };
    });
    const torso = k.part("torso", hips, [0, 0.4, 0]);
    torso.box([0, 1.1, 0], [2.8, 2.2, 2.0], C.skin).box([0, 1.0, 1.02], [2.0, 1.4, 0.1], C.red).box([0, 1.0, 1.08], [0.7, 0.6, 0.06], C.heart, { mat: "glow" })
      .pair([0.75, 1.75, 1.04], [0.7, 0.3, 0.06], C.gold).box([0, 0.3, 1.04], [2.2, 0.25, 0.06], C.gold).box([0, 2.25, 0], [2.6, 0.4, 2.0], C.fur);
    if (star >= 2) for (const x of [-0.6, -0.3, 0, 0.3, 0.6]) torso.box([x, 2.0 - Math.abs(x) * 0.3, 1.06], [0.18, 0.18, 0.1], C.pearl);
    const cape = k.part("cape", torso, [0, 2.2, -0.9]);
    cape.box([0, -1.2, -0.15], [3.0, 2.8, 0.2], C.cape).box([0, -2.6, -0.15], [3.2, 0.4, 0.4], C.fur).pair([1.55, -1.2, -0.15], [0.3, 2.8, 0.4], C.fur)
      .box([0, -1.0, -0.3], [0.8, 0.7, 0.08], C.heart);
    const head = k.part("head", torso, [0, 2.4, 0]);
    head.box([0, 1.3, 0], [3.2, 2.8, 2.8], C.skin).box([0, 0.8, 1.6], [1.4, 0.9, 0.5], C.snout).pair([0.3, 0.85, 1.86], [0.25, 0.35, 0.06], C.nostril)
      .pair([0.7, 1.55, 1.42], [0.45, 0.55, 0.06], C.eye).pair([1.1, 0.75, 1.42], [0.55, 0.3, 0.06], C.blush).box([0, 0.2, 1.42], [0.8, 0.2, 0.06], C.nostril)
      .pair([1.3, 2.7, 0.2], [0.7, 0.8, 0.4], C.skinD, { rot: [0, 0, -0.4] })
      .box([0, 2.95, -0.2], [3.6, 0.9, 3.0], C.hair).box([0, 2.0, -1.6], [3.8, 2.6, 1.0], C.hair).pair([1.8, 1.4, -0.6], [1.0, 2.4, 1.6], C.hairD)
      .pair([2.0, 0.2, -1.0], [1.2, 1.4, 1.4], C.hair).box([0, 0.4, -2.0], [3.0, 1.8, 1.0], C.hairD).box([0.8, 3.5, 0.6], [1.0, 0.7, 1.0], C.hairD)
      .box([0, 3.5, 1.1], [2.0, 0.35, 0.3], C.gold).box([0, 3.85, 1.15], [0.6, 0.55, 0.2], C.heart, { mat: star >= 3 ? "glow" : "solid" });
    if (star >= 3) head.pair([0.7, 3.75, 1.2], [0.25, 0.3, 0.12], C.heart, { mat: "glow" });
    const lidR = k.part("lidR", head, [0.7, 1.6, 1.46]);
    lidR.box([0, -0.25, 0], [0.5, 0.6, 0.06], C.skin);
    const lidL = k.part("lidL", head, [-0.7, 1.6, 1.46]);
    lidL.box([0, -0.25, 0], [0.5, 0.6, 0.06], C.skin);
    const arm = (side: 1 | -1) => {
      const p = k.part(side > 0 ? "armR" : "armL", torso, [side * 1.55, 1.9, 0]);
      p.box([side * 0.2, -0.75, 0], [0.85, 1.5, 0.85], C.skin).box([side * 0.2, -1.1, 0], [0.95, 0.3, 0.95], C.gold).box([side * 0.2, -1.7, 0.05], [0.85, 0.7, 0.85], C.skin);
      return p;
    };
    const armR = arm(1), armL = arm(-1);
    const hammer = k.part("hammer", armR, [0.2, -1.75, 0.2]);
    hammer.box([0, 0.9, 0], [0.35, 2.6, 0.35], C.boot).box([0, 2.5, 0], [1.6, 1.4, 2.3], C.hammer).pair([0, 2.5, 1.2], [1.7, 1.5, 0.25], C.gold)
      .box([0.82, 2.5, 0], [0.08, 0.8, 0.9], C.heart, { mat: star >= 3 ? "glow" : "solid" }).box([-0.82, 2.5, 0], [0.08, 0.8, 0.9], C.heart, { mat: star >= 3 ? "glow" : "solid" });
    if (star >= 2) hammer.box([0, 1.3, 0], [0.45, 0.25, 0.45], C.gold).box([0, 0.0, 0], [0.45, 0.3, 0.45], C.gold);
    const hearts = k.part("hearts", hips, [0, 2.2, 0]);
    const spots = star >= 3 ? 6 : 4;
    for (let i = 0; i < spots; i++) {
      const a = (i / spots) * Math.PI * 2;
      hearts.box([Math.cos(a) * 2.4, 0.4 * Math.sin(i * 2.1), Math.sin(a) * 2.4], [0.5, 0.45, 0.2], C.heart, { mat: "glow", rot: [0, -a, 0] });
    }
    return { hips, torso, head, lidR, lidL, cape, armR, armL, hammer, hearts, legs };
  },

  pose(r, c) {
    const { hips, torso, head, lidR, lidL, cape, armR, armL, hammer, hearts, legs } = r;
    const T = c.time;
    const blink = blinkAt(T, c.sig);
    let wink = 0, lid = blink, show = 0;
    const stride = (w: number, amp: number) => { for (const l of legs) l.part.group.rotation.x = Math.sin(w + (l.side > 0 ? 0 : Math.PI)) * amp; };
    // Rest: hammer propped on the right shoulder.
    armR.group.rotation.x = -0.4;
    hammer.group.rotation.x = 0.1;
    cape.group.rotation.x = -Math.abs(Math.sin(T * 1.6)) * 0.08;
    hearts.group.rotation.y = T * 1.2;

    switch (c.state) {
      case "idle": {
        if (c.combat) {
          const [alert, guard, shield] = beats(T, c.sig, 0x91a7);
          head.group.rotation.y = Math.sin(T * 0.9 + c.sig * 3) * 0.25 * alert;
          armR.group.rotation.x = -0.4 - 0.5 * guard;
          hammer.group.rotation.x = 0.1 + 0.9 * guard;
          armL.group.rotation.x = -0.9 * shield;
          show = 0.6 * shield;
        } else {
          // stand firm (0–.35) → shrug (.35–.65) → blow a heart (.65–1).
          const ph = c.p % 1;
          const shrug = win(ph, 0.35, 0.65, 0.05), kiss = win(ph, 0.65, 1, 0.05);
          torso.group.scale.y = 1 + Math.sin(T * 1.8) * 0.02;
          torso.group.position.y += 0.15 * shrug * Math.abs(Math.sin(c.t * 6));
          armL.group.rotation.x = -1.6 * kiss + 0.6 * kiss * ramp(ph, 0.85, 0.95);
          head.group.rotation.z = 0.12 * kiss;
          wink = kiss;
          show = 0.5 * ramp(ph, 0.85, 0.95) * kiss;
        }
        break;
      }
      case "move": {
        const g = c.combat ? 1 : ramp(c.p, 0.8, 1.8);
        const w = T * (9 + 4 * g);
        stride(w, 0.45 + 0.15 * g);
        hips.group.position.y += Math.abs(Math.sin(w)) * 0.2;
        torso.group.rotation.x = 0.12 + 0.15 * g;
        armL.group.rotation.x = -Math.sin(w) * 0.5;
        cape.group.rotation.x = -0.25 * g;
        break;
      }
      case "attack": {
        // wind up overhead (0–.45) → swing (.45–.6, impact .6) → smash held → recover.
        const p = c.p;
        const up = ramp(p, 0, 0.45), down = ramp(p, 0.45, 0.6), back = ramp(p, 0.78, 1);
        armR.group.rotation.x = -0.4 - 2.0 * up * (1 - down) - 0.3 * down * (1 - back);
        hammer.group.rotation.x = 0.1 - 0.7 * up * (1 - down) + 2.3 * down * (1 - back);
        torso.group.rotation.x = -0.15 * up * (1 - down) + 0.25 * down * (1 - back);
        hips.group.position.y += -0.05 * down * (1 - back);
        break;
      }
      case "skill": {
        // aura (0–.25) → hearts spread (.2–.55) → charm wink (impact .6) → damage cut → love shield.
        const p = c.p;
        const aura = win(p, 0, 0.95, 0.08), spread = win(p, 0.2, 0.95, 0.06), charm = win(p, 0.5, 0.75, 0.04), guard = win(p, 0.72, 1, 0.06);
        armL.group.rotation.x = -1.5 * spread * (1 - guard) - 0.8 * guard;
        armL.group.rotation.z = -0.6 * spread;
        torso.group.rotation.z = 0.1 * charm;
        hips.group.position.y += 0.15 * aura;
        armR.group.rotation.x = -0.4 - 0.4 * guard;
        hammer.group.rotation.x = 0.1 + 1.0 * guard;
        wink = charm;
        show = spread;
        hearts.group.rotation.y = c.t * 3;
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
    hearts.group.scale.setScalar(0.001 + clamp01(show));
    lidR.group.scale.y = 0.05 + 0.95 * clamp01(lid);
    lidL.group.scale.y = 0.05 + 0.95 * clamp01(Math.max(lid, wink));
  },

  death: {
    // Ngã xuống (0–.4) → gục on her back (.3–.6) → tan biến thành trái tim (.7–1, shrink-out).
    seconds: 1.2,
    vanishAt: 0.7,
    pose(r: Parts, c: DeathCtx) {
      const { hips, torso, head, lidR, lidL, legs, armR, armL, hammer, hearts } = r;
      const p = c.p;
      const fold = ramp(p, 0, 0.3), fall = ramp(p, 0.12, 0.42), lie = ramp(p, 0.2, 0.55);
      hips.group.position.y += -1.5 * fall + bell(p, 0.4, 0.5) * 0.12;
      for (const l of legs) l.part.group.rotation.x = -1.4 * fold;
      torso.group.rotation.x = -1.1 * lie;
      armR.group.rotation.z = 0.7 * lie;
      armL.group.rotation.z = -0.7 * lie;
      hammer.group.rotation.x = 0.6 * lie;
      head.group.rotation.x = 0.3 * lie;
      hearts.group.scale.setScalar(0.001 + ramp(p, 0.55, 0.7));
      const shut = 0.05 + 0.95 * Math.max(ramp(p, 0.25, 0.45), bell(p, 0, 0.08));
      lidR.group.scale.y = shut;
      lidL.group.scale.y = shut;
    },
  },
});
