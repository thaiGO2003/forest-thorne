import type { Scene as PhaserScene } from "phaser";
import { scaleUiSize } from "../core/uiResponsive.js";

const SETTINGS_STEPPER_SIDE_MIN = 56;
const SETTINGS_STEPPER_CENTER_MIN = 180;

type SceneWithTextMetrics = PhaserScene & Record<string, unknown>;

export function getSettingsStepperMetrics(scene: SceneWithTextMetrics | null | undefined, buttonWidth: number, buttonHeight: number, gap: number): {
  sideWidth: number;
  centerWidth: number;
} {
  const sideWidth = Math.max(
    Math.round(buttonHeight * 1.12),
    scaleUiSize(scene, SETTINGS_STEPPER_SIDE_MIN, "control")
  );
  const centerWidth = Math.max(
    scaleUiSize(scene, SETTINGS_STEPPER_CENTER_MIN, "control"),
    buttonWidth - sideWidth * 2 - gap * 2
  );
  return {
    sideWidth,
    centerWidth
  };
}

type StepperButton = Record<string, unknown>;

export interface SettingsStepperRowConfig {
  y: number;
  makeButton: (x: number, y: number, w: number, h: number, label: string, onClick: () => void, opts: Record<string, unknown>) => StepperButton;
  centerWidth: number;
  sideWidth: number;
  height: number;
  gap: number;
  centerLabel: string;
  onDecrement: () => void;
  onIncrement: () => void;
  onCenterClick?: () => void;
  decrementLabel?: string;
  incrementLabel?: string;
  centerButtonOpts?: Record<string, unknown>;
  sideButtonOpts?: Record<string, unknown>;
}

export function buildSettingsStepperRow({
  y,
  makeButton,
  centerWidth,
  sideWidth,
  height,
  gap,
  centerLabel,
  onDecrement,
  onIncrement,
  onCenterClick = () => {},
  decrementLabel = "−",
  incrementLabel = "+",
  centerButtonOpts = {},
  sideButtonOpts = {}
}: SettingsStepperRowConfig): {
  down: StepperButton;
  center: StepperButton;
  up: StepperButton;
} {
  const sideOffset = centerWidth * 0.5 + gap + sideWidth * 0.5;
  return {
    down: makeButton(-sideOffset, y, sideWidth, height, decrementLabel, onDecrement, sideButtonOpts),
    center: makeButton(0, y, centerWidth, height, centerLabel, onCenterClick, centerButtonOpts),
    up: makeButton(sideOffset, y, sideWidth, height, incrementLabel, onIncrement, sideButtonOpts)
  };
}
