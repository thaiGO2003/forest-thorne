// Combat playback (§16.13, A16, A90.1, A112, A119): turns an already-resolved canonical CombatEvent
// stream into staged presentation — anticipation, melee approach / projectile flight, impact at the
// semantic moment, floating numbers, statuses, death. It never resolves combat; HP shown here is
// the canonical event values replayed in order.
import * as THREE from "three";
import { getUnit } from "../content/catalog";
import type { CombatEvent } from "../core/combat";
import { ICONS } from "../core/emojiIcon";
import type { BillboardStatus } from "./billboard";
import type { BoardView } from "./boardView";
import type { CombatFx } from "./fx";

export interface RosterEntry { uid: string; baseId: string; star: number; side: "L" | "R"; hp: number; maxHp: number; rage: number; rageMax: number; shield: number }

export interface PlaybackTick { cycle: number; queue: string[]; log: string[]; alive: Record<"L" | "R", RosterEntry[]>; all: RosterEntry[] }

export interface CombatPlayer {
  setSpeed(s: number): void;
  /** Resolves when the last event has finished presenting. */
  done: Promise<void>;
  dispose(): void;
}

const POSITIVE = new Set(["shield", "regen", "atkUp", "defUp", "haste", "immune", "reflect"]);
const ELEMENT_FX: Record<string, number> = { FIRE: 0xff8a3a, TIDE: 0x5ab8ff, WIND: 0xd8f6ff, STONE: 0xc8a070, NIGHT: 0x9a6aff, SPIRIT: 0xfff0a0, SWARM: 0xb6ff4a, WOOD: 0x7fd65a };
const BASE_STEP = 0.5, LOG_CAP = 12;

