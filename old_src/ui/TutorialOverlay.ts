/**
 * TutorialOverlay.ts
 *
 * Overlay text + arrow + gate hint for guided tutorial rounds.
 */

import { UI_FONT } from "../core/uiTheme.js";
import { getTutorialStepsForRound } from "../data/tutorialSteps.js";
import { TutorialStep } from "../data/tutorialSteps.js";
import { t } from "../i18n/index.js";
import type { Scene as PhaserScene, Scale } from "phaser";
import {
  computeTutorialOverlayLayout,
  getPlacementFromLegacyArrow,
  resolveTutorialGate,
  resolveTutorialTarget,
  type Anchor
} from "./tutorialTargetResolver.js";
import { isTutorialStepSatisfied } from "./tutorialProgress.js";
import { getTutorialDismissMarkerKey } from "./tutorialProgress.js";

type Rectangle = Phaser.GameObjects.Rectangle;
type Graphics = Phaser.GameObjects.Graphics;
type Text = Phaser.GameObjects.Text;
type Tween = Phaser.Tweens.Tween;
type TimeEvent = Phaser.Time.TimerEvent;
type DisplayObject = Phaser.GameObjects.GameObject;
type ResizeHandler = (gameSize: Phaser.Structs.Size) => void;

interface TutorialRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

interface TutorialAnchor {
  rect: TutorialRect;
  radius?: number;
  key?: string;
  role?: string;
  focusKind?: string;
  placement?: string;
  buttonKey?: string;
  index?: number;
  itemId?: string | null;
  row?: number;
  col?: number;
  recommendation?: unknown;
  suggestion?: unknown;
  x?: number;
  y?: number;
}
interface TutorialGate {
  target: TutorialAnchor | null;
  allowedAnchors: TutorialAnchor[];
  focusAnchor: TutorialAnchor | null;
}

interface TutorialLegacyStep {
  arrow?: string;
}

const ARROW_BOUNCE_PX = 12;
const ARROW_BOUNCE_MS = 600;
const TEXT_BOX_PAD = 16;
const TEXT_BOX_MAX_W = 380;

export class TutorialOverlay {
  scene: PhaserScene;
  stepIndex: number;
  active: boolean;
  steps: TutorialStep[];

  dimmer: Rectangle | null;
  arrowGraphics: Graphics | null;
  arrowTween: Tween | null;
  textBox: Rectangle | null;
  textContent: Text | null;
  skipBtn: Text | null;
  stepText: Text | null;
  continueHintText: Text | null;
  blockedHintText: Text | null;
  _blockedHintCall: TimeEvent | null;
  _objects: DisplayObject[];
  currentStep: TutorialStep | null;
  currentGate: TutorialGate | null;
  _resizeHandler: ResizeHandler | null;
  _destroyed: boolean;
  _arrowAnchor: TutorialAnchor | null;
  _arrowDir: string;
  _arrowSz: number;

  constructor(scene: PhaserScene) {
    this.scene = scene;
    this.stepIndex = -1;
    this.active = false;
    this.steps = getTutorialStepsForRound((scene as PhaserScene & { player?: { round?: number } })?.player?.round ?? 1);

    this.dimmer = null;
    this.arrowGraphics = null;
    this.arrowTween = null;
    this.textBox = null;
    this.textContent = null;
    this.skipBtn = null;
    this.stepText = null;
    this.continueHintText = null;
    this.blockedHintText = null;
    this._blockedHintCall = null;
    this._objects = [];
    this.currentStep = null;
    this.currentGate = null;
    this._resizeHandler = null;
    this._destroyed = false;
    this._arrowAnchor = null;
    this._arrowDir = "none";
    this._arrowSz = 16;
  }

  _isSceneReady(): boolean {
    const cam = this.scene?.cameras?.main;
    return !!cam && Number.isFinite(cam.width) && Number.isFinite(cam.height);
  }

