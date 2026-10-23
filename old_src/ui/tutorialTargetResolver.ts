import type { Scene as PhaserScene, Cameras } from "phaser";

const DEFAULT_SCREEN_PADDING = 16;
const DEFAULT_TARGET_RADIUS = 24;
const PLAYER_FRONTLINE_SLOTS: Array<{ row: number; col: number }> = [
  { row: 2, col: 4 }, { row: 1, col: 4 }, { row: 3, col: 4 }, { row: 2, col: 3 },
  { row: 0, col: 4 }, { row: 4, col: 4 }, { row: 1, col: 3 }, { row: 3, col: 3 },
  { row: 2, col: 2 }
];
const PLAYER_BACKLINE_SLOTS: Array<{ row: number; col: number }> = [
  { row: 2, col: 1 }, { row: 1, col: 1 }, { row: 3, col: 1 }, { row: 2, col: 0 },
  { row: 0, col: 1 }, { row: 4, col: 1 }, { row: 1, col: 0 }, { row: 3, col: 0 },
  { row: 2, col: 2 }
];

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  centerX: number;
  centerY: number;
}

interface Point {
  x: number;
  y: number;
}

interface AnchorMeta {
  key?: string;
  placement?: string;
  buttonKey?: string;
  index?: number;
  itemId?: string | null;
  row?: number;
  col?: number;
  focusKind?: string;
}

export interface Anchor extends AnchorMeta {
  rect: Rect;
  x: number;
  y: number;
  radius?: number;
  recommendation?: unknown;
  suggestion?: unknown;
}

type SlotRect = Rect & { slotW?: number; slotH?: number; benchIndex?: number };

interface DisplayObjectLike {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  width?: number;
  height?: number;
  originX?: number;
  originY?: number;
  radius?: number;
  getBounds?: () => { x?: number; y?: number; width?: number; height?: number } | null;
}

interface BoardCellRef {
  row: number;
  col: number;
}

interface BoardOccupiedRef extends BoardCellRef {
  unit?: { equips?: string[] } | null;
}

interface BenchUnitRef {
  unit: { equips?: string[]; base?: { classType?: string }; classType?: string } | null;
  index: number;
}

interface RecommendationCell {
  row: number;
  col: number;
  benchIndex: number;
  lane: "frontline" | "backline";
  classType: string | null;
}

interface InventoryCellRef {
  itemId?: string | null;
  index?: number;
  bg?: DisplayObjectLike;
}

interface ShopCardLike {
  bg?: DisplayObjectLike;
}

interface SlotLike {
  bg?: DisplayObjectLike;
  x?: number;
  y?: number;
  slotW?: number;
  slotH?: number;
  benchIndex?: number;
}

interface ChipLike {
  bg?: DisplayObjectLike;
  label?: DisplayObjectLike;
  value?: DisplayObjectLike;
}

interface ShopOfferLike {
  baseId?: string;
}

interface ButtonLike {
  bg?: DisplayObjectLike;
}

interface TileSize {
  tileW?: number;
  tileH?: number;
}

interface TargetBase {
  kind: string;
  role?: string;
}

interface ScreenTarget extends TargetBase {
  kind: "screen";
  key: string;
  placement?: string;
}

interface ShopCardTarget extends TargetBase {
  kind: "shopCard";
  index?: number;
}

interface ShopFirstAvailableTarget extends TargetBase {
  kind: "shopFirstAvailable";
}

interface BenchSlotTarget extends TargetBase {
  kind: "benchSlot";
  index?: number;
}

interface BenchFirstOccupiedTarget extends TargetBase {
  kind: "benchFirstOccupied" | "benchAnyOccupied";
}

interface SynergyPanelTarget extends TargetBase {
  kind: "synergyPanel";
}

interface ButtonTarget extends TargetBase {
  kind: "button" | "settingsControl" | "statChip";
  key: string;
}

interface BoardCellTarget extends TargetBase {
  kind: "boardCell";
  row: number;
  col: number;
}

interface BoardOccupiedTarget extends TargetBase {
  kind: "boardFirstOccupied" | "boardAnyOccupied" | "boardAnyEquipped" | "boardAnyEmptyCell";
}

interface BoardDeployTarget extends TargetBase {
  kind: "boardRecommendedDeploy";
}

interface BoardRepositionTarget extends TargetBase {
  kind: "boardSuggestedReposition";
}

