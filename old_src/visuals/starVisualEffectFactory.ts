import Phaser from "phaser";
import type { VisualLayerSpec, StarVisualAnchor } from "./starVisualTypes.js";

type AnyObj = Record<string, unknown>;

type AnyFn = (...args: unknown[]) => unknown;

interface FxPool {
  acquireCircle: (x: number, y: number, radius: number, color: number, alpha: number, depth: number) => Phaser.GameObjects.Arc | null;
  tween: (target: Phaser.GameObjects.Arc, config: AnyObj, key: string) => void;
}

interface FxPoolResult {
  root: Phaser.GameObjects.Container;
  motionTarget: Phaser.GameObjects.GameObject;
}

interface BuildLayerOptions {
  radius?: number;
  vertical?: boolean;
}

interface StarTweenConfig {
  targets: Phaser.GameObjects.GameObject | Phaser.GameObjects.GameObject[];
  scaleX?: string | number;
  scaleY?: string | number;
  scale?: string | number;
  alpha?: string | number | { from: number; to: number };
  y?: number | string;
  angle?: number;
  duration?: number;
  ease?: string;
  yoyo?: boolean;
  repeat?: number;
}

interface SceneLike {
  add: Phaser.GameObjects.GameObjectFactory;
  tweens: {
    add: (config: AnyObj) => Phaser.Tweens.Tween | null;
    remove?: (tween: Phaser.Tweens.Tween | null) => void;
  };
  fxPool?: FxPool | null;
}

interface VisualLayerOptions {
  baseDepth?: number;
}

interface ResolvedIdentity extends AnyObj {
  layers?: VisualLayerSpec[];
}

function safePush<T>(list: T[], value: T | null | undefined): T | null | undefined {
  if (value) list.push(value);
  return value;
}

function addTween(scene: SceneLike | null | undefined, tweens: (Phaser.Tweens.Tween | null)[], config: StarTweenConfig): Phaser.Tweens.Tween | null {
  const tween = scene?.tweens?.add?.(config as unknown as AnyObj) ?? null;
  if (tween) tweens.push(tween);
  return tween;
}

function callMethod(obj: AnyObj, name: string, ...args: unknown[]): void {
  const fn = obj[name] as AnyFn | undefined;
  if (typeof fn === "function") fn(...args);
}

function setCommonNodeProps(node: Phaser.GameObjects.GameObject | null | undefined, layer: VisualLayerSpec): Phaser.GameObjects.GameObject | null | undefined {
  if (!node) return node;
  const n = node as unknown as AnyObj;
  if (typeof layer.alpha === "number") callMethod(n, "setAlpha", layer.alpha);
  if (typeof layer.scale === "number") callMethod(n, "setScale", layer.scale);
  return node;
}

function getAnchorOffset(anchor: StarVisualAnchor = "base"): { x: number; y: number } {
  switch (anchor) {
    case "head":
      return { x: 0, y: -20 };
    case "side":
      return { x: 15, y: -8 };
    case "back":
      return { x: -12, y: -10 };
    case "orbit":
      return { x: 0, y: -14 };
    case "base":
    default:
      return { x: 0, y: 0 };
  }
}

function buildContainer(scene: SceneLike, x: number = 0, y: number = 0): Phaser.GameObjects.Container {
  return scene.add.container(x, y);
}

function buildAuraRing(scene: SceneLike, layer: VisualLayerSpec): FxPoolResult {
  const root = buildContainer(scene);
  const ring = scene.add.ellipse(
    0,
    0,
    Math.max(18, (layer.radiusX ?? 18) * 2),
    Math.max(8, (layer.radiusY ?? 9) * 2),
    layer.color ?? 0xffffff,
    layer.alpha ?? 0.18
  );
  callMethod(ring as unknown as AnyObj, "setStrokeStyle", 2, layer.accentColor ?? layer.color ?? 0xffffff, 0.9);
  root.add(ring);
  return { root, motionTarget: ring };
}

function buildGlyphCluster(scene: SceneLike, layer: VisualLayerSpec, fallbackGlyphs: string[]): FxPoolResult {
  const root = buildContainer(scene);
  const glyphs = Array.isArray(layer.glyphSet) && layer.glyphSet.length ? layer.glyphSet : fallbackGlyphs;
  const count = Math.max(1, Number(layer.count) || glyphs.length || 1);
  const spread = Math.max(8, Number(layer.spread) || 14);
  for (let index = 0; index < count; index += 1) {
    const glyph = glyphs[index % glyphs.length];
    const ratio = count === 1 ? 0.5 : index / Math.max(1, count - 1);
    const text = scene.add.text((ratio - 0.5) * spread, -Math.abs((ratio - 0.5) * spread) * 0.4, glyph, {
      fontFamily: "'Segoe UI Symbol', 'Segoe UI Emoji', Arial",
      fontSize: `${Math.max(12, Math.round((Number(layer.scale) || 1) * 13))}px`,
      color: `#${(layer.accentColor ?? layer.color ?? 0xffffff).toString(16).padStart(6, "0")}`,
      fontStyle: "bold",
      stroke: "#1f1206",
      strokeThickness: 2
    }).setOrigin(0.5);
    root.add(text);
  }
  return { root, motionTarget: root };
}

