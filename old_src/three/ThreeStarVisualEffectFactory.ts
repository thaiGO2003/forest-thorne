import * as THREE from "three";
import type { VisualLayerSpec, StarVisualAnchor, StarVisualMotion } from "../visuals/starVisualTypes.js";

type AnyObj = Record<string, unknown>;

export interface VisualLayerOptions {
  baseDepth?: number;
  [key: string]: unknown;
}

export interface ResolvedIdentity extends AnyObj {
  layers?: VisualLayerSpec[];
}

export interface ThreeStarVisualLayersResult {
  root: THREE.Group;
  nodes: THREE.Object3D[];
  destroy: () => void;
  update: (deltaSeconds?: number) => void;
}

interface MotionState {
  type: StarVisualMotion;
  baseX: number;
  baseY: number;
  baseZ: number;
  baseAlpha: number;
  baseScale: number;
  time: number;
  motionScale: number;
}

/**
 * Maps anchor positions to relative 3D coordinate offsets.
 */
export function getAnchorOffset(anchor: StarVisualAnchor = "base"): { x: number; y: number; z: number } {
  switch (anchor) {
    case "head":
      return { x: 0, y: -20, z: 0.05 };
    case "side":
      return { x: 15, y: -8, z: 0.05 };
    case "back":
      return { x: -12, y: -10, z: -0.05 };
    case "orbit":
      return { x: 0, y: -14, z: 0.05 };
    case "base":
    default:
      return { x: 0, y: 0, z: 0 };
  }
}

/**
 * Creates a sprite with high-DPI text/glyph rendered to a canvas texture.
 */