  start(): void {
    if (this._destroyed || !this._isSceneReady()) return;
    this.active = true;
    this.stepIndex = -1;
    this.steps = getTutorialStepsForRound((this.scene as PhaserScene & { player?: { round?: number } })?.player?.round ?? 1);
    this._createBaseUI();
    if (!this._resizeHandler) {
      this._resizeHandler = () => this.refreshCurrentStep();
      const scale = this.scene.scale as Phaser.Scale.ScaleManager;
      scale?.on?.("resize", this._resizeHandler);
    }
    const events = this.scene.events as Phaser.Events.EventEmitter;
    events?.once?.("shutdown", () => this.destroy());
    events?.once?.("destroy", () => this.destroy());
    this.advance();
  }

  advance(): void {
    let step: TutorialStep | null = null;
    do {
      this.stepIndex += 1;
      if (this.stepIndex >= this.steps.length) {
        this.finish();
        return;
      }
      step = this.steps[this.stepIndex];
    } while (isTutorialStepSatisfied(this.scene as unknown as Parameters<typeof isTutorialStepSatisfied>[0], step as unknown as Parameters<typeof isTutorialStepSatisfied>[1]));

    const delay = step.delay || 0;
    if (delay > 0) {
      this.scene.time.delayedCall(delay, () => {
        if (!this._destroyed && step) this._showStep(step);
      });
      return;
    }
    this._showStep(step);
  }

  handleTrigger(triggerName: string): boolean {
    if (!this.active || this.stepIndex < 0 || this.stepIndex >= this.steps.length) return false;
    const step = this.steps[this.stepIndex];
    if (isTutorialStepSatisfied(this.scene as unknown as Parameters<typeof isTutorialStepSatisfied>[0], step as unknown as Parameters<typeof isTutorialStepSatisfied>[1]) || step.trigger === triggerName) {
      if (step.trigger === "dismiss" && triggerName === "dismiss") {
        const markerKey = getTutorialDismissMarkerKey(step.id);
        if (markerKey) {
          (this.scene as PhaserScene & {
            setTutorialMarker?: (key: string, value: boolean) => void;
            persistProgress?: () => void;
          }).setTutorialMarker?.(markerKey, true);
          (this.scene as PhaserScene & { persistProgress?: () => void }).persistProgress?.();
        }
      }
      this.advance();
      return true;
    }
    return false;
  }

  isActive(): boolean {
    return this.active;
  }

  getCurrentStep(): TutorialStep | null {
    if (!this.active || this.stepIndex < 0) return null;
    return this.steps[this.stepIndex] ?? null;
  }

  getCurrentGate(): TutorialGate | null {
    return this.currentGate;
  }

  showBlockedHint(message: string): void {
    if (!this.blockedHintText || !message) return;
    this.blockedHintText
      .setText(message)
      .setVisible(true);
    if (this._blockedHintCall) {
      this._blockedHintCall.remove(false);
      this._blockedHintCall = null;
    }
    if (this.scene.time?.delayedCall) {
      this._blockedHintCall = this.scene.time.delayedCall(1300, () => {
        this.blockedHintText?.setVisible(false);
        this._blockedHintCall = null;
      });
      return;
    }
    this.blockedHintText.setVisible(false);
  }

  finish(): void {
    this.active = false;
    this.currentStep = null;
    this.currentGate = null;
    this._clearVisuals();
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this.finish();
    if (this._resizeHandler) {
      const scale = this.scene.scale as Phaser.Scale.ScaleManager;
      scale?.off?.("resize", this._resizeHandler);
      this._resizeHandler = null;
    }
    this._objects.forEach((obj) => obj?.destroy?.());
    this._objects = [];
  }

