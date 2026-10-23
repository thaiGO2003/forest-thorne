import { UI_FONT } from "../../core/uiTheme.js";
import { t } from "../../i18n/index.js";

import { getPlanningBenchCap, movePlanningUnit, sellPlanningBenchIndex, sellPlanningUnit } from "./planningFormationRuntime.js";
import { addPlanningLog } from "./planningLogRuntime.js";
import { showPlanningLibraryUnitDetail } from "./planningSettingsRuntime.js";

interface ContextMenuUnit {
  baseId: string;
  uid: string;
}

type ContextMenuRegion = "BENCH" | "BOARD" | string;

interface ContextMenuPlayer {
  bench: Array<unknown | null>;
  [key: string]: unknown;
}

interface ContextMenuScene extends Phaser.Scene {
  contextMenu: Phaser.GameObjects.Container | null;
  player: ContextMenuPlayer;
  audioFx: { play: (key: string) => void };
  phase: string;
  settingsVisible: boolean;
  overlaySprites: Phaser.GameObjects.GameObject[];
  isUnitDragging: boolean;
  selectedBenchIndex: number | null;
  selectedInventoryItemId: string | null;
  aiMode: string;
  layout: unknown;
  dragUnit?: { uid?: string } | null;
  tryEquipSelectedItem?: (unit: unknown) => void;
  createOwnedUnit: (...args: unknown[]) => unknown;
  benchUpgradeLevel: number;
  craftGridItems: (string | null)[];
  tutorialOverlay?: { handleTrigger: (event: string) => void } | null;
  [key: string]: unknown;
}

interface ContextMenuOption {
  label: string;
  action: () => void;
}

export function showPlanningContextMenu(
  scene: ContextMenuScene,
  unit: ContextMenuUnit,
  region: ContextMenuRegion,
  r_or_idx: number,
  c: number,
  x: number,
  y: number
): void {
    if (scene.contextMenu) {
      scene.contextMenu.destroy();
      scene.contextMenu = null;
    }

    const container = scene.add.container(x, y);
    container.setDepth(5000);

    const options: ContextMenuOption[] = [];
    options.push({
      label: t("planning.ui.details"),
      action: () => {
        showPlanningLibraryUnitDetail(scene as unknown as Parameters<typeof showPlanningLibraryUnitDetail>[0], unit.baseId);
      }
    });

    if (region === "BENCH") {
      // Deploy (find free slot on board?) - Logic complex, maybe just Swap mode?
      // For now: "Bán"
      options.push({ label: t("planning.ui.sell"), action: () => sellPlanningBenchIndex(scene as unknown as Parameters<typeof sellPlanningBenchIndex>[0], r_or_idx) });
    } else if (region === "BOARD") {
      // Recall
      options.push({
        label: t("planning.ui.recall"), action: () => {
          let freeSlot = scene.player.bench.findIndex((u) => u == null);
          if (freeSlot === -1 && scene.player.bench.length < getPlanningBenchCap(scene as unknown as Parameters<typeof getPlanningBenchCap>[0])) {
            freeSlot = scene.player.bench.length;
          }
          if (freeSlot !== -1) {
            movePlanningUnit(scene as unknown as Parameters<typeof movePlanningUnit>[0], { region: "BOARD", row: r_or_idx, col: c }, { region: "BENCH", index: freeSlot });
            scene.audioFx.play("click");
          } else {
            addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.log.queueFull"));
          }
        }
      });
      options.push({ label: t("planning.ui.sell"), action: () => sellPlanningUnit(scene as unknown as Parameters<typeof sellPlanningUnit>[0], unit.uid) });
    }

    // Background
    const w = 120;
    const h = options.length * 35 + 10;
    const bg = scene.add.rectangle(w / 2, h / 2, w, h, 0x111826, 0.95);
    bg.setStrokeStyle(1, 0x4a6fa5);
    container.add(bg);

    options.forEach((opt, idx) => {
      const btnY = 25 + idx * 35;
      const btn = scene.add.text(w / 2, btnY, opt.label, {
        fontFamily: UI_FONT, fontSize: "14px", color: "#e0e0e0"
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      btn.on("pointerover", () => btn.setColor("#ffffff"));
      btn.on("pointerout", () => btn.setColor("#e0e0e0"));
      btn.on("pointerdown", (pointer: unknown, localX: number, localY: number, event: { stopPropagation?: () => void }) => {
        if (event && event.stopPropagation) event.stopPropagation();
        opt.action();
        container.destroy();
        scene.contextMenu = null;
      });
      container.add(btn);
    });

    scene.contextMenu = container;

    // Close when clicking outside
    scene.time.delayedCall(10, () => {
      const closeHandler = () => {
        if (scene.contextMenu) {
          scene.contextMenu.destroy();
          scene.contextMenu = null;
        }
        scene.input.off("pointerdown", closeHandler);
      };
      scene.input.on("pointerdown", closeHandler);
    });
}