function buildParticleDots(scene: SceneLike, layer: VisualLayerSpec, opts: BuildLayerOptions = {}): FxPoolResult {
  const root = buildContainer(scene);
  const count = Math.max(1, Number(layer.count) || 1);
  const spread = Math.max(6, Number(layer.spread) || 12);
  const radius = Number(opts.radius) || 2.8;
  for (let index = 0; index < count; index += 1) {
    const ratio = count === 1 ? 0.5 : index / Math.max(1, count - 1);
    const x = (ratio - 0.5) * spread;
    const y = opts.vertical === true ? -ratio * spread * 0.7 : Math.sin(ratio * Math.PI) * -4;
    const dot = scene.add.circle(x, y, radius, layer.color ?? 0xffffff, layer.alpha ?? 0.8);
    callMethod(dot as unknown as AnyObj, "setStrokeStyle", 1, layer.accentColor ?? layer.color ?? 0xffffff, 0.7);
    root.add(dot);
  }
  return { root, motionTarget: root };
}

function buildLeafSwirl(scene: SceneLike, layer: VisualLayerSpec): FxPoolResult {
  const root = buildContainer(scene);
  const count = Math.max(1, Number(layer.count) || 2);
  const spread = Math.max(8, Number(layer.spread) || 14);
  for (let index = 0; index < count; index += 1) {
    const ratio = count === 1 ? 0.5 : index / Math.max(1, count - 1);
    const leaf = scene.add.ellipse((ratio - 0.5) * spread, -4 - Math.abs(ratio - 0.5) * 6, 7, 13, layer.color ?? 0x8edb89, layer.alpha ?? 0.84);
    callMethod(leaf as unknown as AnyObj, "setStrokeStyle", 1, layer.accentColor ?? 0xffffff, 0.65);
    callMethod(leaf as unknown as AnyObj, "setAngle", -20 + ratio * 40);
    root.add(leaf);
  }
  return { root, motionTarget: root };
}

function buildGroundSigils(scene: SceneLike, layer: VisualLayerSpec): FxPoolResult {
  const root = buildContainer(scene, 0, 2);
  const star = scene.add.star(0, 0, 5, 6, 12, layer.color ?? 0xffffff, layer.alpha ?? 0.45);
  callMethod(star as unknown as AnyObj, "setStrokeStyle", 1.4, layer.accentColor ?? layer.color ?? 0xffffff, 0.9);
  root.add(star);
  return { root, motionTarget: star };
}

function buildCrest(scene: SceneLike, layer: VisualLayerSpec): FxPoolResult {
  const root = buildContainer(scene);
  const crest = scene.add.star(0, 0, 4, 2.6, 5.4, layer.color ?? 0xffffff, layer.alpha ?? 0.9);
  callMethod(crest as unknown as AnyObj, "setStrokeStyle", 1, layer.accentColor ?? layer.color ?? 0xffffff, 0.8);
  root.add(crest);
  return { root, motionTarget: crest };
}

function buildSideOrnament(scene: SceneLike, layer: VisualLayerSpec): FxPoolResult {
  const root = buildContainer(scene);
  const count = Math.max(1, Number(layer.count) || 1);
  const spread = Math.max(12, Number(layer.spread) || 18);
  for (let index = 0; index < count; index += 1) {
    const x = count === 1 ? 0 : index === 0 ? -spread * 0.5 : spread * 0.5;
    const ornament = scene.add.ellipse(x, 0, 10, 5, layer.color ?? 0xffffff, layer.alpha ?? 0.72);
    callMethod(ornament as unknown as AnyObj, "setAngle", index === 0 ? -26 : 26);
    callMethod(ornament as unknown as AnyObj, "setStrokeStyle", 1, layer.accentColor ?? layer.color ?? 0xffffff, 0.7);
    root.add(ornament);
  }
  return { root, motionTarget: root };
}

