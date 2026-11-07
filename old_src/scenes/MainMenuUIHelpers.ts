import Phaser from "phaser";
import { t } from "../i18n/index.js";

/**
 * MainMenuScene - UI Helper functions
 * Extracted from MainMenuScene.js to keep under 500 lines
 */

type SceneWithContainerAdd = Phaser.Scene & {
  time?: { delayedCall?: (delay: number, callback: () => void) => unknown };
  add: Phaser.GameObjects.GameObjectFactory;
  make?: { graphics?: (config: { add: boolean }) => unknown };
};

function queueButtonReset(scene: SceneWithContainerAdd, delayMs: number, callback: () => void): void {
  if (scene?.time?.delayedCall) {
    scene.time.delayedCall(delayMs, callback);
    return;
  }
  setTimeout(callback, delayMs);
}

function estimateTextWidth(text: unknown, fontSizePx = 15): number {
  return String(text ?? "").length * Math.max(6, fontSizePx * 0.58);
}

function truncateSingleLineLabel(text: unknown, maxWidth: number, fontSizePx = 15): string {
  const value = String(text ?? "");
  if (!Number.isFinite(maxWidth) || maxWidth <= 0) return "";
  if (estimateTextWidth(value, fontSizePx) <= maxWidth) return value;

  const ellipsis = "...";
  let next = value;
  while (next.length > 0 && estimateTextWidth(`${next}${ellipsis}`, fontSizePx) > maxWidth) {
    next = next.slice(0, -1);
  }
  return next.length > 0 ? `${next}${ellipsis}` : ellipsis;
}

export type MenuButton = {
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  text: Phaser.GameObjects.Text;
  enabled: boolean;
  baseFill: number;
  baseStroke: number;
  setLabel(value: string): void;
  setEnabled(enabled: boolean): void;
};

export function createMenuButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: (() => void) | undefined,
  fill: number,
  stroke: number,
  parent: Phaser.GameObjects.Container | null = null
): MenuButton {
  const bg = scene.add.rectangle(x, y, w, h, fill, 0.96);
  bg.setStrokeStyle(2, stroke, 1);
  bg.setInteractive({ useHandCursor: true });
  const text = scene.add.text(x, y, label, {
    fontFamily: "Consolas",
    fontSize: "20px",
    color: "#f1f8ff"
  }).setOrigin(0.5);

  const button: MenuButton = {
    bg,
    label: text,
    text,
    enabled: true,
    baseFill: fill,
    baseStroke: stroke,
    setLabel: (value) => text.setText(value),
    setEnabled: (enabled) => {
      button.enabled = !!enabled;
      bg.setFillStyle(button.enabled ? fill : 0x3a3a3a, button.enabled ? 0.96 : 0.82);
      bg.setStrokeStyle(2, button.enabled ? stroke : 0x6e6e6e, 1);
      text.setColor(button.enabled ? "#f1f8ff" : "#aeb5bd");
    }
  };

  bg.on("pointerover", () => {
    if (button.enabled) {
      bg.setFillStyle(fill, 1);
      text.setColor("#ffffff");
    }
  });
  bg.on("pointerout", () => {
    if (button.enabled) {
      bg.setFillStyle(fill, 0.96);
      text.setColor("#f1f8ff");
    }
  });
  bg.on("pointerdown", () => {
    if (!button.enabled) return;
    bg.setScale(0.95);
    text.setScale(0.95);
    queueButtonReset(scene as SceneWithContainerAdd, 50, () => {
      if (!bg.active || !text.active) return;
      bg.setScale(1);
      text.setScale(1);
    });
    onClick?.();
  });

  if (parent) {
    parent.add(bg);
    parent.add(text);
  }

  return button;
}

/**
 * Creates a radio group with title and selectable options
 */
export type RadioOptionLike = {
  value: string;
  label: string;
  getLabel?: () => string;
  disabled?: boolean;
};

export type RadioGroupConfig = {
  parent: Phaser.GameObjects.Container;
  x: number;
  y: number;
  width: number;
  title: string | (() => string);
  options: RadioOptionLike[];
  getValue: () => string;
  onChange: (value: string, option?: RadioOptionLike) => void;
  maxHeight?: number | null;
};

export type RadioGroup = {
  group: Phaser.GameObjects.Container;
  refresh(): void;
  scrollBy(deltaY: number): boolean;
  wheelTarget: Phaser.GameObjects.Zone;
  canScroll(): boolean;
  containsPoint(pointer: unknown): boolean;
};

type DisplayObjectWithParent = Phaser.GameObjects.GameObject & {
  x: number;
  y: number;
  parentContainer?: Phaser.GameObjects.Container | null;
};

type RowDescriptor = {
  option: RadioOptionLike;
  rowY: number;
  rowBg: Phaser.GameObjects.Rectangle;
  outerCircle: Phaser.GameObjects.Arc;
  innerCircle: Phaser.GameObjects.Arc;
  rowLabel: Phaser.GameObjects.Text;
};

