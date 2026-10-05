// Voxel part builder for unit rigs (§22.4, A24, A90). A rig is a tree of pivot `Part`s; every box
// added to a part is merged into ONE BufferGeometry per material bucket, so each pivot costs one
// draw call. Dense micro-voxel grids cull faces shared by filled neighbours (hidden-face culling).
// Authoring space: 1 unit = 1 voxel = 0.1 board block. +Z = face/front, +Y = up, ground at y=0.
import * as THREE from "three";

export type V3 = readonly [number, number, number];
export type Bucket = "solid" | "glow" | "glass";

export interface BoxOpts {
  /** Euler rotation (radians) of the box about its own centre. */
  rot?: V3;
  /** Material bucket: solid (lit, opaque), glow (unlit emissive), glass (intentional translucency). */
  mat?: Bucket;
}

/** Unit-cube faces as quads (a,b,c,d), CCW seen from outside: (b-a)×(c-a) points along `n`. */
const FACES: { n: V3; c: [V3, V3, V3, V3] }[] = [
  { n: [1, 0, 0], c: [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]] },
  { n: [-1, 0, 0], c: [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]] },
  { n: [0, 1, 0], c: [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]] },
  { n: [0, -1, 0], c: [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1]] },
  { n: [0, 0, 1], c: [[1, -1, 1], [1, 1, 1], [-1, 1, 1], [-1, -1, 1]] },
  { n: [0, 0, -1], c: [[-1, -1, -1], [-1, 1, -1], [1, 1, -1], [1, -1, -1]] },
];
/** Neighbour offset per face index, for grid culling. */
const NEIGHBOUR: V3[] = FACES.map((f) => f.n);

class Accum {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
}

const tmpColor = new THREE.Color();
const tmpEuler = new THREE.Euler();
const tmpQuat = new THREE.Quaternion();
const tmpV = new THREE.Vector3();
const tmpN = new THREE.Vector3();

/** One pivot of the rig. `group` is what pose functions rotate/translate. */
export class Part {
  readonly group = new THREE.Group();
  private readonly acc: Partial<Record<Bucket, Accum>> = {};

  constructor(readonly name: string, at: V3 = [0, 0, 0]) {
    this.group.name = name;
    this.group.position.set(at[0], at[1], at[2]);
  }

  private bucket(b: Bucket): Accum {
    return (this.acc[b] ??= new Accum());
  }

  private face(a: Accum, f: number, cx: number, cy: number, cz: number, hx: number, hy: number, hz: number, color: number, q: THREE.Quaternion | null) {
    const F = FACES[f]!;
    tmpColor.setHex(color);
    tmpN.set(F.n[0], F.n[1], F.n[2]);
    if (q) tmpN.applyQuaternion(q);
    for (const k of [0, 1, 2, 0, 2, 3]) {
      const c = F.c[k]!;
      tmpV.set(c[0] * hx, c[1] * hy, c[2] * hz);
      if (q) tmpV.applyQuaternion(q);
      a.pos.push(tmpV.x + cx, tmpV.y + cy, tmpV.z + cz);
      a.nor.push(tmpN.x, tmpN.y, tmpN.z);
      a.col.push(tmpColor.r, tmpColor.g, tmpColor.b);
    }
  }

  /** Box centred at `c` with full size `s` (voxels), in this pivot's local space. */
  box(c: V3, s: V3, color: number, o: BoxOpts = {}): this {
    const a = this.bucket(o.mat ?? "solid");
    let q: THREE.Quaternion | null = null;
    if (o.rot) q = tmpQuat.setFromEuler(tmpEuler.set(o.rot[0], o.rot[1], o.rot[2]));
    for (let f = 0; f < 6; f++) this.face(a, f, c[0], c[1], c[2], s[0] / 2, s[1] / 2, s[2] / 2, color, q);
    return this;
  }

  /** Mirror helper: same box at +x and -x (bilateral anatomy). */
  pair(c: V3, s: V3, color: number, o: BoxOpts = {}): this {
    this.box(c, s, color, o);
    const r = o.rot ? ([o.rot[0], -o.rot[1], -o.rot[2]] as const) : undefined;
    return this.box([-c[0], c[1], c[2]], s, color, { ...o, rot: r });
  }

