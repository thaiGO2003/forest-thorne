/**
 * ThreeMainMenuTributeGalleryPanel.ts
 *
 * Tribute credits gallery and supporter badges panel for Three.js.
 * Displays low-poly supporter avatars, colored badge backgrounds, initials,
 * measured animated marquee labels with clipping masks, and touch/wheel scrolling.
 */

import { TRIBUTE_CREDITS } from "../data/tributeCredits.js";
import type { TributeCredit } from "../data/tributeCredits.js";
import { t } from "../i18n/index.js";

type AnyObj = Record<string, unknown>;

const COLUMNS = 4;
const TILE_SIZE = 68;
const TILE_GAP = 8;
const TILE_LABEL_H = 18;

export type TributeScrollGroup = {
  wheelTarget: AnyObj;
  scrollBy: (deltaY: number) => boolean;
  containsPoint: (pointerOrX: unknown, maybeY?: unknown) => boolean;
};

export type TributePanelHost = {
  scale: { width: number; height: number };
  add: {
    container: (x?: number, y?: number) => AnyObj;
    rectangle: (x: number, y: number, w: number, h: number, color: number, alpha?: number) => AnyObj;
    text: (x: number, y: number, text: string, style?: AnyObj) => AnyObj;
    image?: (x: number, y: number, key: string) => AnyObj;
    circle?: (x: number, y: number, r: number, color?: number, alpha?: number) => AnyObj;
    zone: (x: number, y: number, w: number, h: number) => AnyObj;
  };
  make?: {
    graphics?: (config?: object) => AnyObj;
  };
  textures?: {
    exists: (key: string) => boolean;
  };
  time?: {
    delayedCall?: (delay: number, callback: () => void) => AnyObj;
  };
  tweens?: {
    add?: (config: AnyObj) => AnyObj;
  };
  input: {
    on: (event: string, handler: (...args: unknown[]) => void) => void;
    off?: (event: string, handler: (...args: unknown[]) => void) => void;
  };
  events: {
    once: (event: string, handler: () => void) => void;
  };
  tributePanel?: AnyObj | null;
  tributePanelTitleText?: AnyObj | null;
  tributePanelSubtitleText?: AnyObj | null;
  tributeScrollGroup?: TributeScrollGroup | null;
};

type TileWithMarquee = AnyObj & {
  _marqueeMaskUpdate?: (scrollOff?: number) => void;
};

type TileDescriptor = {
  tile: TileWithMarquee;
  hitBg: AnyObj;
};

type TributePointerLike = {
  x?: number;
  y?: number;
  worldX?: number;
  worldY?: number;
};

function createBadge(scene: TributePanelHost, entry: TributeCredit): AnyObj {
  const badge = scene.add.container(0, 0);
  const bg = scene.add.rectangle(0, 0, TILE_SIZE, TILE_SIZE, entry.fill, 0.98);
  if (typeof bg.setOrigin === "function") bg.setOrigin(0, 0);
  if (typeof bg.setStrokeStyle === "function") bg.setStrokeStyle(2, entry.accent, 0.95);
  if (typeof badge.add === "function") badge.add(bg);

  if (entry.assetKey && typeof scene.textures?.exists === "function" && scene.textures.exists(entry.assetKey) && typeof scene.add.image === "function") {
    const image = scene.add.image(TILE_SIZE * 0.5, TILE_SIZE * 0.5, entry.assetKey);
    if (typeof image.setDisplaySize === "function") image.setDisplaySize(TILE_SIZE - 6, TILE_SIZE - 6);
    if (typeof badge.add === "function") badge.add(image);
  } else {
    const glow = scene.add.rectangle(TILE_SIZE * 0.5, TILE_SIZE * 0.5, TILE_SIZE - 10, TILE_SIZE - 10, entry.accent, 0.15);
    if (typeof glow.setOrigin === "function") glow.setOrigin(0.5);

    const initials = scene.add.text(TILE_SIZE * 0.5, TILE_SIZE * 0.5, entry.initials, {
      fontFamily: "Trebuchet MS",
      fontSize: "24px",
      color: entry.text,
      fontStyle: "bold"
    });
    if (typeof initials.setOrigin === "function") initials.setOrigin(0.5);

    if (typeof badge.add === "function") badge.add([glow, initials]);
  }

  return badge;
}

