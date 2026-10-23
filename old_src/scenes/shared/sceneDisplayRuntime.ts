import type { UiSettings } from "../../core/uiSettings.js";
import { guiScaleToZoom, resolveResolution } from "../../core/uiSettings.js";

/**
 * Apply UI resolution + camera zoom through Phaser's Scale Manager.
 * Never scale the canvas via DOM/CSS — scene.scale.resize + refresh keeps
 * pointer coordinates aligned with rendered pixels.
 */
type DisplayScene = Phaser.Scene & {
  tooltip?: { refreshLayout?: () => void };
};

export function applySceneDisplaySettings(
  scene: DisplayScene,
  settings: UiSettings | null | undefined,
  options: { afterApply?: (scene: DisplayScene, settings: UiSettings | null | undefined) => void } = {}
): void {
  const resolution = resolveResolution(settings?.resolutionKey);
  if (resolution && scene?.scale) {
    scene.scale.resize(resolution.width, resolution.height);
  }

  scene?.scale?.refresh?.();

  const zoom = guiScaleToZoom(settings?.guiScale ?? 1);
  scene?.cameras?.main?.setZoom(zoom);
  scene?.tooltip?.refreshLayout?.();

  if (typeof options.afterApply === "function") {
    options.afterApply(scene, settings);
  }
}
