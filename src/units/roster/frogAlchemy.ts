// Ếch Giả Kim (frog_alchemy) — bespoke rig authored from the Mganga alchemist kit.
// Slim upright emerald frog: long folded hind legs, wide gold eyes, cream throat sac, glass flask.
// Idle: breathe/blink/throat flutter/flask swirl · Move: two-hop lope · Attack: vial throw
// · Skill: flask raised, vapor gathers, wide poison spray · Hit: recoil.
// 2★ adds a leather bandolier with three glowing vials; 3★ adds a glass toxin circlet + orbiting vapor.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, strike } from "../rig";

const C = {
  green: 0x35c46b, greenD: 0x1d8a4a, greenL: 0x74e6a0, belly: 0xd9f6c9, spot: 0x14663a,
  yellow: 0xffd84a, amber: 0xef9f1c, ink: 0x101c14, white: 0xf4fff8, mouth: 0xd95c86,
  glass: 0xbfe9ff, toxin: 0x9dff3c, toxinD: 0x4fd10a,
  leather: 0x6b4226, leatherD: 0x3b2414, cork: 0xa9793f,
};

interface FrogParts {
  body: Part; hips: Part; torso: Part; head: Part; jaw: Part; lids: Part; throat: Part;
  armL: Part; armR: Part; legL: Part; legR: Part; flask: Part;
  vials: Part[]; wisps: Part[]; crown: Part | null;
}

const ARM_REST: [number, number, number] = [2.15, 3.5, 0.4];
const LEG_REST: [number, number, number] = [2.1, 2.6, -0.5];