function createMarqueeLabel(
  scene: TributePanelHost,
  tile: TileWithMarquee,
  tileWorldX: number,
  tileWorldY: number,
  fullName: string
): void {
  const labelY = TILE_SIZE + 3;
  const maxW = TILE_SIZE - 4;

  const nameText = scene.add.text(0, labelY, fullName, {
    fontFamily: "Consolas",
    fontSize: "9px",
    color: "#dcecff",
    align: "left"
  });
  if (typeof nameText.setOrigin === "function") nameText.setOrigin(0, 0);

  const textW = Number(nameText.width ?? nameText.displayWidth ?? (fullName.length * 5.5));

  if (textW <= maxW) {
    if (typeof nameText.setX === "function") {
      nameText.setX(Math.floor((TILE_SIZE - textW) * 0.5));
    }
    if (typeof tile.add === "function") tile.add(nameText);
    return;
  }

  const labelContainer = scene.add.container(Math.floor((TILE_SIZE - maxW) * 0.5), labelY);
  if (typeof nameText.setPosition === "function") {
    nameText.setPosition(0, 0);
  }
  if (typeof labelContainer.add === "function") {
    labelContainer.add(nameText);
  }

  const labelMaskGfx = typeof scene.make?.graphics === "function" ? scene.make.graphics({}) : null;
  const updateMask = (scrollOff = 0): void => {
    if (labelMaskGfx) {
      if (typeof labelMaskGfx.clear === "function") labelMaskGfx.clear();
      if (typeof labelMaskGfx.fillStyle === "function") labelMaskGfx.fillStyle(0xffffff);
      const absX = tileWorldX + Math.floor((TILE_SIZE - maxW) * 0.5);
      const absY = tileWorldY + labelY - scrollOff;
      if (typeof labelMaskGfx.fillRect === "function") labelMaskGfx.fillRect(absX, absY, maxW, 14);
    }
  };
  updateMask();

  if (typeof labelContainer.enableFilters === "function") {
    labelContainer.enableFilters();
  }
  const filterExt = (labelContainer.filters as { external?: { addMask?: (g: unknown) => unknown } })?.external;
  if (typeof filterExt?.addMask === "function" && labelMaskGfx) {
    filterExt.addMask(labelMaskGfx);
  }

  if (typeof tile.add === "function") {
    tile.add(labelContainer);
  }

  const overflow = textW - maxW;
  const speed = 25;
  const duration = (overflow / speed) * 1000;
  const pauseMs = 1800;
  const randomDelay = Math.random() * 3000;

  const startTween = (): void => {
    if (typeof scene.tweens?.add === "function") {
      scene.tweens.add({
        targets: nameText,
        x: -overflow,
        duration,
        ease: "Sine.easeInOut",
        delay: pauseMs,
        yoyo: true,
        hold: pauseMs,
        repeatDelay: pauseMs,
        repeat: -1
      });
    }
  };

  if (typeof scene.time?.delayedCall === "function") {
    scene.time.delayedCall(randomDelay, startTween);
  } else {
    startTween();
  }

  tile._marqueeMaskUpdate = updateMask;
}

