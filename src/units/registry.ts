// Recovered portrait/combat consumers use the current procedural model factory.
import * as THREE from "three";
import { UNIT_BY_ID } from "../content/catalog";
import { createUnitModel } from "../world/units/factory";
import { ACTION_S } from "../world/units/kit";
import type { Star, UnitVisual, ActionState, PlayOpts } from "./rig";
export const hasRig = (id: string) => UNIT_BY_ID.has(id);
export function createUnit(id: string, star: Star, _skin: string | null = null): UnitVisual {
  const model = createUnitModel(id, star), root = model.root;
  const anchor = new THREE.Object3D();
  anchor.position.y = new THREE.Box3().setFromObject(root).max.y + 0.18;
  root.add(anchor);
  let action: ActionState = "idle", elapsed = 0, options: PlayOpts = {}, impacted = false;
  let dead = false, deathTime = 0, deathDone: (() => void) | undefined;
  let disposed = false, combat = false;
  const baseScale = root.scale.clone();
  return {
    id, star, root, anchor,
    play(state, opts = {}) {
      if (disposed || dead) return;
      action = state; elapsed = 0; options = opts; impacted = false; model.setState(state);
    },
    state: () => action,
    setCombat(value) { combat = value; },
    setFacing(side) { root.rotation.y = typeof side === "number" ? side : side === "L" ? Math.PI / 2 : -Math.PI / 2; },
    setHpRatio(ratio) {
      if (ratio > 0) { dead = false; deathTime = 0; root.visible = true; root.scale.copy(baseScale); }
    },
    die(done) { if (!dead) { dead = true; deathTime = 0; deathDone = done; } },
    update(dt) {
      if (disposed) return;
      if (dead) {
        deathTime += dt; root.scale.copy(baseScale).multiplyScalar(Math.max(0.01, 1 - deathTime / .6));
        if (deathTime >= .6) { root.visible = false; const done = deathDone; deathDone = undefined; done?.(); }
        return;
      }
      elapsed += dt;
      root.scale.copy(baseScale);
      if (combat && action === "idle") { root.scale.y *= .95; root.scale.z *= 1.04; }
      const duration = Math.max(.001, options.duration ?? ACTION_S[action]);
      model.update(dt * ACTION_S[action] / duration);
      if (!impacted && elapsed >= duration * .5) { impacted = true; options.onImpact?.(); }
      if (action !== "idle" && action !== "move" && elapsed >= duration) {
        const done = options.onDone; options = {}; action = "idle"; model.setState("idle"); done?.();
      }
    },
    dispose() { if (!disposed) { disposed = true; root.removeFromParent(); model.dispose(); } },
  };
}
