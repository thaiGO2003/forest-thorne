// 3D Unit Placement, Animation & Selection Manager for Planning and Combat.
import * as THREE from "three";
import { benchPerimeter, toVisual, type Profile } from "../board/geometry";
import { cellToWorld } from "./arena";
import { setRayFromClientPoint, type CanvasBoundsSource } from "./boardPicking";
import { createUnitModel } from "./units/factory";
import type { UnitModel } from "./units/kit";
import type { OwnedUnit, RunState } from "../core/run";

export type UnitTarget =
  | { type: "board"; index: number; unit: OwnedUnit }
  | { type: "bench"; index: number; unit: OwnedUnit };

export type TileTarget =
  | { type: "board"; index: number }
  | { type: "bench"; index: number };

interface ManagedUnit {
  key: string;
  unit: OwnedUnit;
  model: UnitModel;
  currentPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  targetRotY: number;
}

export class UnitManager {
  private readonly group = new THREE.Group();
  private readonly units = new Map<string, ManagedUnit>();
  private selectedKey: string | null = null;
  private readonly selectRing: THREE.Mesh;
  private readonly destMarkers: THREE.Mesh[] = [];
  private readonly screenRaycaster = new THREE.Raycaster();
  private readonly screenNdc = new THREE.Vector2();
  private readonly profile: Profile = "solo";

  constructor(private readonly scene: THREE.Scene) {
    this.group.name = "unit-manager";
    this.scene.add(this.group);

    // 3D selection ring
    const ringGeo = new THREE.RingGeometry(0.38, 0.46, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    this.selectRing = new THREE.Mesh(ringGeo, ringMat);
    this.selectRing.visible = false;
    this.selectRing.position.y = 0.08;
    this.group.add(this.selectRing);
  }

  getGroup(): THREE.Group {
    return this.group;
  }

  /**
   * Synchronize 3D models with current RunState board and bench.
   */
  sync(s: RunState): void {
    const activeKeys = new Set<string>();
    const benchCells = benchPerimeter(this.profile);

    // 1. Board units (indices 0..24)
    for (let i = 0; i < s.board.length; i++) {
      const u = s.board[i];
      if (!u) continue;
      const key = `board-${i}`;
      activeKeys.add(key);

      const col = i % 5;
      const row = Math.floor(i / 5);
      const vCell = toVisual(col, row);
      const w = cellToWorld(vCell, this.profile);
      const targetPos = new THREE.Vector3(w.x, 0.06, w.z);
      // Allies face east (+x direction)
      const targetRotY = Math.PI / 2;

      this.updateOrSpawn(key, u, targetPos, targetRotY);
    }

    // 2. Bench units
    for (let j = 0; j < s.bench.length; j++) {
      const u = s.bench[j];
      if (!u) continue;
      const key = `bench-${j}`;
      activeKeys.add(key);

      const bCell = benchCells[j];
      if (!bCell) continue;
      const w = cellToWorld(bCell, this.profile);
      const targetPos = new THREE.Vector3(w.x, 0.06, w.z);
      const targetRotY = Math.PI / 2;

      this.updateOrSpawn(key, u, targetPos, targetRotY);
    }

    // Reuse the canonical preview; enemies are read-only and never planning move targets.
    for (const enemy of s.enemyPreview) {
      const key = `enemy-${enemy.uid}`;
      activeKeys.add(key);
      const w = cellToWorld(toVisual(enemy.col, enemy.row), this.profile);
      this.updateOrSpawn(key, { ...enemy, star: Math.min(3, Math.max(1, enemy.star)) as 1 | 2 | 3, equips: enemy.equips ?? [], traits: enemy.traits ?? [] },
        new THREE.Vector3(w.x, .06, w.z), -Math.PI / 2);
    }
    // 3. Remove obsolete units
    for (const [key, item] of this.units.entries()) {
      if (!activeKeys.has(key)) {
        item.model.dispose();
        this.group.remove(item.model.root);
        this.units.delete(key);
      }
    }

    // Update selection ring position
    this.updateSelectionRing();
  }

  private updateOrSpawn(
    key: string,
    u: OwnedUnit,
    targetPos: THREE.Vector3,
    targetRotY: number,
  ): void {
    let existing = this.units.get(key);
    if (!existing || existing.unit.baseId !== u.baseId || existing.unit.star !== u.star) {
      if (existing) {
        existing.model.dispose();
        this.group.remove(existing.model.root);
      }
      const model = createUnitModel(u.baseId, u.star as 1 | 2 | 3, u.uid);
      model.root.position.copy(targetPos);
      model.root.rotation.y = targetRotY;
      this.group.add(model.root);

      existing = {
        key,
        unit: u,
        model,
        currentPos: targetPos.clone(),
        targetPos,
        targetRotY,
      };
      this.units.set(key, existing);
    } else {
      existing.unit = u;
      existing.targetPos = targetPos;
      existing.targetRotY = targetRotY;
    }
  }

  setSelected(target: UnitTarget | null): void {
    if (!target) {
      this.selectedKey = null;
    } else {
      this.selectedKey = `${target.type}-${target.index}`;
    }
    this.updateSelectionRing();
  }

  private updateSelectionRing(): void {
    if (!this.selectedKey) {
      this.selectRing.visible = false;
      return;
    }
    const managed = this.units.get(this.selectedKey);
    if (!managed) {
      this.selectRing.visible = false;
      return;
    }
    this.selectRing.visible = true;
    this.selectRing.position.set(managed.currentPos.x, 0.08, managed.currentPos.z);
  }

  /**
   * Raycast check against 3D unit models and ground tiles.
   */
  pick(raycaster: THREE.Raycaster, s: RunState): { unitTarget?: UnitTarget; tileTarget?: TileTarget } | null {
    // Check unit hits first
    for (const [key, item] of this.units.entries()) {
      const intersects = raycaster.intersectObject(item.model.root, true);
      if (intersects.length > 0) {
        const [type, idxStr] = key.split("-");
        const index = Number(idxStr);
        if (type === "board" || type === "bench") {
          return {
            unitTarget: {
              type,
              index,
              unit: item.unit,
            },
          };
        }
      }
    }

    // Check ground tiles
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hitPoint = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
      // 1. Check board cells
      for (let i = 0; i < 25; i++) {
        const col = i % 5;
        const row = Math.floor(i / 5);
        const w = cellToWorld(toVisual(col, row), this.profile);
        const dist = Math.hypot(hitPoint.x - w.x, hitPoint.z - w.z);
        if (dist < 0.48) {
          const u = s.board[i];
          if (u) {
            return { unitTarget: { type: "board", index: i, unit: u } };
          }
          return { tileTarget: { type: "board", index: i } };
        }
      }

      // 2. Check bench slots
      const benchCells = benchPerimeter(this.profile);
      for (let j = 0; j < s.bench.length + 1 && j < benchCells.length; j++) {
        const bCell = benchCells[j];
        if (!bCell) continue;
        const w = cellToWorld(bCell, this.profile);
        const dist = Math.hypot(hitPoint.x - w.x, hitPoint.z - w.z);
        if (dist < 0.48) {
          const u = s.bench[j];
          if (u) {
            return { unitTarget: { type: "bench", index: j, unit: u } };
          }
          return { tileTarget: { type: "bench", index: j } };
        }
      }
    }
    return null;
  }

