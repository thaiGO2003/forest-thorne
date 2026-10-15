// Replay the canonical event stream; combatStaging/gameSpeed own basic movement timing.
import * as THREE from "three";
import { getUnit } from "../content/catalog";
import type { CombatEvent, CombatInspectionFrame, CombatUnitSnapshot } from "../core/combat";
import { stageBasicCombatEvent } from "../core/combatStaging";
import { normalizeGameSpeedLevel, scaleCombatPresentationMs } from "../core/gameSpeed";
import { ICONS } from "../core/emojiIcon";
import type { BillboardStatus } from "./billboard";
import type { BoardView } from "./boardView";
import type { CombatFx } from "./fx";
export interface RosterEntry { uid: string; baseId: string; star: number; side: "L" | "R"; hp: number; maxHp: number; rage: number; rageMax: number; shield: number; inspection?: CombatUnitSnapshot }
export interface PlaybackTick { cycle: number; queue: string[]; log: string[]; alive: Record<"L" | "R", RosterEntry[]>; all: RosterEntry[] }
export interface CombatPlayer { setSpeed(level: number): void; done: Promise<void>; dispose(): void }
const POSITIVE = new Set(["shield", "regen", "atkUp", "defUp", "haste", "immune", "reflect"]);
export function playCombat(o: {
  board: BoardView; fx: CombatFx; roster: RosterEntry[]; events: CombatEvent[];
  onFrame: (fn: (dt: number) => void) => () => void; onTick: (tick: PlaybackTick) => void;
  onEvent?: (event: CombatEvent) => void;
  inspectionFrames?: CombatInspectionFrame[];
}): CombatPlayer {
  const { board, fx } = o;
  const units = new Map(o.roster.map((unit) => [unit.uid, { ...unit, inspection: unit.inspection ? structuredClone(unit.inspection) : undefined, statuses: [] as BillboardStatus[] }]));
  const log: string[] = [];
  const timers: { remaining: number; run: () => void }[] = [];
  const moves: { root: THREE.Object3D; from: THREE.Vector3; to: THREE.Vector3; elapsed: number; duration: number }[] = [];
  let speedLevel = 0, wait = 0, index = 0, disposed = false, complete = false;
  let pendingActions = 0;
  let inspectionIndex = 0, cycle = 1;
  const { promise, resolve } = Promise.withResolvers<void>();
  const after = (ms: number, run: () => void) => { if (ms <= 0) run(); else timers.push({ remaining: ms, run }); };
  const position = (uid: string) => {
    const result = new THREE.Vector3(); board.visual(uid)?.anchor.getWorldPosition(result); return result;
  };
  const push = (uid: string) => {
    const unit = units.get(uid);
    if (unit) board.setLive(uid, { hp: unit.hp, maxHp: unit.maxHp, rage: unit.rage, rageMax: unit.rageMax, statuses: unit.statuses });
  };
  const name = (uid: string) => { const unit = units.get(uid); return unit ? getUnit(unit.baseId).nameVi : uid; };
  const tick = () => {
    const all = [...units.values()];
    const queue = o.events.slice(index).flatMap((event) => "src" in event ? [event.src] : []).filter((uid, i, all) => all.indexOf(uid) === i).slice(0, 8);
    o.onTick({ cycle, queue, log: [...log], all, alive: { L: all.filter((unit) => unit.side === "L" && unit.hp > 0), R: all.filter((unit) => unit.side === "R" && unit.hp > 0) } });
  };
  const syncInspection = () => {
    const frames = o.inspectionFrames ?? [];
    let changed = false;
    while (inspectionIndex < frames.length && frames[inspectionIndex].eventIndex <= index) {
      const frame = frames[inspectionIndex++];
      cycle = frame.cycle;
      for (const snapshot of frame.units) {
        const unit = units.get(snapshot.uid);
        if (!unit) continue;
        unit.inspection = snapshot;
        unit.hp = snapshot.hp; unit.maxHp = snapshot.maxHp; unit.rage = snapshot.rage;
        unit.rageMax = snapshot.rageMax; unit.shield = snapshot.shield;
        unit.statuses = Object.entries(snapshot.status).filter(([, status]) => status.turns > 0)
          .map(([key]) => ({ key, positive: key === "hot" || POSITIVE.has(key) }));
        for (const mod of snapshot.mods) unit.statuses.push({ key: `${mod.stat}${mod.value >= 0 ? "Up" : "Down"}`, positive: mod.value >= 0 });
        push(snapshot.uid);
      }
      changed = true;
    }
    if (changed) tick();
  };
  const land = (src: string, dst: string, damage: number, absorbed: number, crit = false) => {
    const target = units.get(dst); if (!target) return;
    const hpDamage = Math.max(0, damage - absorbed);
    target.shield = Math.max(0, target.shield - absorbed); target.hp = Math.max(0, target.hp - hpDamage);
    if (hpDamage > 0) board.visual(dst)?.play("hit");
    fx.float(position(dst), hpDamage > 0 ? `-${hpDamage}${crit ? "!" : ""}` : `🛡️${absorbed}`, crit ? "crit" : "damage");
    fx.burst(position(dst), 0xffc36a); push(dst); tick();
    log.push(`${name(src)} → ${name(dst)} -${hpDamage}`); if (log.length > 12) log.shift();
  };
  const move = (root: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3, duration: number) => {
    if (duration <= 0) root.position.copy(to);
    else moves.push({ root, from: from.clone(), to: to.clone(), elapsed: 0, duration });
  };
  const present = (event: CombatEvent): number => {
    if (event.t === "basic" || event.t === "miss") {
      const actor = units.get(event.src), visual = board.visual(event.src);
      let impacted = false;
      const impact = () => {
        if (disposed || impacted) return;
        impacted = true;
        o.onEvent?.(event);
        if (event.t === "basic") land(event.src, event.dst, event.dmg, event.absorbed, event.crit);
        else fx.float(position(event.dst), "MISS", "miss");
      };
      if (!actor || !visual) {
        impact();
        return scaleCombatPresentationMs(100, speedLevel);
      }
      const staged = stageBasicCombatEvent(event as Parameters<typeof stageBasicCombatEvent>[0], actor, speedLevel);
      const { timing } = staged;
      // A rig's own authored impact callback is the sole HP/damage transition.
      pendingActions++;
      const attackMs = staged.pattern === "RANGED_STATIC"
        ? scaleCombatPresentationMs(360, speedLevel)
        : timing.preImpactMs + timing.postImpactMs;
      if (staged.pattern === "RANGED_STATIC") {
        visual.play("attack", {
          duration: attackMs / 1000,
          onImpact: impact,
          onDone: () => { if (!disposed) pendingActions--; },
        });
        return attackMs;
      }
      const home = visual.root.position.clone();
      const target = board.visual(event.dst)?.root.position.clone() ?? home.clone();
      const toward = target.clone().sub(home);
      toward.y = 0;
      if (toward.lengthSq() > 0) toward.normalize();
      const contact = target.clone().addScaledVector(toward, staged.pattern === "ASSASSIN_BACK" ? 0.65 : -0.65);
      contact.y = home.y;
      visual.play("move");
      move(visual.root, home, contact, timing.approachMs);
      after(timing.approachMs, () => {
        if (disposed) return;
        // Assassins turn back toward their target after crossing behind it.
        if (toward.lengthSq() > 0) visual.setFacing(Math.atan2(target.x - contact.x, target.z - contact.z));
        visual.play("attack", {
          duration: attackMs / 1000,
          onImpact: impact,
          onDone: () => {
            if (disposed) return;
            visual.play("move");
            move(visual.root, contact, home, timing.retreatMs);
            after(timing.retreatMs, () => {
              if (disposed) return;
              visual.setFacing(actor.side);
              visual.play("idle");
              pendingActions--;
            });
          },
        });
      });
      return timing.approachMs + attackMs + timing.retreatMs;
    }
    o.onEvent?.(event);
    switch (event.t) {
      case "skill": case "reflect": land(event.src, event.dst, event.dmg, event.absorbed, event.t === "skill" && event.crit); break;
      case "cast": board.visual(event.src)?.play("skill"); break;
      case "dot": {
        const unit = units.get(event.dst);
        const absorbed = unit ? Math.min(unit.shield, event.dmg) : 0;
        const hpDamage = event.dmg - absorbed;
        if (unit) { unit.shield -= absorbed; unit.hp = Math.max(0, unit.hp - hpDamage); push(event.dst); }
        fx.float(position(event.dst), hpDamage > 0 ? `-${hpDamage}` : `🛡️${absorbed}`, "dot"); break;
      }
      case "heal": {
        const unit = units.get(event.dst); if (unit) { unit.hp = Math.min(unit.maxHp, unit.hp + event.amount); push(event.dst); }
        fx.float(position(event.dst), `+${event.amount}`, "heal"); break;
      }
      case "shield": {
        const unit = units.get(event.dst); if (unit) { unit.shield += event.amount; push(event.dst); } break;
      }
      case "status": {
        const unit = units.get(event.dst);
        if (unit) { unit.statuses = unit.statuses.filter((status) => status.key !== event.kind); if (event.turns > 0) unit.statuses.push({ key: event.kind, positive: POSITIVE.has(event.kind) }); push(event.dst); }
        break;
      }
      case "revive": { const unit = units.get(event.dst); if (unit) { unit.hp = event.hp; push(event.dst); } break; }
      case "death": { const unit = units.get(event.dst); if (unit) { unit.hp = 0; unit.shield = 0; unit.statuses = []; push(event.dst); } board.visual(event.dst)?.die(); break; }
      case "skip": fx.float(position(event.src), ICONS[event.reason as keyof typeof ICONS] ?? "💤", "status"); break;
    }
    return scaleCombatPresentationMs(100, speedLevel);
  };
  const off = o.onFrame((seconds) => {
    if (disposed) return;
    const ms = Math.min(seconds, .1) * 1000;
    fx.update(ms / 1000);
    for (let i = moves.length - 1; i >= 0; i--) {
      const entry = moves[i]; entry.elapsed += ms;
      const progress = Math.min(1, entry.elapsed / entry.duration);
      entry.root.position.lerpVectors(entry.from, entry.to, progress * progress * (3 - 2 * progress));
      if (progress === 1) moves.splice(i, 1);
    }
    for (const timer of [...timers]) {
      timer.remaining -= ms;
      if (timer.remaining <= 0) { timers.splice(timers.indexOf(timer), 1); timer.run(); }
    }
    wait -= ms;
    if (wait > 0 || timers.length || moves.length || pendingActions > 0) return;
    syncInspection();
    if (index >= o.events.length) { if (!complete) { complete = true; resolve(); } return; }
    wait = present(o.events[index++]); tick();
  });
  syncInspection();
  tick();
  return { setSpeed(level) { speedLevel = normalizeGameSpeedLevel(level); }, done: promise,
    dispose() { if (disposed) return; disposed = true; off(); timers.length = 0; moves.length = 0; pendingActions = 0; resolve(); } };
}