export function createMenuRadioGroup(
  scene: Phaser.Scene,
  { parent, x, y, width, title, options, getValue, onChange, maxHeight = null }: RadioGroupConfig
): RadioGroup {
  const resolveWorldOffset = (displayObject: DisplayObjectWithParent): { worldX: number; worldY: number } => {
    let worldX = 0;
    let worldY = 0;
    let current: DisplayObjectWithParent | null = displayObject;
    while (current) {
      worldX += Number.isFinite(current.x) ? current.x : 0;
      worldY += Number.isFinite(current.y) ? current.y : 0;
      current = current.parentContainer ?? null;
    }
    return { worldX, worldY };
  };

  const group = scene.add.container(x, y);
  parent.add(group);

  const resolveTitle = (): string => typeof title === "function" ? title() : title;
  const sectionTitle = scene.add.text(0, 0, resolveTitle(), {
    fontFamily: "Consolas",
    fontSize: "19px",
    color: "#ffebb0"
  });
  group.add(sectionTitle);

  const rows: RowDescriptor[] = [];
  const rowHeight = 28;
  const rowGap = 8;
  const scrollAreaY = 34;
  const labelX = 32;
  const labelRightPadding = 14;
  const labelFontSize = 15;
  const labelMaxWidth = Math.max(40, width - labelX - labelRightPadding);
  const viewportHeight = Math.max(
    rowHeight,
    Math.floor(Number.isFinite(maxHeight) ? (maxHeight as number) : options.length * (rowHeight + rowGap))
  );
  const rowsContainer = scene.add.container(0, scrollAreaY);
  group.add(rowsContainer);
  const rowsMaskGraphics = typeof scene.make?.graphics === "function" ? scene.make.graphics({} as object) : null;
  if (rowsMaskGraphics && typeof (rowsMaskGraphics as { fillStyle?: (c: number) => void; fillRect?: (x: number, y: number, w: number, h: number) => void }).fillRect === "function") {
    const parentOffset = resolveWorldOffset(parent as DisplayObjectWithParent);
    (rowsMaskGraphics as { fillStyle?: (c: number) => void }).fillStyle?.(0xffffff);
    (rowsMaskGraphics as { fillRect: (x: number, y: number, w: number, h: number) => void }).fillRect(
      parentOffset.worldX + x,
      parentOffset.worldY + y + scrollAreaY,
      width,
      viewportHeight
    );
  }
  const rowsMask = rowsMaskGraphics && typeof rowsContainer.enableFilters === "function"
    ? (rowsContainer.enableFilters(), (rowsContainer.filters as { external: { addMask: (g: unknown) => unknown } }).external.addMask(rowsMaskGraphics))
    : null;
  void rowsMask;

  options.forEach((option, index) => {
    const rowY = index * (rowHeight + rowGap);
    const rowBg = scene.add.rectangle(0, rowY, width, rowHeight, 0x233850, 0.7).setOrigin(0, 0);
    rowBg.setStrokeStyle(1, 0x7fb8ff, 0.8);
    const outerCircle = scene.add.circle(16, rowY + rowHeight * 0.5, 8, 0x0c1522, 1);
    outerCircle.setStrokeStyle(2, 0x8fc7ff, 1);
    const innerCircle = scene.add.circle(16, rowY + rowHeight * 0.5, 4, 0x75ffd4, 1);
    const rowLabel = scene.add.text(labelX, rowY + 5, truncateSingleLineLabel(typeof option.getLabel === "function" ? option.getLabel() : option.label, labelMaxWidth, labelFontSize), {
      fontFamily: "Consolas",
      fontSize: `${labelFontSize}px`,
      color: "#e7f4ff"
    });

    rowsContainer.add([rowBg, outerCircle, innerCircle, rowLabel]);
    rows.push({ option, rowY, rowBg, outerCircle, innerCircle, rowLabel });
  });

  const contentHeight = Math.max(0, options.length * rowHeight + Math.max(0, options.length - 1) * rowGap);
  const canScroll = contentHeight > viewportHeight + 2;
  let scrollOffset = 0;
  let hoveredIndex = -1;
  const viewportBounds = new Phaser.Geom.Rectangle(0, 0, width, viewportHeight);

  const viewportZone = scene.add.zone(width * 0.5, scrollAreaY + viewportHeight * 0.5, width, viewportHeight);
  viewportZone.setInteractive({ useHandCursor: true });
  group.add(viewportZone);

  const scrollHint = scene.add.text(width, scrollAreaY + viewportHeight + 6, "", {
    fontFamily: "Consolas",
    fontSize: "11px",
    color: "#8fb9df"
  }).setOrigin(1, 0);
  group.add(scrollHint);

  const updateRowsPosition = (): void => {
    rowsContainer.y = scrollAreaY - scrollOffset;
  };

  const updateViewportBounds = (): Phaser.Geom.Rectangle => {
    const { worldX, worldY } = resolveWorldOffset(group as unknown as DisplayObjectWithParent);
    viewportBounds.x = worldX;
    viewportBounds.y = worldY + scrollAreaY;
    viewportBounds.width = width;
    viewportBounds.height = viewportHeight;
    if (rowsMaskGraphics) {
      const g = rowsMaskGraphics as {
        clear?: () => void;
        fillStyle?: (color: number, alpha: number) => void;
        fillRect?: (x: number, y: number, w: number, h: number) => void;
      };
      g.clear?.();
      g.fillStyle?.(0xffffff, 1);
      g.fillRect?.(viewportBounds.x, viewportBounds.y, width, viewportHeight);
    }
    return viewportBounds;
  };

  const containsPoint = (pointerOrX: unknown, maybeY: unknown = null): boolean => {
    const worldX = typeof pointerOrX === "object"
      ? (pointerOrX as { worldX?: number; x?: number })?.worldX ?? (pointerOrX as { x?: number })?.x
      : pointerOrX;
    const worldY = typeof pointerOrX === "object"
      ? (pointerOrX as { worldY?: number; y?: number })?.worldY ?? (pointerOrX as { y?: number })?.y
      : maybeY;
    updateViewportBounds();
    return Number.isFinite(worldX as number)
      && Number.isFinite(worldY as number)
      && Phaser.Geom.Rectangle.Contains(viewportBounds, worldX as number, worldY as number);
  };

  const resolveRowAtPointer = (pointer: unknown): number => {
    if (!containsPoint(pointer)) return -1;
    const p = pointer as { worldY?: number; y?: number } | null | undefined;
    const pointerWorldY = p?.worldY ?? p?.y;
    if (typeof pointerWorldY !== "number") return -1;
    updateViewportBounds();
    const localY = pointerWorldY - viewportBounds.y + scrollOffset;
    const rowSpan = rowHeight + rowGap;
    const index = Math.floor(localY / rowSpan);
    if (index < 0 || index >= rows.length) return -1;
    const withinRowY = localY - index * rowSpan;
    return withinRowY <= rowHeight ? index : -1;
  };

  const setHoveredIndex = (nextIndex: number): void => {
    hoveredIndex = nextIndex;
    refresh();
  };

  viewportZone.on("pointerover", () => {
    scene.input.setDefaultCursor("pointer");
  });
  viewportZone.on("pointerout", () => {
    scene.input.setDefaultCursor("default");
    setHoveredIndex(-1);
  });
  viewportZone.on("pointermove", (pointer: unknown) => {
    setHoveredIndex(resolveRowAtPointer(pointer));
  });
  viewportZone.on("pointerdown", (pointer: unknown) => {
    const index = resolveRowAtPointer(pointer);
    if (index < 0) return;
    const option = rows[index]?.option;
    if (!option || option.disabled) return;
    onChange(option.value, option);
  });

  const scrollBy = (deltaY: number): boolean => {
    if (!canScroll) return false;
    const maxOffset = Math.max(0, contentHeight - viewportHeight);
    const nextOffset = Phaser.Math.Clamp(scrollOffset + Math.sign(deltaY) * 36, 0, maxOffset);
    if (nextOffset === scrollOffset) return false;
    scrollOffset = nextOffset;
    updateRowsPosition();
    refresh();
    return true;
  };

  const refresh = (): void => {
    const current = getValue();
    sectionTitle.setText(resolveTitle());
    rows.forEach(({ option, rowY, rowBg, outerCircle, innerCircle, rowLabel }) => {
      const selected = option.value === current;
      const visibleTop = rowY - scrollOffset;
      const visible = visibleTop + rowHeight >= 0 && visibleTop <= viewportHeight;
      rowBg.setVisible(visible);
      outerCircle.setVisible(visible);
      rowLabel.setVisible(visible);
      rowLabel.setText(
        truncateSingleLineLabel(
          typeof option.getLabel === "function" ? option.getLabel() : option.label,
          labelMaxWidth,
          labelFontSize
        )
      );
      innerCircle.setVisible(visible && selected && !option.disabled);
      if (option.disabled) {
        rowBg.setFillStyle(0x1a2533, 0.6);
        rowBg.setStrokeStyle(1, 0x4a5d73, 0.5);
        rowLabel.setColor("#7f8c9d");
      } else {
        const hovered = hoveredIndex >= 0 && rows[hoveredIndex]?.option?.value === option.value && !selected;
        rowBg.setFillStyle(selected ? 0x365b7d : hovered ? 0x2f4d6a : 0x233850, selected ? 0.96 : hovered ? 0.86 : 0.7);
        rowLabel.setColor(selected ? "#ffffff" : "#e7f4ff");
      }
    });
    if (canScroll) {
      const maxOffset = Math.max(0, contentHeight - viewportHeight);
      const atBottom = scrollOffset >= maxOffset - 1;
      scrollHint.setText(atBottom ? t("menu.scrollUpHint") : t("menu.scrollMoreHint"));
      scrollHint.setVisible(true);
    } else {
      scrollHint.setVisible(false);
    }
  };

  updateRowsPosition();
  updateViewportBounds();
  refresh();
  return { group, refresh, scrollBy, wheelTarget: viewportZone, canScroll: () => canScroll, containsPoint };
}