  _createBaseUI(): void {
    if (!this._isSceneReady()) return;
    const cam = this.scene.cameras.main;

    this.dimmer = this.scene.add.rectangle(
      cam.width / 2,
      cam.height / 2,
      cam.width,
      cam.height,
      0x000000,
      0.32
    ).setScrollFactor(0).setDepth(9000).setInteractive();
    this.dimmer.on("pointerdown", () => this.handleTrigger("dismiss"));
    this._objects.push(this.dimmer);

    this.arrowGraphics = this.scene.add.graphics()
      .setScrollFactor(0)
      .setDepth(9010);
    this._objects.push(this.arrowGraphics);

    this.textBox = this.scene.add.rectangle(0, 0, TEXT_BOX_MAX_W, 80, 0x0e1828, 0.95)
      .setStrokeStyle(2, 0x8bc8ff, 0.9)
      .setScrollFactor(0)
      .setDepth(9010)
      .setOrigin(0.5);
    this._objects.push(this.textBox);

    this.textContent = this.scene.add.text(0, 0, "", {
      fontFamily: UI_FONT,
      fontSize: "15px",
      color: "#e9f5ff",
      lineSpacing: 6,
      wordWrap: { width: TEXT_BOX_MAX_W - TEXT_BOX_PAD * 2 },
      align: "center"
    }).setScrollFactor(0).setDepth(9011).setOrigin(0.5);
    this._objects.push(this.textContent);

    this.stepText = this.scene.add.text(0, 0, "", {
      fontFamily: UI_FONT,
      fontSize: "11px",
      color: "#6a8aa8",
      align: "right"
    }).setScrollFactor(0).setDepth(9011).setOrigin(1, 0);
    this._objects.push(this.stepText);

    this.continueHintText = this.scene.add.text(0, 0, t("tutorial.dismissHint"), {
      fontFamily: UI_FONT,
      fontSize: "12px",
      color: "#ffeab0",
      align: "center",
      fontStyle: "bold"
    }).setScrollFactor(0).setDepth(9011).setOrigin(0.5).setVisible(false);
    this._objects.push(this.continueHintText);

    this.blockedHintText = this.scene.add.text(cam.width / 2, cam.height - 42, "", {
      fontFamily: UI_FONT,
      fontSize: "12px",
      color: "#ffd7a8",
      align: "center",
      fontStyle: "bold",
      backgroundColor: "#0b1522"
    }).setScrollFactor(0).setDepth(9012).setOrigin(0.5).setVisible(false);
    this._objects.push(this.blockedHintText);

    this.skipBtn = this.scene.add.text(cam.width - 16, 16, t("tutorial.skip"), {
      fontFamily: UI_FONT,
      fontSize: "13px",
      color: "#7f94a7",
      fontStyle: "bold"
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(9012)
      .setInteractive({ useHandCursor: true });
    this.skipBtn.on("pointerdown", () => {
      const scene = this.scene as PhaserScene & { skipTutorialOverlay?: () => void };
      if (typeof scene?.skipTutorialOverlay === "function") {
        scene.skipTutorialOverlay();
        return;
      }
      this.finish();
    });
    this.skipBtn.on("pointerover", () => this.skipBtn?.setColor("#ffeab0"));
    this.skipBtn.on("pointerout", () => this.skipBtn?.setColor("#7f94a7"));
    this._objects.push(this.skipBtn);
  }

  _showStep(step: TutorialStep): void {
    if (!this.active || this._destroyed || !this._isSceneReady()) return;
    const legacy = step as TutorialStep & TutorialLegacyStep;
    const normalizedStep = this._normalizeStep(step);
    if (isTutorialStepSatisfied(this.scene as unknown as Parameters<typeof isTutorialStepSatisfied>[0], normalizedStep as unknown as Parameters<typeof isTutorialStepSatisfied>[1])) {
      this.advance();
      return;
    }
    this.currentStep = normalizedStep;
    this.currentGate = (resolveTutorialGate(this.scene as unknown as Parameters<typeof resolveTutorialGate>[0], normalizedStep) ?? null) as TutorialGate | null;
    const cam = this.scene.cameras.main;
    const anchor = this.currentGate?.target ?? (resolveTutorialTarget(this.scene as unknown as Parameters<typeof resolveTutorialTarget>[0], normalizedStep.target) as TutorialAnchor | null);
    const layoutAnchor = this.currentGate?.focusAnchor ?? anchor;

    if (!this.textContent || !this.textBox || !this.stepText || !this.continueHintText || !this.dimmer) return;

    this.textContent.setText(this._resolveStepText(normalizedStep, anchor));
    const textH = this.textContent.height + TEXT_BOX_PAD * 2;
    const textW = Math.min(TEXT_BOX_MAX_W, this.textContent.width + TEXT_BOX_PAD * 2);
    const layout = computeTutorialOverlayLayout(layoutAnchor as unknown as Anchor | null, cam, textW, textH, (normalizedStep.panelPlacement as unknown as "above") ?? "auto");
    const arrowDirection = normalizedStep.indicator.type === "none"
      ? "none"
      : normalizedStep.indicator.direction === "auto"
        ? layout.arrowDirection
        : (normalizedStep.indicator.direction ?? "auto");

    this.textBox.setPosition(layout.boxX, layout.boxY).setSize(textW, textH).setVisible(true);
    this.textContent.setPosition(layout.boxX, layout.boxY).setVisible(true);
    this.stepText.setText(`${this.stepIndex + 1}/${this.steps.length}`);
    this.stepText.setPosition(layout.boxX + textW / 2 - 6, layout.boxY + textH / 2 + 4).setVisible(true);

    const isDismissStep = normalizedStep.trigger === "dismiss";
    this.continueHintText
      .setText(t("tutorial.dismissHint"))
      .setPosition(layout.boxX, layout.boxY + textH * 0.5 + 18)
      .setVisible(isDismissStep);
    this.blockedHintText?.setVisible(false);

    this._drawArrow(anchor, arrowDirection);

    if (isDismissStep) {
      this.dimmer.setVisible(true).setAlpha(0.35);
      this.dimmer.setInteractive();
    } else {
      this.dimmer.setVisible(true).setAlpha(0.18);
      this.dimmer.disableInteractive();
    }
    void legacy;
  }

  refreshCurrentStep(): void {
    if (!this.active || !this.currentStep || this._destroyed || !this._isSceneReady()) return;
    this._showStep(this.currentStep);
  }

  _normalizeStep(step: TutorialStep): TutorialStep {
    const legacy = step as TutorialStep & TutorialLegacyStep;
    const indicator = step.indicator ?? {
      type: legacy.arrow === "none" ? "none" : "arrow",
      direction: legacy.arrow ?? "auto"
    };
    return {
      ...step,
      indicator: {
        type: indicator.type ?? "arrow",
        direction: indicator.direction ?? "auto"
      },
      panelPlacement: step.panelPlacement ?? (legacy.arrow !== undefined ? getPlacementFromLegacyArrow(legacy.arrow as string) : undefined)
    };
  }

  _resolveStepText(step: TutorialStep, anchor: TutorialAnchor | null): string {
    if (typeof step.text === "function") {
      const ctx = { scene: this.scene, step, anchor };
      return step.text(ctx as unknown as Parameters<typeof step.text>[0]);
    }
    return step.text ?? "";
  }

  _drawArrow(anchor: TutorialAnchor | null, direction: string): void {
    if (!this.arrowGraphics) return;
    this.arrowGraphics.clear().setVisible(direction !== "none" || (this.currentGate?.allowedAnchors?.length ?? 0) > 0);
    if (this.arrowTween) {
      this.arrowTween.destroy();
      this.arrowTween = null;
    }

    if (direction === "none") {
      this._arrowAnchor = anchor;
      this._arrowDir = direction;
      this._arrowSz = 16;
      this._renderArrowAt(0);
      return;
    }

    const sz = 16;
    this._arrowAnchor = anchor;
    this._arrowDir = direction;
    this._arrowSz = sz;

    this._renderArrowAt(0);
    this.arrowTween = this.scene.tweens.add({
      targets: { offset: 0 },
      offset: ARROW_BOUNCE_PX,
      duration: ARROW_BOUNCE_MS,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      onUpdate: (_tween: unknown, target: { offset: number }) => {
        this._renderArrowAt(target.offset);
      }
    });
  }

  _renderArrowAt(offset: number): void {
    const g = this.arrowGraphics;
    if (!g) return;
    const sz = this._arrowSz;
    const dir = this._arrowDir;
    const anchor = this._arrowAnchor;
    const rect = anchor?.rect;
    if (!rect) return;

    g.clear();
    g.lineStyle(2, 0xffeab0, 0.55);
    const extraAnchors = this.currentGate?.allowedAnchors ?? [];
    extraAnchors.forEach((allowedAnchor: TutorialAnchor) => {
      const allowedRect = allowedAnchor?.rect;
      if (!allowedRect) return;
      const expand = 5;
      if (allowedRect.width > 42 || allowedRect.height > 42) {
        if (typeof g.strokeRoundedRect === "function") {
          g.strokeRoundedRect(
            allowedRect.left - expand,
            allowedRect.top - expand,
            allowedRect.width + expand * 2,
            allowedRect.height + expand * 2,
            10
          );
        } else {
          g.strokeRect(
            allowedRect.left - expand,
            allowedRect.top - expand,
            allowedRect.width + expand * 2,
            allowedRect.height + expand * 2
          );
        }
      } else {
        g.strokeCircle(allowedRect.centerX, allowedRect.centerY, Math.max(allowedAnchor.radius ?? 20, 22));
      }
    });

    const tx = rect.centerX;
    const ty = rect.centerY;
    g.fillStyle(0xffeab0, 0.95);

    const gap = 8 + offset;
    let x0 = 0;
    let y0 = 0;
    let x1 = 0;
    let y1 = 0;
    let x2 = 0;
    let y2 = 0;
    if (dir === "down") {
      const tipY = rect.top - gap;
      x0 = tx; y0 = tipY;
      x1 = tx - sz * 0.7; y1 = tipY - sz;
      x2 = tx + sz * 0.7; y2 = tipY - sz;
    } else if (dir === "up") {
      const tipY = rect.bottom + gap;
      x0 = tx; y0 = tipY;
      x1 = tx - sz * 0.7; y1 = tipY + sz;
      x2 = tx + sz * 0.7; y2 = tipY + sz;
    } else if (dir === "left") {
      const tipX = rect.right + gap;
      x0 = tipX; y0 = ty;
      x1 = tipX + sz; y1 = ty - sz * 0.7;
      x2 = tipX + sz; y2 = ty + sz * 0.7;
    } else if (dir === "right") {
      const tipX = rect.left - gap;
      x0 = tipX; y0 = ty;
      x1 = tipX - sz; y1 = ty - sz * 0.7;
      x2 = tipX - sz; y2 = ty + sz * 0.7;
    }

    if (dir !== "none") {
      g.fillTriangle(x0, y0, x1, y1, x2, y2);
    }

    g.lineStyle(2, 0xffeab0, 0.85);
    const expand = 8 + offset * 0.25;
    if (rect.width > 42 || rect.height > 42) {
      if (typeof g.strokeRoundedRect === "function") {
        g.strokeRoundedRect(rect.left - expand, rect.top - expand, rect.width + expand * 2, rect.height + expand * 2, 12);
      } else {
        g.strokeRect(rect.left - expand, rect.top - expand, rect.width + expand * 2, rect.height + expand * 2);
      }
    } else {
      g.strokeCircle(tx, ty, Math.max(anchor.radius ?? 24, 24) + offset * 0.3);
    }
  }

  _clearVisuals(): void {
    if (this.arrowTween) {
      this.arrowTween.destroy();
      this.arrowTween = null;
    }
    if (this._blockedHintCall) {
      this._blockedHintCall.remove(false);
      this._blockedHintCall = null;
    }
    this._objects.forEach((obj) => {
      const settable = obj as DisplayObject & { setVisible?: (v: boolean) => void };
      settable?.setVisible?.(false);
    });
  }
}
