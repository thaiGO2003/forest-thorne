/*
 * SceneButton.js
 *
 * Shared button factory used by PlanningScene, CombatScene, and MainMenuScene.
 * Extract of the duplicated createButton() method into a reusable helper.
 *
 * Usage:
 *   import { createSceneButton } from "../ui/SceneButton.js";
 *   const btn = createSceneButton(scene, x, y, w, h, "Label", onClick, options);
 */

import { UI_FONT, UI_COLORS } from "../core/uiTheme.js";
import { scaleFontPx } from "../core/uiResponsive.js";
import type { Scene as PhaserScene } from "phaser";

type SceneWithHelpers = PhaserScene;

const VARIANTS: Record<string, { fill: number; edge: number; hover: number; text: string }> = {
    secondary: {
        fill: 0x1a2d42,
        edge: UI_COLORS.panelEdge,
        hover: 0x25405d,
        text: UI_COLORS.textPrimary
    },
    ghost: {
        fill: 0x162433,
        edge: UI_COLORS.panelEdgeSoft,
        hover: 0x21354c,
        text: UI_COLORS.textSecondary
    },
    cta: {
        fill: UI_COLORS.cta,
        edge: UI_COLORS.ctaEdge,
        hover: UI_COLORS.ctaHover,
        text: "#141f04"
    }
};

function queueButtonReset(scene: SceneWithHelpers, delayMs: number, callback: () => void): void {
    if (scene?.time?.delayedCall) {
        scene.time.delayedCall(delayMs, callback);
        return;
    }
    setTimeout(callback, delayMs);
}

function isLiveGameObject(obj: unknown): boolean {
    return !!(obj && typeof obj === "object" && (obj as { scene?: unknown }).scene && (obj as { active?: boolean }).active !== false);
}

function canSetTextSafely(text: unknown): boolean {
    const t = text as { canvas?: unknown; context?: unknown; texture?: { source?: Array<{ image?: unknown }> } } | null;
    return !!(
        isLiveGameObject(text)
        && t?.canvas
        && t?.context
        && t?.texture?.source?.[0]?.image
    );
}

export interface SceneButtonOptions {
  variant?: keyof typeof VARIANTS;
  fontSize?: number | string;
  bold?: boolean;
  textRole?: string;
}

export interface SceneButton {
  x: number;
  y: number;
  w: number;
  h: number;
  shadow: SceneButtonShadow;
  bg: SceneButtonBg;
  text: SceneButtonText;
  enabled: boolean;
  setLabel: (v: string) => SceneButton;
  setEnabled: (enabled: boolean) => SceneButton;
  setVisible: (visible: boolean) => SceneButton;
  destroy: () => void;
}

interface SceneButtonShadow {
  setDepth: (v: number) => void;
  setVisible: (v: boolean) => void;
  setScale: (v: number) => void;
  active: boolean;
  destroy?: () => void;
}

interface SceneButtonBg {
  setStrokeStyle: (...args: unknown[]) => void;
  setDepth: (v: number) => void;
  setFillStyle: (...args: unknown[]) => void;
  setVisible: (v: boolean) => void;
  setScale: (v: number) => void;
  setInteractive: (opts: { useHandCursor: boolean }) => void;
  on: (event: string, handler: () => void) => void;
  active: boolean;
  scene: unknown;
  destroy?: () => void;
}

interface SceneButtonText {
  setOrigin: (v: number) => void;
  setDepth: (v: number) => void;
  setText: (v: string) => void;
  setColor: (v: string) => void;
  setScale: (v: number) => void;
  setVisible: (v: boolean) => void;
  active: boolean;
  scene: unknown;
  canvas: unknown;
  context: unknown;
  texture?: { source?: unknown[] };
  destroy?: () => void;
}

/**
 * Create a styled interactive button in a Phaser scene.
 */
