import * as THREE from "three";
import { resolveUnitStarVisualIdentity } from "../visuals/unitStarVisualIdentity.js";
import type { ResolvedStarVisualIdentity, VisualLayerSpec } from "../visuals/starVisualTypes.js";

export interface ThreeAvatarSceneLike {
  textures?: {
    exists?: (key: string) => boolean;
    get?: (key: string) => THREE.Texture | null | undefined;
  };
}

export interface ThreeAvatarVisualModule {
  handlesStarEvolution?: boolean | null;
  createModel?: (scene: ThreeAvatarSceneLike, options: Record<string, unknown>) => THREE.Object3D | null;
}

export interface ThreeAvatarVisualLike {
  createModel?: ThreeAvatarVisualModule["createModel"];
  visual?: ThreeAvatarVisualModule;
  portraitKey?: string | null;
  previewIcon?: string;
  icon?: string;
}

export interface ThreeAvatarContainerLike {
  add: (object: THREE.Object3D) => unknown;
  userData?: Record<string, unknown>;
  dispose?: () => void;
}

export type ThreeUnitAvatarGroup = THREE.Group & {
  dispose: () => void;
};
interface ModelPlacement {
  dx: number;
  dy: number;
  scale: number;
}

interface AttachStarIdentityOptions {
  baseId?: string | null;
  star?: number;
  surface?: string;
  appearance?: unknown;
  classType?: string | null;
  tribe?: string | null;
  unitCore?: unknown;
  visualModule?: ThreeAvatarVisualModule | null;
  context?: Record<string, unknown>;
}

interface AddAvatarVisualOptions {
  baseId?: string | null;
  appearance?: unknown;
  surface?: string;
  ownerKind?: string;
  classType?: string | null;
  tribe?: string | null;
  unitCore?: unknown;
  collectionProfile?: unknown;
}

export interface CreateThreeUnitAvatarOptions {
  x?: number;
  y?: number;
  size?: number;
  visual?: ThreeAvatarVisualLike | null;
  star?: number;
  baseId?: string | null;
  appearance?: unknown;
  classType?: string | null;
  tribe?: string | null;
  unitCore?: unknown;
  surface?: string;
  ownerKind?: string;
  collectionProfile?: unknown;
  accentColor?: number;
  fallbackIcon?: string;
  frameFill?: number;
  innerFill?: number;
  innerStroke?: number;
  hp?: number | null;
  maxHp?: number | null;
}

function clampAvatarStar(star: number | string): 1 | 2 | 3 {
  const parsed = Math.round(Number(star) || 1);
  if (parsed <= 1) return 1;
  if (parsed >= 3) return 3;
  return parsed as 2;
}

function clampRatio(value: number | string | null | undefined): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

function normalizeVisualModule(visual: ThreeAvatarVisualLike | null = null): ThreeAvatarVisualModule | null {
  if (!visual) return null;
  if (typeof visual.createModel === "function") return visual as ThreeAvatarVisualModule;
  if (typeof visual.visual?.createModel === "function") return visual.visual;
  return null;
}

type ResolveOptions = NonNullable<Parameters<typeof resolveUnitStarVisualIdentity>[0]>;

/**
 * Resolve and attach the shared star identity decoration without importing
 * Phaser. Three.js receives a group containing lightweight procedural layers.
 */
export function attachUnitAvatarStarIdentity(
  scene: ThreeAvatarSceneLike | null | undefined,
  container: ThreeAvatarContainerLike | null | undefined,
  {
    baseId = null,
    star = 1,
    surface = "library",
    appearance = null,
    classType = null,
    tribe = null,
    unitCore = null,
    visualModule = null,
    context = {}
  }: AttachStarIdentityOptions = {}
): ResolvedStarVisualIdentity | null {
  if (!scene || !container?.add || !baseId || surface === "library") return null;

  const resolved = resolveUnitStarVisualIdentity({
    baseId,
    star,
    surface,
    appearance: appearance as ResolveOptions["appearance"],
    classType,
    tribe,
    unitCore: unitCore as ResolveOptions["unitCore"],
    visualModule: visualModule as ResolveOptions["visualModule"]
  });
  if (!resolved || resolved.handledByVisualModule || resolved.layers.length === 0) return resolved;

  const root = buildThreeStarVisualLayers(resolved, context);
  container.add(root);
  return resolved;
}

/** Preserve the 1★/2★/3★ avatar formation geometry from the Phaser renderer. */
export function buildUnitAvatarModelPlacements(size: number, star: number | string): ModelPlacement[] {
  const modelCount = clampAvatarStar(star);
  if (modelCount === 1) {
    return [{ dx: 0, dy: Math.round(size * 0.08), scale: 1 }];
  }
  if (modelCount === 2) {
    return [
      { dx: -Math.round(size * 0.22), dy: Math.round(size * 0.12), scale: 0.84 },
      { dx: Math.round(size * 0.22), dy: Math.round(size * 0.12), scale: 0.84 }
    ];
  }
  return [
    { dx: 0, dy: -Math.round(size * 0.08), scale: 0.78 },
    { dx: -Math.round(size * 0.27), dy: Math.round(size * 0.2), scale: 0.62 },
    { dx: Math.round(size * 0.27), dy: Math.round(size * 0.2), scale: 0.62 }
  ];
}

