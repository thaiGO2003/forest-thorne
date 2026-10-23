import { clamp } from "../../core/gameUtils.js";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ScrollItem {
  item: { y: number; visible?: boolean; getBounds?: () => { bottom: number } | undefined };
  baseY: number;
}

type RightPanelScene = Phaser.Scene & {
  rightPanelArea: Rect | null;
  rightPanelScrollItems: ScrollItem[];
  rightPanelScrollOffset: number;
  rightPanelMaxScroll: number;
  [key: string]: unknown;
};

export function pointInPlanningRightPanel(scene: RightPanelScene, x: number, y: number): boolean {
  if (!scene.rightPanelArea) return false;
  return (
    x >= scene.rightPanelArea.x &&
    x <= scene.rightPanelArea.x + scene.rightPanelArea.w &&
    y >= scene.rightPanelArea.y &&
    y <= scene.rightPanelArea.y + scene.rightPanelArea.h
  );
}

export function refreshPlanningRightPanelScrollMetrics(scene: RightPanelScene): void {
  if (!scene.rightPanelArea || !scene.rightPanelScrollItems.length) return;
  const viewBottom = scene.rightPanelArea.y + scene.rightPanelArea.h;
  let contentBottom = scene.rightPanelArea.y;
  scene.rightPanelScrollItems.forEach((entry) => {
    if (!entry.item?.visible) return;
    const bounds = entry.item.getBounds?.();
    if (!bounds) return;
    const baseBottom = bounds.bottom + scene.rightPanelScrollOffset;
    if (baseBottom > contentBottom) contentBottom = baseBottom;
  });
  scene.rightPanelMaxScroll = Math.max(0, Math.ceil(contentBottom - viewBottom + 8));
  scene.rightPanelScrollOffset = clamp(scene.rightPanelScrollOffset, 0, scene.rightPanelMaxScroll);
  scene.rightPanelScrollItems.forEach((entry) => {
    entry.item.y = entry.baseY - scene.rightPanelScrollOffset;
  });
}

export function scrollPlanningRightPanel(scene: RightPanelScene, deltaY: number): void {
  if (!scene.rightPanelScrollItems?.length || !scene.rightPanelArea) return;
  const next = clamp(scene.rightPanelScrollOffset + (deltaY > 0 ? 36 : -36), 0, scene.rightPanelMaxScroll);
  scene.rightPanelScrollOffset = next;
  scene.rightPanelScrollItems.forEach((entry) => {
    entry.item.y = entry.baseY - scene.rightPanelScrollOffset;
  });
}
