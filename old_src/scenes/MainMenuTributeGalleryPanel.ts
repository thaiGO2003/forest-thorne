import Phaser from "phaser";
import { TRIBUTE_CREDITS } from "../data/tributeCredits.js";
import type { TributeCredit } from "../data/tributeCredits.js";
import { t } from "../i18n/index.js";

const COLUMNS = 4;
const TILE_SIZE = 68;
const TILE_GAP = 8;
const TILE_LABEL_H = 18;
const MAX_LABEL_CHARS = 10; // Ký tự tối đa hiện tĩnh trước khi marquee

type TributeScrollGroup = {
  wheelTarget: Phaser.GameObjects.Zone;
  scrollBy: (deltaY: number) => boolean;
  containsPoint: (pointerOrX: unknown, maybeY?: unknown) => boolean;
};

type TributePanelHost = Phaser.Scene & {
  tributePanel: Phaser.GameObjects.Container | null;
  tributePanelTitleText: Phaser.GameObjects.Text | null;
  tributePanelSubtitleText: Phaser.GameObjects.Text | null;
  tributeScrollGroup: TributeScrollGroup | null;
};

type TileWithMarquee = Phaser.GameObjects.Container & {
  _marqueeMaskUpdate?: (scrollOff?: number) => void;
};

function createBadge(scene: TributePanelHost, entry: TributeCredit): Phaser.GameObjects.Container {
  const badge = scene.add.container(0, 0);
  const bg = scene.add.rectangle(0, 0, TILE_SIZE, TILE_SIZE, entry.fill, 0.98).setOrigin(0, 0);
  bg.setStrokeStyle(2, entry.accent, 0.95);
  badge.add(bg);

  if (entry.assetKey && scene.textures.exists(entry.assetKey)) {
    const image = scene.add.image(TILE_SIZE * 0.5, TILE_SIZE * 0.5, entry.assetKey).setDisplaySize(TILE_SIZE - 6, TILE_SIZE - 6);
    badge.add(image);
  } else {
    const glow = scene.add.rectangle(TILE_SIZE * 0.5, TILE_SIZE * 0.5, TILE_SIZE - 10, TILE_SIZE - 10, entry.accent, 0.15).setOrigin(0.5);
    const initials = scene.add.text(TILE_SIZE * 0.5, TILE_SIZE * 0.5, entry.initials, {
      fontFamily: "Trebuchet MS",
      fontSize: "24px",
      color: entry.text,
      fontStyle: "bold"
    }).setOrigin(0.5);
    badge.add([glow, initials]);
  }

  return badge;
}

/**
 * Tạo label text với marquee animation nếu tên quá dài.
 * Text hiện 1 dòng, nếu tràn → trượt qua lại liên tục.
 */
function createMarqueeLabel(
  scene: TributePanelHost,
  tile: TileWithMarquee,
  tileWorldX: number,
  tileWorldY: number,
  fullName: string
): void {
  const labelY = TILE_SIZE + 3;
  const maxW = TILE_SIZE - 4;

  // Tạo text 1 dòng, không wrap
  const nameText = scene.add.text(0, labelY, fullName, {
    fontFamily: "Consolas",
    fontSize: "9px",
    color: "#dcecff",
    align: "left",
  }).setOrigin(0, 0);

  const textW = nameText.width;

  if (textW <= maxW) {
    // Tên ngắn → canh giữa bình thường
    nameText.setX(Math.floor((TILE_SIZE - textW) * 0.5));
    tile.add(nameText);
    return;
  }

  // Tên dài → cần marquee
  // Đặt text vào 1 container con để mask riêng
  const labelContainer = scene.add.container(Math.floor((TILE_SIZE - maxW) * 0.5), labelY);
  nameText.setPosition(0, 0);
  labelContainer.add(nameText);

  // Mask clip vùng label
  const labelMaskGfx = scene.make.graphics({}) as {
    clear(): void;
    fillStyle(color: number, alpha?: number): void;
    fillRect(x: number, y: number, w: number, h: number): void;
  };
  labelMaskGfx.fillStyle(0xffffff);
  // Vị trí mask = vị trí tuyệt đối của label trên scene
  // Sẽ được cập nhật khi scroll qua hàm updateMask
  const updateMask = (scrollOff = 0): void => {
    labelMaskGfx.clear();
    labelMaskGfx.fillStyle(0xffffff);
    const absX = tileWorldX + Math.floor((TILE_SIZE - maxW) * 0.5);
    const absY = tileWorldY + labelY - scrollOff;
    labelMaskGfx.fillRect(absX, absY, maxW, 14);
  };
  updateMask();
  if (typeof labelContainer.enableFilters === "function") {
    labelContainer.enableFilters();
    (labelContainer.filters as { external?: { addMask: (g: unknown) => unknown } })?.external?.addMask?.(labelMaskGfx);
  }
  tile.add(labelContainer);

  // Marquee tween: trượt text sang trái rồi quay lại
  const overflow = textW - maxW;
  const speed = 25; // px/s
  const duration = (overflow / speed) * 1000;
  const pauseMs = 1800; // dừng ở đầu/cuốc

  // Delay ngẫu nhiên để không phải tất cả chạy đồng bộ
  const randomDelay = Math.random() * 3000;

  scene.time.delayedCall(randomDelay, () => {
    scene.tweens.add({
      targets: nameText,
      x: -overflow,
      duration,
      ease: "Sine.easeInOut",
      delay: pauseMs,
      yoyo: true,
      hold: pauseMs,
      repeatDelay: pauseMs,
      repeat: -1,
    });
  });

  // Lưu ref để cập nhật mask khi scroll
  tile._marqueeMaskUpdate = updateMask;
}

