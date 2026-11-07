/**
 * sceneHitLowHpRuntime — direct-on-model damage flash helpers.
 *
 * Low-HP ring/glow has been intentionally disabled so beasts no longer get
 * any circular backdrop/accent behind the token body.
 */

type AnyObj = Record<string, unknown>;

interface CombatScene {
  scaleCombatDuration?: (ms: number) => number;
  tweens?: { add?: (config: AnyObj) => AnyObj | null };
}

interface IconStackEntry {
  target?: PhaserGameObject | null;
}

interface FlashSnapshot {
  alpha: number;
  fillColor: number | null;
  fillAlpha: number;
  strokeColor: number | null;
  strokeAlpha: number;
  lineWidth: number;
  isTinted: boolean;
  tintTopLeft: number;
  tintTopRight: number;
  tintBottomLeft: number;
  tintBottomRight: number;
}

interface FlashState {
  tween?: { remove?: () => void } | null;
  snapshots?: Array<{ node: PhaserGameObject; snapshot: FlashSnapshot }>;
}

interface PhaserGameObject extends AnyObj {
  active?: boolean;
  visible?: boolean;
  list?: PhaserGameObject[];
  alpha?: number;
  fillColor?: number;
  fillAlpha?: number;
  strokeColor?: number;
  strokeAlpha?: number;
  lineWidth?: number;
  isTinted?: boolean;
  tintTopLeft?: number;
  tintTopRight?: number;
  tintBottomLeft?: number;
  tintBottomRight?: number;
  x?: number;
  setFillStyle?: (color: number, alpha?: number) => unknown;
  setStrokeStyle?: (width: number, color: number, alpha?: number) => unknown;
  setTint?: (...args: unknown[]) => unknown;
  clearTint?: () => unknown;
  setAlpha?: (value: number) => unknown;
  getData?: (key: string) => unknown;
  __sharedHitJoltTween?: { remove?: () => void } | null;
  __sharedHitJoltBaseX?: number;
  __sharedLowHpAccent?: { tweens?: Array<{ remove?: () => void } | null>; glow?: { destroy?: () => void }; ring?: { destroy?: () => void } } | null;
}

interface UnitLike extends AnyObj {
  __sharedIconStack?: IconStackEntry[];
  icon?: PhaserGameObject;
  __sharedDamageFlashState?: FlashState;
  __sharedHitJoltTween?: { remove?: () => void } | null;
  __sharedHitJoltBaseX?: number;
  __sharedLowHpAccent?: { tweens?: Array<{ remove?: () => void } | null>; glow?: { destroy?: () => void }; ring?: { destroy?: () => void } } | null;
}

interface HitAccentOptions {
  damageLeft?: number;
}

interface HitJoltOptions extends HitAccentOptions {
  fromX?: number;
}

function scaleDuration(scene: CombatScene | null | undefined, ms: number): number {
  return typeof scene?.scaleCombatDuration === "function" ? scene.scaleCombatDuration(ms) : ms;
}

function mixColor(baseColor: number, flashColor: number, intensity: number): number {
  const t = Math.max(0, Math.min(1, Number(intensity) || 0));
  const baseR = (baseColor >> 16) & 0xff;
  const baseG = (baseColor >> 8) & 0xff;
  const baseB = baseColor & 0xff;
  const flashR = (flashColor >> 16) & 0xff;
  const flashG = (flashColor >> 8) & 0xff;
  const flashB = flashColor & 0xff;
  const blend = (a: number, b: number) => Math.round(a + (b - a) * t);
  return (blend(baseR, flashR) << 16) | (blend(baseG, flashG) << 8) | blend(baseB, flashB);
}

function getSharedVisualTargets(unit: UnitLike | null | undefined): PhaserGameObject[] {
  if (!unit) return [];
  if (Array.isArray(unit.__sharedIconStack) && unit.__sharedIconStack.length) {
    return unit.__sharedIconStack
      .map((entry) => entry?.target)
      .filter((target): target is PhaserGameObject => !!target && target.active !== false && target.visible !== false);
  }
  const icon = unit.icon;
  return icon?.active ? [icon] : [];
}

function collectStylableNodes(node: PhaserGameObject | null | undefined, bucket: PhaserGameObject[] = []): PhaserGameObject[] {
  if (!node || node.active === false) return bucket;
  if (Array.isArray(node.list)) {
    node.list.forEach((child) => collectStylableNodes(child, bucket));
  }
  if (
    typeof node.setFillStyle === "function"
    || typeof node.setStrokeStyle === "function"
    || typeof node.setTint === "function"
    || typeof node.clearTint === "function"
    || typeof node.setAlpha === "function"
  ) {
    bucket.push(node);
  }
  return bucket;
}

function captureNodeStyle(node: PhaserGameObject | null | undefined): FlashSnapshot {
  return {
    alpha: Number.isFinite(node?.alpha) ? (node!.alpha as number) : 1,
    fillColor: Number.isFinite(node?.fillColor) ? (node!.fillColor as number) : null,
    fillAlpha: Number.isFinite(node?.fillAlpha) ? (node!.fillAlpha as number) : 1,
    strokeColor: Number.isFinite(node?.strokeColor) ? (node!.strokeColor as number) : null,
    strokeAlpha: Number.isFinite(node?.strokeAlpha) ? (node!.strokeAlpha as number) : 1,
    lineWidth: Number.isFinite(node?.lineWidth) ? (node!.lineWidth as number) : 0,
    isTinted: node?.isTinted === true,
    tintTopLeft: Number.isFinite(node?.tintTopLeft) ? (node!.tintTopLeft as number) : 0xffffff,
    tintTopRight: Number.isFinite(node?.tintTopRight) ? (node!.tintTopRight as number) : 0xffffff,
    tintBottomLeft: Number.isFinite(node?.tintBottomLeft) ? (node!.tintBottomLeft as number) : 0xffffff,
    tintBottomRight: Number.isFinite(node?.tintBottomRight) ? (node!.tintBottomRight as number) : 0xffffff
  };
}

