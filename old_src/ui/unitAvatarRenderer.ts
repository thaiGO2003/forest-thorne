import { UI_FONT } from "../core/uiTheme.js";
import { buildUnitStarVisualLayers } from "../visuals/starVisualEffectFactory.js";
import { resolveUnitStarVisualIdentity } from "../visuals/unitStarVisualIdentity.js";
import type { Scene as PhaserScene } from "phaser";
import type { ResolvedStarVisualIdentity } from "../visuals/starVisualTypes.js";

interface ModelPlacement {
  dx: number;
  dy: number;
  scale: number;
}

interface VisualModule {
  createModel: (
    scene: PhaserScene,
    options: {
      x: number;
      y: number;
      scale: number;
      star: number;
      baseId: string | null;
      appearance: unknown;
      surface: string;
      ownerKind: string;
      classType: string | null;
      tribe: string | null;
      unitCore: unknown;
      collectionProfile: unknown;
    }
  ) => Phaser.GameObjects.GameObject | null;
}

interface VisualLike {
  createModel?: (scene: PhaserScene, options: Record<string, unknown>) => Phaser.GameObjects.GameObject | null;
  visual?: VisualModule;
  portraitKey?: string | null;
  previewIcon?: string;
  icon?: string;
}

interface AvatarContainerLike {
  add: (child: Phaser.GameObjects.GameObject | Phaser.GameObjects.GameObject[]) => unknown;
  once: (event: string, handler: () => void) => unknown;
}

type StarAppearanceLike = {
  skinId?: string | null;
  handlesStarEvolution?: boolean | null;
  visual?: { handlesStarEvolution?: boolean | null } | null;
};

type StarUnitCoreLike = {
  classType?: string | null;
  tribe?: string | null;
};

type StarVisualModuleLike = { handlesStarEvolution?: boolean | null };

interface StarIdentityContext {
  ownerKind?: string;
  collectionProfile?: unknown;
  baseDepth?: number;
  [key: string]: unknown;
}

interface AttachStarIdentityOptions {
  baseId?: string | null;
  star?: number;
  surface?: string;
  appearance?: unknown;
  classType?: string | null;
  tribe?: string | null;
  unitCore?: unknown;
  visualModule?: VisualModule | null;
  context?: StarIdentityContext;
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

interface CreateUnitAvatarOptions {
  x?: number;
  y?: number;
  size?: number;
  visual?: VisualLike | null;
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
  return parsed as 2 | 3;
}

function clampRatio(value: number | string | null | undefined): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric <= 0) return 0;
  if (numeric >= 1) return 1;
  return numeric;
}

function normalizeVisualModule(visual: VisualLike | null = null): VisualModule | null {
  if (!visual) return null;
  if (typeof visual.createModel === "function") return visual as unknown as VisualModule;
  if (typeof visual.visual?.createModel === "function") return visual.visual;
  return null;
}

export function attachUnitAvatarStarIdentity(
  scene: PhaserScene | null | undefined,
  container: AvatarContainerLike | null | undefined,
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
  if (!scene?.add || !container?.add || !baseId) return null;
  if (surface === "library") return null;
  const resolved = resolveUnitStarVisualIdentity({
    baseId,
    star,
    surface,
    appearance: appearance as unknown as StarAppearanceLike | null,
    classType,
    tribe,
    unitCore: unitCore as unknown as StarUnitCoreLike | null,
    visualModule: visualModule as unknown as StarVisualModuleLike | null
  });
  if (!resolved || resolved.handledByVisualModule || !Array.isArray(resolved.layers) || resolved.layers.length === 0) {
    return resolved;
  }

  const handle = buildUnitStarVisualLayers(
    scene as unknown as Parameters<typeof buildUnitStarVisualLayers>[0],
    container as unknown as Parameters<typeof buildUnitStarVisualLayers>[1],
    resolved as unknown as Parameters<typeof buildUnitStarVisualLayers>[2],
    {
      ...context,
      baseDepth: Number.isFinite(context?.baseDepth) ? context.baseDepth : -1
    }
  );
  if (handle?.root) {
    container.add(handle.root);
    if (typeof container.once === "function") {
      container.once("destroy", () => handle.destroy?.());
    }
  }
  return resolved;
}

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
  scene: PhaserScene,
  container: Phaser.GameObjects.Container,
  size: number,
  visual: VisualLike | null,
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
  const hpValue = Number(hp);
  const maxHpValue = Number(maxHp);
  const hpRatio = maxHpValue > 0 ? clampRatio(hpValue / maxHpValue) : 1;
  const visualModule = normalizeVisualModule(visual);
  if (visualModule?.createModel) {
    try {
      let renderedCount = 0;
      placements.forEach((placement, index) => {
        const model = visualModule.createModel(scene, {
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
        const settable = model as Phaser.GameObjects.GameObject & {
          setVisible?: (v: boolean) => void;
          setAlpha?: (v: number) => void;
        };
        settable.setVisible?.(visible);
        settable.setAlpha?.(alpha);
        (model as unknown as { alpha: number }).alpha = alpha;
        container.add(model);
        renderedCount += 1;
      });
      if (renderedCount > 0) {
        return;
      }
    } catch {
      void 0;
    }
  }

  const portraitKey = visual?.portraitKey;
  if (portraitKey && scene?.textures?.exists?.(portraitKey)) {
    placements.forEach((placement) => {
      const portrait = scene.add.image(Math.round(size * 0.5) + placement.dx, Math.round(size * 0.5) + placement.dy, portraitKey).setOrigin(0.5);
      portrait.setDisplaySize(Math.max(18, size - 18) * placement.scale, Math.max(18, size - 18) * placement.scale);
      container.add(portrait);
    });
    return;
  }

  placements.forEach((placement) => {
    const icon = scene.add.text(Math.round(size * 0.5) + placement.dx, Math.round(size * 0.5) + placement.dy, visual?.previewIcon ?? visual?.icon ?? fallbackIcon, {
      fontFamily: UI_FONT,
      fontSize: `${Math.max(20, Math.round(size * 0.42 * placement.scale))}px`,
      color: "#ffffff"
    }).setOrigin(0.5);
    container.add(icon);
  });
}

export function createUnitAvatar(scene: PhaserScene, {
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
}: CreateUnitAvatarOptions = {}): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y);
  const outer = scene.add.rectangle(size * 0.5, size * 0.5, size, size, frameFill, 0.98);
  outer.setStrokeStyle(2, accentColor, 0.95);
  const inner = scene.add.rectangle(size * 0.5, size * 0.5, Math.max(16, size - 10), Math.max(16, size - 10), innerFill, 0.96);
  inner.setStrokeStyle(1, innerStroke, 0.65);
  container.add([outer, inner]);

  attachUnitAvatarStarIdentity(scene, container as unknown as AvatarContainerLike, {
    baseId,
    star,
    surface,
    appearance,
    classType,
    tribe,
    unitCore,
    visualModule: normalizeVisualModule(visual),
    context: {
      ownerKind,
      collectionProfile,
      baseDepth: 0
    }
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

  return container;
}