export function createSceneButton(
  scene: SceneWithHelpers,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  options: SceneButtonOptions = {}
): SceneButton {
    const variant = VARIANTS[options.variant ?? "secondary"] ?? VARIANTS.secondary;
    const fontRole = options.textRole ?? "button";
    const resolvedFontSize = typeof options.fontSize === "string"
        ? options.fontSize
        : scaleFontPx(scene as PhaserScene & Record<string, unknown>, options.fontSize ?? 14, fontRole as "title" | "body" | "label" | "button" | "caption" | "tooltipTitle" | "tooltipBody");

    // Drop-shadow rectangle for depth
    const shadow = scene.add.rectangle(x + w / 2, y + h / 2 + 2, w, h, 0x000000, 0.22) as {
      setDepth: (v: number) => void;
      setVisible: (v: boolean) => void;
      setScale: (v: number) => void;
      active: boolean;
      destroy: () => void;
    };
    shadow.setDepth(1998);

    // Main background
    const bg = scene.add.rectangle(x + w / 2, y + h / 2, w, h, variant.fill, 0.94) as {
      setStrokeStyle: (...args: unknown[]) => void;
      setDepth: (v: number) => void;
      setFillStyle: (...args: unknown[]) => void;
      setVisible: (v: boolean) => void;
      setScale: (v: number) => void;
      setInteractive: (opts: { useHandCursor: boolean }) => void;
      on: (event: string, handler: () => void) => void;
      active: boolean;
      scene: unknown;
      destroy: () => void;
    };
    bg.setStrokeStyle(1, variant.edge, 0.95);
    bg.setDepth(1999);

    // Label text
    const text = scene.add.text(x + w / 2, y + h / 2, label, {
        fontFamily: UI_FONT,
        fontSize: resolvedFontSize as string | number,
        color: variant.text,
        fontStyle: options.bold ? "bold" : "normal"
    }) as {
      setOrigin: (v: number) => void;
      setDepth: (v: number) => void;
      setText: (v: string) => void;
      setColor: (v: string) => void;
      setScale: (v: number) => void;
      setVisible: (v: boolean) => void;
      active: boolean;
      scene: unknown;
      canvas: unknown;
      context: unknown;
      texture?: { source?: unknown[] };
      destroy: () => void;
    };
    text.setOrigin(0.5);
    text.setDepth(2000);

    // Button state object
    const btn: SceneButton = {
        x,
        y,
        w,
        h,
        shadow,
        bg,
        text,
        enabled: true,
        setLabel: (v) => {
            if (!canSetTextSafely(text)) return btn;
            text.setText(v);
            return btn;
        },
        setEnabled: (enabled) => {
            btn.enabled = enabled;
            if (isLiveGameObject(bg)) {
                bg.setFillStyle(enabled ? variant.fill : 0x323943, enabled ? 0.94 : 0.7);
                bg.setStrokeStyle(1, enabled ? variant.edge : 0x5b6572, 0.85);
            }
            if (isLiveGameObject(text)) {
                text.setColor(enabled ? variant.text : "#8d98a6");
            }
            if (isLiveGameObject(shadow)) {
                shadow.setVisible(enabled);
            }
            return btn;
        },
        setVisible: (visible) => {
            if (isLiveGameObject(shadow)) shadow.setVisible(visible && btn.enabled);
            if (isLiveGameObject(bg)) bg.setVisible(visible);
            if (isLiveGameObject(text)) text.setVisible(visible);
            return btn;
        },
        destroy: () => {
            (shadow as { destroy?: () => void } | undefined)?.destroy?.();
            (bg as { destroy?: () => void } | undefined)?.destroy?.();
            (text as { destroy?: () => void } | undefined)?.destroy?.();
        }
    };

    // Pointer interactions
    bg.setInteractive({ useHandCursor: true });
    bg.on("pointerover", () => {
        if (btn.enabled) {
            bg.setFillStyle(variant.hover, 0.98);
            text.setColor("#ffffff");
        }
    });
    bg.on("pointerout", () => {
        if (btn.enabled) {
            bg.setFillStyle(variant.fill, 0.94);
            text.setColor(variant.text);
        }
    });
    bg.on("pointerdown", () => {
        if (!btn.enabled) return;
        bg.setScale(0.96);
        text.setScale(0.96);
        shadow.setScale(0.96);
        queueButtonReset(scene, 50, () => {
            if (!bg.active || !text.active || !shadow.active) return;
            bg.setScale(1);
            text.setScale(1);
            shadow.setScale(1);
        });
        onClick();
    });

    return btn;
}
