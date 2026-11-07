import Phaser from "phaser";
import { createOwnedUnit as createPersistedOwnedUnit } from "../core/runState.js";
import {
  applyOwnedEquipmentBonusesToUnit,
  normalizeEquipIds
} from "./shared/sceneEquipmentRuntime.js";

// Internal sandbox scene only.
// Not registered in src/main.js or lazy scene routing production flow.
export const BOARD_PROTOTYPE_INTERNAL_ONLY = true;

const PANEL_FILL = 0x0f1826;
const PANEL_STROKE = 0x4d6b8a;
const TITLE_STYLE = {
  fontFamily: "Consolas",
  fontSize: "24px",
  color: "#d7efff",
  fontStyle: "bold"
};
const BODY_STYLE = {
  fontFamily: "Consolas",
  fontSize: "14px",
  color: "#b8d6ee",
  lineSpacing: 8,
  wordWrap: { width: 760 }
};

type PrototypeBonus = Record<string, number | undefined>;

type PrototypeUnitMods = Record<string, number>;

type PrototypeUnit = {
  maxHp?: number;
  hp?: number;
  atk?: number;
  matk?: number;
  def?: number;
  mdef?: number;
  mods?: PrototypeUnitMods | null;
};

type EquipableUnit = {
  equips?: unknown;
  star?: number;
  [key: string]: unknown;
};

function renderInfoBlock(scene: BoardPrototypeScene): void {
  const cx = scene.scale.width * 0.5;
  const cy = scene.scale.height * 0.5;

  const panel = scene.add.rectangle(cx, cy, 860, 360, PANEL_FILL, 0.96);
  panel.setStrokeStyle(2, PANEL_STROKE, 0.92);

  const title = scene.add.text(cx, cy - 132, "BOARD PROTOTYPE", TITLE_STYLE).setOrigin(0.5);
  const body = scene.add.text(
    cx - 380,
    cy - 88,
    [
      "Scene này hiện là sandbox nội bộ, không còn giữ một combat implementation riêng.",
      "",
      "Mục đích còn lại:",
      "• kiểm tra thử nhanh board / equipment helpers ở môi trường cô lập",
      "• giữ entry point dev-only nếu cần dựng lại playground sau này",
      "• tránh duplicate logic với PlanningScene / CombatScene",
      "",
      "Phím tắt:",
      "• R: tạo unit mẫu",
      "• ESC: quay lại menu chính nếu scene đang được mở thủ công"
    ].join("\n"),
    BODY_STYLE
  );

  scene.prototypePanelParts = [panel, title, body];
}

function applyPrototypeBonusToUnit(unit: PrototypeUnit | null, bonus: PrototypeBonus | null): void {
  if (!unit || !bonus) return;
  if (bonus.hp) {
    unit.maxHp = (unit.maxHp ?? unit.hp ?? 0) + (bonus.hp ?? 0);
    unit.hp = Math.min(unit.maxHp, (unit.hp ?? 0) + (bonus.hp ?? 0));
  }
  if (bonus.atk) unit.atk = (unit.atk ?? 0) + (bonus.atk ?? 0);
  if (bonus.matk) unit.matk = (unit.matk ?? 0) + (bonus.matk ?? 0);
  if (bonus.def) unit.def = (unit.def ?? 0) + (bonus.def ?? 0);
  if (bonus.mdef) unit.mdef = (unit.mdef ?? 0) + (bonus.mdef ?? 0);
  if (bonus.critPct) {
    unit.mods = unit.mods ?? {};
    unit.mods.critPct = (unit.mods.critPct ?? 0) + (bonus.critPct ?? 0);
  }
  if (bonus.evadePct) {
    unit.mods = unit.mods ?? {};
    unit.mods.evadePct = (unit.mods.evadePct ?? 0) + (bonus.evadePct ?? 0);
  }
  if (bonus.shieldStart) {
    unit.mods = unit.mods ?? {};
    unit.mods.shieldStart = (unit.mods.shieldStart ?? 0) + (bonus.shieldStart ?? 0);
  }
}

export class BoardPrototypeScene extends Phaser.Scene {
  prototypePanelParts: Phaser.GameObjects.GameObject[] = [];
  sampleUnit: PrototypeUnit | null = null;

  constructor() {
    super("BoardPrototypeScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#0a1019");
    renderInfoBlock(this);

    this.input.keyboard?.on?.("keydown-R", () => {
      this.sampleUnit = this.createOwnedUnit("ant_guard", 1) ?? null;
    });
    this.input.keyboard?.on?.("keydown-ESC", () => {
      this.scene.start("MainMenuScene");
    });
  }

  createOwnedUnit(baseId: string, star = 1, equips: string[] = [], options: Record<string, unknown> = {}): PrototypeUnit | null {
    return createPersistedOwnedUnit(baseId, star, null, normalizeEquipIds(equips, { baseId, star }), options) as PrototypeUnit | null;
  }

  normalizeEquipIds(equips: unknown, unit: EquipableUnit | null = null): string[] {
    return normalizeEquipIds(equips, unit);
  }

  applyBonusToUnit(unit: PrototypeUnit | null, bonus: PrototypeBonus | null): void {
    applyPrototypeBonusToUnit(unit, bonus);
  }

  applyOwnedEquipmentBonuses(unit: PrototypeUnit | null, owned: Record<string, unknown>): unknown[] {
    const target = unit as unknown as Parameters<typeof applyOwnedEquipmentBonusesToUnit>[0];
    const ownedTyped = owned as unknown as Parameters<typeof applyOwnedEquipmentBonusesToUnit>[1];
    const callback = applyPrototypeBonusToUnit as unknown as Parameters<typeof applyOwnedEquipmentBonusesToUnit>[2];
    return applyOwnedEquipmentBonusesToUnit(target, ownedTyped, callback, {
      assignEquipsToUnit: true,
      includeLegacy: true
    });
  }
}