  select(target: UnitTarget | null): void {
    this.setSelected(target);
  }

  pickScreen(clientX: number, clientY: number, canvas: CanvasBoundsSource, camera: THREE.Camera, s: RunState): { type: "board" | "bench"; index: number; unit?: OwnedUnit } | null {
    if (!setRayFromClientPoint(canvas, clientX, clientY, camera, this.screenRaycaster, this.screenNdc)) return null;
    const hit = this.pick(this.screenRaycaster, s);
    if (!hit) return null;
    if (hit.unitTarget) {
      return { type: hit.unitTarget.type, index: hit.unitTarget.index, unit: hit.unitTarget.unit };
    }
    if (hit.tileTarget) {
      return { type: hit.tileTarget.type, index: hit.tileTarget.index };
    }
    return null;
  }

  update(dt: number): void {
    const lerpSpeed = Math.min(1, dt * 12);
    for (const item of this.units.values()) {
      item.currentPos.lerp(item.targetPos, lerpSpeed);
      item.model.root.position.copy(item.currentPos);
      item.model.update(dt);
    }
    if (this.selectedKey) {
      const managed = this.units.get(this.selectedKey);
      if (managed) {
        this.selectRing.position.set(managed.currentPos.x, 0.08, managed.currentPos.z);
      }
    }
  }

  dispose(): void {
    for (const item of this.units.values()) {
      item.model.dispose();
    }
    this.units.clear();
    this.selectRing.geometry.dispose();
    (this.selectRing.material as THREE.Material).dispose();
    this.scene.remove(this.group);
  }
}

export function createUnitManager(scene: THREE.Scene): UnitManager {
  return new UnitManager(scene);
}