export function playCombat(o: {
  board: BoardView; fx: CombatFx; roster: RosterEntry[]; events: CombatEvent[];
  onFrame: (fn: (dt: number) => void) => () => void; onTick: (t: PlaybackTick) => void;
}): CombatPlayer {
  const { board, fx } = o;
  const units = new Map(o.roster.map((r) => [r.uid, { ...r, statuses: [] as BillboardStatus[] }]));
  const log: string[] = [];
  // LOGIC: `cycle` must come from canonical combat (queue pass markers); the event stream lacks them yet.
  let speed = 1, wait = 0.4, i = 0, finished = false;
  const cycle = 1;
  const { promise, resolve } = Promise.withResolvers<void>();
  let delayId = 0;
  const delays = new Map<number, { t: number; fn: () => void }>();
  const after = (sec: number, fn: () => void) => { delays.set(++delayId, { t: sec, fn }); };

  const name = (uid: string) => { const u = units.get(uid); return u ? getUnit(u.baseId).nameVi : uid; };
  const anchor = (uid: string) => {
    const v = board.visual(uid), p = new THREE.Vector3();
    v?.anchor.getWorldPosition(p);
    return p;
  };
  const chest = (uid: string) => { const v = board.visual(uid), p = new THREE.Vector3(); v?.root.getWorldPosition(p); p.y += 0.45; return p; };
  const push = (uid: string) => {
    const u = units.get(uid);
    if (u) board.setLive(uid, { hp: u.hp, maxHp: u.maxHp, rage: u.rage, rageMax: u.rageMax, statuses: u.statuses });
  };
  const say = (line: string) => { log.push(line); if (log.length > LOG_CAP) log.shift(); };
  const tick = () => {
    const all = [...units.values()];
    const queue = o.events.slice(i).flatMap((e) => ("src" in e && (e.t === "basic" || e.t === "skill" || e.t === "cast") ? [e.src] : [])).filter((s, k, a) => a.indexOf(s) === k).slice(0, 8);
    o.onTick({ cycle, queue, log, all, alive: { L: all.filter((u) => u.side === "L" && u.hp > 0), R: all.filter((u) => u.side === "R" && u.hp > 0) } });
  };

  /** Apply one damage-bearing hit at its semantic impact moment. */
  const land = (src: string, dst: string, dmg: number, absorbed: number, crit: boolean) => {
    const u = units.get(dst), s = units.get(src);
    if (!u) return;
    u.shield = Math.max(0, u.shield - absorbed);
    u.hp = Math.max(0, u.hp - dmg);
    if (dmg > 0) {
      const v = board.visual(dst);
      v?.play("hit");
      if (v && s) fx.jolt(v.root, board.visual(src)?.root.position.x ?? 0, 1); // dt already speed-scaled
    }
    fx.float(anchor(dst), dmg > 0 ? `-${dmg}${crit ? "!" : ""}` : absorbed ? `🛡️${absorbed}` : "0", crit ? "crit" : "damage");
    fx.burst(chest(dst), ELEMENT_FX[s ? getUnit(s.baseId).element : ""] ?? 0xffffff);
    push(dst);
  };

  /** Present one event; returns seconds until the next event may start. */
  const present = (e: CombatEvent): number => {
    switch (e.t) {
      case "basic": {
        const s = units.get(e.src), v = board.visual(e.src);
        if (!s || !v) { land(e.src, e.dst, e.dmg, e.absorbed, e.crit); return BASE_STEP; }
        const def = getUnit(s.baseId), ranged = def.stats.range >= 2;
        say(`${name(e.src)} ${ICONS.atk} ${name(e.dst)} -${e.dmg}`);
        if (ranged) {
          v.play("attack", { onImpact: () => fx.shot(chest(e.src), chest(e.dst), ELEMENT_FX[def.element] ?? 0xffffff, 0.32, () => land(e.src, e.dst, e.dmg, e.absorbed, e.crit)) });
          return 1.0;
        }
        // Melee: approach to contact, strike, return — damage commits on contact (A16).
        const home = v.root.position.clone(), target = board.visual(e.dst)?.root.position.clone() ?? home;
        const contact = home.clone().lerp(target, 0.72);
        v.play("move");
        approach(v.root, home, contact, 0.28, () => v.play("attack", {
          onImpact: () => land(e.src, e.dst, e.dmg, e.absorbed, e.crit),
          onDone: () => approach(v.root, contact, home, 0.24, () => {}),
        }));
        return 1.35;
      }
      case "cast": {
        const s = units.get(e.src);
        board.visual(e.src)?.play("skill");
        if (s) { s.rage = 0; push(e.src); }
        fx.float(anchor(e.src), `✨ ${s ? getUnit(s.baseId).skill.nameVi : ""}`, "status");
        say(`${name(e.src)} ✨ ${s ? getUnit(s.baseId).skill.nameVi : ""}`);
        return 0.75;
      }
      case "skill": land(e.src, e.dst, e.dmg, e.absorbed, e.crit); return 0.22;
      case "miss": fx.float(anchor(e.dst), "MISS", "miss"); board.visual(e.src)?.play("attack"); say(`${name(e.src)} → ${name(e.dst)} MISS`); return 0.7;
      case "dot": {
        const u = units.get(e.dst);
        if (u) { u.hp = Math.max(0, u.hp - e.dmg); push(e.dst); }
        fx.float(anchor(e.dst), `${ICONS[e.kind as keyof typeof ICONS] ?? ""}-${e.dmg}`, "dot");
        return 0.3;
      }
      case "heal": {
        const u = units.get(e.dst);
        if (u) { u.hp = Math.min(u.maxHp, u.hp + e.amount); push(e.dst); }
        fx.float(anchor(e.dst), `+${e.amount}`, "heal");
        fx.burst(chest(e.dst), 0x7cf06a);
        return 0.3;
      }
      case "shield": {
        const u = units.get(e.dst);
        if (u) u.shield += e.amount;
        fx.float(anchor(e.dst), `🛡️+${e.amount}`, "shield");
        return 0.3;
      }
      case "status": {
        const u = units.get(e.dst);
        if (u) {
          u.statuses = u.statuses.filter((s) => s.key !== e.kind);
          if (e.turns > 0) u.statuses.push({ key: e.kind, positive: POSITIVE.has(e.kind) });
          push(e.dst);
        }
        if (e.turns > 0) fx.float(anchor(e.dst), ICONS[e.kind as keyof typeof ICONS] ?? e.kind, "status");
        return 0.25;
      }
      case "revive": {
        const u = units.get(e.dst);
        if (u) { u.hp = e.hp; push(e.dst); }
        fx.float(anchor(e.dst), `✨+${e.hp}`, "heal");
        return 0.6;
      }
      case "skip": fx.float(anchor(e.src), ICONS[e.reason as keyof typeof ICONS] ?? "💤", "status"); return 0.45;
      case "death": {
        const u = units.get(e.dst);
        if (u) { u.hp = 0; u.statuses = []; push(e.dst); }
        board.visual(e.dst)?.die();
        say(`💀 ${name(e.dst)}`);
        return 0.55;
      }
      default:
        // Canonical logic can emit event kinds that have no dedicated presentation yet.
        return BASE_STEP;
    }
  };

  // Tweened root moves (presentation staging only; canonical cells never change). Durations are in
  // combat time: the frame loop already scales dt by speed.
  const moves: { root: THREE.Object3D; a: THREE.Vector3; b: THREE.Vector3; t: number; dur: number; done: () => void }[] = [];
  function approach(root: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, dur: number, done: () => void) {
    moves.push({ root, a: a.clone(), b: b.clone(), t: 0, dur, done });
  }

  const off = o.onFrame((rawDt) => {
    const dt = Math.min(rawDt, 0.1) * speed;
    fx.update(dt);
    for (let k = moves.length - 1; k >= 0; k--) {
      const m = moves[k]!;
      m.t += dt;
      const p = Math.min(1, m.t / m.dur), e = p * p * (3 - 2 * p);
      m.root.position.lerpVectors(m.a, m.b, e);
      if (p >= 1) { moves.splice(k, 1); m.done(); }
    }
    for (const [id, d] of delays) if ((d.t -= dt) <= 0) { delays.delete(id); d.fn(); }
    if (finished) return;
    if ((wait -= dt) > 0) return;
    if (i >= o.events.length) {
      finished = true;
      after(0.8, () => resolve());
      return;
    }
    wait = present(o.events[i++]!);
    tick();
  });
  tick();

  return {
    setSpeed(s) { speed = Math.max(0.25, s); },
    done: promise,
    dispose() { off(); delays.clear(); moves.length = 0; resolve(); },
  };
}