export function createMainMenuTributeGalleryPanel(scene: TributePanelHost): void {
  const h = scene.scale.height;

  const contentWidth = COLUMNS * TILE_SIZE + (COLUMNS - 1) * TILE_GAP;
  const panelPadding = 20;
  const panelWidth = contentWidth + panelPadding * 2;
  const panelHeight = Math.min(Math.max(360, Math.floor(h * 0.52)), h - 220);
  const panelX = 28;
  const panelY = Math.max(188, Math.floor(h * 0.24));
  const panel = scene.add.container(panelX, panelY);
  if (typeof panel.setDepth === "function") panel.setDepth(25);

  const bg = scene.add.rectangle(0, 0, panelWidth, panelHeight, 0x0f1c2c, 0.92);
  if (typeof bg.setOrigin === "function") bg.setOrigin(0, 0);
  if (typeof bg.setStrokeStyle === "function") bg.setStrokeStyle(1, 0x78baf0, 0.8);

  const accent = scene.add.rectangle(0, 0, 5, panelHeight, 0x8de8ff, 0.95);
  if (typeof accent.setOrigin === "function") accent.setOrigin(0, 0);

  const title = scene.add.text(18, 14, t("menu.tributeTitle"), {
    fontFamily: "Trebuchet MS",
    fontSize: "28px",
    color: "#ffeab0",
    fontStyle: "bold"
  });
  if (typeof title.setOrigin === "function") title.setOrigin(0, 0);

  const subtitle = scene.add.text(18, 44, t("menu.tributeSubtitle"), {
    fontFamily: "Consolas",
    fontSize: "12px",
    color: "#98b6cf",
    wordWrap: { width: panelWidth - 36 }
  });
  if (typeof subtitle.setOrigin === "function") subtitle.setOrigin(0, 0);

  const viewportX = panelPadding;
  const viewportY = 72;
  const viewportW = contentWidth;
  const viewportH = panelHeight - 106;
  const viewportBounds = {
    x: panelX + viewportX,
    y: panelY + viewportY,
    width: viewportW,
    height: viewportH
  };

  const viewportZone = scene.add.zone(viewportX + viewportW * 0.5, viewportY + viewportH * 0.5, viewportW, viewportH);
  if (typeof viewportZone.setInteractive === "function") viewportZone.setInteractive({ useHandCursor: true });

  const viewportFrame = scene.add.rectangle(viewportX + viewportW * 0.5, viewportY + viewportH * 0.5, viewportW, viewportH, 0x14253b, 0.42);
  if (typeof viewportFrame.setOrigin === "function") viewportFrame.setOrigin(0.5);
  if (typeof viewportFrame.setStrokeStyle === "function") viewportFrame.setStrokeStyle(1, 0x35556e, 0.68);

  const rowsContainer = scene.add.container(viewportX, viewportY);

  const maskGfx = typeof scene.make?.graphics === "function" ? scene.make.graphics({ x: 0, y: 0 }) : null;
  if (maskGfx) {
    if (typeof maskGfx.fillStyle === "function") maskGfx.fillStyle(0xffffff);
    if (typeof maskGfx.fillRect === "function") maskGfx.fillRect(panelX + viewportX, panelY + viewportY, viewportW, viewportH);
  }
  if (typeof rowsContainer.enableFilters === "function") {
    rowsContainer.enableFilters();
  }
  const rowsFilterExt = (rowsContainer.filters as { external?: { addMask?: (g: unknown) => unknown } })?.external;
  if (typeof rowsFilterExt?.addMask === "function" && maskGfx) {
    rowsFilterExt.addMask(maskGfx);
  }

  const tileHeight = TILE_SIZE + TILE_LABEL_H;

  const tiles: TileDescriptor[] = (TRIBUTE_CREDITS as TributeCredit[]).map((entry, index) => {
    const col = index % COLUMNS;
    const row = Math.floor(index / COLUMNS);
    const x = col * (TILE_SIZE + TILE_GAP);
    const y = row * (tileHeight + TILE_GAP);

    const tile = scene.add.container(x, y) as TileWithMarquee;
    const hitBg = scene.add.rectangle(0, 0, TILE_SIZE, TILE_SIZE + TILE_LABEL_H, 0x16273c, 0.88);
    if (typeof hitBg.setOrigin === "function") hitBg.setOrigin(0, 0);
    if (typeof hitBg.setStrokeStyle === "function") hitBg.setStrokeStyle(1, 0x598ab8, 0.78);

    const badge = createBadge(scene, entry);
    if (typeof tile.add === "function") tile.add([hitBg, badge]);

    const tileWorldX = panelX + viewportX + x;
    const tileWorldY = panelY + viewportY + y;
    createMarqueeLabel(scene, tile, tileWorldX, tileWorldY, entry.blurred ? "***" : entry.name);

    if (typeof rowsContainer.add === "function") rowsContainer.add(tile);
    return { tile, hitBg };
  });

  const totalContentH = Math.ceil(TRIBUTE_CREDITS.length / COLUMNS) * (tileHeight + TILE_GAP) - TILE_GAP;
  let scrollOffset = 0;
  const maxOffset = Math.max(0, totalContentH - viewportH);
  let isDragging = false;
  let dragStartY = 0;
  let dragStartOffset = 0;

  const scrollHint = scene.add.text(viewportX + viewportW, viewportY + viewportH + 6, "", {
    fontFamily: "Consolas",
    fontSize: "11px",
    color: "#8fb9df"
  });
  if (typeof scrollHint.setOrigin === "function") scrollHint.setOrigin(1, 0);

  const containsPoint = (pointerOrX: unknown, maybeY: unknown = null): boolean => {
    const worldX = typeof pointerOrX === "object"
      ? (pointerOrX as TributePointerLike)?.worldX ?? (pointerOrX as TributePointerLike)?.x
      : pointerOrX;
    const worldY = typeof pointerOrX === "object"
      ? (pointerOrX as TributePointerLike)?.worldY ?? (pointerOrX as TributePointerLike)?.y
      : maybeY;
    const px = Number(worldX);
    const py = Number(worldY);
    return Number.isFinite(px)
      && Number.isFinite(py)
      && px >= viewportBounds.x
      && px <= viewportBounds.x + viewportBounds.width
      && py >= viewportBounds.y
      && py <= viewportBounds.y + viewportBounds.height;
  };

  const updateViewport = (): void => {
    rowsContainer.y = viewportY - scrollOffset;
    tiles.forEach(({ tile }) => {
      if (typeof tile._marqueeMaskUpdate === "function") {
        tile._marqueeMaskUpdate(scrollOffset);
      }
    });
    if (maxOffset > 0) {
      if (typeof scrollHint.setText === "function") {
        scrollHint.setText(scrollOffset >= maxOffset - 1 ? t("menu.scrollUpHint") : t("menu.scrollMoreHint"));
      }
      if (typeof scrollHint.setVisible === "function") scrollHint.setVisible(true);
    } else {
      if (typeof scrollHint.setVisible === "function") scrollHint.setVisible(false);
    }
  };

  const scrollBy = (deltaY: number): boolean => {
    if (maxOffset <= 0) return false;
    const step = Math.min(Math.abs(deltaY), 200);
    const rawOffset = scrollOffset + Math.sign(deltaY) * step;
    const nextOffset = Math.max(0, Math.min(maxOffset, rawOffset));
    if (nextOffset === scrollOffset) return false;
    scrollOffset = nextOffset;
    updateViewport();
    return true;
  };

  const handlePointerDown = (...args: unknown[]): void => {
    const pointer = args[0] as TributePointerLike;
    if (!containsPoint(pointer) || maxOffset <= 0) return;
    isDragging = true;
    dragStartY = pointer.y ?? 0;
    dragStartOffset = scrollOffset;
  };

  const handlePointerMove = (...args: unknown[]): void => {
    if (!isDragging || maxOffset <= 0) return;
    const pointer = args[0] as TributePointerLike;
    const dy = dragStartY - (pointer.y ?? 0);
    const nextOffset = Math.max(0, Math.min(maxOffset, dragStartOffset + dy));
    if (nextOffset !== scrollOffset) {
      scrollOffset = nextOffset;
      updateViewport();
    }
  };

  const handlePointerUp = (): void => {
    isDragging = false;
  };

  scene.input.on("pointerdown", handlePointerDown);
  scene.input.on("pointermove", handlePointerMove);
  scene.input.on("pointerup", handlePointerUp);

  let cleanedUp = false;
  const cleanupInputHandlers = (): void => {
    if (cleanedUp) return;
    cleanedUp = true;
    scene.input.off?.("pointerdown", handlePointerDown);
    scene.input.off?.("pointermove", handlePointerMove);
    scene.input.off?.("pointerup", handlePointerUp);
  };
  scene.events.once("shutdown", cleanupInputHandlers);
  scene.events.once("destroy", cleanupInputHandlers);

  updateViewport();
  if (typeof panel.add === "function") {
    panel.add([bg, accent, title, subtitle, viewportFrame, rowsContainer, viewportZone, scrollHint]);
  }

  scene.tributePanel = panel;
  scene.tributePanelTitleText = title;
  scene.tributePanelSubtitleText = subtitle;
  scene.tributeScrollGroup = { wheelTarget: viewportZone, scrollBy, containsPoint };
}

export default { createMainMenuTributeGalleryPanel };
