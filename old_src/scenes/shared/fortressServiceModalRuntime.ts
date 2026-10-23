import type Phaser from "phaser";
import { UI_COLORS, UI_FONT, EMOJI_FONT } from "../../core/uiTheme.js";
import { t } from "../../i18n/index.js";

type ModalButton = { bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text };
type ModalScene = Phaser.Scene & { overlay?: Phaser.GameObjects.Container; [key: string]: unknown };
type ServiceOption = { icon?: string; label: string; description: string; stroke?: number; onSelect?: () => boolean | void };
type ServiceChoice = { kind: string; hpDelta?: number; xpDelta?: number; goldDelta?: number; labelKey: string; detailKey: string };
type ModalArgs = { icon?: string; title: string; subtitle: string; note?: string; options?: ServiceOption[]; allowSkip?: boolean; onSkip?: () => void };
type PharmacyModalArgs = { serviceChoices?: ServiceChoice[]; onSelect?: (choice: ServiceChoice) => void; onSkip?: () => void };
type BeastDenModalArgs = { units?: Array<{ icon?: string; name: string; tier: number; classVi?: string; classType: string }>;
  onSelect?: (unit: { icon?: string; name: string; tier: number; classVi?: string; classType: string }) => void; onSkip?: () => void };
type BlacksmithModalArgs = { forgeTier?: number; onEnter?: () => void; onSkip?: () => void };

