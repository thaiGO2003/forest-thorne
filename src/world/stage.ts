// Render host: renderer + tactical camera + orbit controls + arena, one RAF loop (A91.1, A91.5).
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Profile } from "../board/geometry";
import { createArena, type Arena, type LightPhase, type ShadowQuality } from "./arena";
import { FAR, FOV, framingDistance, MAX_POLAR, maxDistance, MIN_DISTANCE, NEAR, panStep, smoothstep } from "./camera";

export interface Stage {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  arena: Arena;
  setProfile(p: Profile): void;
  setPhase(phase: LightPhase): void;
  /** Joystick/gamepad pan vector in [-1,1]² (A91.1); keyboard WASD/arrows add to it. */
  setPan(x: number, y: number): void;
  /** Cap rendered frames without creating a second timer/render loop. */
  setFpsLimit(fps: number): void;
  setShadowQuality(q: ShadowQuality): void;
  setShadowsEnabled(enabled: boolean): void;
  /** Scale drawing-buffer resolution without changing logical/CSS layout size. */
  setRenderScale(scale: number): void;
  renderer: THREE.WebGLRenderer;
  /** Per-frame callback (dt seconds) for presentation layers such as unit rigs; returns unsubscribe. */
  onFrame(fn: (dt: number) => void): () => void;
  dispose(): void;
}

const REFRAME_S = 0.5;
const PAN_KEYS: Record<string, [number, number]> = {
  KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
};
/** Tactical view direction: behind the allied side, looking across the board. */
const VIEW_DIR = new THREE.Vector3(0, 0.82, 0.57).normalize();
export function effectivePixelRatio(deviceRatio: number, quality: ShadowQuality, renderScale: number): number {
  const dpr = Number.isFinite(deviceRatio) && deviceRatio > 0 ? deviceRatio : 1;
  const scale = Number.isFinite(renderScale) ? Math.min(1, Math.max(0.5, renderScale)) : 1;
  const cap = quality === "low" ? 1 : 2;
  return Math.min(dpr, cap) * scale;
}


