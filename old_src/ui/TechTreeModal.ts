/**
 * TechTreeModal.ts — Giao diện Sơ đồ công nghệ (Tech Tree)
 *
 * Hiển thị dạng cây phân nhánh theo sector tròn, hỗ trợ pan/zoom và click-to-buy.
 * Trạng thái: 🟢 Đã mua | 🟡 Mở khóa | ⬛ Chưa mở khóa
 */

import {
  TECH_NODES,
  TECH_BY_ID,
  TECH_BRANCHES,
  TECH_BRANCH_ORDER,
  getTechCost,
  getTechRequirementIds,
  canResearch,
  isUnlocked,
  TechNode,
  TechLevels
} from "../data/techTree.js";
import { UI_FONT, EMOJI_FONT, UI_COLORS } from "../core/uiTheme.js";
import { refreshInfoPanel as _refreshInfoPanel } from "./TechTreeInfoPanel.js";
import { TECH_TREE_LAYOUT_DEFAULTS, computeTechTreeLayout } from "./techTreeLayout.js";
import {
  isDisplayObjectAlive,
  safeSetAlpha,
  safeSetColor,
  safeSetFillStyle,
  safeSetVisible,
  safeSetStrokeStyle,
  safeSetText
} from "./displayObjectGuards.js";

type PhaserScene = Phaser.Scene;
type Rectangle = Phaser.GameObjects.Rectangle;
type Container = Phaser.GameObjects.Container;
type Circle = Phaser.GameObjects.Arc;
type Text = Phaser.GameObjects.Text;
type Line = Phaser.GameObjects.Line;
type DisplayObject = Phaser.GameObjects.GameObject;

interface TechNodeVisual {
  circle: Circle;
  icon: Text;
  label: Text;
  levelText: Text;
  glow: Circle;
  branchColor: number;
}

interface TechConnectionLine {
  line: Line;
  fromId: string;
  toId: string;
}

interface TechPoint {
  x: number;
  y: number;
}

interface TechContentBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface TechBranchSector {
  center: number;
  start: number;
  end: number;
}

interface TechPlayerLite {
  gold?: number;
  techLevels?: TechLevels;
}

type TechResearchCallback = (id: string) => void;
type TechWheelHandler = (
  pointer: unknown,
  gameObjects: unknown,
  dx: number,
  dy: number
) => void;
type TechPointerState = { x: number; y: number } | null;

const {
  nodeRadius: NODE_RADIUS,
  baseRingRadius: BASE_RING_RADIUS,
  ringStep: RING_STEP,
  labelMaxWidth: LABEL_MAX_WIDTH
} = TECH_TREE_LAYOUT_DEFAULTS;

function safeSetInteractive(displayObject: DisplayObject | null, config: unknown): void {
  if (!isDisplayObjectAlive(displayObject) || typeof (displayObject as { setInteractive?: unknown }).setInteractive !== "function") return;
  (displayObject as unknown as { setInteractive: (config: unknown) => void }).setInteractive(config);
}

function safeDisableInteractive(displayObject: DisplayObject | null): void {
  if (!isDisplayObjectAlive(displayObject) || typeof (displayObject as { disableInteractive?: unknown }).disableInteractive !== "function") return;
  (displayObject as unknown as { disableInteractive: () => void }).disableInteractive();
}

export class TechTreeModal {
  scene: PhaserScene;
  player: TechPlayerLite;
  onResearch: TechResearchCallback;
  visible: boolean;
  depth: number;

  zoom: number;
  panX: number;
  panY: number;
  _isDragging: boolean;
  _lastPointer: TechPointerState;

  objects: DisplayObject[];
  nodeMap: Record<string, TechNodeVisual>;
  connectionLines: TechConnectionLine[];
  dimmer: Rectangle | null;
  container: Container | null;
  closeBtn: Text | null;
  titleText: Text | null;
  goldText: Text | null;
  bottomBar: Rectangle | null;
  bottomGold: Text | null;
  bottomClose: Text | null;
  _panZone: Rectangle | null;
  infoPanel: { objects: DisplayObject[] };
  selectedId: string | null;
  _positions: Record<string, TechPoint> | null;
  _contentBounds: TechContentBounds | null;
  _maxDepth: number;
  _branchSectors: Record<string, TechBranchSector> | null;
  _wheelHandler: TechWheelHandler | null;