type TileDescriptor = {
  tile: TileWithMarquee;
  hitBg: Phaser.GameObjects.Rectangle;
};

type TributePointerLike = {
  worldX?: number;
  worldY?: number;
  x?: number;
  y?: number;
};

export function createMainMenuTributeGalleryPanel(scene: TributePanelHost): void {
  const w = scene.scale.width;
  const h = scene.scale.height;

  // Panel rộng hơn để chứa 4 cột
  const contentWidth = COLUMNS * TILE_SIZE + (COLUMNS - 1) * TILE_GAP;
  const panelPadding = 20;
  const panelWidth = contentWidth + panelPadding * 2;
  const panelHeight = Math.min(Math.max(360, Math.floor(h * 0.52)), h - 220);
  const panelX = 28;
  const panelY = Math.max(188, Math.floor(h * 0.24));
  const panel = scene.add.container(panelX, panelY).setDepth(25);

  const bg = scene.add.rectangle(0, 0, panelWidth, panelHeight, 0x0f1c2c, 0.92).setOrigin(0, 0);
  bg.setStrokeStyle(1, 0x78baf0, 0.8);
  const accent = scene.add.rectangle(0, 0, 5, panelHeight, 0x8de8ff, 0.95).setOrigin(0, 0);
  const title = scene.add.text(18, 14, t("menu.tributeTitle"), {
    fontFamily: "Trebuchet MS",
    fontSize: "28px",
    color: "#ffeab0",
    fontStyle: "bold"
  }).setOrigin(0, 0);
  const subtitle = scene.add.text(18, 44, t("menu.tributeSubtitle"), {
    fontFamily: "Consolas",
    fontSize: "12px",
    color: "#98b6cf",
    wordWrap: { width: panelWidth - 36 }
  }).setOrigin(0, 0);

  const viewportX = panelPadding;
  const viewportY = 72;
  const viewportW = contentWidth;
  const viewportH = panelHeight - 106;
  const viewportBounds = new Phaser.Geom.Rectangle(panelX + viewportX, panelY + viewportY, viewportW, viewportH);
  const viewportZone = scene.add.zone(viewportX + viewportW * 0.5, viewportY + viewportH * 0.5, viewportW, viewportH);
  viewportZone.setInteractive({ useHandCursor: true });
  const viewportFrame = scene.add.rectangle(viewportX + viewportW * 0.5, viewportY + viewportH * 0.5, viewportW, viewportH, 0x14253b, 0.42).setOrigin(0.5);
  viewportFrame.setStrokeStyle(1, 0x35556e, 0.68);

  const rowsContainer = scene.add.container(viewportX, viewportY);

  // ── Mask: clip nội dung cuộn vào đúng viewport ──
  const maskGfx = scene.make.graphics({ x: 0, y: 0 }) as {
    fillStyle(color: number, alpha?: number): void;
    fillRect(x: number, y: number, w: number, h: number): void;
  };
  maskGfx.fillStyle(0xffffff);
  maskGfx.fillRect(panelX + viewportX, panelY + viewportY, viewportW, viewportH);
  if (typeof rowsContainer.enableFilters === "function") {
    rowsContainer.enableFilters();
    const clipMask = (rowsContainer.filters as { external?: { addMask: (g: unknown) => unknown } })?.external?.addMask?.(maskGfx);
    void clipMask;
  }

  const tileHeight = TILE_SIZE + TILE_LABEL_H;

  const tiles: TileDescriptor[] = (TRIBUTE_CREDITS as TributeCredit[]).map((entry, index) => {
    const col = index % COLUMNS;
    const row = Math.floor(index / COLUMNS);
    const x = col * (TILE_SIZE + TILE_GAP);
    const y = row * (tileHeight + TILE_GAP);

    // Tạo tile thủ công (thay vì createTile) để tích hợp marquee
    const tile = scene.add.container(x, y) as TileWithMarquee;
    const hitBg = scene.add.rectangle(0, 0, TILE_SIZE, TILE_SIZE + TILE_LABEL_H, 0x16273c, 0.88).setOrigin(0, 0);
    hitBg.setStrokeStyle(1, 0x598ab8, 0.78);
    const badge = createBadge(scene, entry);
    tile.add([hitBg, badge]);

    // Toạ độ tuyệt đối để tính mask cho marquee
    const tileWorldX = panelX + viewportX + x;
    const tileWorldY = panelY + viewportY + y;
    createMarqueeLabel(scene, tile, tileWorldX, tileWorldY, entry.blurred ? '***' : entry.name);

    rowsContainer.add(tile);
    return { tile, hitBg };
  });

  const totalContentH = Math.ceil(TRIBUTE_CREDITS.length / COLUMNS) * (tileHeight + TILE_GAP) - TILE_GAP;
  let scrollOffset = 0;
  const maxOffset = Math.max(0, totalContentH - viewportH);
  let isDragging = false;
  let dragStartY = 0;
  let dragStartOffset = 0;

  const scrollHint = scene.add.text(viewportX + viewportW, viewportY + viewportH + 6, "", {
    fontFamily: "Consolas",
    fontSize: "11px",
    color: "#8fb9df"
  }).setOrigin(1, 0);

  const containsPoint = (pointerOrX: unknown, maybeY: unknown = null): boolean => {
    const worldX = typeof pointerOrX === "object"
      ? (pointerOrX as TributePointerLike)?.worldX ?? (pointerOrX as TributePointerLike)?.x
      : pointerOrX;
    const worldY = typeof pointerOrX === "object"
      ? (pointerOrX as TributePointerLike)?.worldY ?? (pointerOrX as TributePointerLike)?.y
      : maybeY;
    return Number.isFinite(worldX as number) && Number.isFinite(worldY as number) && Phaser.Geom.Rectangle.Contains(viewportBounds, worldX as number, worldY as number);
  };

  const updateViewport = (): void => {
    rowsContainer.y = viewportY - scrollOffset;
    // Cập nhật mask marquee theo scroll offset mới
    tiles.forEach(({ tile }) => {
      if (tile._marqueeMaskUpdate) {
        tile._marqueeMaskUpdate(scrollOffset);
      }
    });
    if (maxOffset > 0) {
      scrollHint.setText(scrollOffset >= maxOffset - 1 ? t("menu.scrollUpHint") : t("menu.scrollMoreHint"));
      scrollHint.setVisible(true);
    } else {
      scrollHint.setVisible(false);
    }
  };

  const scrollBy = (deltaY: number): boolean => {
    if (maxOffset <= 0) return false;
    const step = Math.min(Math.abs(deltaY), 200);
    const nextOffset = Phaser.Math.Clamp(scrollOffset + Math.sign(deltaY) * step, 0, maxOffset);
    if (nextOffset === scrollOffset) return false;
    scrollOffset = nextOffset;
    updateViewport();
    return true;
  };

  const handlePointerDown = (pointer: TributePointerLike): void => {
    if (!containsPoint(pointer) || maxOffset <= 0) return;
    isDragging = true;
    dragStartY = pointer.y ?? 0;
    dragStartOffset = scrollOffset;
  };

  const handlePointerMove = (pointer: TributePointerLike): void => {
    if (!isDragging || maxOffset <= 0) return;
    const dy = dragStartY - (pointer.y ?? 0);
    const nextOffset = Phaser.Math.Clamp(dragStartOffset + dy, 0, maxOffset);
    if (nextOffset !== scrollOffset) {
      scrollOffset = nextOffset;
      updateViewport();
    }
  };

  const handlePointerUp = (): void => {
    isDragging = false;
  };

  scene.input.on("pointerdown", handlePointerDown);
  scene.input.on("pointermove", handlePointerMove);
  scene.input.on("pointerup", handlePointerUp);

  let cleanedUp = false;
  const cleanupInputHandlers = (): void => {
    if (cleanedUp) return;
    cleanedUp = true;
    scene.input.off?.("pointerdown", handlePointerDown);
    scene.input.off?.("pointermove", handlePointerMove);
    scene.input.off?.("pointerup", handlePointerUp);
  };
  scene.events.once("shutdown", cleanupInputHandlers);
  scene.events.once("destroy", cleanupInputHandlers);

  updateViewport();
  panel.add([bg, accent, title, subtitle, viewportFrame, rowsContainer, viewportZone, scrollHint]);

  scene.tributePanel = panel;
  scene.tributePanelTitleText = title;
  scene.tributePanelSubtitleText = subtitle;
  scene.tributeScrollGroup = { wheelTarget: viewportZone, scrollBy, containsPoint };
}
