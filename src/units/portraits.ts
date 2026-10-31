// Unit portraits (§25.4, A24, A90 rule 5): the avatar is always the real unit rig, never a separate
// thumbnail. Cards get cached snapshots from one small offscreen renderer (queued, a few per frame);
// the Library detail gets a live viewer with idle-by-default, drag rotation, zoom and action preview.
import * as THREE from "three";
import type { PortraitProvider } from "../ui/card";
import { createUnit } from "./registry";
import { createRigMaterials, type ActionState, type Star, type UnitVisual } from "./rig";

const SNAP = 192;
const PER_FRAME = 3;
/** Front / slight-right inspection angle (A24). */
const VIEW_YAW = 0.55;

function light(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight(0xfff6e6, 0x5b4a2e, 1.6));
  const key = new THREE.DirectionalLight(0xfff1d6, 2.2);
  key.position.set(3, 5, 4);
  const rim = new THREE.DirectionalLight(0xbfd8ff, 0.8);
  rim.position.set(-4, 3, -3);
  scene.add(key, rim);
}

/** Fit the entire 3D rig, including depth, at every aspect ratio and orbital angle. */
function frame(camera: THREE.PerspectiveCamera, bounds: THREE.Sphere, zoom = 1) {
  const halfVertical = THREE.MathUtils.degToRad(camera.fov) / 2;
  const halfHorizontal = Math.atan(Math.tan(halfVertical) * camera.aspect);
  const limitingHalfAngle = Math.min(halfVertical, halfHorizontal);
  const dist = Math.max(0.5, bounds.radius * 1.2 / Math.sin(limitingHalfAngle)) * zoom;
  const center = bounds.center;
  camera.position.set(center.x + Math.sin(VIEW_YAW) * dist, center.y + dist * 0.28, center.z + Math.cos(VIEW_YAW) * dist);
  camera.lookAt(center);
  camera.near = Math.max(0.01, dist / 100);
  camera.far = dist + bounds.radius * 4 + 2;
  camera.updateProjectionMatrix();
}

export interface PortraitViewer {
  setUnit(baseId: string, star: Star, skin?: string | null): void;
  setCombat(v: boolean): void;
  play(state: ActionState): void;
  dispose(): void;
}

export interface Portraits extends PortraitProvider {
  createViewer(host: HTMLElement): PortraitViewer;
  dispose(): void;
}