function addAvatarVisual(
  scene: ThreeAvatarSceneLike,
  container: THREE.Group,
  size: number,
  visual: ThreeAvatarVisualLike | null,
  star: number | string,
  fallbackIcon: string,
  hp: number | null = null,
  maxHp: number | null = null,
  options: AddAvatarVisualOptions = {}
): void {
  const {
    baseId = null,
    appearance = null,
    surface = "library",
    ownerKind = "LIBRARY",
    classType = null,
    tribe = null,
    unitCore = null,
    collectionProfile = null
  } = options;
  const modelCount = clampAvatarStar(star);
  const placements = buildUnitAvatarModelPlacements(size, modelCount);
  const maxHpValue = Number(maxHp);
  const hpRatio = maxHpValue > 0 ? clampRatio(Number(hp) / maxHpValue) : 1;
  const visualModule = normalizeVisualModule(visual);

  if (visualModule?.createModel) {
    try {
      let renderedCount = 0;
      placements.forEach((placement, index) => {
        const model = visualModule.createModel?.(scene, {
          x: Math.round(size * 0.5) + placement.dx,
          y: Math.round(size * 0.62) + placement.dy,
          scale: Math.max(0.44, Math.min(0.76, size / 118)) * placement.scale,
          star: modelCount,
          baseId,
          appearance,
          surface,
          ownerKind,
          classType,
          tribe,
          unitCore,
          collectionProfile
        });
        if (!model) return;
        const vitality = clampRatio(hpRatio * modelCount - index);
        const visible = vitality > 0.08;
        const alpha = visible ? Math.max(0.26, 0.36 + vitality * 0.64) : 0;
        setModelVisibility(model, visible, alpha);
        model.userData.avatarPlacement = placement;
        container.add(model);
        renderedCount += 1;
      });
      if (renderedCount > 0) return;
    } catch {
      // A production visual module is optional; continue to portrait/icon fallback.
    }
  }

  const portraitKey = visual?.portraitKey;
  const portraitTexture = portraitKey && scene.textures?.exists?.(portraitKey)
    ? scene.textures.get?.(portraitKey)
    : null;
  if (portraitTexture) {
    placements.forEach((placement) => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: portraitTexture, transparent: true }));
      sprite.position.set(
        (Math.round(size * 0.5) + placement.dx) / Math.max(1, size),
        (Math.round(size * 0.5) + placement.dy) / Math.max(1, size),
        0.05
      );
      sprite.scale.set((Math.max(18, size - 18) * placement.scale) / size, (Math.max(18, size - 18) * placement.scale) / size, 1);
      sprite.userData.portraitKey = portraitKey;
      sprite.userData.avatarOwnedMaterial = true;
      sprite.userData.avatarOwnedTexture = false;
      container.add(sprite);
    });
    return;
  }

  const icon = visual?.previewIcon ?? visual?.icon ?? fallbackIcon;
  placements.forEach((placement) => {
    const sprite = createTextSprite(icon, Math.max(20, Math.round(size * 0.42 * placement.scale)));
    sprite.position.set(
      (Math.round(size * 0.5) + placement.dx) / Math.max(1, size),
      (Math.round(size * 0.5) + placement.dy) / Math.max(1, size),
      0.05
    );
    sprite.userData.icon = icon;
    container.add(sprite);
  });
}

/**
 * Build a Three.js avatar frame and preserve the original visual priority:
 * model module → portrait texture → icon fallback.
 */
