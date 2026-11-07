/**
 * ThreeFortressServiceModalRuntime.ts
 *
 * Fortress service modals (Pharmacy, Beast Den, Blacksmith) runtime for Three.js.
 */

import { UI_COLORS, UI_FONT, EMOJI_FONT } from "../core/uiTheme.js";
import { t } from "../i18n/index.js";

type AnyObj = Record<string, unknown>;

export interface ModalButton {
  bg: AnyObj;
  text: AnyObj;
}

export interface ModalScene {
  scale: { width: number; height: number };
  add: {
    rectangle: (x: number, y: number, w: number, h: number, color?: number, alpha?: number) => AnyObj;
    circle: (x: number, y: number, radius: number, color?: number, alpha?: number) => AnyObj;
    text: (x: number, y: number, text: string, style?: AnyObj) => AnyObj;
    container: (x?: number, y?: number) => AnyObj;
  };
  overlay?: AnyObj;
  [key: string]: unknown;
}

export interface ServiceOption {
  icon?: string;
  label: string;
  description: string;
  stroke?: number;
  onSelect?: () => boolean | void;
}

export interface ServiceChoice {
  kind: string;
  hpDelta?: number;
  xpDelta?: number;
  goldDelta?: number;
  labelKey: string;
  detailKey: string;
}

export interface ModalArgs {
  icon?: string;
  title: string;
  subtitle: string;
  note?: string;
  options?: ServiceOption[];
  allowSkip?: boolean;
  onSkip?: () => void;
}

export interface PharmacyModalArgs {
  serviceChoices?: ServiceChoice[];
  onSelect?: (choice: ServiceChoice) => void;
  onSkip?: () => void;
}

export interface BeastDenUnit {
  icon?: string;
  name: string;
  tier: number;
  classVi?: string;
  classType: string;
}

export interface BeastDenModalArgs {
  units?: BeastDenUnit[];
  onSelect?: (unit: BeastDenUnit) => void;
  onSkip?: () => void;
}

export interface BlacksmithModalArgs {
  forgeTier?: number;
  onEnter?: () => void;
  onSkip?: () => void;
}

function createModalButton(
  scene: ModalScene,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  onClick: () => void,
  fill = 0x294662,
  stroke = 0x93ccff
): ModalButton {
  const bg = scene.add.rectangle(x, y, width, height, fill, 0.96);
  if (typeof bg.setStrokeStyle === "function") bg.setStrokeStyle(1.5, stroke, 0.95);
  if (typeof bg.setInteractive === "function") bg.setInteractive({ useHandCursor: true });
  const text = scene.add.text(x, y, label, {
    fontFamily: UI_FONT,
    fontSize: "14px",
    color: "#ffffff",
    fontStyle: "bold"
  });
  if (typeof text.setOrigin === "function") text.setOrigin(0.5);
  if (typeof bg.on === "function") {
    bg.on("pointerdown", () => onClick?.());
  }
  return { bg, text };
}

function destroyOverlay(scene: ModalScene): void {
  if (typeof (scene.overlay as { destroy?: (b?: boolean) => unknown })?.destroy === "function") {
    (scene.overlay as { destroy: (b?: boolean) => unknown }).destroy(true);
  }
  scene.overlay = undefined;
}

