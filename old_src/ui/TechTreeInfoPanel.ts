/**
 * TechTreeInfoPanel — Info panel rendering for TechTreeModal
 *
 * Extracted from TechTreeModal.js to keep under 500 lines.
 */

import {
  TECH_BY_ID,
  TECH_BRANCHES,
  getTechCost,
  getTechRequirementIds,
  canResearch,
  isUnlocked,
  TechNode
} from "../data/techTree.js";
import { UI_FONT } from "../core/uiTheme.js";

const UI_COLORS = {
  panelEdgeSoft: 0x3a5a7a,
  textMuted: "#6688aa",
  textSecondary: "#a0c0dd"
} as const;

type PhaserScene = Phaser.Scene;
type PhaserShape = Phaser.GameObjects.Shape;
type PhaserText = Phaser.GameObjects.Text;

interface TechTreeModalLike {
  selectedId: string | null;
  player: {
    techLevels?: Record<string, number>;
    gold?: number;
  };
  scene: PhaserScene;
  depth: number;
  infoPanel: { objects: Phaser.GameObjects.GameObject[] };
  _clearInfoPanel: () => void;
  onResearch?: (id: string) => void;
  refreshFromPlayer?: (player: TechTreeModalLike["player"]) => void;
  _refreshNodeStates: () => void;
  _refreshInfoPanel: () => void;
}