function applyFlashFrame(
  node: PhaserGameObject | null | undefined,
  snapshot: FlashSnapshot,
  flashColor: number,
  intensity: number,
  colorMixPeak: number
): void {
  if (!node || node.active === false) return;
  const safeIntensity = Math.max(0, Math.min(1, Number(intensity) || 0));
  const safeMix = Math.max(0, Math.min(1, (Number(colorMixPeak) || 0) * safeIntensity));
  if (snapshot.fillColor != null && typeof node.setFillStyle === "function") {
    node.setFillStyle(mixColor(snapshot.fillColor, flashColor, safeMix), snapshot.fillAlpha);
  }
  if (snapshot.strokeColor != null && typeof node.setStrokeStyle === "function" && snapshot.lineWidth > 0) {
    node.setStrokeStyle(
      snapshot.lineWidth,
      mixColor(snapshot.strokeColor, flashColor, Math.min(1, safeMix * 0.9)),
      snapshot.strokeAlpha
    );
  }
  if (
    snapshot.fillColor == null
    && snapshot.strokeColor == null
    && typeof node.setTint === "function"
  ) {
    node.setTint(mixColor(0xffffff, flashColor, Math.min(1, safeMix * 0.75)));
  }
}

function restoreNodeStyle(node: PhaserGameObject | null | undefined, snapshot: FlashSnapshot): void {
  if (!node) return;
  if (snapshot.fillColor != null && typeof node.setFillStyle === "function") {
    node.setFillStyle(snapshot.fillColor, snapshot.fillAlpha);
  }
  if (snapshot.strokeColor != null && typeof node.setStrokeStyle === "function") {
    node.setStrokeStyle(snapshot.lineWidth, snapshot.strokeColor, snapshot.strokeAlpha);
  }
  if (snapshot.isTinted && typeof node.setTint === "function") {
    node.setTint(
      snapshot.tintTopLeft,
      snapshot.tintTopRight,
      snapshot.tintBottomLeft,
      snapshot.tintBottomRight
    );
  } else {
    node.clearTint?.();
  }
  if (typeof node.setAlpha === "function") {
    node.setAlpha(snapshot.alpha);
  }
}

function stopSharedDamageFlash(target: PhaserGameObject | null | undefined): void {
  if (!target) return;
  const state = target.__sharedDamageFlashState as FlashState | undefined;
  if (!state) return;
  state.tween?.remove?.();
  state.snapshots?.forEach(({ node, snapshot }) => restoreNodeStyle(node, snapshot));
  delete target.__sharedDamageFlashState;
}

export function playSharedUnitHitAccent(
  _scene: CombatScene | null | undefined,
  unit: UnitLike | null | undefined,
  options: HitAccentOptions = {}
): void {
  const damageLeft = Math.max(0, Number(options.damageLeft) || 0);
  if (damageLeft <= 0) return;
  getSharedVisualTargets(unit).forEach((target) => {
    stopSharedDamageFlash(target);
  });
}

export function playSharedUnitHitJolt(
  scene: CombatScene | null | undefined,
  unit: UnitLike | null | undefined,
  options: HitJoltOptions = {}
): void {
  const damageLeft = Math.max(0, Number(options.damageLeft) || 0);
  if (damageLeft <= 0) return;
  const fromX = options.fromX;
  getSharedVisualTargets(unit).forEach((target) => {
    const direction = Number.isFinite(fromX) ? ((fromX as number) < (target.x ?? 0) ? 1 : -1) : -1;
    const baseX = Number(target.x) || 0;
    target.__sharedHitJoltTween?.remove?.();
    if (Number.isFinite(target.__sharedHitJoltBaseX)) {
      target.x = target.__sharedHitJoltBaseX;
    }
    target.__sharedHitJoltBaseX = baseX;
    const tween = scene?.tweens?.add?.({
      targets: target,
      x: baseX + direction * 5,
      duration: scaleDuration(scene, 65),
      yoyo: true,
      ease: "Sine.inOut",
      onComplete: () => {
        if (target?.active) {
          target.x = baseX;
        }
        target.__sharedHitJoltTween = null;
        delete target.__sharedHitJoltBaseX;
      }
    });
    if (tween) {
      target.__sharedHitJoltTween = tween as { remove?: () => void };
    } else {
      target.x = baseX;
      delete target.__sharedHitJoltBaseX;
    }
  });
}

export function ensureSharedLowHpAccent(
  _scene: CombatScene | null | undefined,
  unit: UnitLike | null | undefined
): null {
  clearSharedLowHpAccent(unit);
  return null;
}

export function clearSharedLowHpAccent(unit: UnitLike | null | undefined): void {
  if (!unit) return;
  const model = unit.icon ?? unit;
  const accent = model?.__sharedLowHpAccent;
  if (!accent) return;
  accent.tweens?.forEach((tween) => tween?.remove?.());
  accent.glow?.destroy?.();
  accent.ring?.destroy?.();
  delete model.__sharedLowHpAccent;
}