function buildLayer(scene: SceneLike, layer: VisualLayerSpec): FxPoolResult {
  switch (layer.type) {
    case "aura_ring":
      return buildAuraRing(scene, layer);
    case "note_cluster":
      return buildGlyphCluster(scene, layer, ["♪", "♫", "♬"]);
    case "sleep_glyphs":
      return buildGlyphCluster(scene, layer, ["Z", "z", "☾"]);
    case "ember_stream":
      return buildParticleDots(scene, layer, { vertical: true, radius: 2.4 });
    case "electric_arc":
      return buildParticleDots(scene, layer, { radius: 1.8 });
    case "bubble_cluster":
      return buildParticleDots(scene, layer, { radius: 3.2 });
    case "leaf_swirl":
      return buildLeafSwirl(scene, layer);
    case "holy_mote":
      return buildParticleDots(scene, layer, { radius: 2.2 });
    case "ground_sigils":
      return buildGroundSigils(scene, layer);
    case "crest":
      return buildCrest(scene, layer);
    case "side_ornament":
      return buildSideOrnament(scene, layer);
    case "poison_droplet":
    case "stone_dust":
    case "shadow_wisp":
    case "feather_drift":
    case "void_shard":
    default:
      return buildParticleDots(scene, layer, { radius: 2.4 });
  }
}

function applyMotion(
  scene: SceneLike | null | undefined,
  tweens: (Phaser.Tweens.Tween | null)[],
  node: Phaser.GameObjects.GameObject | null | undefined,
  layer: VisualLayerSpec,
  anchor: { x: number; y: number }
): void {
  if (!node || !layer?.motion || !scene?.tweens) return;
  const motionScale = Math.max(0.15, Number(layer.extra?.motionScale) ?? 1);
  switch (layer.motion) {
    case "pulse":
      addTween(scene, tweens, {
        targets: node,
        scaleX: `+=${0.12 * motionScale}`,
        scaleY: `+=${0.12 * motionScale}`,
        alpha: { from: Math.max(0.05, (layer.alpha ?? 0.2) * 0.72), to: Math.min(1, (layer.alpha ?? 0.2) + 0.08) },
        duration: 1000 / motionScale,
        ease: "Sine.inOut",
        yoyo: true,
        repeat: -1
      });
      break;
    case "rise_fade":
      addTween(scene, tweens, {
        targets: node,
        y: anchor.y - 7 * motionScale,
        alpha: { from: Math.max(0.18, layer.alpha ?? 0.9), to: Math.max(0.06, (layer.alpha ?? 0.9) * 0.35) },
        duration: 850 / motionScale,
        ease: "Sine.inOut",
        yoyo: true,
        repeat: -1
      });
      break;
    case "orbit":
      addTween(scene, tweens, {
        targets: node,
        angle: 360,
        duration: 1800 / motionScale,
        ease: "Linear",
        repeat: -1
      });
      break;
    case "flicker":
    case "arc_crackle":
      addTween(scene, tweens, {
        targets: node,
        alpha: { from: Math.max(0.1, (layer.alpha ?? 0.8) * 0.55), to: Math.min(1, (layer.alpha ?? 0.8) + 0.12) },
        duration: 220 / motionScale,
        ease: "Sine.inOut",
        yoyo: true,
        repeat: -1
      });
      break;
    case "idle_float":
    default:
      addTween(scene, tweens, {
        targets: node,
        y: anchor.y - 4 * motionScale,
        duration: 1100 / motionScale,
        ease: "Sine.inOut",
        yoyo: true,
        repeat: -1
      });
      break;
  }
}

interface UnitStarVisualLayersResult {
  root: Phaser.GameObjects.Container;
  nodes: Phaser.GameObjects.GameObject[];
  tweens: (Phaser.Tweens.Tween | null)[];
  destroy: () => void;
}

export function buildUnitStarVisualLayers(
  scene: SceneLike,
  modelRoot: AnyObj,
  resolvedIdentity: ResolvedIdentity,
  context: VisualLayerOptions = {}
): UnitStarVisualLayersResult {
  void modelRoot;
  const root = buildContainer(scene, 0, 0);
  const nodes: Phaser.GameObjects.GameObject[] = [];
  const tweens: (Phaser.Tweens.Tween | null)[] = [];
  const layers = Array.isArray(resolvedIdentity?.layers) ? resolvedIdentity.layers : [];

  layers.forEach((layer, index) => {
    const anchor = getAnchorOffset(layer.anchor);
    const built = buildLayer(scene, layer);
    if (!built?.root) return;
    built.root.x = anchor.x;
    built.root.y = anchor.y;
    built.root.setDepth?.((context.baseDepth ?? 0) - (layers.length - index));
    callMethod(built.root as unknown as AnyObj, "setData", "sharedStarEvolutionDecoration", true);
    root.add?.(built.root);
    safePush(nodes, built.root);
    applyMotion(scene, tweens, built.motionTarget ?? built.root, layer, anchor);
  });

  return {
    root,
    nodes,
    tweens,
    destroy() {
      tweens.forEach((tween) => scene?.tweens?.remove?.(tween));
      root?.destroy?.();
    }
  };
}

export default { buildUnitStarVisualLayers };