function showFortressServiceModal(scene: ModalScene, args: ModalArgs): AnyObj {
  const {
    icon = "◆",
    title,
    subtitle,
    note = "",
    options = [],
    allowSkip = false,
    onSkip = null
  } = args;

  destroyOverlay(scene);
  const width = scene.scale.width;
  const height = scene.scale.height;
  const container = scene.add.container(0, 0);
  if (typeof container.setDepth === "function") container.setDepth(200);

  const veil = scene.add.rectangle(width / 2, height / 2, width, height, 0x03070d, 0.76);
  const panelW = Math.min(700, width - 80);
  const panelH = Math.min(500, height - 90);
  const panelX = width / 2;
  const panelY = height / 2;
  const panel = scene.add.rectangle(panelX, panelY, panelW, panelH, 0x0f1a2b, 0.985);
  if (typeof panel.setStrokeStyle === "function") panel.setStrokeStyle(2, 0x8bc8ff, 1);

  const accent = scene.add.rectangle(panelX - panelW / 2, panelY - panelH / 2, panelW, 8, 0x7ceec4, 0.95);
  if (typeof accent.setOrigin === "function") accent.setOrigin(0, 0);

  const iconBadge = scene.add.circle(panelX - panelW / 2 + 36, panelY - panelH / 2 + 46, 28, 0x1a2c42, 0.96);
  if (typeof iconBadge.setStrokeStyle === "function") iconBadge.setStrokeStyle(1.5, 0x9fd6ff, 0.92);
  const iconText = scene.add.text(
    (iconBadge as { x?: number }).x ?? (panelX - panelW / 2 + 36),
    (iconBadge as { y?: number }).y ?? (panelY - panelH / 2 + 46),
    icon,
    { fontFamily: EMOJI_FONT, fontSize: "26px" }
  );
  if (typeof iconText.setOrigin === "function") iconText.setOrigin(0.5);

  const titleText = scene.add.text(
    panelX - panelW / 2 + 78,
    panelY - panelH / 2 + 24,
    title,
    { fontFamily: UI_FONT, fontSize: "26px", color: "#ffeab0", fontStyle: "bold" }
  );
  const subtitleText = scene.add.text(
    panelX - panelW / 2 + 78,
    panelY - panelH / 2 + 58,
    subtitle,
    { fontFamily: UI_FONT, fontSize: "14px", color: UI_COLORS.textSecondary, wordWrap: { width: panelW - 126 } }
  );

  const noteCard = scene.add.rectangle(panelX, panelY - panelH / 2 + 116, panelW - 48, 46, 0x17283c, 0.96);
  if (typeof noteCard.setStrokeStyle === "function") noteCard.setStrokeStyle(1, 0x36536f, 0.75);
  const noteText = scene.add.text(
    panelX - panelW / 2 + 36,
    ((noteCard as { y?: number }).y ?? (panelY - panelH / 2 + 116)) - 12,
    note,
    { fontFamily: UI_FONT, fontSize: "12px", color: "#dcefff", wordWrap: { width: panelW - 84 } }
  );

  const elementsToAdd = [veil, panel, accent, iconBadge, iconText, titleText, subtitleText, noteCard, noteText];
  if (typeof (container as { add?: (items: AnyObj[]) => unknown }).add === "function") {
    (container as { add: (items: AnyObj[]) => unknown }).add(elementsToAdd);
  }

  const startY = panelY - panelH / 2 + 176;
  options.slice(0, 4).forEach((option, index) => {
    const y = startY + index * 72;
    const card = scene.add.rectangle(panelX, y, panelW - 52, 56, 0x1a2c42, 0.98);
    if (typeof card.setStrokeStyle === "function") card.setStrokeStyle(1.5, option.stroke ?? 0x9cd0ff, 0.88);
    if (typeof card.setInteractive === "function") card.setInteractive({ useHandCursor: true });

    const label = scene.add.text(
      panelX - panelW / 2 + 32,
      y - 16,
      `${option.icon ?? "◆"} ${option.label}`,
      { fontFamily: UI_FONT, fontSize: "15px", color: "#f4fbff", fontStyle: "bold" }
    );
    const desc = scene.add.text(
      panelX - panelW / 2 + 32,
      y + 4,
      option.description,
      { fontFamily: UI_FONT, fontSize: "12px", color: UI_COLORS.textSecondary, wordWrap: { width: panelW - 104 } }
    );

    if (typeof card.on === "function") {
      card.on("pointerdown", () => {
        const shouldClose = option.onSelect?.();
        if (shouldClose !== false) destroyOverlay(scene);
      });
    }

    if (typeof (container as { add?: (items: AnyObj[]) => unknown }).add === "function") {
      (container as { add: (items: AnyObj[]) => unknown }).add([card, label, desc]);
    }
  });

  if (allowSkip) {
    const skipBtn = createModalButton(
      scene,
      panelX + panelW / 2 - 100,
      panelY + panelH / 2 - 34,
      132,
      36,
      t("ui.skip"),
      () => {
        destroyOverlay(scene);
        onSkip?.();
      }
    );
    if (typeof (container as { add?: (items: AnyObj[]) => unknown }).add === "function") {
      (container as { add: (items: AnyObj[]) => unknown }).add([skipBtn.bg, skipBtn.text]);
    }
  }

  scene.overlay = container;
  return container;
}

export function showFortressPharmacyModal(scene: ModalScene, args: PharmacyModalArgs = {}): AnyObj {
  const { serviceChoices = [], onSelect, onSkip } = args;
  const choices = (Array.isArray(serviceChoices) ? serviceChoices : []).filter(
    (choice): choice is ServiceChoice => Boolean(choice) && typeof choice === "object"
  );
  return showFortressServiceModal(scene, {
    icon: "🧪",
    title: t("fortress.node.pharmacy"),
    subtitle: t("fortress.healChoice"),
    note: t("fortress.serviceNote.pharmacy"),
    options: choices.map((choice) => ({
      icon: choice.kind === "heal_xp" ? "💡" : choice.kind === "heal_gold" ? "🧺" : "💚",
      label: t(choice.labelKey, {
        hp: choice.hpDelta ?? 0,
        xp: choice.xpDelta ?? 0,
        gold: choice.goldDelta ?? 0
      }),
      description: t(choice.detailKey, {
        hp: choice.hpDelta ?? 0,
        xp: choice.xpDelta ?? 0,
        gold: choice.goldDelta ?? 0
      }),
      stroke: 0x8ff0c0,
      onSelect: () => onSelect?.(choice)
    })),
    allowSkip: true,
    onSkip
  });
}

export function showFortressBeastDenModal(scene: ModalScene, args: BeastDenModalArgs = {}): AnyObj {
  const { units = [], onSelect, onSkip } = args;
  return showFortressServiceModal(scene, {
    icon: "🐾",
    title: t("fortress.node.beastDen"),
    subtitle: t("fortress.recruitChoice"),
    note: t("fortress.serviceNote.beastDen"),
    options: units.map((unit) => ({
      icon: unit.icon ?? "🐾",
      label: unit.name,
      description: `${t("label.tier")} ${unit.tier} • ${unit.classVi ?? unit.classType}`,
      stroke: 0xffd28b,
      onSelect: () => onSelect?.(unit)
    })),
    allowSkip: true,
    onSkip
  });
}

export function showFortressBlacksmithModal(scene: ModalScene, args: BlacksmithModalArgs = {}): AnyObj {
  const { forgeTier = 1, onEnter, onSkip } = args;
  return showFortressServiceModal(scene, {
    icon: "⚒",
    title: t("fortress.node.blacksmith"),
    subtitle: t("fortress.blacksmithChoice"),
    note: t("fortress.blacksmithEnterDetail", { tier: forgeTier }),
    options: [
      {
        icon: "🛠",
        label: t("fortress.blacksmithEnter"),
        description: t("fortress.serviceNote.blacksmith"),
        stroke: 0xffc27d,
        onSelect: () => onEnter?.()
      }
    ],
    allowSkip: true,
    onSkip
  });
}

export default {
  showFortressPharmacyModal,
  showFortressBeastDenModal,
  showFortressBlacksmithModal
};
