import { UI_COLORS } from "../../core/uiTheme.js";
import { computePlanningLowerDockPanelLayout } from "./planningLowerDockPanelLayout.js";

interface LowerDockChromeScene {
  add: { rectangle: (x: number, y: number, w: number, h: number, fill: number, alpha: number) => RectangleLike };
  layout?: unknown;
  [key: string]: unknown;
}

interface RectangleLike {
  setStrokeStyle: (width: number, color: number, alpha?: number) => void;
  setDepth: (depth: number) => void;
  destroy?: () => void;
}

interface PanelOptions {
  fill?: number;
  alpha?: number;
  stroke?: number;
  strokeAlpha?: number;
  depth?: number;
}

interface LowerDockChromeLayoutInput {
  boardPanelX?: number;
  boardPanelW?: number;
  lowerTopY?: number;
  lowerPanelH?: number;
  shopRegionX?: number;
  shopRegionW?: number;
  benchSlotsRegionX?: number;
  benchSlotsRegionW?: number;
  benchRegionX?: number;
  benchRegionW?: number;
  craftRegionX?: number;
  craftRegionW?: number;
  compactHud?: boolean;
  [key: string]: unknown;
}

function createPanel(scene: LowerDockChromeScene, bounds: { x: number; y: number; w: number; h: number }, options: PanelOptions = {}): RectangleLike {
  const panel = scene.add.rectangle(
    bounds.x + bounds.w * 0.5,
    bounds.y + bounds.h * 0.5,
    bounds.w,
    bounds.h,
    options.fill ?? 0x0d1624,
    options.alpha ?? 0.9
  );
  panel.setStrokeStyle(1, options.stroke ?? UI_COLORS.panelEdgeSoft, options.strokeAlpha ?? 0.72);
  panel.setDepth(options.depth ?? 1488);
  return panel;
}

export function createPlanningLowerDockPanelChrome(
  scene: LowerDockChromeScene,
  layout: LowerDockChromeLayoutInput = scene?.layout as LowerDockChromeLayoutInput
): { dock: ReturnType<typeof computePlanningLowerDockPanelLayout>; nodes: RectangleLike[] } {
  const dock = computePlanningLowerDockPanelLayout(layout);
  return {
    dock,
    nodes: [
      createPanel(scene, dock.root, { fill: 0x0a1320, alpha: 0.9, stroke: UI_COLORS.panelEdge }),
      createPanel(scene, dock.shop, { fill: 0x0f1a2a, alpha: 0.9 }),
      createPanel(scene, dock.bench, { fill: 0x0f1a2a, alpha: 0.9 }),
      createPanel(scene, dock.storage, { fill: 0x101c2e, alpha: 0.92 })
    ]
  };
}
