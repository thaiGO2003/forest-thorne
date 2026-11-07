/**
 * ThreeMainMenuUIHelpers.ts
 *
 * Reusable UI button and radio group components for Three.js MainMenuScene and panels.
 * Provides interactive menus, hover states, mobile touch scrolling, and i18n support.
 */

import { t } from "../i18n/index.js";

type AnyObj = Record<string, unknown>;

interface SceneWithContainerAdd {
  time?: {
    delayedCall?: (delayMs: number, callback: () => void) => unknown;
  };
}

function queueButtonReset(scene: SceneWithContainerAdd | null | undefined, delayMs: number, callback: () => void): void {
  if (scene?.time?.delayedCall) {
    scene.time.delayedCall(delayMs, callback);
    return;
  }
  setTimeout(callback, delayMs);
}

function truncateSingleLineLabel(text: unknown, maxWidth: number, fontSizePx: number = 15): string {
  const raw = String(text ?? "").trim();
  if (!raw) return "";
  const avgCharWidth = Math.max(6, fontSizePx * 0.58);
  const estimated = raw.length * avgCharWidth;
  if (estimated <= maxWidth) return raw;

  const availableWidth = Math.max(12, maxWidth - 14);
  const keepChars = Math.max(2, Math.floor(availableWidth / avgCharWidth));
  return `${raw.slice(0, keepChars).trimEnd()}...`;
}

export type MenuButton = {
  bg: AnyObj;
  label: AnyObj;
  text: AnyObj;
  enabled: boolean;
  baseFill: number;
  baseStroke: number;
  setLabel(value: string): void;
  setEnabled(enabled: boolean): void;
};

export function createMenuButton(
  scene: AnyObj,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: (() => void) | undefined,
  fill: number,
  stroke: number,
  parent: AnyObj | null = null
): MenuButton {
  const add = scene.add as {
    rectangle: (x: number, y: number, w: number, h: number, fill: number, alpha: number) => AnyObj;
    text: (x: number, y: number, text: string, style: AnyObj) => AnyObj;
  };

  const bg = add.rectangle(x, y, w, h, fill, 0.96);
  if (typeof bg.setStrokeStyle === "function") bg.setStrokeStyle(2, stroke, 1);
  if (typeof bg.setInteractive === "function") bg.setInteractive({ useHandCursor: true });

  const text = add.text(x, y, label, {
    fontFamily: "Consolas",
    fontSize: "20px",
    color: "#f1f8ff"
  });
  if (typeof text.setOrigin === "function") text.setOrigin(0.5);

  const button: MenuButton = {
    bg,
    label: text,
    text,
    enabled: true,
    baseFill: fill,
    baseStroke: stroke,
    setLabel: (value: string) => {
      if (typeof text.setText === "function") text.setText(value);
    },
    setEnabled: (enabled: boolean) => {
      button.enabled = !!enabled;
      if (typeof bg.setFillStyle === "function") {
        bg.setFillStyle(button.enabled ? fill : 0x3a3a3a, button.enabled ? 0.96 : 0.82);
      }
      if (typeof bg.setStrokeStyle === "function") {
        bg.setStrokeStyle(2, button.enabled ? stroke : 0x6e6e6e, 1);
      }
      if (typeof text.setColor === "function") {
        text.setColor(button.enabled ? "#f1f8ff" : "#aeb5bd");
      }
    }
  };

  if (typeof bg.on === "function") {
    bg.on("pointerover", () => {
      if (button.enabled) {
        if (typeof bg.setFillStyle === "function") bg.setFillStyle(fill, 1);
        if (typeof text.setColor === "function") text.setColor("#ffffff");
      }
    });
    bg.on("pointerout", () => {
      if (button.enabled) {
        if (typeof bg.setFillStyle === "function") bg.setFillStyle(fill, 0.96);
        if (typeof text.setColor === "function") text.setColor("#f1f8ff");
      }
    });
    bg.on("pointerdown", () => {
      if (!button.enabled) return;
      if (typeof bg.setScale === "function") bg.setScale(0.95);
      if (typeof text.setScale === "function") text.setScale(0.95);
      queueButtonReset(scene as SceneWithContainerAdd, 50, () => {
        if (bg.active === false || text.active === false) return;
        if (typeof bg.setScale === "function") bg.setScale(1);
        if (typeof text.setScale === "function") text.setScale(1);
      });
      onClick?.();
    });
  }

  if (parent && typeof parent.add === "function") {
    parent.add(bg);
    parent.add(text);
  }

  return button;
}

