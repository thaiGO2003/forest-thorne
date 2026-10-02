// A25 sky art: pixel-cartoon sun + rainbow, painted once to small canvases (nearest filter),
// placed at fixed world spots behind the enemy side so they stay spatially stable under orbit.
import * as THREE from "three";

type Own = <T extends { dispose(): void }>(x: T) => T;

/** Paint an `size`×`size` pixel grid; `px(x, y)` returns a CSS color or null for transparent. */
function pixelTexture(own: Own, w: number, h: number, px: (x: number, y: number) => string | null) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = px(x, y);
    if (v) { g.fillStyle = v; g.fillRect(x, y, 1, 1); }
  }
  const t = own(new THREE.CanvasTexture(c));
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createSky(root: THREE.Group, own: Own): { update(dt: number): void } {
  // Sun: round core, lighter rim highlight, 8 stubby rays, cheeky face.
  const S = 32, C = 15.5;
  const sunTex = pixelTexture(own, S, S, (x, y) => {
    const dx = x - C, dy = y - C, r = Math.hypot(dx, dy);
    if (r <= 8.5) {
      if ((x === 12 || x === 19) && (y === 13 || y === 14)) return "#5a3410"; // eyes
      if (y === 18 && x >= 13 && x <= 18 && !(x === 13 || x === 18)) return "#5a3410"; // smile
      if (y === 17 && (x === 13 || x === 18)) return "#5a3410";
      if (y === 16 && (x === 10 || x === 21)) return "#ff9a6a"; // cheeks
      return r > 7.2 ? "#ffb52e" : dx + dy < -6 ? "#fff3a0" : "#ffd84a";
    }
    const a = Math.atan2(dy, dx), k = Math.round((a / Math.PI) * 4);
    const onRay = Math.abs(a - (k * Math.PI) / 4) < 0.16;
    if (onRay && r > 10 && r < (k % 2 ? 13.5 : 15.5)) return "#ffc93a";
    return null;
  });
  const sun = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: sunTex, fog: false, depthWrite: false })));
  sun.scale.set(9, 9, 1);
  sun.position.set(-26, 30, -60);
  sun.name = "sky-sun";

  // Rainbow: 6 bands on a half annulus, pixel-stepped, slight transparency.
  const W = 96, H = 48, R0 = 34, BAND = 2.4;
  const BANDS = ["#ff5a5a", "#ff9b3d", "#ffe14a", "#6fd14f", "#4fa8ff", "#9b6dff"];
  const bowTex = pixelTexture(own, W, H, (x, y) => {
    const r = Math.hypot(x + 0.5 - W / 2, H - (y + 0.5));
    const b = Math.floor((R0 + BANDS.length * BAND - r) / BAND);
    return b >= 0 && b < BANDS.length ? BANDS[b]! : null;
  });
  const bowMat = own(new THREE.MeshBasicMaterial({ map: bowTex, transparent: true, opacity: 0.78, fog: false, depthWrite: false }));
  const bow = new THREE.Mesh(own(new THREE.PlaneGeometry(48, 24)), bowMat);
  bow.position.set(22, 4, -78);
  bow.name = "sky-rainbow";

  for (const o of [sun, bow]) { o.raycast = () => {}; o.renderOrder = -1; root.add(o); }

  let t = 0;
  return {
    // Gentle sun "breathing"; position never moves.
    update(dt) {
      t += dt;
      const k = 9 * (1 + Math.sin(t * 1.4) * 0.03);
      sun.scale.set(k, k, 1);
    },
  };
}