  /**
   * Coat pattern: `n` small raised patches scattered deterministically over the top and both side
   * faces of the box region (c, s). Used for spots/rosettes/warts; never changes the silhouette.
   */
  spots(c: V3, s: V3, color: number, n: number, seed: number, size = 0.8, o: BoxOpts = {}): this {
    let r = seed >>> 0 || 1;
    const rnd = () => ((r = Math.imul(r ^ (r >>> 15), 2246822519) + 0x9e3779b9 >>> 0) / 4294967296);
    const [hx, hy, hz] = [s[0] / 2, s[1] / 2, s[2] / 2], lift = 0.06;
    for (let i = 0; i < n; i++) {
      const face = rnd(), u = rnd() * 2 - 1, v = rnd() * 2 - 1, w = size * (0.7 + rnd() * 0.6), d = size * (0.7 + rnd() * 0.6);
      if (face < 0.5) this.box([c[0] + u * (hx - w / 2), c[1] + hy + lift, c[2] + v * (hz - d / 2)], [w, 0.14, d], color, o);
      else {
        const side = face < 0.75 ? 1 : -1;
        this.box([c[0] + side * (hx + lift), c[1] + u * (hy - w / 2), c[2] + v * (hz - d / 2)], [0.14, w, d], color, o);
      }
    }
    return this;
  }

  /**
   * Dense micro-voxel grid with hidden-face culling. `layers[y][z]` is a row string along +x;
   * `.`/space = empty, other chars index `palette`. Origin = centre of the grid's minimum corner cell.
   * Row 0 of each layer is the BACK (-z) row; y layer 0 is the bottom.
   */
  voxels(origin: V3, cell: number, layers: readonly (readonly string[])[], palette: Readonly<Record<string, number>>, o: { mat?: Bucket; centerX?: boolean } = {}): this {
    const a = this.bucket(o.mat ?? "solid");
    const at = (x: number, y: number, z: number) => {
      const ch = layers[y]?.[z]?.[x];
      return ch !== undefined && ch !== "." && ch !== " " && palette[ch] !== undefined;
    };
    const width = Math.max(...layers.flatMap((l) => l.map((r) => r.length)));
    const ox = o.centerX ? origin[0] - ((width - 1) * cell) / 2 : origin[0];
    const h = cell / 2;
    for (let y = 0; y < layers.length; y++) for (let z = 0; z < layers[y]!.length; z++) {
      const row = layers[y]![z]!;
      for (let x = 0; x < row.length; x++) {
        if (!at(x, y, z)) continue;
        const color = palette[row[x]!]!;
        const cx = ox + x * cell, cy = origin[1] + y * cell, cz = origin[2] + z * cell;
        for (let f = 0; f < 6; f++) {
          const n = NEIGHBOUR[f]!;
          if (at(x + n[0], y + n[1], z + n[2])) continue; // shared face: hidden, culled
          this.face(a, f, cx, cy, cz, h, h, h, color, null);
        }
      }
    }
    return this;
  }

  /** Bake accumulated boxes into meshes (one per bucket). Called once by the rig runtime. */
  bake(mats: Record<Bucket, THREE.Material>, out: THREE.BufferGeometry[]) {
    for (const b of ["solid", "glow", "glass"] as const) {
      const a = this.acc[b];
      if (!a || !a.pos.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(a.pos, 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(a.nor, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(a.col, 3));
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mats[b]);
      m.name = `${this.name}:${b}`;
      m.castShadow = b === "solid";
      m.renderOrder = b === "glass" ? 2 : 0;
      this.group.add(m);
      out.push(g);
    }
    delete this.acc.solid; delete this.acc.glow; delete this.acc.glass;
  }
}

/** Builder handed to every unit's `build`. Owns the part list so the runtime can bake/dispose. */
export class Kit {
  readonly parts: Part[] = [];
  constructor(readonly body: THREE.Group) {}

  /** New pivot under `parent` (a Part or the body root) at local position `at`. */
  part(name: string, parent: Part | null = null, at: V3 = [0, 0, 0]): Part {
    const p = new Part(name, at);
    (parent ? parent.group : this.body).add(p.group);
    this.parts.push(p);
    return p;
  }
}