export type RadioOptionLike = {
  value: string;
  label: string;
  getLabel?: () => string;
  disabled?: boolean;
};

export type RadioGroupConfig = {
  parent: AnyObj;
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
  group: AnyObj;
  refresh(): void;
  scrollBy(deltaY: number): boolean;
  wheelTarget: AnyObj;
  canScroll(): boolean;
  containsPoint(pointer: unknown): boolean;
};

type DisplayObjectWithParent = AnyObj & {
  x?: number;
  y?: number;
  parentContainer?: AnyObj | null;
};

type RowDescriptor = {
  option: RadioOptionLike;
  rowY: number;
  rowBg: AnyObj;
  outerCircle: AnyObj;
  innerCircle: AnyObj;
  rowLabel: AnyObj;
};

export function createMenuRadioGroup(
  scene: AnyObj,
  { parent, x, y, width, title, options, getValue, onChange, maxHeight = null }: RadioGroupConfig
): RadioGroup {
  const resolveWorldOffset = (displayObject: DisplayObjectWithParent): { worldX: number; worldY: number } => {
    let worldX = 0;
    let worldY = 0;
    let current: DisplayObjectWithParent | null = displayObject;
    while (current) {
      worldX += Number.isFinite(current.x) ? (current.x as number) : 0;
      worldY += Number.isFinite(current.y) ? (current.y as number) : 0;
      current = (current.parentContainer as DisplayObjectWithParent) ?? null;
    }
    return { worldX, worldY };
  };

  const add = scene.add as {
    container: (x: number, y: number) => AnyObj;
    text: (x: number, y: number, text: string, style?: AnyObj) => AnyObj;
    rectangle: (x: number, y: number, w: number, h: number, color: number, alpha?: number) => AnyObj;
    circle: (x: number, y: number, r: number, color: number, alpha?: number) => AnyObj;
    zone: (x: number, y: number, w: number, h: number) => AnyObj;
  };

  const group = add.container(x, y);
  if (parent && typeof parent.add === "function") parent.add(group);

  const resolveTitle = (): string => (typeof title === "function" ? title() : title);
  const sectionTitle = add.text(0, 0, resolveTitle(), {
    fontFamily: "Consolas",
    fontSize: "19px",
    color: "#ffebb0"
  });
  if (typeof group.add === "function") group.add(sectionTitle);

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
  const rowsContainer = add.container(0, scrollAreaY);
  if (typeof group.add === "function") group.add(rowsContainer);

  options.forEach((option, index) => {
    const rowY = index * (rowHeight + rowGap);
    const rowBg = add.rectangle(0, rowY, width, rowHeight, 0x233850, 0.7);
    if (typeof rowBg.setOrigin === "function") rowBg.setOrigin(0, 0);
    if (typeof rowBg.setStrokeStyle === "function") rowBg.setStrokeStyle(1, 0x7fb8ff, 0.8);

    const outerCircle = add.circle(16, rowY + rowHeight * 0.5, 8, 0x0c1522, 1);
    if (typeof outerCircle.setStrokeStyle === "function") outerCircle.setStrokeStyle(2, 0x8fc7ff, 1);

    const innerCircle = add.circle(16, rowY + rowHeight * 0.5, 4, 0x75ffd4, 1);

    const rowLabel = add.text(
      labelX,
      rowY + 5,
      truncateSingleLineLabel(typeof option.getLabel === "function" ? option.getLabel() : option.label, labelMaxWidth, labelFontSize),
      {
        fontFamily: "Consolas",
        fontSize: `${labelFontSize}px`,
        color: "#e7f4ff"
      }
    );

    if (typeof rowsContainer.add === "function") {
      rowsContainer.add([rowBg, outerCircle, innerCircle, rowLabel]);
    }
    rows.push({ option, rowY, rowBg, outerCircle, innerCircle, rowLabel });
  });

  const contentHeight = Math.max(0, options.length * rowHeight + Math.max(0, options.length - 1) * rowGap);
  const canScroll = contentHeight > viewportHeight + 2;
  let scrollOffset = 0;
  let hoveredIndex = -1;
  const viewportBounds = { x: 0, y: 0, width, height: viewportHeight };

  const viewportZone = add.zone(width * 0.5, scrollAreaY + viewportHeight * 0.5, width, viewportHeight);
  if (typeof viewportZone.setInteractive === "function") viewportZone.setInteractive({ useHandCursor: true });
  if (typeof group.add === "function") group.add(viewportZone);

  const scrollHint = add.text(width, scrollAreaY + viewportHeight + 6, "", {
    fontFamily: "Consolas",
    fontSize: "11px",
    color: "#8fb9df"
  });
  if (typeof scrollHint.setOrigin === "function") scrollHint.setOrigin(1, 0);
  if (typeof group.add === "function") group.add(scrollHint);

  const updateRowsPosition = (): void => {
    rowsContainer.y = scrollAreaY - scrollOffset;
  };

  const updateViewportBounds = (): { x: number; y: number; width: number; height: number } => {
    const { worldX, worldY } = resolveWorldOffset(group as DisplayObjectWithParent);
    viewportBounds.x = worldX;
    viewportBounds.y = worldY + scrollAreaY;
    viewportBounds.width = width;
    viewportBounds.height = viewportHeight;
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
    const px = Number(worldX);
    const py = Number(worldY);
    return Number.isFinite(px)
      && Number.isFinite(py)
      && px >= viewportBounds.x
      && px <= viewportBounds.x + viewportBounds.width
      && py >= viewportBounds.y
      && py <= viewportBounds.y + viewportBounds.height;
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

  if (typeof viewportZone.on === "function") {
    const input = scene.input as { setDefaultCursor?: (c: string) => void } | undefined;
    viewportZone.on("pointerover", () => {
      input?.setDefaultCursor?.("pointer");
    });
    viewportZone.on("pointerout", () => {
      input?.setDefaultCursor?.("default");
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
  }

  const scrollBy = (deltaY: number): boolean => {
    if (!canScroll) return false;
    const maxOffset = Math.max(0, contentHeight - viewportHeight);
    const rawOffset = scrollOffset + Math.sign(deltaY) * 36;
    const nextOffset = Math.max(0, Math.min(maxOffset, rawOffset));
    if (nextOffset === scrollOffset) return false;
    scrollOffset = nextOffset;
    updateRowsPosition();
    refresh();
    return true;
  };

  const refresh = (): void => {
    const current = getValue();
    if (typeof sectionTitle.setText === "function") sectionTitle.setText(resolveTitle());

    rows.forEach(({ option, rowY, rowBg, outerCircle, innerCircle, rowLabel }) => {
      const selected = option.value === current;
      const visibleTop = rowY - scrollOffset;
      const visible = visibleTop + rowHeight >= 0 && visibleTop <= viewportHeight;
      if (typeof rowBg.setVisible === "function") rowBg.setVisible(visible);
      if (typeof outerCircle.setVisible === "function") outerCircle.setVisible(visible);
      if (typeof rowLabel.setVisible === "function") rowLabel.setVisible(visible);
      if (typeof rowLabel.setText === "function") {
        rowLabel.setText(
          truncateSingleLineLabel(
            typeof option.getLabel === "function" ? option.getLabel() : option.label,
            labelMaxWidth,
            labelFontSize
          )
        );
      }
      if (typeof innerCircle.setVisible === "function") {
        innerCircle.setVisible(visible && selected && !option.disabled);
      }
      if (option.disabled) {
        if (typeof rowBg.setFillStyle === "function") rowBg.setFillStyle(0x1a2533, 0.6);
        if (typeof rowBg.setStrokeStyle === "function") rowBg.setStrokeStyle(1, 0x4a5d73, 0.5);
        if (typeof rowLabel.setColor === "function") rowLabel.setColor("#7f8c9d");
      } else {
        const hovered = hoveredIndex >= 0 && rows[hoveredIndex]?.option?.value === option.value && !selected;
        if (typeof rowBg.setFillStyle === "function") {
          rowBg.setFillStyle(selected ? 0x365b7d : hovered ? 0x2f4d6a : 0x233850, selected ? 0.96 : hovered ? 0.86 : 0.7);
        }
        if (typeof rowLabel.setColor === "function") {
          rowLabel.setColor(selected ? "#ffffff" : "#e7f4ff");
        }
      }
    });

    if (canScroll) {
      const maxOffset = Math.max(0, contentHeight - viewportHeight);
      const atBottom = scrollOffset >= maxOffset - 1;
      if (typeof scrollHint.setText === "function") {
        scrollHint.setText(atBottom ? t("menu.scrollUpHint") : t("menu.scrollMoreHint"));
      }
      if (typeof scrollHint.setVisible === "function") scrollHint.setVisible(true);
    } else {
      if (typeof scrollHint.setVisible === "function") scrollHint.setVisible(false);
    }
  };

  updateRowsPosition();
  updateViewportBounds();
  refresh();
  return { group, refresh, scrollBy, wheelTarget: viewportZone, canScroll: () => canScroll, containsPoint };
}

export default { createMenuButton, createMenuRadioGroup };
