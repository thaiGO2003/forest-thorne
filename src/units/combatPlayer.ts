// Replay the canonical event stream; combatStaging/gameSpeed own basic movement timing.
import * as THREE from "three";
import { getUnit } from "../content/catalog";
import { TIME_SAND_FAMILY } from "../core/skills";
import {
  SPORE_BURST_POINTS,
  type CombatEvent,
  type CombatInspectionFrame,
  type CombatUnitSnapshot,
  type SporeCell
} from "../core/combat";
import {
  assassinBackContactUsesRing,
  basicContactCell,
  meleeContactUsesRiverSeam,
  stageBasicCombatEvent,
  type BasicCombatEvent,
} from "../core/combatStaging";
import {
  getEmptyQueueDelayMs,
  getGameSpeedDisplayMultiplier,
  normalizeGameSpeedLevel,
  scaleCombatPresentationMs
} from "../core/gameSpeed";
import { ICONS } from "../core/emojiIcon";
import type { BillboardStatus } from "./billboard";
import { TILE_TOP, type BoardView } from "./boardView";
import type { CombatFx } from "./fx";
import { RIGS } from "./registry";
import { BLOCK } from "../world/arena";
import { RIG_DEFAULT_DURATIONS, RIG_DEFAULT_IMPACT } from "./rig";
export interface RosterEntry { uid: string; baseId: string; star: number; side: "L" | "R"; hp: number; maxHp: number; rage: number; rageMax: number; shield: number; inspection?: CombatUnitSnapshot }
export interface PlaybackTick { cycle: number; queue: string[]; log: string[]; alive: Record<"L" | "R", RosterEntry[]>; all: RosterEntry[] }
export interface CombatPlayer { setSpeed(level: number): void; done: Promise<void>; dispose(): void }
const POSITIVE = new Set(["shield", "damageReduction", "regen", "atkUp", "defUp", "haste", "immune", "reflect"]);
const PROJECTILE_COLOR = 0xffd36a;
/** Action-only Giơ Kiếm Lên Trời guard; not an actual permanent immunity status. */
const OATH_GUARD_STATUS: BillboardStatus = { key: "immune", positive: true };
/** Sương Độc presentation: purple pool landing, lime detonation (matches the concept VFX). */
const SPORE_POOL_COLOR = 0x9b40d6, SPORE_BURST_COLOR = 0xb6ff4a;
/** Bướm Cỏ: bright green storm particles follow the same target sequence as damage events. */
const GRASS_STORM_COLOR = 0x85df63;
/** Each spider soul projectile corresponds to exactly one canonical skill impact. */
const SPIDER_SOUL_COLOR = 0x9ee4ff;
/** Existing hit sparks fire per horn impact; blue electricity appears only for a paralyze proc. */
const KIRIN_PARALYZE_COLOR = 0x63d6ff;
/** Sand leaves the caster on the next valid tile and impacts at projectile arrival. */
const TIME_SAND_COLOR = 0xd8c28b;
const PRESENTATION_ONLY = () => {};
export function playCombat(o: {
  board: BoardView; fx: CombatFx; roster: RosterEntry[]; events: CombatEvent[];
  onFrame: (fn: (dt: number) => void) => () => void; onTick: (tick: PlaybackTick) => void;
  onEvent?: (event: CombatEvent) => void;
  inspectionFrames?: CombatInspectionFrame[];
}): CombatPlayer {
  const { board, fx } = o;
  const units = new Map(o.roster.map((unit) => [unit.uid, { ...unit, inspection: unit.inspection ? structuredClone(unit.inspection) : undefined, statuses: [] as BillboardStatus[], oathActive: false, suppressed: [] as string[], spores: 0 }]));
  // Active Sương Độc pools per owner (cell keys), mirrored onto the board as hazard tiles.
  const hazards = new Map<string, Map<number, SporeCell>>();
  const relocated = new Map<string, { kind: "board" | "enemy" | "bench"; col: number; row: number }>();
  const hazardKey = (cell: SporeCell) => cell.row * 100 + cell.col;
  const syncHazards = () => {
    const cells = new Map<number, SporeCell>();
    for (const owned of hazards.values()) for (const [k, cell] of owned) cells.set(k, cell);
    board.setHazardCells?.([...cells.values()]);
  };
  const removeHazards = (owner: string, cells: readonly SporeCell[]) => {
    const owned = hazards.get(owner);
    if (!owned) return;
    for (const cell of cells) owned.delete(hazardKey(cell));
    syncHazards();
  };
  const cellPoint = (cell: SporeCell) => {
    const c = board.cellCenter(cell.col, cell.row);
    return new THREE.Vector3(c.x, TILE_TOP + 0.25, c.z);
  };
  const log: string[] = [];
  const timers: { remaining: number; run: () => void }[] = [];
  const moves: { root: THREE.Object3D; from: THREE.Vector3; to: THREE.Vector3; elapsed: number; duration: number }[] = [];
  let speedLevel = 0;
  let wait = 0;
  let index = 0;
  let pendingImpacts = 0;
  let pendingActions = 0;
  let inspectionIndex = 0;
  let cycle = 1;
  let disposed = false;
  let skillImpact: { src: string; fired: boolean; pending: (() => void)[]; onDone: (() => void)[]; targets: readonly string[] } | null = null;
  let complete = false;
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
    if (unit) board.setLive(uid, {
      hp: unit.hp, maxHp: unit.maxHp, rage: unit.rage, rageMax: unit.rageMax,
      statuses: unit.oathActive
        ? [...unit.statuses.filter((status) => !unit.suppressed.includes(status.key)), OATH_GUARD_STATUS]
        : unit.statuses,
      counter: unit.spores > 0 ? { icon: ICONS.poison, value: unit.spores, max: SPORE_BURST_POINTS } : undefined,
    });
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
        unit.hp = snapshot.hp;
        unit.maxHp = snapshot.maxHp;
        unit.rage = snapshot.rage;
        unit.rageMax = snapshot.rageMax;
        unit.shield = snapshot.shield;
        unit.statuses = Object.entries(snapshot.status)
          .filter(([, status]) => status.turns > 0)
          .map(([key]) => ({ key, positive: key === "hot" || POSITIVE.has(key) }));
        for (const mod of snapshot.mods) {
          unit.statuses.push({
            key: `${mod.stat}${mod.value >= 0 ? "Up" : "Down"}`,
            positive: mod.value >= 0,
          });
        }
        push(snapshot.uid);
      }
      changed = true;
    }
    if (changed) tick();
  };
  const land = (src: string, dst: string, damage: number, absorbed: number, crit = false) => {
    const target = units.get(dst); if (!target) return;
    const hpDamage = Math.max(0, damage - absorbed);
    target.shield = Math.max(0, target.shield - absorbed);
    target.hp = Math.max(0, target.hp - hpDamage);
    if (hpDamage > 0) board.visual(dst)?.play("hit");
    fx.float(position(dst), hpDamage > 0 ? `-${hpDamage}${crit ? "!" : ""}` : `${ICONS.shield}${absorbed}`, crit ? "crit" : "damage");
    fx.burst(position(dst), 0xffc36a); push(dst); tick();
    log.push(`${name(src)} → ${name(dst)} -${hpDamage}`); if (log.length > 12) log.shift();
  };
  const queueSkillDamage = (damageEvent: Extract<CombatEvent, { t: "basic" | "skill" }>) => exactImpact(() => {
    const window = skillImpact?.src === damageEvent.src ? skillImpact : null;
    const targetIndex = window?.targets.indexOf(damageEvent.dst) ?? -1;
    board.flashTile?.(damageEvent.dst, targetIndex > 0 ? "splash" : "direct");
    if (damageEvent.kind === "soul") fx.burst(position(damageEvent.dst), SPIDER_SOUL_COLOR);
    if (damageEvent.kind === "grass") fx.burst(position(damageEvent.dst), GRASS_STORM_COLOR);
    o.onEvent?.(damageEvent);
    land(damageEvent.src, damageEvent.dst, damageEvent.dmg, damageEvent.absorbed, damageEvent.crit);
  });
  const move = (root: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3, duration: number) => {
    if (duration <= 0) root.position.copy(to);
    else moves.push({ root, from: from.clone(), to: to.clone(), elapsed: 0, duration });
  };
  // Old_src current-tile highlight: purple turn marker + gold actor outline; skills swap the
  // outline for the stepped rainbow border (setCombatBorder("skill")).
  let focusedUid: string | null = null;
  const focusActor = (uid: string) => {
    focusedUid = uid;
    board.setTurnIndicator?.(uid);
    board.setActorHighlight?.(uid);
  };
  const clearActorFocus = (uid: string) => {
    // Overlapping skill/basic animations must not clear a newer actor's marker.
    if (focusedUid !== uid) return;
    focusedUid = null;
    board.setTurnIndicator?.(null);
    board.setActorHighlight?.(null);
    board.setCombatBorder?.(null);
  };
  const present = (event: CombatEvent): number => {
    if (event.t === "cycle") {
      o.onEvent?.(event);
      cycle = event.cycle;
      tick();
      return 0;
    }
    if (event.t === "empty") {
      board.flashCell?.(event.col, event.row, "scan");
      o.onEvent?.(event);
      return getEmptyQueueDelayMs(speedLevel);
    }
    if (event.t === "basic" || event.t === "miss") {
      const actor = units.get(event.src), visual = board.visual(event.src);
      const semanticImpact = exactImpact(() => {
        board.flashTile?.(event.dst, "direct");
        o.onEvent?.(event);
        if (event.t === "basic") land(event.src, event.dst, event.dmg, event.absorbed, event.crit);
        else fx.float(position(event.dst), "MISS", "miss");
      });
      if (!actor || !visual) {
        semanticImpact();
        return scaleCombatPresentationMs(100, speedLevel);
      }
      const stagedEvent: BasicCombatEvent = event.t === "miss"
        ? event
        : { t: "basic", src: event.src, dst: event.dst, dmg: event.dmg, absorbed: event.absorbed, crit: event.crit };
      const staged = stageBasicCombatEvent(stagedEvent, actor, speedLevel);
      const { timing } = staged;
      focusActor(event.src);

      if (staged.pattern === "RANGED_STATIC") {
        board.setCombatBorder?.(event.src, "attack");
        pendingActions++;
        const attackMs = scaleCombatPresentationMs(360, speedLevel);
        visual.play("attack", {
          duration: attackMs / 1000,
          onImpact: semanticImpact,
          onDone: () => {
            if (disposed) return;
            pendingActions--;
            clearActorFocus(event.src);
          },
        });
        const targetVisual = board.visual(event.dst);
        if (targetVisual) {
          fx.shot(
            position(event.src),
            position(event.dst),
            PROJECTILE_COLOR,
            (attackMs * (RIGS[actor.baseId]?.impact?.attack ?? RIG_DEFAULT_IMPACT.attack)) / 1000,
            PRESENTATION_ONLY,
          );
        }
        return attackMs;
      }

      const home = visual.root.position.clone();
      const actorSlot = relocated.get(event.src) ?? board.slot(event.src);
      const targetSlot = relocated.get(event.dst) ?? board.slot(event.dst);
      const contact = actorSlot && targetSlot && actorSlot.kind !== "bench" && targetSlot.kind !== "bench"
        ? (() => {
            // Old_src: melee front-line contact lands on the river seam, not the attacker's edge tile.
            if (meleeContactUsesRiverSeam(staged.pattern, actor.side, targetSlot)) {
              const left = board.cellCenter(4, targetSlot.row);
              const right = board.cellCenter(5, targetSlot.row);
              return new THREE.Vector3((left.x + right.x) / 2, home.y - 0.14, (left.z + right.z) / 2);
            }
            if (assassinBackContactUsesRing(staged.pattern, actor.side, targetSlot)) {
              const center = board.cellCenter(targetSlot.col, targetSlot.row);
              const awayFromRiver = actor.side === "L" ? 1 : -1;
              return new THREE.Vector3(center.x + awayFromRiver * BLOCK, TILE_TOP, center.z);
            }
            const cell = basicContactCell(staged.pattern, actor, targetSlot);
            const center = board.cellCenter(cell.col, cell.row);
            return new THREE.Vector3(center.x, home.y, center.z);
          })()
        : home.clone();
      const target = board.visual(event.dst)?.root.position.clone();
      const attackMs = timing.preImpactMs + timing.postImpactMs;
      pendingActions++;
      board.setCombatBorder?.(event.src, "attack");
      visual.play("move");
      move(visual.root, home, contact, timing.approachMs);
      after(timing.approachMs, () => {
        if (disposed) return;
        if (target) {
          const towardTarget = target.clone().sub(contact);
          towardTarget.y = 0;
          if (towardTarget.lengthSq() > 0) visual.setFacing(Math.atan2(towardTarget.x, towardTarget.z));
        }
        visual.play("attack", {
          duration: attackMs / 1000,
          onImpact: semanticImpact,
          onDone: () => {
            if (disposed) return;
            visual.play("move");
            move(visual.root, contact, home, timing.retreatMs);
            after(timing.retreatMs, () => {
              if (disposed) return;
              visual.setFacing(actor.side);
              visual.play("idle");
              pendingActions--;
              clearActorFocus(event.src);
            });
          },
        });
      });
      return timing.approachMs + attackMs + timing.retreatMs;
    }
    if (event.t === "skill") {
      const window = skillImpact?.src === event.src ? skillImpact : null;
      const semanticImpact = queueSkillDamage(event);
      if (window && !window.fired) {
        window.pending.push(semanticImpact);
        if (event.kind !== "horn") {
          while (index < o.events.length) {
            const next = o.events[index];
            if (next?.t !== "skill" || next.src !== event.src) break;
            index++;
            window.pending.push(queueSkillDamage(next));
          }
        }
      } else if (event.kind === "soul" && board.visual(event.src) && board.visual(event.dst)) {
        // Reflections/statuses may separate canonical soul hits; every impact still gets its shot.
        const origin = position(event.src);
        origin.y += 0.35;
        fx.shot(origin, position(event.dst), SPIDER_SOUL_COLOR,
          0.24 / getGameSpeedDisplayMultiplier(speedLevel), semanticImpact, 0.35);
      } else {
        semanticImpact();
      }
      return scaleCombatPresentationMs(event.kind === "horn" ? 65 : 100, speedLevel);
    }
    o.onEvent?.(event);
    switch (event.t) {
      case "reflect": land(event.src, event.dst, event.dmg, event.absorbed); break;
      case "cast": {
        board.flashSkill?.(event.src);
        event.targets.forEach((uid, targetIndex) => board.flashTile?.(uid, targetIndex === 0 ? "direct" : "splash"));
        const visual = board.visual(event.src);
        if (!visual) break;
        focusActor(event.src);
        board.setCombatBorder?.(event.src, "skill");
        // Preserve each Kirin impact/status event and replay it at an individual horn thrust.
        // The canonical events remain separate; this batch controls presentation timing only.
        const kirinHits: { hit: Extract<CombatEvent, { t: "basic" | "skill" }>; follows: CombatEvent[] }[] = [];
        if (units.get(event.src)?.baseId === "kirin_thunder") {
          while (index < o.events.length) {
            const next = o.events[index]!;
            if (next.t === "skill" && next.kind === "horn" && next.src === event.src) {
              kirinHits.push({ hit: next, follows: [] });
            } else if (kirinHits.length && (
              next.t === "reflect" || next.t === "heal" || next.t === "shield"
              || next.t === "status" || next.t === "death" || next.t === "revive"
            )) {
              // Keep all immediate strike aftermath (reflect, on-hit effects and deaths)
              // attached to its horn beat instead of replaying it after the barrage.
              kirinHits[kirinHits.length - 1]!.follows.push(next);
            } else break;
            index++;
          }
        }
        // Sand hits may have per-hit deaths, reflection and on-hit statuses between damage
        // events. Bind each aftermath to its projectile instead of letting it race ahead.
        const sandHits: typeof kirinHits = [];
        const sandAfter: CombatEvent[] = [];
        if (units.get(event.src)?.baseId === "wisp_light") {
          while (index < o.events.length) {
            const next = o.events[index]!;
            if (next.t === "skill" && next.kind === "sand" && next.src === event.src) {
              sandHits.push({ hit: next, follows: [] });
            } else if (sandHits.length && (
              next.t === "reflect" || next.t === "heal" || next.t === "shield"
              || next.t === "death" || next.t === "revive"
              || (next.t === "status" && next.kind !== "knockup" && next.kind !== "petrify")
            )) {
              sandHits[sandHits.length - 1]!.follows.push(next);
            } else break;
            index++;
          }
        }
        // Knock-up, petrify and relocation resolve only after the full volley.
        if (sandHits.length) {
          while (index < o.events.length) {
            const next = o.events[index]!;
            if ((next.t === "status" && next.source?.skillId === TIME_SAND_FAMILY
              && (next.kind === "knockup" || next.kind === "petrify"))
              || (next.t === "teleport" && next.src === event.src)) {
              sandAfter.push(next);
              index++;
            } else break;
          }
        }
        if (sandHits.length) pendingActions++;
        if (kirinHits.length) pendingActions++;
        const window = { src: event.src, fired: false, pending: [] as (() => void)[], onDone: [] as (() => void)[], targets: event.targets };
        skillImpact = window;
        // Souls launch from the impact pose: queue the contiguous soul hits now so the
        // cast impact can fire one projectile per queued damage event.
        if (units.get(event.src)?.baseId === "spider_venom") {
          while (index < o.events.length) {
            const next = o.events[index];
            if (next?.t !== "skill" || next.src !== event.src || next.kind !== "soul") break;
            window.pending.push(queueSkillDamage(next));
            index++;
          }
        }
        const skillSeconds = (RIGS[units.get(event.src)?.baseId ?? ""]?.durations?.skill ?? RIG_DEFAULT_DURATIONS.skill)
          / getGameSpeedDisplayMultiplier(speedLevel);
        if (units.get(event.src)?.baseId === "weasel_quick" && event.targets[0]) {
          const origin = position(event.src);
          origin.y += 0.6;
          fx.shot(origin, position(event.targets[0]), 0x8bdfcf, skillSeconds * 0.55, PRESENTATION_ONLY, 0.15);
        }
        visual.play("skill", {
          duration: skillSeconds,
          onImpact: () => {
            if (disposed || window.fired) return;
            window.fired = true;
            if (sandHits.length) {
              const flight = 0.14 / getGameSpeedDisplayMultiplier(speedLevel);
              const launch = (i: number) => {
                if (disposed) return;
                if (i >= sandHits.length) {
                  for (const aftermath of sandAfter) present(aftermath);
                  pendingActions--;
                  return;
                }
                const entry = sandHits[i]!;
                const from = position(entry.hit.from ?? event.src);
                from.y += 0.5;
                const to = position(entry.hit.dst);
                to.y += 0.22;
                const impact = queueSkillDamage(entry.hit);
                fx.shot(from, to, TIME_SAND_COLOR, flight, () => {
                  if (disposed) return;
                  impact();
                  for (const follow of entry.follows) present(follow);
                  launch(i + 1);
                }, 0.15);
              };
              launch(0);
            } else if (kirinHits.length) {
              // The rig alternates left/right horn strikes over the p=.6–.93 window.
              const spacingMs = (skillSeconds * 330) / Math.max(1, kirinHits.length - 1);
              for (let i = 0; i < kirinHits.length; i++) {
                const entry = kirinHits[i]!;
                const hit = exactImpact(() => {
                  board.flashTile?.(entry.hit.dst, i % 2 ? "splash" : "direct");
                  o.onEvent?.(entry.hit);
                  land(entry.hit.src, entry.hit.dst, entry.hit.dmg, entry.hit.absorbed, entry.hit.crit);
                  for (const follow of entry.follows) present(follow);
                });
                after(i * spacingMs, hit);
              }
            } else if (units.get(event.src)?.baseId === "butterfly_mirror" && window.pending.length) {
              const impacts = window.pending.splice(0);
              let from = position(event.src);
              const next = (i: number) => {
                if (disposed || i >= impacts.length) return;
                const to = position(window.targets[i]!);
                fx.shot(from, to, GRASS_STORM_COLOR, 0.12 / getGameSpeedDisplayMultiplier(speedLevel), () => {
                  impacts[i]!();
                  from = to;
                  next(i + 1);
                }, 0.08);
              };
              next(0);
            } else if (units.get(event.src)?.baseId === "spider_venom" && window.pending.length) {
              const impacts = window.pending.splice(0);
              const origin = position(event.src);
              origin.y += 0.35;
              const flight = 0.24 / getGameSpeedDisplayMultiplier(speedLevel);
              for (let i = 0; i < impacts.length; i++) {
                // No decorative-only shots: every launch completes one queued damage event at arrival.
                fx.shot(origin, position(window.targets[i]!), SPIDER_SOUL_COLOR, flight, impacts[i]!, 0.35);
              }
            } else {
              for (const impact of window.pending.splice(0)) impact();
            }
          },
          onDone: () => {
            if (kirinHits.length) pendingActions--;
            for (const finish of window.onDone.splice(0)) finish();
            if (skillImpact === window) skillImpact = null;
            if (!disposed) clearActorFocus(event.src);
          },
        });
        break;
      }
      case "teleport": {
        const visual = board.visual(event.src);
        const slot = board.slot(event.src);
        if (!visual || !slot) break;
        fx.burst(position(event.src), TIME_SAND_COLOR);
        const cell = board.cellCenter(event.col, event.row);
        visual.root.position.set(cell.x, visual.root.position.y, cell.z);
        relocated.set(event.src, { kind: slot.kind, col: event.col, row: event.row });
        board.flashCell?.(event.col, event.row, "direct");
        fx.burst(position(event.src), TIME_SAND_COLOR);
        break;
      }
      case "hookPull": {
        const pull = exactImpact(() => {
          const visual = board.visual(event.dst);
          if (!visual) return;
          const from = visual.root.position.clone();
          const cell = board.cellCenter(event.col, event.row);
          const to = new THREE.Vector3(cell.x, from.y, cell.z);
          fx.burst(position(event.dst), 0x8bdfcf);
          board.flashCell?.(event.col, event.row, "direct");
          move(visual.root, from, to, scaleCombatPresentationMs(300, speedLevel));
        });
        if (skillImpact?.src === event.src && !skillImpact.fired) skillImpact.pending.push(pull);
        else pull();
        break;
      }
      case "dot": {
        const unit = units.get(event.dst);
        const absorbed = unit ? Math.min(unit.shield, event.dmg) : 0;
        const hpDamage = event.dmg - absorbed;
        if (unit) { unit.shield -= absorbed; unit.hp = Math.max(0, unit.hp - hpDamage); push(event.dst); }
        fx.float(position(event.dst), hpDamage > 0 ? `-${hpDamage}` : `${ICONS.shield}${absorbed}`, "dot"); break;
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
        if (event.kind === "paralyze" && event.turns > 0 && event.source?.skillId === "kirin_volt_horns") {
          fx.burst(position(event.dst), KIRIN_PARALYZE_COLOR);
          fx.float(position(event.dst), "Tê liệt", "status");
        }
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
      case "death": {
        const unit = units.get(event.dst);
        if (unit) {
          unit.hp = 0;
          unit.shield = 0;
          unit.statuses = [];
          push(event.dst);
        }
        board.visual(event.dst)?.die();
        break;
      }
      case "skip":
        fx.float(position(event.src), ICONS[event.reason as keyof typeof ICONS] ?? ICONS.sleep, "status");
        break;
      case "oath": {
        const unit = units.get(event.dst);
        if (!unit) break;
        if (event.active) {
          unit.oathActive = true;
          unit.suppressed = event.suppressed;
          push(event.dst);
          fx.burst(position(event.dst), 0xff3048);
          fx.float(position(event.dst), `${ICONS.immune}${event.suppressed.length}`, "status");
        } else {
          const finish = () => {
            unit.oathActive = false;
            unit.suppressed = [];
            push(event.dst);
          };
          if (skillImpact?.src === event.dst) skillImpact.onDone.push(finish);
          else finish();
        }
        break;
      }
      case "sporeThrow": {
        // Pools appear on the caster's skill impact, like skill damage; immediately if no window is open.
        const land = () => {
          const owned = hazards.get(event.src) ?? new Map<number, SporeCell>();
          hazards.set(event.src, owned);
          for (const cell of event.cells) {
            owned.set(hazardKey(cell), cell);
            fx.burst(cellPoint(cell), SPORE_POOL_COLOR);
            board.flashCell?.(cell.col, cell.row, "splash");
          }
          syncHazards();
        };
        const window = skillImpact?.src === event.src && !skillImpact.fired ? skillImpact : null;
        if (window) window.pending.push(exactImpact(land));
        else land();
        break;
      }
      case "sporePoint": {
        const owner = units.get(event.owner);
        if (owner) { owner.spores = event.points; push(event.owner); }
        board.flashCell?.(event.col, event.row, "direct");
        fx.float(position(event.dst), `${ICONS.poison}+1`, "status");
        break;
      }
      case "sporeBurst": {
        const owner = units.get(event.owner);
        if (owner) { owner.spores = 0; push(event.owner); }
        for (const cell of event.cells) fx.burst(cellPoint(cell), SPORE_BURST_COLOR);
        fx.float(position(event.owner), `${ICONS.poison}×${event.points}`, "status");
        removeHazards(event.owner, event.cells);
        break;
      }
      case "sporeExpire":
        removeHazards(event.owner, event.cells);
        break;
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
    if (
      wait > 0 ||
      timers.length ||
      moves.length ||
      pendingImpacts > 0 ||
      pendingActions > 0
    ) return;
    syncInspection();
    if (index >= o.events.length) { if (!complete) { complete = true; resolve(); } return; }
    wait = present(o.events[index++]); tick();
  });
  syncInspection();
  tick();
  return { setSpeed(level) { speedLevel = normalizeGameSpeedLevel(level); }, done: promise,
    dispose() {
      if (disposed) return;
      disposed = true;
      off();
      timers.length = 0;
      moves.length = 0;
      pendingImpacts = 0;
      pendingActions = 0;
      resolve();
    } };
}