interface InventoryTarget extends TargetBase {
  kind: "inventoryFirstOccupied" | "inventoryItem";
  itemId?: string | null;
}

interface CraftSlotTarget extends TargetBase {
  kind: "craftSlot" | "craftOutput";
  index?: number;
}

interface ActionTarget extends TargetBase {
  kind: "sellButton" | "unequipButton" | "historyClose";
}

interface AnyTarget extends TargetBase {
  kind: "any";
}

type NormalizedTarget =
  | AnyTarget
  | ScreenTarget
  | ShopCardTarget
  | ShopFirstAvailableTarget
  | BenchSlotTarget
  | BenchFirstOccupiedTarget
  | SynergyPanelTarget
  | ButtonTarget
  | BoardCellTarget
  | BoardOccupiedTarget
  | BoardDeployTarget
  | BoardRepositionTarget
  | InventoryTarget
  | CraftSlotTarget
  | ActionTarget
  | { kind: string; [k: string]: unknown };

interface TutorialSceneLike extends PhaserScene, Record<string, unknown> {
  player?: {
    bench?: Array<{ equips?: string[] } | null | undefined>;
    board?: Array<Array<{ equips?: string[] } | null | undefined>>;
    shop?: Array<ShopOfferLike | null | undefined>;
  };
  cameras: PhaserScene["cameras"] & { main?: Cameras.Scene2D.Camera };
  gridToScreen?: (col: number, row: number) => Point | null;
  getTileSize?: () => TileSize | null;
  shopCards?: ShopCardLike[];
  benchSlots?: SlotLike[];
  inventoryCells?: InventoryCellRef[];
  modalButtons?: Record<string, ButtonLike>;
  _settingsPanelObj?: { buttons?: Record<string, ButtonLike> };
  synergyTitleText?: DisplayObjectLike;
  synergyText?: DisplayObjectLike;
  buttons?: Record<string, ButtonLike>;
  headerStatChips?: Record<string, ChipLike>;
  craftInputSlots?: SlotLike[];
  craftOutputSlot?: { bg?: DisplayObjectLike };
  historyCloseBg?: DisplayObjectLike;
  historyCloseText?: DisplayObjectLike;
}

function toRect(left: number, top: number, width: number, height: number): Rect {
  const safeWidth = Math.max(0, Number(width) || 0);
  const safeHeight = Math.max(0, Number(height) || 0);
  return {
    left,
    top,
    width: safeWidth,
    height: safeHeight,
    right: left + safeWidth,
    bottom: top + safeHeight,
    centerX: left + safeWidth / 2,
    centerY: top + safeHeight / 2
  };
}

function mergeRects(rects: Array<Rect | null | undefined>): Rect | null {
  const validRects = rects.filter(Boolean) as Rect[];
  if (!validRects.length) return null;
  const left = Math.min(...validRects.map((rect) => rect.left));
  const top = Math.min(...validRects.map((rect) => rect.top));
  const right = Math.max(...validRects.map((rect) => rect.right));
  const bottom = Math.max(...validRects.map((rect) => rect.bottom));
  return toRect(left, top, right - left, bottom - top);
}

