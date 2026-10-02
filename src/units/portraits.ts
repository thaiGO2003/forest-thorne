// Unit portraits (§25.4, A24, A90 rule 5): the avatar is always the real unit rig, never a separate
// thumbnail. Cards get cached snapshots from one small offscreen renderer (queued, a few per frame);
// the Library detail gets a live viewer with idle-by-default, drag rotation, zoom and action preview.
import * as THREE from "three";
import type { PortraitProvider } from "../ui/card";
import { createUnit } from "./registry";
import type { ActionState, Star, UnitVisual } from "./rig";

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

/** Place camera so the unit's bounding box fills the frame at the inspection angle. */
function frame(camera: THREE.PerspectiveCamera, obj: THREE.Object3D, zoom = 1) {
  const box = new THREE.Box3().setFromObject(obj, true);
  const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) * 0.62;
  const dist = (radius / Math.tan((camera.fov * Math.PI) / 360)) * zoom;
  camera.position.set(center.x + Math.sin(VIEW_YAW) * dist, center.y + dist * 0.28, center.z + Math.cos(VIEW_YAW) * dist);
  camera.lookAt(center);
  camera.near = dist / 50; camera.far = dist * 6;
  camera.updateProjectionMatrix();
}

export interface PortraitViewer {
  setUnit(baseId: string, star: Star): void;
  play(state: ActionState): void;
  dispose(): void;
}

export interface Portraits extends PortraitProvider {
  createViewer(host: HTMLElement): PortraitViewer;
}

export function createPortraits(): Portraits {
  const cache = new Map<string, HTMLCanvasElement>();
  const queue: { id: string; star: Star; key: string }[] = [];
  const queued = new Set<string>();
  const listeners = new Set<() => void>();
  let renderer: THREE.WebGLRenderer | null = null;
  const scene = new THREE.Scene();
  light(scene);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  const pump = () => {
    if (!queue.length) return;
    renderer ??= new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(SNAP, SNAP, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    for (let n = 0; n < PER_FRAME && queue.length; n++) {
      const job = queue.shift()!;
      const u = createUnit(job.id, job.star);
      u.update(0.016);
      scene.add(u.root);
      frame(camera, u.root);
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
    get(id, star) {
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
      const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
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
      let unit: UnitVisual | null = null, zoom = 1, yaw = 0, dragging = false;
      const pointers = new Map<number, { x: number; y: number }>();
      let pinch = 0;

      const resize = () => {
        const w = host.clientWidth || 1, h = host.clientHeight || 1;
        r.setSize(w, h, false);
        cam.aspect = w / h;
        if (unit) frame(cam, turn, zoom);
      };
      const ro = new ResizeObserver(resize);
      ro.observe(host);

      const down = (e: PointerEvent) => { pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); r.domElement.setPointerCapture(e.pointerId); dragging = true; };
      const move = (e: PointerEvent) => {
        const prev = pointers.get(e.pointerId);
        if (!prev) return;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size === 2) {
          const [a, b] = [...pointers.values()];
          const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
          if (pinch) setZoom(zoom * (pinch / d));
          pinch = d;
        } else yaw += (e.clientX - prev.x) * 0.012;
      };
      const up = (e: PointerEvent) => { pointers.delete(e.pointerId); pinch = 0; dragging = pointers.size > 0; };
      const wheel = (e: WheelEvent) => { e.preventDefault(); setZoom(zoom * (1 + Math.sign(e.deltaY) * 0.1)); };
      const setZoom = (z: number) => { zoom = Math.min(1.8, Math.max(0.55, z)); if (unit) frame(cam, turn, zoom); };
      r.domElement.addEventListener("pointerdown", down);
      r.domElement.addEventListener("pointermove", move);
      r.domElement.addEventListener("pointerup", up);
      r.domElement.addEventListener("pointercancel", up);
      r.domElement.addEventListener("wheel", wheel, { passive: false });

      const clock = new THREE.Clock();
      r.setAnimationLoop(() => {
        const dt = clock.getDelta();
        if (!dragging) yaw += dt * 0.15; // slow showcase turn while idle
        turn.rotation.y = yaw;
        unit?.update(dt);
        r.render(vs, cam);
      });

      return {
        setUnit(id, star) {
          unit?.dispose();
          unit = createUnit(id, star);
          unit.update(0.016);
          turn.add(unit.root);
          yaw = 0;
          resize();
        },
        play(state) { unit?.play(state); },
        dispose() {
          r.setAnimationLoop(null);
          ro.disconnect();
          unit?.dispose();
          r.dispose();
          r.domElement.remove();
        },
      };
    },
  };
}