function createModalButton(scene: ModalScene, x: number, y: number, width: number, height: number, label: string, onClick: () => void, fill = 0x294662, stroke = 0x93ccff): ModalButton {
  const bg = scene.add.rectangle(x, y, width, height, fill, 0.96);
  bg.setStrokeStyle(1.5, stroke, 0.95);
  bg.setInteractive({ useHandCursor: true });
  const text = scene.add.text(x, y, label, { fontFamily: UI_FONT, fontSize: "14px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5);
  bg.on("pointerdown", () => onClick?.());
  return { bg, text };
}

function destroyOverlay(scene: ModalScene): void {
  scene.overlay?.destroy?.(true);
  scene.overlay = undefined;
}

function showFortressServiceModal(scene: ModalScene, args: ModalArgs): Phaser.GameObjects.Container {
  const { icon = "◆", title, subtitle, note = "", options = [], allowSkip = false, onSkip = null } = args;
  destroyOverlay(scene);
  const width = scene.scale.width;
  const height = scene.scale.height;
  const container = scene.add.container(0, 0);
  container.setDepth(200);

  const veil = scene.add.rectangle(width / 2, height / 2, width, height, 0x03070d, 0.76);
  const panelW = Math.min(700, width - 80);
  const panelH = Math.min(500, height - 90);
  const panelX = width / 2;
  const panelY = height / 2;
  const panel = scene.add.rectangle(panelX, panelY, panelW, panelH, 0x0f1a2b, 0.985);
  panel.setStrokeStyle(2, 0x8bc8ff, 1);
  const accent = scene.add.rectangle(panelX - panelW / 2, panelY - panelH / 2, panelW, 8, 0x7ceec4, 0.95).setOrigin(0, 0);

  const iconBadge = scene.add.circle(panelX - panelW / 2 + 36, panelY - panelH / 2 + 46, 28, 0x1a2c42, 0.96);
  iconBadge.setStrokeStyle(1.5, 0x9fd6ff, 0.92);
  const iconText = scene.add.text(iconBadge.x, iconBadge.y, icon, { fontFamily: EMOJI_FONT, fontSize: "26px" }).setOrigin(0.5);

  const titleText = scene.add.text(panelX - panelW / 2 + 78, panelY - panelH / 2 + 24, title, { fontFamily: UI_FONT, fontSize: "26px", color: "#ffeab0", fontStyle: "bold" });
  const subtitleText = scene.add.text(panelX - panelW / 2 + 78, panelY - panelH / 2 + 58, subtitle, {
    fontFamily: UI_FONT, fontSize: "14px", color: UI_COLORS.textSecondary, wordWrap: { width: panelW - 126 }
  });

  const noteCard = scene.add.rectangle(panelX, panelY - panelH / 2 + 116, panelW - 48, 46, 0x17283c, 0.96);
  noteCard.setStrokeStyle(1, 0x36536f, 0.75);
  const noteText = scene.add.text(panelX - panelW / 2 + 36, noteCard.y - 12, note, { fontFamily: UI_FONT, fontSize: "12px", color: "#dcefff", wordWrap: { width: panelW - 84 } });

  container.add([veil, panel, accent, iconBadge, iconText, titleText, subtitleText, noteCard, noteText]);

  const startY = panelY - panelH / 2 + 176;
  options.slice(0, 4).forEach((option, index) => {
    const y = startY + index * 72;
    const card = scene.add.rectangle(panelX, y, panelW - 52, 56, 0x1a2c42, 0.98);
    card.setStrokeStyle(1.5, option.stroke ?? 0x9cd0ff, 0.88);
    card.setInteractive({ useHandCursor: true });
    const label = scene.add.text(panelX - panelW / 2 + 32, y - 16, `${option.icon ?? "◆"} ${option.label}`, {
      fontFamily: UI_FONT, fontSize: "15px", color: "#f4fbff", fontStyle: "bold"
    });
    const desc = scene.add.text(panelX - panelW / 2 + 32, y + 4, option.description, {
      fontFamily: UI_FONT, fontSize: "12px", color: UI_COLORS.textSecondary, wordWrap: { width: panelW - 104 }
    });
    card.on("pointerdown", () => {
      const shouldClose = option.onSelect?.();
      if (shouldClose !== false) destroyOverlay(scene);
    });
    container.add([card, label, desc]);
  });

  if (allowSkip) {
    const skipBtn = createModalButton(scene, panelX + panelW / 2 - 100, panelY + panelH / 2 - 34, 132, 36, t("ui.skip"), () => {
      destroyOverlay(scene);
      onSkip?.();
    });
    container.add([skipBtn.bg, skipBtn.text]);
  }
  scene.overlay = container;
  return container;
}

export function showFortressPharmacyModal(scene: ModalScene, args: PharmacyModalArgs = {}): Phaser.GameObjects.Container {
  const { serviceChoices = [], onSelect, onSkip } = args;
  const choices = (Array.isArray(serviceChoices) ? serviceChoices : []).filter((choice): choice is ServiceChoice => Boolean(choice) && typeof choice === "object");
  return showFortressServiceModal(scene, {
    icon: "🧪", title: t("fortress.node.pharmacy"), subtitle: t("fortress.healChoice"), note: t("fortress.serviceNote.pharmacy"),
    options: choices.map((choice) => ({
      icon: choice.kind === "heal_xp" ? "💡" : choice.kind === "heal_gold" ? "🧺" : "💚",
      label: t(choice.labelKey, { hp: choice.hpDelta ?? 0, xp: choice.xpDelta ?? 0, gold: choice.goldDelta ?? 0 }),
      description: t(choice.detailKey, { hp: choice.hpDelta ?? 0, xp: choice.xpDelta ?? 0, gold: choice.goldDelta ?? 0 }),
      stroke: 0x8ff0c0, onSelect: () => onSelect?.(choice)
    })),
    allowSkip: true, onSkip
  });
}

export function showFortressBeastDenModal(scene: ModalScene, args: BeastDenModalArgs = {}): Phaser.GameObjects.Container {
  const { units = [], onSelect, onSkip } = args;
  return showFortressServiceModal(scene, {
    icon: "🐾", title: t("fortress.node.beastDen"), subtitle: t("fortress.recruitChoice"), note: t("fortress.serviceNote.beastDen"),
    options: units.map((unit) => ({
      icon: unit.icon ?? "🐾", label: unit.name, description: `${t("label.tier")} ${unit.tier} • ${unit.classVi ?? unit.classType}`, stroke: 0xffd28b,
      onSelect: () => onSelect?.(unit)
    })),
    allowSkip: true, onSkip
  });
}

export function showFortressBlacksmithModal(scene: ModalScene, args: BlacksmithModalArgs = {}): Phaser.GameObjects.Container {
  const { forgeTier = 1, onEnter, onSkip } = args;
  return showFortressServiceModal(scene, {
    icon: "⚒", title: t("fortress.node.blacksmith"), subtitle: t("fortress.blacksmithChoice"),
    note: t("fortress.blacksmithEnterDetail", { tier: forgeTier }),
    options: [{ icon: "🛠", label: t("fortress.blacksmithEnter"), description: t("fortress.serviceNote.blacksmith"), stroke: 0xffc27d, onSelect: () => onEnter?.() }],
    allowSkip: true, onSkip
  });
}