function createGlyphSprite(text: string, color: number, fontSize: number = 14): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, 64, 64);
    ctx.font = `bold ${fontSize * 2}px 'Segoe UI Symbol', 'Segoe UI Emoji', Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
    ctx.strokeStyle = "#1f1206";
    ctx.lineWidth = 3;
    ctx.strokeText(text, 32, 32);
    ctx.fillText(text, 32, 32);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(fontSize, fontSize, 1);
  sprite.userData.avatarOwnedTexture = true;
  sprite.userData.avatarOwnedMaterial = true;
  return sprite;
}

function buildAuraRing(layer: VisualLayerSpec): { root: THREE.Group; motionTarget: THREE.Object3D } {
  const root = new THREE.Group();
  const radiusX = Math.max(9, layer.radiusX ?? 18);
  const radiusY = Math.max(4, layer.radiusY ?? 9);
  const avgRadius = (radiusX + radiusY) * 0.5;
  const color = layer.color ?? 0xffffff;
  const alpha = layer.alpha ?? 0.18;

  const geometry = new THREE.RingGeometry(avgRadius * 0.75, avgRadius * 1.05, 24);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: alpha,
    side: THREE.DoubleSide
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.scale.set(radiusX / avgRadius, radiusY / avgRadius, 1);
  mesh.userData.avatarOwnedGeometry = true;
  mesh.userData.avatarOwnedMaterial = true;

  root.add(mesh);
  return { root, motionTarget: mesh };
}

function buildGlyphCluster(layer: VisualLayerSpec, fallbackGlyphs: string[]): { root: THREE.Group; motionTarget: THREE.Object3D } {
  const root = new THREE.Group();
  const glyphs = Array.isArray(layer.glyphSet) && layer.glyphSet.length ? layer.glyphSet : fallbackGlyphs;
  const count = Math.max(1, Number(layer.count) || glyphs.length || 1);
  const spread = Math.max(8, Number(layer.spread) || 14);
  const color = layer.accentColor ?? layer.color ?? 0xffffff;
  const fontSize = Math.max(12, Math.round((Number(layer.scale) || 1) * 13));

  for (let index = 0; index < count; index += 1) {
    const glyph = glyphs[index % glyphs.length];
    const ratio = count === 1 ? 0.5 : index / Math.max(1, count - 1);
    const sprite = createGlyphSprite(glyph, color, fontSize);
    sprite.position.set(
      (ratio - 0.5) * spread,
      -Math.abs((ratio - 0.5) * spread) * 0.4,
      0.02
    );
    root.add(sprite);
  }

  return { root, motionTarget: root };
}

function buildParticleDots(layer: VisualLayerSpec, opts: { radius?: number; vertical?: boolean } = {}): { root: THREE.Group; motionTarget: THREE.Object3D } {
  const root = new THREE.Group();
  const count = Math.max(1, Number(layer.count) || 1);
  const spread = Math.max(6, Number(layer.spread) || 12);
  const radius = Number(opts.radius) || 2.8;
  const color = layer.color ?? 0xffffff;
  const alpha = layer.alpha ?? 0.8;

  for (let index = 0; index < count; index += 1) {
    const ratio = count === 1 ? 0.5 : index / Math.max(1, count - 1);
    const x = (ratio - 0.5) * spread;
    const y = opts.vertical === true ? -ratio * spread * 0.7 : Math.sin(ratio * Math.PI) * -4;

    const geometry = new THREE.SphereGeometry(radius * 0.5, 8, 8);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: alpha
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, 0.02);
    mesh.userData.avatarOwnedGeometry = true;
    mesh.userData.avatarOwnedMaterial = true;
    root.add(mesh);
  }

  return { root, motionTarget: root };
}

function buildLeafSwirl(layer: VisualLayerSpec): { root: THREE.Group; motionTarget: THREE.Object3D } {
  const root = new THREE.Group();
  const count = Math.max(1, Number(layer.count) || 2);
  const spread = Math.max(8, Number(layer.spread) || 14);
  const color = layer.color ?? 0x8edb89;
  const alpha = layer.alpha ?? 0.84;

  for (let index = 0; index < count; index += 1) {
    const ratio = count === 1 ? 0.5 : index / Math.max(1, count - 1);
    const geometry = new THREE.ConeGeometry(3, 8, 4);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: alpha,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set((ratio - 0.5) * spread, -4 - Math.abs(ratio - 0.5) * 6, 0.02);
    mesh.rotation.z = (-20 + ratio * 40) * (Math.PI / 180);
    mesh.userData.avatarOwnedGeometry = true;
    mesh.userData.avatarOwnedMaterial = true;
    root.add(mesh);
  }

  return { root, motionTarget: root };
}

function buildGroundSigils(layer: VisualLayerSpec): { root: THREE.Group; motionTarget: THREE.Object3D } {
  const root = new THREE.Group();
  const color = layer.color ?? 0xffffff;
  const alpha = layer.alpha ?? 0.45;

  const geometry = new THREE.RingGeometry(5, 12, 5);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: alpha,
    side: THREE.DoubleSide
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.userData.avatarOwnedGeometry = true;
  mesh.userData.avatarOwnedMaterial = true;
  root.add(mesh);

  return { root, motionTarget: mesh };
}

function buildCrest(layer: VisualLayerSpec): { root: THREE.Group; motionTarget: THREE.Object3D } {
  const root = new THREE.Group();
  const color = layer.color ?? 0xffffff;
  const alpha = layer.alpha ?? 0.9;

  const geometry = new THREE.OctahedronGeometry(4, 0);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: alpha
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.avatarOwnedGeometry = true;
  mesh.userData.avatarOwnedMaterial = true;
  root.add(mesh);

  return { root, motionTarget: mesh };
}

function buildSideOrnament(layer: VisualLayerSpec): { root: THREE.Group; motionTarget: THREE.Object3D } {
  const root = new THREE.Group();
  const count = Math.max(1, Number(layer.count) || 1);
  const spread = Math.max(12, Number(layer.spread) || 18);
  const color = layer.color ?? 0xffffff;
  const alpha = layer.alpha ?? 0.72;

  for (let index = 0; index < count; index += 1) {
    const x = count === 1 ? 0 : index === 0 ? -spread * 0.5 : spread * 0.5;
    const geometry = new THREE.BoxGeometry(6, 3, 2);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: alpha
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, 0, 0.02);
    mesh.rotation.z = (index === 0 ? -26 : 26) * (Math.PI / 180);
    mesh.userData.avatarOwnedGeometry = true;
    mesh.userData.avatarOwnedMaterial = true;
    root.add(mesh);
  }

  return { root, motionTarget: root };
}

function buildLayer(layer: VisualLayerSpec): { root: THREE.Group; motionTarget: THREE.Object3D } {
  switch (layer.type) {
    case "aura_ring":
      return buildAuraRing(layer);
    case "note_cluster":
      return buildGlyphCluster(layer, ["♪", "♫", "♬"]);
    case "sleep_glyphs":
      return buildGlyphCluster(layer, ["Z", "z", "☾"]);
    case "ember_stream":
      return buildParticleDots(layer, { vertical: true, radius: 2.4 });
    case "electric_arc":
      return buildParticleDots(layer, { radius: 1.8 });
    case "bubble_cluster":
      return buildParticleDots(layer, { radius: 3.2 });
    case "leaf_swirl":
      return buildLeafSwirl(layer);
    case "holy_mote":
      return buildParticleDots(layer, { radius: 2.2 });
    case "ground_sigils":
      return buildGroundSigils(layer);
    case "crest":
      return buildCrest(layer);
    case "side_ornament":
      return buildSideOrnament(layer);
    case "poison_droplet":
    case "stone_dust":
    case "shadow_wisp":
    case "feather_drift":
    case "void_shard":
    default:
      return buildParticleDots(layer, { radius: 2.4 });
  }
}

function attachMotion(
  node: THREE.Object3D,
  layer: VisualLayerSpec,
  anchor: { x: number; y: number; z: number }
): void {
  if (!node || !layer?.motion) return;
  const motionScale = Math.max(0.15, Number(layer.extra?.motionScale) ?? 1);

  const motionState: MotionState = {
    type: layer.motion,
    baseX: anchor.x,
    baseY: anchor.y,
    baseZ: anchor.z,
    baseAlpha: layer.alpha ?? 1,
    baseScale: Number(layer.scale) || 1,
    time: 0,
    motionScale
  };

  node.userData.motionState = motionState;
}

function updateNodeMotion(node: THREE.Object3D, deltaSeconds: number): void {
  const state = node.userData?.motionState as MotionState | undefined;
  if (!state) return;

  state.time += deltaSeconds * state.motionScale;
  const t = state.time;

  switch (state.type) {
    case "pulse": {
      const pulseFactor = 1 + Math.sin(t * Math.PI * 2) * 0.12;
      node.scale.set(state.baseScale * pulseFactor, state.baseScale * pulseFactor, 1);
      break;
    }
    case "rise_fade": {
      const cycle = (t * 1.2) % 1;
      node.position.y = state.baseY - cycle * 7;
      const alpha = state.baseAlpha * (1 - cycle * 0.65);
      node.traverse((child) => {
        const mat = (child as THREE.Mesh).material;
        if (mat && !Array.isArray(mat)) {
          mat.opacity = alpha;
        }
      });
      break;
    }
    case "orbit": {
      node.rotation.z = t * Math.PI * 1.1;
      break;
    }
    case "flicker":
    case "arc_crackle": {
      const flicker = 0.6 + Math.random() * 0.4;
      node.traverse((child) => {
        const mat = (child as THREE.Mesh).material;
        if (mat && !Array.isArray(mat)) {
          mat.opacity = state.baseAlpha * flicker;
        }
      });
      break;
    }
    case "idle_float":
    default: {
      node.position.y = state.baseY - Math.sin(t * Math.PI * 1.8) * 4;
      break;
    }
  }
}

/**
 * Builds 3D star visual effect layers for a unit or model root.
 */
export function buildUnitStarVisualLayers(
  scene: unknown,
  modelRoot: unknown,
  resolvedIdentity: ResolvedIdentity,
  context: VisualLayerOptions = {}
): ThreeStarVisualLayersResult {
  void scene;
  void modelRoot;

  const root = new THREE.Group();
  root.name = "star-visual-layers";
  const nodes: THREE.Object3D[] = [];
  const layers = Array.isArray(resolvedIdentity?.layers) ? resolvedIdentity.layers : [];

  layers.forEach((layer, index) => {
    const anchor = getAnchorOffset(layer.anchor);
    const built = buildLayer(layer);
    if (!built?.root) return;

    built.root.position.set(anchor.x, anchor.y, anchor.z);
    built.root.renderOrder = (context.baseDepth ?? 0) - (layers.length - index);
    built.root.userData.sharedStarEvolutionDecoration = true;

    root.add(built.root);
    nodes.push(built.root);
    attachMotion(built.motionTarget ?? built.root, layer, anchor);
  });

  return {
    root,
    nodes,
    destroy() {
      root.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.userData?.avatarOwnedGeometry && mesh.geometry) {
          mesh.geometry.dispose();
        }
        const material = mesh.material;
        const materials = Array.isArray(material) ? material : material ? [material] : [];
        materials.forEach((entry) => {
          if (mesh.userData?.avatarOwnedMaterial && typeof entry?.dispose === "function") {
            const map = (entry as THREE.SpriteMaterial).map;
            if (mesh.userData?.avatarOwnedTexture && map && typeof map.dispose === "function") {
              map.dispose();
            }
            entry.dispose();
          }
        });
      });
      root.clear();
    },
    update(deltaSeconds: number = 0.016) {
      nodes.forEach((node) => {
        updateNodeMotion(node, deltaSeconds);
        node.children.forEach((child) => updateNodeMotion(child, deltaSeconds));
      });
    }
  };
}

export default { buildUnitStarVisualLayers };
