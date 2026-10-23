/**
 * ThreeCombatActionButtonsRuntime.ts
 *
 * Combat action buttons initialization and event binding for Three.js.
 * Sets up shop reroll, XP purchase, shop lock, combat initiation, and run reset buttons.
 */

import { getResetRunButtonLabel } from "../ui/buttonEmojiLabels.js";

export type CombatButton = {
  setLabel: (label: string) => unknown;
  setEnabled?: (enabled: boolean) => unknown;
};

export type CombatButtonScene = {
  buttons: Record<string, CombatButton>;
  createButton: (
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    onClick: () => void,
    options?: Record<string, unknown>
  ) => CombatButton;
  rollShop: () => void;
  buyXp: () => void;
  toggleLock: () => void;
  beginCombat: () => void;
  startNewRun: () => void;
};

export function createCombatButtons(scene: CombatButtonScene): void {
  scene.buttons.roll = scene.createButton(40, 600, 120, 36, "Đổi tướng", () => scene.rollShop());
  scene.buttons.xp = scene.createButton(170, 600, 120, 36, "Mua XP", () => scene.buyXp());
  scene.buttons.lock = scene.createButton(300, 600, 120, 36, "Khóa: Tắt", () => scene.toggleLock());
  scene.buttons.start = scene.createButton(430, 600, 160, 36, "Bắt đầu giao tranh", () => scene.beginCombat());
  scene.buttons.reset = scene.createButton(600, 600, 120, 36, getResetRunButtonLabel(), () => scene.startNewRun());
}

export default { createCombatButtons };
