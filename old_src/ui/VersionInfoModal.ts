/**
 * VersionInfoModal.js
 *
 * Version info popup for PlanningScene.
 * Extracted from PlanningScene to reduce file size.
 */

import { UI_FONT, UI_COLORS } from "../core/uiTheme.js";
import { type SceneButton } from "./SceneButton.js";
import type { Scene as PhaserScene } from "phaser";

export interface VersionInfo {
  version: string;
  updatedAt: string;
  notes: string[];
}

type SceneWithToggle = PhaserScene & {
  toggleVersionInfoModal: (visible: boolean) => void;
  scale: { width: number; height: number };
  add: PhaserScene["add"];
};

type CreateButtonFn = (
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  opts?: { variant?: string; fontSize?: number | string }
) => SceneButton;

/**
 * Creates the version info modal UI elements.
 */
export function buildVersionInfoModal(
  scene: SceneWithToggle,
  createButton: CreateButtonFn,
  versionInfo: VersionInfo
): Array<{ setDepth: (v: number) => void; setVisible: (v: boolean) => void; on?: (event: string, handler: () => void) => void; setInteractive?: (opts: unknown) => void }> {
  const w = scene.scale.width;
  const h = scene.scale.height;
  const panelW = Math.min(640, Math.floor(w * 0.78));
  const panelH = Math.min(430, Math.floor(h * 0.62));
  const cx = Math.floor(w * 0.5);
  const cy = Math.floor(h * 0.5);
  const x0 = cx - panelW * 0.5;
  const y0 = cy - panelH * 0.5;

  const shade = scene.add.rectangle(cx, cy, w, h, 0x020509, 0.7);
  shade.setDepth(5900);
  shade.setVisible(false);
  shade.setInteractive({ useHandCursor: true });
  shade.on("pointerdown", () => scene.toggleVersionInfoModal(false));

  const panel = scene.add.rectangle(cx, cy, panelW, panelH, 0x0f1a29, 0.98);
  panel.setStrokeStyle(1, UI_COLORS.panelEdge, 0.92);
  panel.setDepth(5901);
  panel.setVisible(false);

  const title = scene.add.text(x0 + 20, y0 + 16, "Thông tin phiên bản", {
    fontFamily: UI_FONT,
    fontSize: "21px",
    color: UI_COLORS.textPrimary,
    fontStyle: "bold"
  });
  title.setDepth(5902);
  title.setVisible(false);

  const meta = scene.add.text(
    x0 + 20,
    y0 + 52,
    `Phiên bản: ${versionInfo.version}  •  Cập nhật: ${versionInfo.updatedAt}`,
    {
      fontFamily: UI_FONT,
      fontSize: "13px",
      color: UI_COLORS.textSecondary
    }
  );
  meta.setDepth(5902);
  meta.setVisible(false);

  const notesText = versionInfo.notes.map((note, idx) => `${idx + 1}. ${note}`).join("\n");
  const notes = scene.add.text(x0 + 20, y0 + 86, notesText, {
    fontFamily: UI_FONT,
    fontSize: "14px",
    color: UI_COLORS.textPrimary,
    lineSpacing: 8,
    wordWrap: { width: panelW - 40 }
  });
  notes.setDepth(5902);
  notes.setVisible(false);

  const closeBtn = createButton(
    x0 + panelW - 130,
    y0 + panelH - 48,
    110,
    34,
    "Đóng",
    () => scene.toggleVersionInfoModal(false),
    { variant: "ghost", fontSize: 13 }
  );
  closeBtn.shadow.setDepth(5902);
  closeBtn.bg.setDepth(5903);
  closeBtn.text.setDepth(5904);
  closeBtn.setVisible(false);

  return [shade, panel, title, meta, notes, closeBtn.shadow, closeBtn.bg, closeBtn.text];
}