  constructor(scene: PhaserScene, player: TechPlayerLite, onResearch: TechResearchCallback) {
    this.scene = scene;
    this.player = player;
    this.onResearch = onResearch;
    this.visible = false;
    this.depth = 7000;

    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this._isDragging = false;
    this._lastPointer = null;

    this.objects = [];
    this.nodeMap = {};
    this.connectionLines = [];
    this.dimmer = null;
    this.container = null;
    this.closeBtn = null;
    this.titleText = null;
    this.goldText = null;
    this.bottomBar = null;
    this.bottomGold = null;
    this.bottomClose = null;
    this._panZone = null;
    this.infoPanel = { objects: [] };
    this.selectedId = null;
    this._positions = null;
    this._contentBounds = null;
    this._maxDepth = 4;
    this._branchSectors = null;
    this._wheelHandler = null;

    this._build();
    this.setVisible(false);
  }

  setVisible(visible: boolean): this {
    this.visible = !!visible;
    this._setAllVisible(this.visible);
    return this;
  }

  _build(): void {
    const scene = this.scene;
    const cam = scene.cameras.main;
    const width = cam.width;
    const height = cam.height;

    this.dimmer = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.82)
      .setDepth(this.depth)
      .setScrollFactor(0)
      .setInteractive();
    this.dimmer.on("pointerdown", () => this._deselectNode());

    this.container = scene.add.container(width / 2, height / 2)
      .setDepth(this.depth + 1)
      .setScrollFactor(0);

    this.titleText = scene.add.text(width / 2, 24, "🌳 SƠ ĐỒ CÔNG NGHỆ", {
      fontFamily: UI_FONT,
      fontSize: "20px",
      color: "#e9f5ff",
      fontStyle: "bold"
    }).setOrigin(0.5, 0).setDepth(this.depth + 10).setScrollFactor(0);

    this.closeBtn = scene.add.text(width - 40, 20, "✕", {
      fontFamily: UI_FONT,
      fontSize: "24px",
      color: "#ff6b6b"
    }).setOrigin(0.5, 0).setDepth(this.depth + 10).setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    this.closeBtn.on("pointerdown", () => this.hide());

    this.goldText = scene.add.text(24, 24, "", {
      fontFamily: UI_FONT,
      fontSize: "14px",
      color: "#ffd580"
    }).setDepth(this.depth + 10).setScrollFactor(0);

    const barHeight = 40;
    const barY = height - barHeight / 2 - 8;
    this.bottomBar = scene.add.rectangle(width / 2, barY, 360, barHeight, 0x0e1828, 0.92)
      .setStrokeStyle(1, UI_COLORS.panelEdgeSoft, 0.6)
      .setDepth(this.depth + 15).setScrollFactor(0);

    this.bottomGold = scene.add.text(width / 2 - 160, barY, "", {
      fontFamily: UI_FONT,
      fontSize: "14px",
      color: "#ffd580"
    }).setOrigin(0, 0.5).setDepth(this.depth + 16).setScrollFactor(0);

    this.bottomClose = scene.add.text(width / 2 + 150, barY, "✕ Đóng", {
      fontFamily: UI_FONT,
      fontSize: "13px",
      color: "#ff6b6b",
      fontStyle: "bold"
    }).setOrigin(1, 0.5).setDepth(this.depth + 16).setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    this.bottomClose.on("pointerdown", () => this.hide());
    this.bottomClose.on("pointerover", () => this.bottomClose?.setColor("#ff9999"));
    this.bottomClose.on("pointerout", () => this.bottomClose?.setColor("#ff6b6b"));

