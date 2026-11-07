import { gridKey } from "../../core/gameUtils.js";

interface PreviewUnit {
  uid: string;
}

interface PreviewTile {
  center: { x: number; y: number };
  [key: string]: unknown;
}

interface TileLookup {
  get: (key: string) => PreviewTile | undefined;
}

interface AttackPreviewGraphicsLike {
  clear: () => void;
  fillStyle: (color: number, alpha: number) => void;
  lineStyle: (width: number, color: number, alpha: number) => void;
  beginPath: () => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  strokePath: () => void;
  fillTriangle: (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => void;
  setDepth: (depth: number) => void;
  setVisible: (visible: boolean) => void;
}

interface AttackPreviewScene {
  previewHoverUnit: PreviewUnit | null;
  attackPreviewLayer: AttackPreviewGraphicsLike | null;
  attackPreviewIcons: Array<{ destroy?: () => void }> | null;
  attackPreviewSword: AttackPreviewGraphicsLike | null;
  tileLookup: TileLookup;
  drawDiamond: (layer: AttackPreviewGraphicsLike, x: number, y: number) => void;
  gridToScreen: (col: number, row: number) => { x: number; y: number };
  [key: string]: unknown;
}

interface AttackPreviewCell {
  row: number;
  col: number;
}

interface AttackPreviewStyle {
  fillColor: number;
  fillAlpha: number;
  lineWidth: number;
  lineColor: number;
  lineAlpha: number;
}

interface SwordAttacker {
  col: number;
  row: number;
  side: "LEFT" | "RIGHT" | string;
}

export function clearSharedAttackPreview(
  scene: AttackPreviewScene,
  unit: PreviewUnit | null = null,
  options: { clearIcons?: boolean } = {}
): boolean {
  const { clearIcons = false } = options;
  if (unit && scene.previewHoverUnit && scene.previewHoverUnit.uid !== unit.uid) return false;

  scene.previewHoverUnit = null;
  scene.attackPreviewLayer?.clear();
  if (clearIcons && Array.isArray(scene.attackPreviewIcons)) {
    scene.attackPreviewIcons.forEach((obj) => obj?.destroy?.());
    scene.attackPreviewIcons = [];
  }
  if (scene.attackPreviewSword) {
    scene.attackPreviewSword.clear();
    scene.attackPreviewSword.setVisible(false);
  }
  return true;
}

export function drawSharedAttackPreviewCells(
  scene: AttackPreviewScene,
  cells: AttackPreviewCell[],
  resolveStyle: (cell: AttackPreviewCell, tile: PreviewTile) => AttackPreviewStyle | null | undefined
): void {
  cells.forEach((cell) => {
    const tile = scene.tileLookup.get(gridKey(cell.row, cell.col));
    if (!tile) return;

    const style = resolveStyle(cell, tile);
    if (!style) return;

    scene.attackPreviewLayer?.fillStyle(style.fillColor, style.fillAlpha);
    scene.attackPreviewLayer?.lineStyle(style.lineWidth, style.lineColor, style.lineAlpha);
    if (scene.attackPreviewLayer) scene.drawDiamond(scene.attackPreviewLayer, tile.center.x, tile.center.y);
  });
}

export function drawSharedAttackPreviewSword(
  scene: AttackPreviewScene,
  row: number,
  col: number,
  attacker: SwordAttacker
): void {
  if (!scene.attackPreviewSword) return;

  const tile = scene.tileLookup.get(gridKey(row, col));
  if (!tile) return;

  const attackerPoint = scene.gridToScreen(attacker.col, attacker.row);
  const dx = tile.center.x - attackerPoint.x;
  const dir: number = Math.abs(dx) < 2 ? (attacker.side === "LEFT" ? 1 : -1) : dx >= 0 ? 1 : -1;
  const g = scene.attackPreviewSword;
  const cy = tile.center.y - 12;
  const cx = tile.center.x;
  const bladeLen = 24;
  const half = bladeLen * 0.5;
  const startX = cx - half * dir;
  const endX = cx + half * dir;
  const tipX = endX + 7 * dir;

  g.clear();
  g.lineStyle(3, 0xfff1c7, 1);
  g.beginPath();
  g.moveTo(startX, cy);
  g.lineTo(endX, cy);
  g.strokePath();

  g.fillStyle(0xffd56a, 1);
  g.fillTriangle(endX, cy - 5, endX, cy + 5, tipX, cy);

  g.lineStyle(3, 0xc4d5e8, 1);
  g.beginPath();
  g.moveTo(startX, cy - 6);
  g.lineTo(startX, cy + 6);
  g.strokePath();

  g.lineStyle(2, 0x8ba3bd, 1);
  g.beginPath();
  g.moveTo(startX - 4 * dir, cy);
  g.lineTo(startX - 9 * dir, cy);
  g.strokePath();

  g.setDepth(tile.center.y + 22);
  g.setVisible(true);
}
