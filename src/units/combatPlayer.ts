// Replay the canonical event stream; combatStaging/gameSpeed own basic movement timing.
import * as THREE from "three";
import { getUnit } from "../content/catalog";
import type { CombatEvent } from "../core/combat";
import { basicContactCell, stageBasicCombatEvent } from "../core/combatStaging";
import { getEmptyQueueDelayMs, normalizeGameSpeedLevel, scaleCombatPresentationMs } from "../core/gameSpeed";
import { ICONS } from "../core/emojiIcon";
import type { BillboardStatus } from "./billboard";
import type { BoardView } from "./boardView";
import type { CombatFx } from "./fx";
export interface RosterEntry { uid: string; baseId: string; star: number; side: "L" | "R"; hp: number; maxHp: number; rage: number; rageMax: number; shield: number }
export interface PlaybackTick { cycle: number; queue: string[]; log: string[]; alive: Record<"L" | "R", RosterEntry[]>; all: RosterEntry[] }
export interface CombatPlayer { setSpeed(level: number): void; done: Promise<void>; dispose(): void }
const POSITIVE = new Set(["shield", "regen", "atkUp", "defUp", "haste", "immune", "reflect"]);
const PROJECTILE_BASE_MS = 240;
const PROJECTILE_COLOR = 0xffd36a;
export function playCombat(o: {
  board: BoardView; fx: CombatFx; roster: RosterEntry[]; events: CombatEvent[];
  onFrame: (fn: (dt: number) => void) => () => void; onTick: (tick: PlaybackTick) => void;
  onEvent?: (event: CombatEvent) => void;
}): CombatPlayer {
  const { board, fx } = o;
  const units = new Map(o.roster.map((unit) => [unit.uid, { ...unit, statuses: [] as BillboardStatus[] }]));
  const log: string[] = [];
  const timers: { remaining: number; run: () => void }[] = [];
  const moves: { root: THREE.Object3D; from: THREE.Vector3; to: THREE.Vector3; elapsed: number; duration: number }[] = [];
  let speedLevel = 0, wait = 0, index = 0, pendingImpacts = 0, cycle = 1, disposed = false, complete = false;
  const { promise, resolve } = Promise.withResolvers<void>();
  const after = (ms: number, run: () => void) => { if (ms <= 0) run(); else timers.push({ remaining: ms, run }); };
  const exactImpact = (run: () => void) => {
    let fired = false;
    pendingImpacts++;
    return () => {
      if (fired) return;
      fired = true;
      pendingImpacts = Math.max(0, pendingImpacts - 1);
      if (!disposed) run();
    };
  };
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
  const land = (src: string, dst: string, damage: number, absorbed: number, crit = false) => {
    const target = units.get(dst); if (!target) return;
    target.shield = Math.max(0, target.shield - absorbed); target.hp = Math.max(0, target.hp - damage);
    if (damage > 0) board.visual(dst)?.play("hit");
    fx.float(position(dst), damage > 0 ? `-${damage}${crit ? "!" : ""}` : `${ICONS.shield}${absorbed}`, crit ? "crit" : "damage");
    fx.burst(position(dst), 0xffc36a); push(dst); tick();
    log.push(`${name(src)} → ${name(dst)} -${damage}`); if (log.length > 12) log.shift();
  };
  const move = (root: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3, duration: number) => {
    if (duration <= 0) root.position.copy(to);
    else moves.push({ root, from: from.clone(), to: to.clone(), elapsed: 0, duration });
  };
  const present = (event: CombatEvent): number => {
    o.onEvent?.(event);
    if (event.t === "cycle") {
      cycle = event.cycle;
      tick();
      return 0;
    }
    if (event.t === "empty") return getEmptyQueueDelayMs(speedLevel);
    if (event.t === "basic" || event.t === "miss") {
      const actor = units.get(event.src), visual = board.visual(event.src);
      if (!actor) return scaleCombatPresentationMs(100, speedLevel);
      const staged = event.t === "miss"
        ? stageBasicCombatEvent(event, actor, speedLevel)
        : stageBasicCombatEvent({ ...event, t: "basic" }, actor, speedLevel);
      const { timing } = staged;
      const semanticImpact = () => {
        if (event.t === "basic") land(event.src, event.dst, event.dmg, event.absorbed, event.crit);
        else fx.float(position(event.dst), "MISS", "miss");
      };

      if (staged.pattern === "RANGED_STATIC") {
        visual?.play("attack");
        const targetVisual = board.visual(event.dst);
        if (visual && targetVisual) {
          const impact = exactImpact(semanticImpact);
          fx.shot(
            position(event.src),
            position(event.dst),
            PROJECTILE_COLOR,
            scaleCombatPresentationMs(PROJECTILE_BASE_MS, speedLevel) / 1000,
            impact,
          );
        } else semanticImpact();
        return scaleCombatPresentationMs(100, speedLevel);
      }

      if (!visual) {
        semanticImpact();
        return scaleCombatPresentationMs(100, speedLevel);
      }

      const home = visual.root.position.clone();
      const actorSlot = board.slot(event.src), targetSlot = board.slot(event.dst);
      const contact = actorSlot && targetSlot && actorSlot.kind !== "bench" && targetSlot.kind !== "bench"
        ? (() => {
            const cell = basicContactCell(staged.pattern, actor, targetSlot);
            const center = board.cellCenter(cell.col, cell.row);
            return new THREE.Vector3(center.x, home.y, center.z);
          })()
        : home.clone();
      const retreat = () => {
        visual.play("move");
        move(visual.root, contact, home, timing.retreatMs);
        after(timing.retreatMs, () => visual.play("idle"));
      };
      const impact = exactImpact(() => {
        semanticImpact();
        after(timing.postImpactMs, retreat);
      });
      visual.play("move");
      move(visual.root, home, contact, timing.approachMs);
      after(timing.approachMs, () => visual.play("attack", { onImpact: impact }));
      return scaleCombatPresentationMs(100, speedLevel);
    }
    switch (event.t) {
      case "skill": case "reflect": land(event.src, event.dst, event.dmg, event.absorbed, event.t === "skill" && event.crit); break;
      case "cast": board.visual(event.src)?.play("skill"); break;
      case "dot": {
        const unit = units.get(event.dst); if (unit) { unit.hp = Math.max(0, unit.hp - event.dmg); push(event.dst); }
        fx.float(position(event.dst), `-${event.dmg}`, "dot"); break;
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
      case "revive": {
        const unit = units.get(event.dst);
        if (unit) {
          unit.hp = event.hp;
          push(event.dst);
          board.visual(event.dst)?.revive();
        }
        break;
      }
      case "death": { const unit = units.get(event.dst); if (unit) { unit.hp = 0; unit.statuses = []; push(event.dst); } board.visual(event.dst)?.die(); break; }
      case "skip": fx.float(position(event.src), ICONS[event.reason as keyof typeof ICONS] ?? ICONS.sleep, "status"); break;
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
    if (wait > 0 || timers.length || moves.length || pendingImpacts > 0) return;
    if (index >= o.events.length) { if (!complete) { complete = true; resolve(); } return; }
    wait = present(o.events[index++]); tick();
  });
  tick();
  return { setSpeed(level) { speedLevel = normalizeGameSpeedLevel(level); }, done: promise,
    dispose() { if (disposed) return; disposed = true; off(); timers.length = 0; moves.length = 0; pendingImpacts = 0; resolve(); } };
}