export function createUnitAvatar(
  scene: ThreeAvatarSceneLike,
  {
    x = 0,
    y = 0,
    size = 88,
    visual = null,
    star = 1,
    baseId = null,
    appearance = null,
    classType = null,
    tribe = null,
    unitCore = null,
    surface = "library",
    ownerKind = "LIBRARY",
    collectionProfile = null,
    accentColor = 0xffeab0,
    fallbackIcon = "🎀",
    frameFill = 0x101b2a,
    innerFill = 0x1d3045,
    innerStroke = 0x6a87a6,
    hp = null,
    maxHp = null
  }: CreateThreeUnitAvatarOptions = {}
): ThreeUnitAvatarGroup {
  const container = new THREE.Group() as ThreeUnitAvatarGroup;
  container.position.set(x, y, 0);
  container.userData = {
    baseId,
    star: clampAvatarStar(star),
    surface,
    ownerKind,
    size
  };
  const outer = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ color: frameFill, transparent: true, opacity: 0.98, side: THREE.DoubleSide })
  );
  outer.name = "avatar-frame";
  outer.userData.fill = frameFill;
  outer.userData.stroke = accentColor;
  outer.userData.avatarOwnedGeometry = true;
  outer.userData.avatarOwnedMaterial = true;

  const inner = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.max(16, size - 10), Math.max(16, size - 10)),
    new THREE.MeshBasicMaterial({ color: innerFill, transparent: true, opacity: 0.96, side: THREE.DoubleSide })
  );
  inner.name = "avatar-inner";
  inner.position.z = 0.01;
  inner.userData.stroke = innerStroke;
  inner.userData.avatarOwnedGeometry = true;
  inner.userData.avatarOwnedMaterial = true;
  container.add(outer);
  container.add(inner);

  attachUnitAvatarStarIdentity(scene, container, {
    baseId,
    star,
    surface,
    appearance,
    classType,
    tribe,
    unitCore,
    visualModule: normalizeVisualModule(visual),
    context: { ownerKind, collectionProfile, baseDepth: 0 }
  });

  addAvatarVisual(scene, container, size, visual, star, fallbackIcon, hp, maxHp, {
    baseId,
    appearance,
    surface,
    ownerKind,
    classType,
    tribe,
    unitCore,
    collectionProfile
  });

  container.dispose = () => disposeUnitAvatar(container);
  return container;
}

/**
 * Idempotent disposal of avatar-created Three.js resources.
 */
export function disposeUnitAvatar(root: THREE.Group): void {
  if (!root || root.userData?.disposed === true) return;
  root.userData.disposed = true;

  root.traverse((object) => {
    if (object === root) return;
    const mesh = object as THREE.Mesh;
    if (object.userData?.avatarOwnedGeometry === true && mesh.geometry && typeof mesh.geometry.dispose === "function") {
      mesh.geometry.dispose();
    }
    if (object.userData?.avatarOwnedMaterial === true && mesh.material) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((entry) => {
        const map = (entry as THREE.MeshBasicMaterial | THREE.SpriteMaterial).map;
        if (object.userData?.avatarOwnedTexture === true && map && typeof map.dispose === "function") {
          map.dispose();
        }
        if (typeof entry.dispose === "function") {
          entry.dispose();
        }
      });
    }
    if (typeof object.userData?.dispose === "function") {
      try {
        object.userData.dispose();
      } catch {
        // External model cleanup error is ignored safely
      }
    }
  });
  root.clear();
}

function setModelVisibility(model: THREE.Object3D, visible: boolean, alpha: number): void {
  model.visible = visible;
  model.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.material) return;
    const original = mesh.material;
    const materials = Array.isArray(original) ? original : [original];
    const clones = materials.map((mat) => {
      const cloned = mat.clone();
      cloned.transparent = true;
      cloned.opacity = alpha;
      return cloned;
    });
    mesh.material = Array.isArray(original) ? clones : clones[0];
    mesh.userData.avatarOwnedMaterial = true;
  });
}

function createTextSprite(text: string, fontSize: number): THREE.Sprite {
  if (typeof document === "undefined") {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff, transparent: true }));
    sprite.userData.avatarOwnedMaterial = true;
    return sprite;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = `${fontSize}px Segoe UI, Noto Color Emoji, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#ffffff";
    context.fillText(text, canvas.width / 2, canvas.height / 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.userData.canvas = canvas;
  sprite.userData.avatarOwnedMaterial = true;
  sprite.userData.avatarOwnedTexture = true;
  return sprite;
}

function buildThreeStarVisualLayers(
  identity: ResolvedStarVisualIdentity,
  context: Record<string, unknown>
): THREE.Group {
  const root = new THREE.Group();
  root.name = "star-identity";
  root.userData = { identity, context };
  identity.layers.forEach((layer) => {
    const node = createStarLayerNode(layer);
    root.add(node);
  });
  return root;
}

function createStarLayerNode(layer: VisualLayerSpec): THREE.Object3D {
  const color = layer.color ?? layer.accentColor ?? 0xffd166;
  let node: THREE.Object3D;
  if (layer.type === "aura_ring" || layer.type === "ground_sigils") {
    node = new THREE.Mesh(
      new THREE.RingGeometry(0.34, 0.43, 12),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: layer.alpha ?? 0.65, side: THREE.DoubleSide })
    );
    node.rotation.x = -Math.PI / 2;
  } else {
    node = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.07 * (layer.scale ?? 1), 0),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: layer.alpha ?? 0.8 })
    );
  }
  node.name = `star-layer-${layer.type}`;
  node.userData = { layer, avatarOwnedGeometry: true, avatarOwnedMaterial: true };
  return node;
}

export default { attachUnitAvatarStarIdentity, buildUnitAvatarModelPlacements, createUnitAvatar, disposeUnitAvatar };