export function createPortraits(): Portraits {
  const cache = new Map<string, HTMLCanvasElement>();
  const queue: { id: string; star: Star; key: string }[] = [];
  const queued = new Set<string>();
  const listeners = new Set<() => void>();
  let renderer: THREE.WebGLRenderer | null = null;
  // Keep at most one idle viewer renderer; new contexts register persistent DFG LUT listeners.
  let idleViewerRenderer: THREE.WebGLRenderer | null = null;
  let disposed = false;
  const scene = new THREE.Scene();
  const snapshotMaterials = createRigMaterials();
  light(scene);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  const pump = () => {
    if (disposed || !queue.length) return;
    renderer ??= new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(SNAP, SNAP, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    for (let n = 0; n < PER_FRAME && queue.length; n++) {
      const job = queue.shift()!;
      const u = createUnit(job.id, job.star, null, snapshotMaterials);
      u.update(0.016);
      scene.add(u.root);
      frame(camera, new THREE.Box3().setFromObject(u.root, true).getBoundingSphere(new THREE.Sphere()));
      renderer.render(scene, camera);
      const c = document.createElement("canvas");
      c.width = c.height = SNAP;
      c.getContext("2d")?.drawImage(renderer.domElement, 0, 0);
      cache.set(job.key, c);
      queued.delete(job.key);
      u.dispose();
    }
    for (const fn of listeners) fn();
    if (queue.length) requestAnimationFrame(pump);
  };

  return {
    dispose() {
      disposed = true;
      queue.length = 0;
      cache.clear();
      queued.clear();
      listeners.clear();
      for (const material of Object.values(snapshotMaterials)) material.dispose();
      renderer?.dispose();
      // Snapshot rendering owns its context; release it when the provider ends.
      renderer?.forceContextLoss();
      idleViewerRenderer?.dispose();
      idleViewerRenderer?.forceContextLoss();
      idleViewerRenderer = null;
    },
    get(id, star) {
      if (disposed) return null;
      const st = Math.min(3, Math.max(1, star)) as Star, key = `${id}@${st}`;
      const hit = cache.get(key);
      if (hit) return hit;
      if (!queued.has(key)) {
        queued.add(key);
        queue.push({ id, star: st, key });
        if (queue.length === 1) requestAnimationFrame(pump); // pump drains the rest itself
      }
      return null;
    },
    onReady(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    createViewer(host) {
      const r = idleViewerRenderer ?? new THREE.WebGLRenderer({ antialias: true, alpha: true });
      idleViewerRenderer = null;
      const viewerMaterials = createRigMaterials();
      r.setPixelRatio(Math.min(2, devicePixelRatio || 1));
      r.setClearColor(0x000000, 0);
      r.outputColorSpace = THREE.SRGBColorSpace;
      r.domElement.className = "portrait-canvas";
      r.domElement.setAttribute("aria-hidden", "true");
      host.append(r.domElement);
      const vs = new THREE.Scene();
      light(vs);
      const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
      const turn = new THREE.Group();
      vs.add(turn);
      let unit: UnitVisual | null = null, currentId: string | null = null, combat = false, zoom = 1;
      let yaw = 0, pitch = 0, idleWindow = 2, previewAction = false;
      const bounds = new THREE.Sphere();
      const pointers = new Map<number, { x: number; y: number }>();
      let pinch = 0;

      const resize = () => {
        const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
        r.setSize(w, h, false);
        cam.aspect = w / h;
        if (unit) frame(cam, bounds, zoom);
        else cam.updateProjectionMatrix();
      };
      const ro = new ResizeObserver(resize);
      ro.observe(host);

      const down = (e: PointerEvent) => {
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        r.domElement.setPointerCapture(e.pointerId);
        pinch = 0;
      };
      const move = (e: PointerEvent) => {
        const prev = pointers.get(e.pointerId);
        if (!prev) return;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size === 2) {
          const [a, b] = [...pointers.values()];
          const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
          if (pinch) setZoom(zoom * (pinch / d));
          pinch = d;
        } else if (pointers.size === 1) {
          yaw += (e.clientX - prev.x) * 0.012;
          pitch = THREE.MathUtils.clamp(pitch + (e.clientY - prev.y) * 0.012, -Math.PI / 2, Math.PI / 2);
        }
      };
      const up = (e: PointerEvent) => {
        pointers.delete(e.pointerId);
        if (r.domElement.hasPointerCapture(e.pointerId)) r.domElement.releasePointerCapture(e.pointerId);
        pinch = 0;
      };
      const wheel = (e: WheelEvent) => { e.preventDefault(); setZoom(zoom * (1 + Math.sign(e.deltaY) * 0.1)); };
      const setZoom = (z: number) => { zoom = Math.min(1.8, Math.max(0.65, z)); if (unit) frame(cam, bounds, zoom); };
      r.domElement.addEventListener("pointerdown", down);
      r.domElement.addEventListener("pointermove", move);
      r.domElement.addEventListener("pointerup", up);
      r.domElement.addEventListener("pointercancel", up);
      r.domElement.addEventListener("wheel", wheel, { passive: false });

      const timer = new THREE.Timer();
      r.setAnimationLoop((now) => {
        timer.update(now);
        const dt = Math.min(0.1, timer.getDelta());
        if (!pointers.size) yaw += dt * 0.15;
        turn.rotation.set(pitch, yaw, 0, "YXZ");
        if (unit) {
          if (previewAction) {
            unit.update(dt);
          } else if (idleWindow > 0) {
            unit.update(dt);
            idleWindow -= dt;
            if (idleWindow <= 0) {
              unit.play("idle");
              unit.update(0);
              idleWindow = -(2 + Math.random() * 3);
            }
          } else {
            idleWindow += dt;
            if (idleWindow >= 0) { unit.play("idle"); idleWindow = 1.5 + Math.random() * 1.5; }
          }
        }
        r.render(vs, cam);
      });

      return {
        setUnit(id, star, skin = null) {
          if (currentId !== null && currentId !== id) combat = false;
          unit?.dispose();
          turn.rotation.set(0, 0, 0);
          unit = createUnit(id, star, skin, viewerMaterials);
          currentId = id;
          unit.setCombat(combat);
          unit.update(0.016);
          turn.add(unit.root);
          new THREE.Box3().setFromObject(unit.root, true).getBoundingSphere(bounds);
          yaw = 0;
          pitch = 0;
          zoom = 1;
          previewAction = false;
          idleWindow = 1.5 + Math.random();
          resize();
        },
        setCombat(v) {
          combat = v;
          unit?.setCombat(v);
        },
        play(state) {
          if (!unit) return;
          if (state === "idle") {
            previewAction = false;
            idleWindow = 1.5 + Math.random() * 1.5;
            unit.play("idle");
          } else {
            previewAction = true;
            unit.play(state, { onDone: () => { previewAction = false; idleWindow = -(2 + Math.random() * 3); } });
          }
        },
        dispose() {
          combat = false;
          unit?.setCombat(false);
          r.setAnimationLoop(null);
          timer.dispose();
          ro.disconnect();
          r.domElement.removeEventListener("pointerdown", down);
          r.domElement.removeEventListener("pointermove", move);
          r.domElement.removeEventListener("pointerup", up);
          r.domElement.removeEventListener("pointercancel", up);
          r.domElement.removeEventListener("wheel", wheel);
          pointers.clear();
          unit?.dispose();
          for (const material of Object.values(viewerMaterials)) material.dispose();
          r.renderLists.dispose();
          if (!disposed && idleViewerRenderer === null) {
            idleViewerRenderer = r;
          } else {
            r.dispose();
            r.forceContextLoss();
          }
          r.domElement.remove();
        },
      };
    },
  };
}