export function refreshInfoPanel(modal: TechTreeModalLike): void {
  modal._clearInfoPanel();
  const id = modal.selectedId;
  if (!id) return;

  const node = TECH_BY_ID[id] as TechNode | undefined;
  if (!node) return;
  const requirementIds = getTechRequirementIds(id);

  const s = modal.scene;
  const cam = s.cameras.main;
  const panelW = 360;
  const panelH = node.id === "root" ? 152 : (requirementIds.length > 1 ? 196 : 170);
  const px = cam.width / 2 - panelW / 2;
  const py = cam.height - panelH - 58;

  const techLevels = modal.player.techLevels ?? {};
  const level = techLevels[id] ?? 0;
  const maxed = node.maxBuy === 0 || level >= node.maxBuy;
  const cost = maxed ? 0 : getTechCost(id, level);
  const affordable = canResearch(id, techLevels, modal.player.gold ?? 0);
  const unlocked = isUnlocked(id, techLevels);

  const bg = s.add.rectangle(px + panelW / 2, py + panelH / 2, panelW, panelH, 0x0e1828, 0.96)
    .setStrokeStyle(1.5, UI_COLORS.panelEdgeSoft, 0.8)
    .setDepth(modal.depth + 20).setScrollFactor(0);
  modal.infoPanel.objects.push(bg);

  const title = s.add.text(px + 12, py + 10, `${node.icon} ${node.name}`, {
    fontFamily: UI_FONT, fontSize: "16px", color: "#e9f5ff", fontStyle: "bold"
  }).setDepth(modal.depth + 21).setScrollFactor(0);
  modal.infoPanel.objects.push(title);

  const branchInfo = (TECH_BRANCHES as Record<string, { label?: string }>)[node.branch];
  const branchLabel = branchInfo?.label ?? "";
  const branchTag = s.add.text(px + panelW - 12, py + 12, branchLabel, {
    fontFamily: UI_FONT, fontSize: "11px", color: UI_COLORS.textMuted
  }).setOrigin(1, 0).setDepth(modal.depth + 21).setScrollFactor(0);
  modal.infoPanel.objects.push(branchTag);

  const desc = s.add.text(px + 12, py + 35, node.desc, {
    fontFamily: UI_FONT, fontSize: "12px", color: UI_COLORS.textSecondary,
    wordWrap: { width: panelW - 24 }
  }).setDepth(modal.depth + 21).setScrollFactor(0);
  modal.infoPanel.objects.push(desc);

  let cursorY = py + 35 + desc.height + 8;

  if (requirementIds.length) {
    const reqTitle = s.add.text(px + 12, cursorY, "Yêu cầu:", {
      fontFamily: UI_FONT, fontSize: "11px", color: "#9cc4e6", fontStyle: "bold"
    }).setDepth(modal.depth + 21).setScrollFactor(0);
    modal.infoPanel.objects.push(reqTitle);
    cursorY += 14;

    const reqText = s.add.text(
      px + 12,
      cursorY,
      requirementIds.map((requirementId) => {
        const requirement = TECH_BY_ID[requirementId] as TechNode | undefined;
        const met = requirement?.maxBuy === 0 || (techLevels[requirementId] ?? 0) > 0;
        return `${met ? "✅" : "⬜"} ${requirement?.icon ?? "•"} ${requirement?.name ?? requirementId}`;
      }).join("\n"),
      {
        fontFamily: UI_FONT,
        fontSize: "11px",
        color: unlocked ? "#d7ecff" : "#9eb5c8",
        lineSpacing: 2,
        wordWrap: { width: panelW - 24 }
      }
    ).setDepth(modal.depth + 21).setScrollFactor(0);
    modal.infoPanel.objects.push(reqText);
    cursorY += reqText.height + 8;
  }

  if (node.maxBuy > 0) {
    const maxLabel = node.maxBuy === Infinity ? "♾️" : node.maxBuy;
    const lvlText = s.add.text(px + 12, cursorY, `Cấp: ${level} / ${maxLabel}`, {
      fontFamily: UI_FONT, fontSize: "11px", color: "#ffd580"
    }).setDepth(modal.depth + 21).setScrollFactor(0);
    modal.infoPanel.objects.push(lvlText);
  }

  if (node.id !== "root" && !maxed) {
    const btnW = 140;
    const btnH = 34;
    const btnX = px + panelW / 2;
    const btnY = py + panelH - 26;

    let btnColor: number;
    let btnTextColor: string;
    let btnLabel: string;
    if (!unlocked) {
      btnColor = 0x1a1a2a;
      btnTextColor = "#555";
      btnLabel = "🔒 Chưa mở khóa";
    } else if (!affordable) {
      btnColor = 0x2a1a1a;
      btnTextColor = "#aa6666";
      btnLabel = `Cần ${cost}🪙`;
    } else {
      btnColor = 0x1a3a2a;
      btnTextColor = "#8bffd7";
      btnLabel = `Nghiên cứu (${cost}🪙)`;
    }

    const btnBg = s.add.rectangle(btnX, btnY, btnW, btnH, btnColor, 0.95)
      .setStrokeStyle(1.5, affordable && unlocked ? 0x4caf50 : 0x3a4a5c, 0.8)
      .setDepth(modal.depth + 22).setScrollFactor(0);

    if (affordable && unlocked) {
      btnBg.setInteractive({ useHandCursor: true });
      btnBg.on("pointerover", () => btnBg.setFillStyle(0x2a5a3a, 1));
      btnBg.on("pointerout", () => btnBg.setFillStyle(btnColor, 0.95));
      btnBg.on("pointerdown", () => {
        modal.onResearch?.(id);
        if (typeof modal.refreshFromPlayer === "function") {
          modal.refreshFromPlayer(modal.player);
          return;
        }
        modal._refreshNodeStates();
        modal._refreshInfoPanel();
      });
    }

    const btnText = s.add.text(btnX, btnY, btnLabel, {
      fontFamily: UI_FONT, fontSize: "13px", color: btnTextColor, fontStyle: "bold"
    }).setOrigin(0.5).setDepth(modal.depth + 23).setScrollFactor(0);

    modal.infoPanel.objects.push(btnBg, btnText);
  } else if (maxed && node.id !== "root") {
    const doneText = s.add.text(px + panelW / 2, py + panelH - 26, "✅ Đã nghiên cứu hoàn tất", {
      fontFamily: UI_FONT, fontSize: "12px", color: "#8bffd7"
    }).setOrigin(0.5).setDepth(modal.depth + 21).setScrollFactor(0);
    modal.infoPanel.objects.push(doneText);
  }
}