export function createStage(host: HTMLElement, profile: Profile = "solo"): Stage {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(effectivePixelRatio(devicePixelRatio, "high", 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, NEAR, FAR);
  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.05, minDistance: MIN_DISTANCE, minPolarAngle: 0, maxPolarAngle: MAX_POLAR });
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

  let current = profile;
  let arena = createArena(scene, current);
  arena.setPhase("planning");
  let shadowQuality: ShadowQuality = "high";
  let shadowsEnabled = true;
  let renderScale = 1;
  const applyPixelRatio = () => renderer.setPixelRatio(effectivePixelRatio(devicePixelRatio, shadowQuality, renderScale));

  // Profile reframe: smoothstep from current distance to framing distance over 0.5 s.
  let reframe: { from: number; to: number; t: number } | null = null;
  const aspect = () => camera.aspect;
  const frame = (instant: boolean) => {
    controls.maxDistance = maxDistance(current, aspect());
    const to = framingDistance(current, aspect());
    if (instant) camera.position.copy(controls.target).addScaledVector(VIEW_DIR, to);
    else reframe = { from: camera.position.distanceTo(controls.target), to, t: 0 };
  };

  const resize = () => {
    const previousAspect = camera.aspect;
    const distance = camera.position.distanceTo(controls.target);
    const followedFraming = Math.abs(distance - framingDistance(current, previousAspect)) < Math.max(0.75, distance * 0.03);
    applyPixelRatio();
    const w = host.clientWidth || innerWidth, h = host.clientHeight || innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    controls.maxDistance = maxDistance(current, camera.aspect);
    // Orientation changes otherwise retain a landscape dolly and crop the
    // battlefield on portrait. Respect an intentionally zoomed camera.
    if (followedFraming && Math.abs(camera.aspect - previousAspect) > 0.01) frame(false);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();
  frame(true);

  // Camera pan: joystick vector + held keys; camera and target move by the same displacement.
  const stick = { x: 0, y: 0 };
  const held = new Set<string>();
  const editable = (t: EventTarget | null) =>
    t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName));
  const keyDown = (e: KeyboardEvent) => { if (e.code in PAN_KEYS && !editable(e.target)) held.add(e.code); };
  const keyUp = (e: KeyboardEvent) => held.delete(e.code);
  const blur = () => held.clear();
  addEventListener("keydown", keyDown);
  addEventListener("keyup", keyUp);
  addEventListener("blur", blur);
  const panOffset = new THREE.Vector3(), fwd = new THREE.Vector3();
  const frameFns = new Set<(dt: number) => void>();
  let fpsLimit = 60;
  let lastRenderMs = Number.NEGATIVE_INFINITY;

  const timer = new THREE.Timer();
  renderer.setAnimationLoop((now) => {
    const minFrameMs = 1000 / fpsLimit;
    if (now - lastRenderMs < minFrameMs - 0.5) return;
    lastRenderMs = now;
    timer.update(now);
    const dt = Math.max(0, timer.getDelta());
    let px = stick.x, py = stick.y;
    for (const k of held) { px += PAN_KEYS[k]![0]; py += PAN_KEYS[k]![1]; }
    if (px || py) {
      // Screen-relative input → world axes via camera yaw; panStep owns deadzone/dt cap/clamp.
      fwd.subVectors(controls.target, camera.position).setY(0).normalize();
      const wx = -fwd.z * px - fwd.x * py, wz = fwd.x * px - fwd.z * py;
      const next = panStep(controls.target.x, controls.target.z, wx, wz, dt);
      panOffset.set(next.x - controls.target.x, 0, next.z - controls.target.z);
      controls.target.add(panOffset);
      camera.position.add(panOffset);
    }
    if (reframe) {
      reframe.t = Math.min(1, reframe.t + dt / REFRAME_S);
      const d = reframe.from + (reframe.to - reframe.from) * smoothstep(reframe.t);
      const dir = camera.position.clone().sub(controls.target).normalize();
      camera.position.copy(controls.target).addScaledVector(dir, d);
      if (reframe.t >= 1) reframe = null;
    }
    arena.update(dt);
    for (const fn of frameFns) fn(dt);
    controls.update();
    renderer.render(scene, camera);
  });

  return {
    scene,
    camera,
    renderer,
    get arena() { return arena; },
    setProfile(p) {
      if (p === current) return;
      arena.dispose();
      current = p;
      arena = createArena(scene, p);
      arena.setPhase("planning");
      arena.setShadowQuality(shadowQuality);
      arena.setShadowsEnabled(shadowsEnabled);
      frame(false);
    },
    setPhase: (phase) => arena.setPhase(phase),
    setPan(x, y) { stick.x = x; stick.y = y; },
    setFpsLimit(fps) {
      fpsLimit = Number.isFinite(fps) ? Math.max(1, fps) : 60;
      lastRenderMs = Number.NEGATIVE_INFINITY;
      timer.reset();
    },
    setRenderScale(scale) {
      renderScale = Number.isFinite(scale) ? Math.min(1, Math.max(0.5, scale)) : 1;
      applyPixelRatio();
    },
    setShadowQuality(q) {
      shadowQuality = q;
      arena.setShadowQuality(q);
      applyPixelRatio();
    },
    setShadowsEnabled(enabled) {
      shadowsEnabled = enabled;
      renderer.shadowMap.enabled = enabled;
      arena.setShadowsEnabled(enabled);
    },
    onFrame(fn) { frameFns.add(fn); return () => frameFns.delete(fn); },
    dispose() {
      renderer.setAnimationLoop(null);
      timer.dispose();
      frameFns.clear();
      removeEventListener("keydown", keyDown);
      removeEventListener("keyup", keyUp);
      removeEventListener("blur", blur);
      ro.disconnect();
      controls.dispose();
      arena.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