    this._computePositions();
    this._drawGuides();
    this._buildConnections();
    this._buildNodes();
    this._enablePanZoom();

    if (this.dimmer) this.objects.push(this.dimmer);
    if (this.container) this.objects.push(this.container);
    if (this.titleText) this.objects.push(this.titleText);
    if (this.closeBtn) this.objects.push(this.closeBtn);
    if (this.goldText) this.objects.push(this.goldText);
    if (this.bottomBar) this.objects.push(this.bottomBar);
    if (this.bottomGold) this.objects.push(this.bottomGold);
    if (this.bottomClose) this.objects.push(this.bottomClose);
  }

  _drawGuides(): void {
    const guideLength = BASE_RING_RADIUS + Math.max(this._maxDepth, 4) * RING_STEP;
    const branchSectors = this._branchSectors ?? {};
    const container = this.container;
    if (!container) return;

    TECH_BRANCH_ORDER.forEach((branch) => {
      const angle = branchSectors[branch]?.center ?? -Math.PI / 2;
      const line = this.scene.add.line(
        0,
        0,
        0,
        0,
        Math.cos(angle) * guideLength,
        Math.sin(angle) * guideLength,
        0x1a2a3a,
        0.18
      );
      line.setOrigin(0, 0).setLineWidth(1);
      container.addAt(line, 0);

      const labelRadius = BASE_RING_RADIUS - 50;
      const label = this.scene.add.text(
        Math.cos(angle) * labelRadius,
        Math.sin(angle) * labelRadius,
        TECH_BRANCHES[branch]?.label ?? branch,
        {
          fontFamily: UI_FONT,
          fontSize: "10px",
          color: "#5f7893",
          fontStyle: "bold"
        }
      ).setOrigin(0.5);
      container.add(label);
    });

    for (let depth = 1; depth <= this._maxDepth; depth += 2) {
      const ringRadius = BASE_RING_RADIUS + (depth - 1) * RING_STEP;
      const ring = this.scene.add.circle(0, 0, ringRadius, 0xffffff, 0);
      ring.setStrokeStyle(1, 0x1a2a3a, 0.12);
      container.addAt(ring, 0);
    }
  }

  _computePositions(): Record<string, TechPoint> {
    const layout = computeTechTreeLayout({
      nodes: TECH_NODES as TechNode[],
      branchOrder: TECH_BRANCH_ORDER,
      nodeRadius: NODE_RADIUS,
      baseRingRadius: BASE_RING_RADIUS,
      ringStep: RING_STEP,
      labelMaxWidth: LABEL_MAX_WIDTH
    });

    this._positions = layout.positions as Record<string, TechPoint>;
    this._maxDepth = layout.maxDepth as number;
    this._contentBounds = layout.contentBounds as TechContentBounds;
    this._branchSectors = layout.branchSectors as Record<string, TechBranchSector>;
    return this._positions;
  }

  _buildConnections(): void {
    const positions = this._positions || this._computePositions();
    const container = this.container;
    if (!container) return;
    TECH_NODES.forEach((node) => {
      const requirementIds = getTechRequirementIds(node);
      requirementIds.forEach((requirementId) => {
        const from = positions[requirementId];
        const to = positions[node.id];
        if (!from || !to) return;

        const line = this.scene.add.line(0, 0, from.x, from.y, to.x, to.y, 0x3a5a7c, 0.45);
        line.setOrigin(0, 0).setLineWidth(2);
        container.addAt(line, 0);
        this.connectionLines.push({ line, fromId: requirementId, toId: node.id });
      });
    });
  }

  _buildNodes(): void {
    const positions = this._positions || this._computePositions();
    const container = this.container;
    if (!container) return;

    TECH_NODES.forEach((node) => {
      const point = positions[node.id];
      if (!point) return;

      const branchColor = TECH_BRANCHES[node.branch]?.color ?? 0x888888;
      const glow = this.scene.add.circle(point.x, point.y, NODE_RADIUS + 5, branchColor, 0);
      container.add(glow);

      const circle = this.scene.add.circle(point.x, point.y, NODE_RADIUS, 0x0e1828, 1);
      circle.setStrokeStyle(2.5, branchColor, 0.82);
      circle.setInteractive({ useHandCursor: true });
      container.add(circle);

      const icon = this.scene.add.text(point.x, point.y - 3, node.icon, {
        fontFamily: EMOJI_FONT,
        fontSize: "18px",
        color: "#ffffff"
      }).setOrigin(0.5);
      container.add(icon);

      const label = this.scene.add.text(point.x, point.y + NODE_RADIUS + 5, node.name, {
        fontFamily: UI_FONT,
        fontSize: "8px",
        color: UI_COLORS.textSecondary,
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: LABEL_MAX_WIDTH }
      }).setOrigin(0.5, 0).setLineSpacing(-2);
      container.add(label);

      const levelText = this.scene.add.text(point.x + NODE_RADIUS - 1, point.y - NODE_RADIUS + 2, "", {
        fontFamily: UI_FONT,
        fontSize: "7px",
        color: "#ffd580",
        backgroundColor: "#0e1828cc",
        padding: { x: 2, y: 1 }
      }).setOrigin(1, 0);
      container.add(levelText);

      circle.on("pointerdown", (pointer: { event?: { stopPropagation?: () => void } }) => {
        pointer.event?.stopPropagation?.();
        this._selectNode(node.id);
      });

      this.nodeMap[node.id] = { circle, icon, label, levelText, glow, branchColor };
    });
  }

  _refreshNodeStates(): void {
    const techLevels = this.player.techLevels ?? {};

    TECH_NODES.forEach((node) => {
      const visual = this.nodeMap[node.id];
      if (!visual) return;

      const level = techLevels[node.id] ?? 0;
      const unlocked = isUnlocked(node.id, techLevels);
      const maxed = node.maxBuy === 0 ? true : level >= node.maxBuy;
      const affordable = canResearch(node.id, techLevels, this.player.gold ?? 0);

      if (node.id === "root") {
        safeSetFillStyle(visual.circle, 0x1a4a2a, 1);
        safeSetStrokeStyle(visual.circle, 3, 0x4caf50, 1);
        safeSetFillStyle(visual.glow, 0x4caf50, 0.24);
        safeSetAlpha(visual.icon, 1);
        safeSetColor(visual.label, "#8bffd7");
        safeSetText(visual.levelText, "");
        return;
      }

      if (maxed) {
        safeSetFillStyle(visual.circle, 0x1a3a2a, 1);
        safeSetStrokeStyle(visual.circle, 3, 0x4caf50, 1);
        safeSetFillStyle(visual.glow, 0x4caf50, 0.18);
        safeSetAlpha(visual.icon, 1);
        safeSetColor(visual.label, "#8bffd7");
        safeSetText(visual.levelText, "MAX");
        safeSetColor(visual.levelText, "#8bffd7");
      } else if (level > 0) {
        safeSetFillStyle(visual.circle, 0x2a3a1a, 1);
        safeSetStrokeStyle(visual.circle, 2.5, 0xbdcf47, 0.9);
        safeSetFillStyle(visual.glow, 0xbdcf47, 0.14);
        safeSetAlpha(visual.icon, 1);
        safeSetColor(visual.label, "#d4e665");
        const maxLabel = node.maxBuy === Infinity ? "♾️" : `${node.maxBuy}`;
        safeSetText(visual.levelText, `${level}/${maxLabel}`);
        safeSetColor(visual.levelText, "#ffd580");
      } else if (unlocked && affordable) {
        safeSetFillStyle(visual.circle, 0x1c2c3e, 1);
        safeSetStrokeStyle(visual.circle, 2.5, visual.branchColor, 0.92);
        safeSetFillStyle(visual.glow, visual.branchColor, 0.12);
        safeSetAlpha(visual.icon, 1);
        safeSetColor(visual.label, UI_COLORS.textSecondary);
        safeSetText(visual.levelText, `${getTechCost(node.id, level)}🪙`);
        safeSetColor(visual.levelText, "#ffd580");
      } else if (unlocked) {
        safeSetFillStyle(visual.circle, 0x141e2a, 1);
        safeSetStrokeStyle(visual.circle, 2, visual.branchColor, 0.5);
        safeSetFillStyle(visual.glow, visual.branchColor, 0.05);
        safeSetAlpha(visual.icon, 0.62);
        safeSetColor(visual.label, UI_COLORS.textMuted);
        safeSetText(visual.levelText, `${getTechCost(node.id, level)}🪙`);
        safeSetColor(visual.levelText, "#7f94a7");
      } else {
        safeSetFillStyle(visual.circle, 0x0a0f18, 0.85);
        safeSetStrokeStyle(visual.circle, 2, 0x2a3a4a, 0.4);
        safeSetFillStyle(visual.glow, 0x000000, 0);
        safeSetAlpha(visual.icon, 0.22);
        safeSetColor(visual.label, "#3a4a5c");
        safeSetText(visual.levelText, "");
      }
    });

    this.connectionLines.forEach(({ line, fromId, toId }) => {
      if (!isDisplayObjectAlive(line)) return;
      const fromLevel = techLevels[fromId] ?? 0;
      const toLevel = techLevels[toId] ?? 0;
      const fromNode = TECH_BY_ID[fromId];
      const fromDone = fromNode?.maxBuy === 0 || fromLevel > 0;

      if (toLevel > 0) {
        safeSetStrokeStyle(line, 3, 0x4caf50, 0.68);
      } else if (fromDone) {
        const branchColor = TECH_BRANCHES[TECH_BY_ID[toId]?.branch]?.color ?? 0x3a5a7c;
        safeSetStrokeStyle(line, 2, branchColor, 0.35);
      } else {
        safeSetStrokeStyle(line, 1.5, 0x1a2a3a, 0.28);
      }
    });

    safeSetText(this.goldText, `💰 ${this.player.gold ?? 0} vàng`);
    safeSetText(this.bottomGold, `💰 ${this.player.gold ?? 0} vàng`);
  }

  _selectNode(id: string): void {
    this.selectedId = id;
    this._refreshInfoPanel();
    this._refreshNodeStates();
    const visual = this.nodeMap[id];
    safeSetStrokeStyle(visual?.circle, 3, 0xffffff, 1);
  }

  _deselectNode(): void {
    this.selectedId = null;
    this._clearInfoPanel();
    this._refreshNodeStates();
  }

  _refreshInfoPanel(): void {
    _refreshInfoPanel(this);
  }

  _clearInfoPanel(): void {
    if (!this.infoPanel?.objects) return;
    this.infoPanel.objects.forEach((object) => object.destroy());
    this.infoPanel.objects = [];
  }

  _enablePanZoom(): void {
    const scene = this.scene;
    const cam = scene.cameras.main;

    this._panZone = scene.add.rectangle(cam.width / 2, cam.height / 2, cam.width, cam.height, 0x000000, 0)
      .setDepth(this.depth + 0.5)
      .setScrollFactor(0)
      .setInteractive();

    this._panZone.on("pointerdown", (pointer: { x: number; y: number }) => {
      this._isDragging = true;
      this._lastPointer = { x: pointer.x, y: pointer.y };
    });
    this._panZone.on("pointerup", () => {
      this._isDragging = false;
      this._lastPointer = null;
    });
    this._panZone.on("pointerout", () => {
      this._isDragging = false;
      this._lastPointer = null;
    });
    this._panZone.on("pointermove", (pointer: { x: number; y: number }) => {
      if (!this._isDragging || !this._lastPointer) return;
      const dx = pointer.x - this._lastPointer.x;
      const dy = pointer.y - this._lastPointer.y;
      this._lastPointer = { x: pointer.x, y: pointer.y };
      this.panX += dx;
      this.panY += dy;
      this._applyTransform();
    });

    this._wheelHandler = (_pointer: unknown, _gameObjects: unknown, _dx: number, dy: number) => {
      if (!this.visible) return;
      const step = dy > 0 ? -0.08 : 0.08;
      this.zoom = Math.max(0.25, Math.min(2.4, this.zoom + step));
      this._applyTransform();
    };
    scene.input.on("wheel", this._wheelHandler);

    if (this._panZone) this.objects.push(this._panZone);
  }

  _fitTreeToView(): void {
    const cam = this.scene.cameras.main;
    const bounds = this._contentBounds ?? computeTechTreeLayout({
      nodes: TECH_NODES as TechNode[],
      branchOrder: TECH_BRANCH_ORDER,
      nodeRadius: NODE_RADIUS,
      baseRingRadius: BASE_RING_RADIUS,
      ringStep: RING_STEP,
      labelMaxWidth: LABEL_MAX_WIDTH
    }).contentBounds as TechContentBounds;
    const contentWidth = Math.max(1, bounds.maxX - bounds.minX);
    const contentHeight = Math.max(1, bounds.maxY - bounds.minY);
    const availableWidth = Math.max(240, cam.width - 120);
    const availableHeight = Math.max(220, cam.height - 190);
    const zoomX = availableWidth / contentWidth;
    const zoomY = availableHeight / contentHeight;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    this.zoom = Math.max(0.38, Math.min(1.05, zoomX, zoomY));
    this.panX = -centerX * this.zoom;
    this.panY = -centerY * this.zoom - 12;
    this._applyTransform();
  }

  _applyTransform(): void {
    const cam = this.scene.cameras.main;
    if (!this.container) return;
    this.container.x = cam.width / 2 + this.panX;
    this.container.y = cam.height / 2 + this.panY;
    this.container.setScale(this.zoom);
  }

  refreshFromPlayer(player: TechPlayerLite | null = this.player): void {
    this.player = player ?? this.player;
    this._refreshNodeStates();
    if (this.selectedId) {
      this._refreshInfoPanel();
      return;
    }
    this._clearInfoPanel();
  }

  isAlive(): boolean {
    return !!(
      this.scene?.sys
      && isDisplayObjectAlive(this.dimmer)
      && isDisplayObjectAlive(this.container)
      && isDisplayObjectAlive(this._panZone)
    );
  }

  show(): void {
    this.visible = true;
    this.selectedId = null;
    this._clearInfoPanel();
    this._fitTreeToView();
    this._refreshNodeStates();
    this._setAllVisible(true);
  }

  hide(): void {
    this.visible = false;
    this.selectedId = null;
    this._clearInfoPanel();
    this._setAllVisible(false);
  }

  _setAllVisible(visible: boolean): void {
    safeSetVisible(this.dimmer, visible);
    safeSetVisible(this.container, visible);
    safeSetVisible(this.titleText, visible);
    safeSetVisible(this.closeBtn, visible);
    safeSetVisible(this.goldText, visible);
    safeSetVisible(this._panZone, visible);
    safeSetVisible(this.bottomBar, visible);
    safeSetVisible(this.bottomGold, visible);
    safeSetVisible(this.bottomClose, visible);

    if (!visible) {
      safeDisableInteractive(this.dimmer);
      safeDisableInteractive(this._panZone);
    } else {
      safeSetInteractive(this.dimmer, {});
      safeSetInteractive(this._panZone, {});
    }
  }

  destroy(): void {
    if (this._wheelHandler && this.scene?.input?.off) {
      this.scene.input.off("wheel", this._wheelHandler);
    }
    this._wheelHandler = null;
    this._clearInfoPanel();
    [...new Set(this.objects)].forEach((object) => object?.destroy?.());
    this.objects = [];
    this.nodeMap = {};
    this.connectionLines = [];
    this.dimmer = null;
    this.container = null;
    this.closeBtn = null;
    this.titleText = null;
    this.goldText = null;
    this.bottomBar = null;
    this.bottomGold = null;
    this.bottomClose = null;
    this._panZone = null;
  }
}
