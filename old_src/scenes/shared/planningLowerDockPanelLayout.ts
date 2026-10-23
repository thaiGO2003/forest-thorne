interface LowerDockRect {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}

interface LowerDockHeaderArea {
  areaX: number;
  areaY: number;
  areaW: number;
  leftPad: number;
  rightPad: number;
}

interface LowerDockLayoutInput {
  width?: number;
  height?: number;
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
  boardPanelX?: number;
  boardPanelW?: number;
  benchY?: number;
  invY?: number;
  compactHud?: boolean;
  [key: string]: unknown;
}

interface LowerDockLayoutResult {
  compact: boolean;
  innerPad: number;
  titlePadX: number;
  contentCeilingY: number;
  root: LowerDockRect;
  shop: LowerDockRect;
  bench: LowerDockRect;
  storage: LowerDockRect;
  headerArea: {
    shop: LowerDockHeaderArea;
    bench: LowerDockHeaderArea;
    storage: LowerDockHeaderArea;
  };
}

function toNumber(value: unknown, fallback: number = 0): number {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function createRect(key: string, x: number, y: number, w: number, h: number): LowerDockRect {
  return {
    key,
    x,
    y,
    w,
    h,
    cx: x + w * 0.5,
    cy: y + h * 0.5
  };
}

export function buildPlanningLowerDockPanelLayoutKey(layout: LowerDockLayoutInput = {}): string {
  return [
    toNumber(layout.width),
    toNumber(layout.height),
    toNumber(layout.lowerTopY),
    toNumber(layout.lowerPanelH),
    toNumber(layout.shopRegionX),
    toNumber(layout.shopRegionW),
    toNumber(layout.benchSlotsRegionX, toNumber(layout.benchRegionX)),
    toNumber(layout.benchSlotsRegionW, toNumber(layout.benchRegionW)),
    toNumber(layout.craftRegionX),
    toNumber(layout.craftRegionW)
  ].join(":");
}

export function computePlanningLowerDockPanelLayout(layout: LowerDockLayoutInput = {}): LowerDockLayoutResult {
  const compact = layout.compactHud === true;
  const innerPad = compact ? 8 : 10;
  const titlePadX = compact ? 10 : 12;

  const outerX = toNumber(layout.boardPanelX);
  const outerY = toNumber(layout.lowerTopY);
  const outerW = toNumber(layout.boardPanelW);
  const outerH = toNumber(layout.lowerPanelH);
  const innerY = outerY + innerPad;
  const innerH = Math.max(0, outerH - innerPad * 2);

  const shopRegionX = toNumber(layout.shopRegionX);
  const shopRegionW = toNumber(layout.shopRegionW);
  const benchRegionX = toNumber(layout.benchSlotsRegionX, toNumber(layout.benchRegionX));
  const benchRegionW = toNumber(layout.benchSlotsRegionW, toNumber(layout.benchRegionW));
  const craftRegionX = toNumber(layout.craftRegionX);
  const craftRegionW = toNumber(layout.craftRegionW);

  const root = createRect("root", outerX, outerY, outerW, outerH);
  const shop = createRect("shop", shopRegionX + innerPad, innerY, Math.max(48, shopRegionW - innerPad), innerH);
  const bench = createRect("bench", benchRegionX, innerY, Math.max(48, benchRegionW), innerH);
  const storage = createRect("storage", craftRegionX, innerY, Math.max(48, craftRegionW - innerPad), innerH);

  const contentCeilingY = Number.isFinite(Number(layout.benchY))
    ? Number(layout.benchY)
    : (Number.isFinite(Number(layout.invY)) ? Number(layout.invY) : innerY);

  return {
    compact,
    innerPad,
    titlePadX,
    contentCeilingY,
    root,
    shop,
    bench,
    storage,
    headerArea: {
      shop: {
        areaX: shop.x,
        areaY: outerY,
        areaW: shop.w,
        leftPad: titlePadX,
        rightPad: 0
      },
      bench: {
        areaX: bench.x,
        areaY: outerY,
        areaW: bench.w,
        leftPad: titlePadX,
        rightPad: 12
      },
      storage: {
        areaX: storage.x,
        areaY: outerY,
        areaW: storage.w,
        leftPad: titlePadX,
        rightPad: 12
      }
    }
  };
}