export default defineUnit<FrogParts>({
  id: "frog_alchemy",
  motion: "ground",
  height: 9,
  durations: { idle: 4, attack: 0.85, skill: 1.8, hit: 0.5, move: 0.75 },
  impact: { attack: 0.5, skill: 0.58 },

  build(k, { star }) {
    const body = k.part("body");
    const hips = k.part("hips", body, [0, 2.4, 0]);
    hips.box([0, 0.1, 0], [4.4, 1.5, 3.0], C.greenD)
      .box([0, -0.5, 0.7], [3.4, 0.8, 2.0], C.belly);

    // Slim torso: narrow chest, soft belly, darker shoulder shelf.
    const torso = k.part("torso", body, [0, 2.4, 0]);
    torso.box([0, 1.9, 0], [4.4, 4.4, 3.2], C.green)
      .box([0, 1.7, 1.55], [3.2, 3.0, 0.5], C.belly)
      .box([0, 3.9, -0.1], [4.6, 0.7, 3.0], C.greenD)
      .spots([0, 1.9, 0], [4.4, 4.4, 3.2], C.spot, 16, 7, 0.85);

    const head = k.part("head", torso, [0, 4.0, 0.3]);
    head.box([0, 0.7, 0], [4.6, 2.0, 3.4], C.green)
      .box([0, 1.6, -0.1], [4.8, 0.5, 3.2], C.greenD)
      .pair([0.55, 0.3, 1.78], [0.28, 0.22, 0.14], C.ink) // nostrils
      .pair([1.35, 1.55, 0.85], [1.55, 1.55, 1.55], C.yellow) // wide gold eyes
      .pair([1.35, 1.62, 1.64], [0.85, 0.85, 0.14], C.ink) // slit pupils
      .pair([1.18, 1.9, 1.72], [0.3, 0.3, 0.1], C.white) // glints
      .pair([1.4, 2.32, 1.0], [1.7, 0.5, 1.3], C.greenD, { rot: [0, 0, -0.22] }) // heavy brows
      .spots([0, 0.7, 0], [4.6, 2.0, 3.0], C.spot, 6, 19, 0.8);

    const jaw = k.part("jaw", head, [0, -0.15, -0.3]);
    jaw.box([0, -0.25, 1.15], [4.2, 0.7, 3.0], C.greenL)
      .box([0, 0.05, 1.25], [3.4, 0.2, 2.3], C.mouth)
      .box([0, 0.12, 0.5], [1.6, 0.24, 1.4], C.mouth); // tongue root

    const lids = k.part("lids", head, [0, 2.25, 0.9]);
    lids.pair([1.35, -0.6, 0], [1.7, 1.55, 1.7], C.greenD);

    // Cream vocal sac under the jaw — the frog's breathing tell.
    const throat = k.part("throat", head, [0, -0.35, 1.45]);
    throat.box([0, 0, 0.1], [2.7, 1.15, 1.0], C.belly)
      .box([0, -0.2, 0.5], [1.7, 0.5, 0.5], C.mouth);

    const arm = (side: 1 | -1) => {
      const a = k.part(side > 0 ? "armR" : "armL", torso, [side * ARM_REST[0], ARM_REST[1], ARM_REST[2]]);
      a.box([0, -0.8, 0.1], [1.0, 2.0, 1.0], C.green)
        .box([0, -2.0, 0.7], [0.85, 1.6, 0.85], C.greenL, { rot: [-0.45, 0, 0] })
        .box([0, -2.75, 1.3], [1.15, 0.6, 1.15], C.greenD);
      for (const dx of [-0.35, 0, 0.35]) a.box([dx, -2.9, 1.75], [0.24, 0.28, 0.42], C.belly);
      return a;
    };

    const leg = (side: 1 | -1) => {
      const l = k.part(side > 0 ? "legR" : "legL", body, [side * LEG_REST[0], LEG_REST[1], LEG_REST[2]]);
      l.box([0, -0.8, 0.1], [1.7, 2.2, 2.6], C.green)
        .spots([0, -0.8, 0.1], [1.7, 2.2, 2.6], C.spot, 4, side > 0 ? 41 : 53, 0.7)
        .box([0, -1.5, -0.8], [1.3, 1.7, 1.4], C.greenD, { rot: [0.5, 0, 0] })
        .box([0, -2.35, 1.0], [1.9, 0.5, 3.0], C.greenD); // webbed foot
      for (const dx of [-0.6, 0, 0.6]) l.box([dx, -2.4, 2.5], [0.34, 0.4, 0.5], C.belly);
      return l;
    };

    const armR = arm(1);
    const armL = arm(-1);

    // Glass flask: round-bottom body, neck, cork, glowing brew inside.
    const flask = k.part("flask", armR, [0, -3.35, 1.55]);
    flask.box([0, 0, 0], [1.45, 1.3, 1.45], C.glass, { mat: "glass" })
      .box([0, 0.15, 0], [1.05, 1.7, 1.05], C.glass, { mat: "glass" })
      .box([0, 1.1, 0], [0.5, 0.6, 0.5], C.glass, { mat: "glass" })
      .box([0, 1.5, 0], [0.68, 0.35, 0.68], C.cork)
      .box([0, -0.1, 0], [1.02, 0.75, 1.02], C.toxin, { mat: "glow" });

    // 2★: leather bandolier with three stoppered vials across the chest.
    const vials = star >= 2
      ? [-1.25, 0, 1.25].map((x, i) => {
        const v = k.part(`vial${i}`, torso, [x, 2.5 - Math.abs(x) * 0.35, 1.5]);
        v.box([0, 0, 0], [0.62, 1.1, 0.62], C.glass, { mat: "glass" })
          .box([0, -0.1, 0], [0.5, 0.55, 0.5], i === 1 ? C.toxinD : C.toxin, { mat: "glow" })
          .box([0, 0.62, 0], [0.4, 0.22, 0.4], C.cork);
        return v;
      })
      : [];
    if (star >= 2) {
      torso.box([0, 2.7, 0.55], [4.7, 0.7, 1.1], C.leather, { rot: [0, 0, 0.62] })
        .box([-2.1, 3.4, 0.3], [0.5, 1.4, 0.9], C.leatherD);
    }

    // 3★: glass toxin circlet with three glowing drops.
    let crown: Part | null = null;
    if (star >= 3) {
      crown = k.part("crown", head, [0, 2.5, 0]);
      crown.box([0, 0, 0], [3.1, 0.35, 3.1], C.glass, { mat: "glass" })
        .pair([0, 0.04, 1.5], [3.1, 0.28, 0.36], C.toxin, { mat: "glow" })
        .pair([1.5, 0.04, 0], [0.36, 0.28, 3.1], C.toxin, { mat: "glow" });
      for (const [x, z, h] of [[-1.0, 0.4, 1.0], [0, -0.6, 1.3], [1.05, 0.3, 0.9]] as const) {
        crown.box([x, 0.3 + h / 2, z], [0.5, h, 0.5], C.glass, { mat: "glass" })
          .box([x, 0.3 + h * 0.35, z], [0.4, 0.3, 0.4], C.toxin, { mat: "glow" });
      }
    }

    // 3★: vapor wisps orbit the chest and follow the flask while casting.
    const wisps = star >= 3
      ? [0, 1, 2].map((i) => {
        const w = k.part(`wisp${i}`, torso, [0, 3.6, 0.4]);
        w.box([0, 0, 0], [0.42, 0.42, 0.42], C.toxin, { mat: "glow" })
          .box([0, 0, 0], [0.24, 0.24, 0.24], C.toxinD, { mat: "glow" });
        return w;
      })
      : [];

    return {
      body, hips, torso, head, jaw, lids, throat,
      armL, armR, legL: leg(-1), legR: leg(1), flask, vials, wisps, crown,
    };
  },

  pose(r, c) {
    const { body, torso, head, jaw, throat, lids, armL, armR, flask } = r;
    const slow = c.time * (0.85 + c.sig * 0.3);
    const blink = (c.time * 0.29 + c.sig * 5) % 3.6;
    lids.group.scale.y = blink < 0.13 || c.state === "hit" ? 1 : 0.06;

    // Signature: the brew never settles — wisps orbit faster while casting, vials pulse.
    const swirl = c.state === "skill" ? 9 : 2.2;
    r.wisps.forEach((w, i) => {
      const a = c.time * swirl + i * 2.09;
      w.group.position.set(Math.cos(a) * 2.6, 3.6 + Math.sin(a * 1.3) * 0.7, Math.sin(a) * 1.5 + 0.4);
      w.group.rotation.y = a;
    });
    r.vials.forEach((v, i) => v.group.scale.setScalar(1 + Math.sin(c.time * 2.4 + i * 1.9) * 0.05));
    if (r.crown) r.crown.group.rotation.y = c.time * 0.55;

    switch (c.state) {
      case "idle": {
        const crouch = c.combat ? 0.4 : 0;
        body.group.position.y = -crouch;
        torso.group.scale.set(1, 1 + Math.sin(slow * 2) * 0.025 - crouch * 0.05, 1);
        torso.group.rotation.x = c.combat ? 0.07 : Math.sin(slow * 0.8) * 0.03;
        head.group.rotation.x = c.combat ? -0.07 : Math.sin(slow * 0.9 + 1) * 0.05;
        head.group.rotation.y = c.combat ? 0.12 : Math.sin(slow * 0.6) * 0.14;
        const puff = c.combat ? 0.12 + Math.sin(c.time * 3.1) * 0.04 : bell((slow * 0.24) % 1, 0.5, 0.92) * 0.5;
        throat.group.scale.set(1 + puff * 0.35, 1 + puff, 1 + puff * 0.8);
        jaw.group.rotation.x = c.combat ? 0.07 : 0;
        armR.group.rotation.x = c.combat ? -0.4 : -0.08;
        armL.group.rotation.x = c.combat ? -0.12 : 0.05;
        flask.group.rotation.z = Math.sin(c.time * 1.4) * 0.09;
        flask.group.rotation.x = Math.sin(c.time * 1.1 + 0.6) * 0.06;
        break;
      }
      case "move": {
        // Two low lopes per cycle: folded legs drive, arms counter-swing, flask bounces.
        const hop = (c.p * 2) % 1, air = bell(hop, 0.08, 0.78);
        body.group.position.y = air * 2.2;
        body.group.rotation.x = -air * 0.2 + bell(hop, 0.72, 1) * 0.1;
        torso.group.scale.set(1, 1 - bell(hop, 0.8, 1) * 0.1 + air * 0.04, 1);
        r.legL.group.rotation.x = r.legR.group.rotation.x = -air * 1.0;
        r.legL.group.position.z = r.legR.group.position.z = LEG_REST[2] - air * 1.1;
        armL.group.rotation.x = armR.group.rotation.x = -air * 0.5;
        flask.group.rotation.x = air * 0.35;
        throat.group.scale.set(1, 1 + air * 0.2, 1);
        break;
      }
      case "attack": {
        // Wind up behind the shoulder → snap the flask forward and pour a bolt at impact → recover.
        const s = strike(c.p, 0.5);
        armR.group.rotation.x = -s * 1.4;
        armR.group.rotation.z = -Math.max(0, s) * 0.2;
        armL.group.rotation.x = -s * 0.45;
        head.group.rotation.x = -Math.max(0, s) * 0.26;
        jaw.group.rotation.x = Math.max(0, s) * 0.6;
        flask.group.rotation.x = -Math.max(0, s) * 0.95;
        body.group.rotation.x = -Math.max(0, s) * 0.07;
        throat.group.scale.set(1, 1 + Math.max(0, s) * 0.25, 1);
        break;
      }
      case "skill": {
        // Mây Độc: gather vapor overhead → wide sweeping spray of three separate clouds → settle.
        const gather = ramp(c.p, 0, 0.42), spray = bell(c.p, 0.5, 0.96);
        armR.group.rotation.x = -0.9 - gather * 1.15 + spray * 0.95;
        armR.group.rotation.z = -0.22 - gather * 0.18;
        armL.group.rotation.x = -0.35 - gather * 0.5;
        head.group.rotation.x = -gather * 0.3 + spray * 0.22;
        head.group.rotation.y = Math.sin(c.p * 16) * spray * 0.24;
        jaw.group.rotation.x = spray * 0.8;
        flask.group.scale.setScalar(1 + gather * 0.35 - spray * 0.12);
        flask.group.rotation.x = gather * 0.4 - spray * 1.25;
        body.group.position.y = gather * 0.5;
        body.group.rotation.x = -gather * 0.12 + spray * 0.1;
        throat.group.scale.set(1 + spray * 0.4, 1 + spray * 0.55, 1 + spray * 0.35);
        break;
      }
      case "hit": {
        const k = bell(c.p, 0, 1);
        body.group.rotation.x = -k * 0.28;
        body.group.position.z = -k * 0.8;
        torso.group.scale.set(1 + k * 0.06, 1 - k * 0.1, 1);
        head.group.rotation.x = k * 0.3;
        jaw.group.rotation.x = k * 0.32;
        armR.group.rotation.x = k * 0.5;
        flask.group.rotation.z = k * 0.6;
        break;
      }
    }
  },
});