function rectContainsPoint(rect: Rect | null | undefined, x: number | null | undefined, y: number | null | undefined): boolean {
  if (!rect) return false;
  if (x == null || y == null) return false;
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

export function getDisplayRect(displayObject: DisplayObjectLike | null | undefined): Rect | null {
  if (!displayObject) return null;

  if (typeof displayObject.getBounds === "function") {
    const bounds = displayObject.getBounds();
    if (bounds && Number.isFinite(bounds.x) && Number.isFinite(bounds.y) && Number.isFinite(bounds.width) && Number.isFinite(bounds.height)) {
      return toRect(bounds.x as number, bounds.y as number, bounds.width as number, bounds.height as number);
    }
  }

  if (Number.isFinite(displayObject.x) && Number.isFinite(displayObject.y)) {
    if (Number.isFinite(displayObject.w) && Number.isFinite(displayObject.h)) {
      return toRect(displayObject.x as number, displayObject.y as number, displayObject.w as number, displayObject.h as number);
    }
    if (Number.isFinite(displayObject.width) && Number.isFinite(displayObject.height)) {
      const originX = Number.isFinite(displayObject.originX) ? (displayObject.originX as number) : 0.5;
      const originY = Number.isFinite(displayObject.originY) ? (displayObject.originY as number) : 0.5;
      return toRect(
        (displayObject.x as number) - (displayObject.width as number) * originX,
        (displayObject.y as number) - (displayObject.height as number) * originY,
        displayObject.width as number,
        displayObject.height as number
      );
    }
    if (Number.isFinite(displayObject.radius)) {
      const radius = displayObject.radius as number;
      const diameter = radius * 2;
      return toRect((displayObject.x as number) - radius, (displayObject.y as number) - radius, diameter, diameter);
    }
  }

  return null;
}

function parseLegacyTarget(target: unknown): NormalizedTarget {
  if (typeof target !== "string") {
    return (target ?? { kind: "screen", key: "center" }) as NormalizedTarget;
  }
  if (target === "center") return { kind: "screen", key: "center", placement: "center" };
  if (target === "synergy_bar") return { kind: "synergyPanel" };
  if (target === "combat_button") return { kind: "button", key: "start" };

  const shopMatch = target.match(/^shop_card_(\d+)$/);
  if (shopMatch) {
    return { kind: "shopCard", index: Number(shopMatch[1]) };
  }

  const benchMatch = target.match(/^bench_slot_(\d+)$/);
  if (benchMatch) {
    return { kind: "benchSlot", index: Number(benchMatch[1]) };
  }

  const boardMatch = target.match(/^board_cell_(\d+)_(\d+)$/);
  if (boardMatch) {
    return { kind: "boardCell", col: Number(boardMatch[1]), row: Number(boardMatch[2]) };
  }

  return { kind: "screen", key: "center" };
}

function createAnchorFromRect(rect: Rect | null | undefined, meta: AnchorMeta = {}): Anchor | null {
  if (!rect) return null;
  return {
    rect,
    x: rect.centerX,
    y: rect.centerY,
    radius: Math.max(DEFAULT_TARGET_RADIUS, Math.min(rect.width, rect.height) * 0.6),
    ...meta
  };
}

function createMergedAnchor(anchors: Array<Anchor | null | undefined>, meta: AnchorMeta = {}): Anchor | null {
  const mergedRect = mergeRects(anchors.map((anchor) => anchor?.rect));
  return createAnchorFromRect(mergedRect, meta);
}

function resolveBoardCellAnchor(scene: TutorialSceneLike, target: BoardCellRef): Anchor | null {
  if (typeof scene.gridToScreen !== "function") return null;
  const point = scene.gridToScreen(target.col, target.row);
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  const tileSize = typeof scene.getTileSize === "function" ? scene.getTileSize() : null;
  const width = Math.max(32, tileSize?.tileW ?? 60);
  const height = Math.max(20, tileSize?.tileH ?? 30);
  return createAnchorFromRect(
    toRect(point.x - width / 2, point.y - height / 2, width, height),
    { key: "boardCell", row: target.row, col: target.col }
  );
}

function getFirstOccupiedBenchUnit(scene: TutorialSceneLike): BenchUnitRef {
  const bench = Array.isArray(scene.player?.bench) ? scene.player.bench : [];
  const index = bench.findIndex((unit) => !!unit);
  if (index < 0) return { unit: null, index: -1 };
  return { unit: bench[index] ?? null, index };
}

function getFirstOccupiedBoardCell(scene: TutorialSceneLike): BoardOccupiedRef | null {
  const board = Array.isArray(scene.player?.board) ? scene.player.board : [];
  for (let row = 0; row < board.length; row += 1) {
    const currentRow = Array.isArray(board[row]) ? board[row] : [];
    for (let col = 0; col < currentRow.length; col += 1) {
      if (currentRow[col]) return { row, col, unit: currentRow[col] ?? null };
    }
  }
  return null;
}

function getFirstEquippedBoardCell(scene: TutorialSceneLike): BoardOccupiedRef | null {
  const board = Array.isArray(scene.player?.board) ? scene.player.board : [];
  for (let row = 0; row < board.length; row += 1) {
    const currentRow = Array.isArray(board[row]) ? board[row] : [];
    for (let col = 0; col < currentRow.length; col += 1) {
      const unit = currentRow[col];
      if (unit?.equips?.length) return { row, col, unit };
    }
  }
  return null;
}

function getFirstEmptyBoardCell(scene: TutorialSceneLike): BoardCellRef | null {
  const board = Array.isArray(scene.player?.board) ? scene.player.board : [];
  for (let row = 0; row < board.length; row += 1) {
    const currentRow = Array.isArray(board[row]) ? board[row] : [];
    for (let col = 0; col < currentRow.length; col += 1) {
      if (!currentRow[col]) return { row, col };
    }
  }
  return null;
}

function isBoardCellEmpty(scene: TutorialSceneLike, row: number, col: number): boolean {
  return !scene.player?.board?.[row]?.[col];
}

function getRecommendedDeployCell(scene: TutorialSceneLike): RecommendationCell {
  const { unit, index } = getFirstOccupiedBenchUnit(scene);
  const classType = unit?.base?.classType ?? unit?.classType ?? null;
  const prefersFrontline = classType === "TANKER" || classType === "FIGHTER";
  const preferredSlots = prefersFrontline ? PLAYER_FRONTLINE_SLOTS : PLAYER_BACKLINE_SLOTS;
  const fallbackSlots = prefersFrontline ? PLAYER_BACKLINE_SLOTS : PLAYER_FRONTLINE_SLOTS;
  const chosen = preferredSlots.find((slot) => isBoardCellEmpty(scene, slot.row, slot.col))
    ?? fallbackSlots.find((slot) => isBoardCellEmpty(scene, slot.row, slot.col))
    ?? preferredSlots[0]
    ?? { row: 2, col: 2 };
  return {
    ...chosen,
    benchIndex: index,
    lane: prefersFrontline ? "frontline" : "backline",
    classType
  };
}

function getSuggestedRepositionCell(scene: TutorialSceneLike): BoardCellRef {
  return getFirstEmptyBoardCell(scene) ?? { row: 2, col: 2 };
}

function getFirstInventoryCell(scene: TutorialSceneLike, targetItemId: string | null = null): InventoryCellRef | null {
  const cells = Array.isArray(scene.inventoryCells) ? scene.inventoryCells : [];
  return cells.find((cell) => cell?.itemId && (!targetItemId || cell.itemId === targetItemId)) ?? null;
}

function getSettingsButtons(scene: TutorialSceneLike): Record<string, ButtonLike> {
  return scene.modalButtons ?? scene._settingsPanelObj?.buttons ?? {};
}

interface ContextRef {
  row?: number | null;
  col?: number | null;
  index?: number;
  itemId?: string | null;
  slotIndex?: number;
  targetType?: string;
  buttonKey?: string;
  key?: string;
  x?: number;
  y?: number;
  from?: ContextRef;
  to?: ContextRef;
  item?: ContextRef;
  unit?: ContextRef;
  [k: string]: unknown;
}

function getContextRef(context: ContextRef | undefined | null, role: string | null = null): ContextRef | undefined {
  if (!role || role === "target") return context ?? undefined;
  if (role === "source") return context?.from ?? context ?? undefined;
  if (role === "destination") return context?.to ?? context ?? undefined;
  if (role === "item") return context?.item ?? context ?? undefined;
  if (role === "unit") return context?.unit ?? context?.to ?? context ?? undefined;
  return context ?? undefined;
}

function resolveRectByTarget(scene: TutorialSceneLike, target: unknown): Anchor | null {
  const normalized = parseLegacyTarget(target);
  return resolveTutorialTarget(scene, normalized);
}

export function resolveTutorialTarget(scene: TutorialSceneLike, rawTarget: unknown): Anchor | null {
  const cam = scene.cameras?.main;
  const target = parseLegacyTarget(rawTarget);

  if (target?.kind === "any") {
    return createAnchorFromRect(
      toRect((cam?.width ?? 0) / 2 - 4, (cam?.height ?? 0) / 2 - 4, 8, 8),
      { key: "any", placement: "center" }
    );
  }

  if (target?.kind === "screen" && target.key === "center") {
    return createAnchorFromRect(
      toRect((cam?.width ?? 0) / 2 - 4, (cam?.height ?? 0) / 2 - 4, 8, 8),
      { key: "center", placement: (target as ScreenTarget).placement ?? "center" }
    );
  }

  if (target?.kind === "shopCard") {
    const card = scene.shopCards?.[(target as ShopCardTarget).index ?? 0];
    const rect = getDisplayRect(card?.bg ?? card as unknown as DisplayObjectLike);
    return createAnchorFromRect(rect, { key: "shopCard", index: (target as ShopCardTarget).index ?? 0 });
  }

  if (target?.kind === "shopFirstAvailable") {
    const shop = Array.isArray(scene.player?.shop) ? scene.player.shop : [];
    const cards = Array.isArray(scene.shopCards) ? scene.shopCards : [];
    const firstIndex = shop.findIndex((offer) => !!offer);
    const index = firstIndex >= 0 ? firstIndex : 0;
    const card = cards[index];
    const rect = getDisplayRect(card?.bg ?? card as unknown as DisplayObjectLike);
    return createAnchorFromRect(rect, { key: "shopFirstAvailable", index });
  }

  if (target?.kind === "benchSlot") {
    const slot = scene.benchSlots?.[(target as BenchSlotTarget).index ?? 0];
    const slotRect = getDisplayRect(slot?.bg) ?? (slot ? toRect(slot.x ?? 0, slot.y ?? 0, slot.slotW ?? 60, slot.slotH ?? 60) : null);
    return createAnchorFromRect(slotRect, { key: "benchSlot", index: (target as BenchSlotTarget).index ?? 0 });
  }

  if (target?.kind === "benchFirstOccupied" || target?.kind === "benchAnyOccupied") {
    const { index } = getFirstOccupiedBenchUnit(scene);
    const slot = scene.benchSlots?.find((entry) => entry?.benchIndex === index) ?? scene.benchSlots?.[index];
    const slotRect = getDisplayRect(slot?.bg) ?? (slot ? toRect(slot.x ?? 0, slot.y ?? 0, slot.slotW ?? 60, slot.slotH ?? 60) : null);
    return createAnchorFromRect(slotRect, { key: target.kind, index });
  }

  if (target?.kind === "synergyPanel") {
    const rect = mergeRects([
      getDisplayRect(scene.synergyTitleText),
      getDisplayRect(scene.synergyText)
    ]);
    return createAnchorFromRect(rect, { key: "synergyPanel" });
  }

  if (target?.kind === "button") {
    const button = scene.buttons?.[(target as ButtonTarget).key];
    const rect = getDisplayRect(button?.bg) ?? getDisplayRect(button as unknown as DisplayObjectLike);
    return createAnchorFromRect(rect, { key: `button:${(target as ButtonTarget).key}`, buttonKey: (target as ButtonTarget).key });
  }

  if (target?.kind === "settingsControl") {
    const button = getSettingsButtons(scene)?.[(target as ButtonTarget).key];
    const rect = getDisplayRect(button?.bg) ?? getDisplayRect(button as unknown as DisplayObjectLike);
    return createAnchorFromRect(rect, { key: `settings:${(target as ButtonTarget).key}`, buttonKey: (target as ButtonTarget).key });
  }

  if (target?.kind === "statChip") {
    const chip = scene.headerStatChips?.[(target as ButtonTarget).key];
    const rect = mergeRects([
      getDisplayRect(chip?.bg),
      getDisplayRect(chip?.label),
      getDisplayRect(chip?.value)
    ]);
    return createAnchorFromRect(rect, { key: `statChip:${(target as ButtonTarget).key}` });
  }

  if (target?.kind === "boardCell") {
    return resolveBoardCellAnchor(scene, target as BoardCellRef);
  }

  if (target?.kind === "boardRecommendedDeploy") {
    const recommendation = getRecommendedDeployCell(scene);
    const anchor = resolveBoardCellAnchor(scene, recommendation);
    return anchor
      ? { ...anchor, key: "boardRecommendedDeploy", recommendation: recommendation as unknown }
      : null;
  }

  if (target?.kind === "boardSuggestedReposition") {
    const suggestion = getSuggestedRepositionCell(scene);
    const anchor = resolveBoardCellAnchor(scene, suggestion);
    return anchor ? { ...anchor, key: "boardSuggestedReposition", suggestion: suggestion as unknown } : null;
  }

  if (target?.kind === "boardFirstOccupied" || target?.kind === "boardAnyOccupied") {
    const occupied = getFirstOccupiedBoardCell(scene);
    return occupied ? resolveBoardCellAnchor(scene, occupied) : null;
  }

  if (target?.kind === "boardAnyEquipped") {
    const equipped = getFirstEquippedBoardCell(scene);
    return equipped ? resolveBoardCellAnchor(scene, equipped) : null;
  }

  if (target?.kind === "boardAnyEmptyCell") {
    const empty = getFirstEmptyBoardCell(scene);
    return empty ? resolveBoardCellAnchor(scene, empty) : null;
  }

  if (target?.kind === "inventoryFirstOccupied") {
    const cell = getFirstInventoryCell(scene);
    return createAnchorFromRect(getDisplayRect(cell?.bg), {
      key: "inventoryFirstOccupied",
      itemId: cell?.itemId ?? null,
      index: cell?.index ?? -1
    });
  }

  if (target?.kind === "inventoryItem") {
    const cell = getFirstInventoryCell(scene, (target as InventoryTarget).itemId ?? null);
    return createAnchorFromRect(getDisplayRect(cell?.bg), {
      key: "inventoryItem",
      itemId: (target as InventoryTarget).itemId ?? null,
      index: cell?.index ?? -1
    });
  }

  if (target?.kind === "craftSlot") {
    const slot = scene.craftInputSlots?.[(target as CraftSlotTarget).index ?? 0];
    return createAnchorFromRect(getDisplayRect(slot?.bg), {
      key: "craftSlot",
      index: (target as CraftSlotTarget).index ?? 0
    });
  }

  if (target?.kind === "craftOutput") {
    return createAnchorFromRect(getDisplayRect(scene.craftOutputSlot?.bg), { key: "craftOutput" });
  }

  if (target?.kind === "sellButton") {
    return createAnchorFromRect(getDisplayRect(scene.buttons?.sell?.bg), { key: "sellButton" });
  }

  if (target?.kind === "unequipButton") {
    return createAnchorFromRect(getDisplayRect(scene.buttons?.unequip?.bg), { key: "unequipButton" });
  }

  if (target?.kind === "historyClose") {
    const rect = mergeRects([
      getDisplayRect(scene.historyCloseBg),
      getDisplayRect(scene.historyCloseText)
    ]);
    return createAnchorFromRect(rect, { key: "historyClose" });
  }

  return createAnchorFromRect(
    toRect((cam?.width ?? 0) / 2 - 4, (cam?.height ?? 0) / 2 - 4, 8, 8),
    { key: "fallback", placement: "center" }
  );
}

function extractRowCol(ref: ContextRef | null | undefined): { row: number | null; col: number | null } {
  if (!ref) return { row: null, col: null };
  if (Number.isInteger(ref.row) && Number.isInteger(ref.col)) return { row: ref.row as number, col: ref.col as number };
  return { row: null, col: null };
}

function getPointFromContext(scene: TutorialSceneLike, ref: ContextRef | null | undefined): Point | null {
  if (!ref) return null;
  if (Number.isFinite(ref.x) && Number.isFinite(ref.y)) {
    return { x: ref.x as number, y: ref.y as number };
  }
  const { row, col } = extractRowCol(ref);
  if (row == null || col == null) return null;
  const anchor = resolveBoardCellAnchor(scene, { row, col });
  return anchor ? { x: anchor.x, y: anchor.y } : null;
}

export function matchesTutorialTarget(scene: TutorialSceneLike, rawTarget: unknown, context: ContextRef = {}): boolean {
  const target = parseLegacyTarget(rawTarget);
  const targetRole: string | null = typeof (target as { role?: unknown }).role === "string" ? (target as { role: string }).role : null;
  const roleContext = getContextRef(context, targetRole);

  if (target?.kind === "button") {
    const key = roleContext?.buttonKey ?? roleContext?.key ?? context?.buttonKey ?? context?.key;
    return key === (target as ButtonTarget).key;
  }

  if (target?.kind === "settingsControl") {
    const key = roleContext?.buttonKey ?? roleContext?.key ?? context?.buttonKey ?? context?.key;
    return key === (target as ButtonTarget).key;
  }

  if (target?.kind === "shopCard") {
    return (roleContext?.index ?? context?.index) === ((target as ShopCardTarget).index ?? 0);
  }

  if (target?.kind === "shopFirstAvailable") {
    const anchor = resolveTutorialTarget(scene, target);
    return (roleContext?.index ?? context?.index) === anchor?.index;
  }

  if (target?.kind === "benchSlot") {
    return (roleContext?.index ?? context?.index) === ((target as BenchSlotTarget).index ?? 0);
  }

  if (target?.kind === "benchFirstOccupied" || target?.kind === "benchAnyOccupied") {
    const { index } = getFirstOccupiedBenchUnit(scene);
    return (roleContext?.index ?? context?.index) === index;
  }

  if (target?.kind === "boardCell") {
    const { row, col } = extractRowCol(roleContext);
    return row === (target as BoardCellTarget).row && col === (target as BoardCellTarget).col;
  }

  if (target?.kind === "boardRecommendedDeploy") {
    const recommendation = getRecommendedDeployCell(scene);
    const { row, col } = extractRowCol(roleContext);
    if (row != null && col != null) {
      return row === recommendation.row && col === recommendation.col;
    }
    return (roleContext?.index ?? context?.index) === recommendation.benchIndex;
  }

  if (target?.kind === "boardSuggestedReposition") {
    const suggestion = getSuggestedRepositionCell(scene);
    const { row, col } = extractRowCol(roleContext);
    return row === suggestion.row && col === suggestion.col;
  }

  if (target?.kind === "boardFirstOccupied") {
    const occupied = getFirstOccupiedBoardCell(scene);
    const { row, col } = extractRowCol(roleContext);
    return row === occupied?.row && col === occupied?.col;
  }

  if (target?.kind === "boardAnyOccupied") {
    const { row, col } = extractRowCol(roleContext);
    return row != null && col != null && !!scene.player?.board?.[row]?.[col];
  }

  if (target?.kind === "boardAnyEquipped") {
    const { row, col } = extractRowCol(roleContext);
    return row != null && col != null && (scene.player?.board?.[row]?.[col]?.equips?.length ?? 0) > 0;
  }

  if (target?.kind === "boardAnyEmptyCell") {
    const { row, col } = extractRowCol(roleContext);
    return row != null && col != null && !scene.player?.board?.[row]?.[col];
  }

  if (target?.kind === "inventoryFirstOccupied") {
    const cell = getFirstInventoryCell(scene);
    const itemId = roleContext?.itemId ?? context?.itemId;
    const index = roleContext?.index ?? context?.index;
    return itemId === cell?.itemId || index === cell?.index;
  }

  if (target?.kind === "inventoryItem") {
    const itemId = roleContext?.itemId ?? context?.itemId;
    return itemId === (target as InventoryTarget).itemId;
  }

  if (target?.kind === "craftSlot") {
    const slotIndex = roleContext?.slotIndex ?? context?.slotIndex;
    return slotIndex === ((target as CraftSlotTarget).index ?? 0);
  }

  if (target?.kind === "craftOutput") {
    return (roleContext?.targetType ?? context?.targetType) === "CRAFT_OUTPUT";
  }

  if (target?.kind === "sellButton") {
    return (roleContext?.targetType ?? context?.targetType) === "SELL";
  }

  if (target?.kind === "unequipButton") {
    return (roleContext?.targetType ?? context?.targetType) === "UNEQUIP";
  }

  if (target?.kind === "historyClose") {
    return (roleContext?.buttonKey ?? context?.buttonKey ?? context?.targetType) === "history_close";
  }

  const point = getPointFromContext(scene, roleContext ?? context);
  const anchor = resolveRectByTarget(scene, target);
  return rectContainsPoint(anchor?.rect, point?.x, point?.y);
}

interface TutorialStepLike {
  target?: unknown;
  allowedTargets?: unknown[];
  layoutFocus?: string;
}

interface TutorialGate {
  target: Anchor | null;
  allowedAnchors: Anchor[];
  focusAnchor: Anchor | null;
}

export function resolveTutorialGate(scene: TutorialSceneLike, step: TutorialStepLike | null | undefined): TutorialGate | null {
  const target = resolveTutorialTarget(scene, step?.target);
  const allowedAnchors = Array.isArray(step?.allowedTargets)
    ? step.allowedTargets
        .map((allowedTarget) => resolveTutorialTarget(scene, allowedTarget))
        .filter((anchor): anchor is Anchor => Boolean(anchor))
    : [];
  const focusAnchor = step?.layoutFocus === "allowedTargets" && allowedAnchors.length
    ? createMergedAnchor(allowedAnchors, {
        key: "allowedTargetsFocus",
        focusKind: step.layoutFocus
      })
    : target;
  return {
    target,
    allowedAnchors,
    focusAnchor
  };
}

export function isPointInTutorialGate(gate: TutorialGate | null | undefined, x: number, y: number): boolean {
  if (!gate) return false;
  if (gate.allowedAnchors.some((anchor) => rectContainsPoint(anchor?.rect, x, y))) return true;
  return rectContainsPoint(gate.target?.rect, x, y);
}

export function getPlacementFromLegacyArrow(direction: string): string {
  switch (direction) {
    case "down":
      return "above";
    case "up":
      return "below";
    case "left":
      return "right";
    case "right":
      return "left";
    case "none":
      return "center";
    default:
      return "auto";
  }
}

function pickAutoPlacement(anchor: Anchor, cameraRect: Rect, boxW: number, boxH: number): string {
  const pad = DEFAULT_SCREEN_PADDING;
  const spaces = {
    above: anchor.rect.top - cameraRect.top - pad,
    below: cameraRect.bottom - anchor.rect.bottom - pad,
    left: anchor.rect.left - cameraRect.left - pad,
    right: cameraRect.right - anchor.rect.right - pad
  };
  const canFit = {
    above: spaces.above >= boxH * 0.65,
    below: spaces.below >= boxH * 0.65,
    left: spaces.left >= boxW * 0.65,
    right: spaces.right >= boxW * 0.65
  };
  const verticalBias = anchor.y >= cameraRect.height * 0.58
    ? "above"
    : anchor.y <= cameraRect.height * 0.28
      ? "below"
      : null;
  if (verticalBias && canFit[verticalBias as "above" | "below"]) return verticalBias;

  const horizontalBias = anchor.x >= cameraRect.width * 0.72
    ? "left"
    : anchor.x <= cameraRect.width * 0.28
      ? "right"
      : null;
  if (horizontalBias && canFit[horizontalBias as "left" | "right"]) return horizontalBias;

  const fits: Array<{ placement: string; spare: number }> = [
    { placement: "above", spare: spaces.above - boxH },
    { placement: "below", spare: spaces.below - boxH },
    { placement: "left", spare: spaces.left - boxW },
    { placement: "right", spare: spaces.right - boxW }
  ];
  fits.sort((a, b) => b.spare - a.spare);
  return fits[0]?.placement ?? "above";
}

function clampBoxCenter(value: number, min: number, max: number): number {
  if (min > max) return (min + max) * 0.5;
  return Math.max(min, Math.min(max, value));
}

interface OverlayLayout {
  boxX: number;
  boxY: number;
  arrowDirection: string;
  placement: string;
}

export function computeTutorialOverlayLayout(anchor: Anchor | null | undefined, camera: { width?: number; height?: number } | null | undefined, boxW: number, boxH: number, requestedPlacement = "auto"): OverlayLayout {
  const cameraRect = toRect(0, 0, camera?.width ?? 0, camera?.height ?? 0);
  const fallbackRect = toRect(cameraRect.width / 2 - 4, cameraRect.height / 2 - 4, 8, 8);
  const safeAnchor: Anchor = anchor?.rect
    ? anchor
    : {
        rect: fallbackRect,
        x: fallbackRect.centerX,
        y: fallbackRect.centerY,
        radius: DEFAULT_TARGET_RADIUS
      };
  const placement = requestedPlacement === "auto"
    ? pickAutoPlacement(safeAnchor, cameraRect, boxW, boxH)
    : requestedPlacement;

  const pad = DEFAULT_SCREEN_PADDING;
  const boxHalfW = boxW / 2;
  const boxHalfH = boxH / 2;
  let boxX = safeAnchor.x;
  let boxY = safeAnchor.y;
  let arrowDirection = "none";

  if (placement === "center") {
    boxX = cameraRect.width / 2;
    boxY = cameraRect.height / 2;
    arrowDirection = "none";
  } else if (placement === "above") {
    boxX = clampBoxCenter(safeAnchor.x, boxHalfW + pad, cameraRect.width - boxHalfW - pad);
    boxY = safeAnchor.rect.top - pad - boxHalfH;
    arrowDirection = "down";
  } else if (placement === "below") {
    boxX = clampBoxCenter(safeAnchor.x, boxHalfW + pad, cameraRect.width - boxHalfW - pad);
    boxY = safeAnchor.rect.bottom + pad + boxHalfH;
    arrowDirection = "up";
  } else if (placement === "left") {
    boxX = safeAnchor.rect.left - pad - boxHalfW;
    boxY = clampBoxCenter(safeAnchor.y, boxHalfH + pad, cameraRect.height - boxHalfH - pad - 26);
    arrowDirection = "right";
  } else if (placement === "right") {
    boxX = safeAnchor.rect.right + pad + boxHalfW;
    boxY = clampBoxCenter(safeAnchor.y, boxHalfH + pad, cameraRect.height - boxHalfH - pad - 26);
    arrowDirection = "left";
  }

  boxX = clampBoxCenter(boxX, boxHalfW + 4, cameraRect.width - boxHalfW - 4);
  boxY = clampBoxCenter(boxY, boxHalfH + 4, cameraRect.height - boxHalfH - 30);

  return { boxX, boxY, arrowDirection, placement };
}