import Phaser from "phaser";
import type { GameModeConfig } from "../gameModes/GameModeConfig.js";
import GameModeRegistry from "../gameModes/GameModeRegistry.js";
import { clearRunProgress, loadProgress, saveProgress } from "../core/persistence.js";
import { loadUiSettings, type UiSettings } from "../core/uiSettings.js";
import {
  createDefaultRunState,
  createOwnedUnit,
  hydrateRunState,
  serializeRunState,
  type PlayerState,
  type RunState
} from "../core/runState.js";
import {
  ensureFortressGraph,
  getFortressAvailableNodes,
  getFortressNodeI18nKey,
  getFortressPendingNode,
  selectFortressNode
} from "../core/fortressMode.js";
import { getXpToLevelUp } from "../core/gameUtils.js";
import { UI_COLORS, UI_FONT, EMOJI_FONT } from "../core/uiTheme.js";
import { startManagedScene } from "./sceneLazyRouting.js";
import { t } from "../i18n/index.js";
import { getLoseConditionLabel } from "../core/gameRules.js";
import { getAiModeI18nKey } from "../core/aiModes.js";
import { UNIT_BY_ID } from "../data/unitCatalog.js";
import {
  showFortressBeastDenModal,
  showFortressBlacksmithModal,
  showFortressPharmacyModal
} from "./shared/fortressServiceModalRuntime.js";

type IncomingData = {
  settings?: UiSettings | null;
  mode?: string | null;
  aiMode?: string | null;
  restoredState?: unknown;
  forceNewRun?: boolean | null;
};

type FortNodeType =
  | "battle"
  | "shop"
  | "pharmacy"
  | "beast_den"
  | "blacksmith"
  | "elite"
  | "boss";

type FortNodeLike = {
  id: string;
  type: FortNodeType;
  layer: number;
  lane: number;
  nextIds: string[];
};
type PharmacyChoiceLike = {
  id?: string;
  kind: string;
  hpDelta?: number;
  xpDelta?: number;
  goldDelta?: number;
  labelKey: string;
  detailKey: string;
};

type FortLayerLike = {
  index?: number;
  nodeIds?: string[];
};

type FortGraphLike = {
  actIndex?: number;
  seed?: number;
  nodes?: FortNodeLike[];
  layers?: FortLayerLike[];
};

type FortMetaLike = {
  actIndex: number;
  stepIndex?: number;
  mapSeed?: number;
  graph: FortGraphLike | null;
  currentNodeId: string | null;
  visitedNodeIds: string[];

  pendingNodePayload: Record<string, unknown> | null;
};

type PlayerLike = PlayerState & {
  benchUpgradeLevel?: number;
  benchBonus?: number;
};

type PendingNode = { type: string; payload: unknown } | null;

type UnitSummary = { name: string; tier: number; classType: string; icon?: string; classVi?: string };

type ModalSceneLike = Phaser.Scene & { [key: string]: unknown };

function isPharmacyChoice(value: unknown): value is PharmacyChoiceLike {
  if (!value || typeof value !== "object") return false;
  const choice = value as Record<string, unknown>;
  return typeof choice.kind === "string"
    && typeof choice.labelKey === "string"
    && typeof choice.detailKey === "string";
}

const NODE_ICONS: Record<string, string> = Object.freeze({
  battle: "⚔",
  shop: "🛒",
  pharmacy: "🧪",
  beast_den: "🐾",
  blacksmith: "⚒",
  elite: "👑",
  boss: "☠"
});

function getBenchCap(player: PlayerLike | null | undefined): number {
  const level = Number.isFinite(player?.benchUpgradeLevel ?? 0) ? Math.floor(player!.benchUpgradeLevel ?? 0) : 0;
  const bonus = Number.isFinite(player?.benchBonus ?? 0) ? Math.floor(player!.benchBonus ?? 0) : 0;
  return (level > 0 ? 14 : 8) + bonus;
}

interface XpGainResult {
  gained: number;
  levelsGained: number;
}

function applyXpGain(player: PlayerLike | null | undefined, value: unknown): XpGainResult {
  if (!player || !Number.isFinite(value) || Number(value) <= 0) {
    return { gained: 0, levelsGained: 0 };
  }
  const numValue = Number(value);
  const startLevel = Number.isFinite(player.level) ? player.level : 1;
  let gained = 0;
  let amount = Math.max(0, Math.floor(numValue));
  while (amount > 0 && player.level < 25) {
    const need = getXpToLevelUp(player.level) - player.xp;
    if (amount >= need) {
      amount -= need;
      gained += need;
      player.level += 1;
      player.xp = 0;
    } else {
      player.xp += amount;
      gained += amount;
      amount = 0;
    }
  }
  return {
    gained,
    levelsGained: Math.max(0, player.level - startLevel)
  };
}

type NodeCard = {
  bg: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Text;
  title: Phaser.GameObjects.Text;
  subtitle: Phaser.GameObjects.Text;
};

type FooterButton = {
  bg: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
};

function describeNode(node: FortNodeLike | null | undefined): string {
  switch (node?.type) {
    case "shop":
      return t("fortress.nodeService.shop");
    case "pharmacy":
      return t("fortress.nodeService.pharmacy");
    case "beast_den":
      return t("fortress.nodeService.beastDen");
    case "blacksmith":
      return t("fortress.nodeService.blacksmith");
    case "elite":
      return t("fortress.nodeService.elite");
    case "boss":
      return t("fortress.nodeService.boss");
    case "battle":
    default:
      return t("fortress.nodeService.battle");
  }
}
function castFortMeta(meta: unknown): FortMetaLike | null {
  return (meta ?? null) as unknown as FortMetaLike | null;
}

export class FortressMapScene extends Phaser.Scene {
  incomingData: IncomingData | null = null;
  settings: UiSettings | null = null;
  runState: RunState | null = null;
  player: PlayerState | null = null;
  gameModeId: string = "EndlessPvEFortress";
  gameModeConfig: GameModeConfig | null = null;
  statusText: Phaser.GameObjects.Text | null = null;
  overlay: Phaser.GameObjects.Container | null = null;
  nodeCards: NodeCard[] = [];

  constructor() {
    super("FortressMapScene");
  }

  init(data: IncomingData | null): void {
    this.incomingData = data ?? null;
  }

  create(): void {
    this.settings = this.incomingData?.settings ?? loadUiSettings();
    this.gameModeId = this.incomingData?.mode ?? "EndlessPvEFortress";
    this.gameModeConfig = GameModeRegistry.get(this.gameModeId) ?? GameModeRegistry.get("EndlessPvEFortress");
    this.runState = this.resolveInitialRunState();
    this.player = this.runState?.player ?? null;

    if (this.player && getFortressPendingNode(this.player)) {
      this.startPlanningScene();
      return;
    }

    if (this.player) {
      this.player.fortressMeta = ensureFortressGraph(
        this.player.fortressMeta as unknown as Record<string, unknown> | null | undefined,
        { round: this.player.round }
      );
    }
    this.persistProgress();
    this.renderMap();
  }

  resolveInitialRunState(): RunState | null {
    const restored = hydrateRunState(this.incomingData?.restoredState ?? loadProgress());
    if (this.incomingData?.forceNewRun === true || !restored || restored.player?.gameMode !== this.gameModeId) {
      clearRunProgress();
      return this.createFreshRunState();
    }
    if (restored) {
      restored.aiMode = this.incomingData?.aiMode ?? restored.aiMode;
      restored.audioEnabled = this.settings?.audioEnabled !== false;
      if (restored.player) {
        restored.player.gameMode = this.gameModeId;
        restored.player.fortressMeta = ensureFortressGraph(
          restored.player.fortressMeta as unknown as Record<string, unknown> | null | undefined,
          { round: restored.player.round }
        );
      }
    }
    return restored;
  }

  createFreshRunState(): RunState {
    const state = createDefaultRunState();
    state.aiMode = this.incomingData?.aiMode ?? this.settings?.aiMode ?? this.gameModeConfig?.aiDifficulty ?? "MEDIUM";
    state.audioEnabled = this.settings?.audioEnabled !== false;
    state.player.gameMode = this.gameModeId;
    state.player.hp = Math.max(1, Math.floor(this.gameModeConfig?.startingHP ?? 100));
    state.player.gold = Math.max(0, Math.floor(this.gameModeConfig?.startingGold ?? 10));
    state.player.level = 1;
    state.player.xp = 0;
    state.player.round = 1;
    state.player.loseCondition = (this.gameModeConfig?.loseCondition ?? state.player.loseCondition) as PlayerState["loseCondition"];
    state.player.fortressMeta = ensureFortressGraph(
      state.player.fortressMeta as unknown as Record<string, unknown> | null | undefined,
      { round: 1 }
    );
    return state;
  }

  persistProgress(): void {
    saveProgress(serializeRunState(this.runState));
  }

  renderMap(): void {
    if (!this.player) return;
    const width = this.scale.width;
    const height = this.scale.height;
    const panelW = Math.min(width - 60, 1240);
    const panelH = Math.min(height - 50, 760);
    const panelX = (width - panelW) / 2;
    const panelY = (height - panelH) / 2;
    const headerH = 112;
    const footerH = 74;
    const graphX = panelX + 42;
    const graphY = panelY + headerH + 24;
    const graphW = panelW - 84;
    const graphH = panelH - headerH - footerH - 48;

    this.add.rectangle(width / 2, height / 2, width, height, 0x050b12, 0.7);
    const bg = this.add.rectangle(panelX + panelW / 2, panelY + panelH / 2, panelW, panelH, 0x0f1a2b, 0.97);
    bg.setStrokeStyle(2, 0x8bc8ff, 1);

    this.add.text(panelX + 28, panelY + 22, t("fortress.title"), {
      fontFamily: UI_FONT,
      fontSize: "28px",
      color: "#ffeab0",
      fontStyle: "bold"
    });
    this.add.text(panelX + 28, panelY + 58, t("fortress.subtitle"), {
      fontFamily: UI_FONT,
      fontSize: "15px",
      color: UI_COLORS.textSecondary
    });
    this.add.text(panelX + 28, panelY + 84, this.buildMetaLine(), {
      fontFamily: UI_FONT,
      fontSize: "14px",
      color: UI_COLORS.textPrimary
    });

    this.statusText = this.add.text(panelX + 28, panelY + panelH - 44, t("fortress.choosePath"), {
      fontFamily: UI_FONT,
      fontSize: "14px",
      color: UI_COLORS.textSecondary
    });

    const fortMeta = castFortMeta(this.player.fortressMeta);
    const graph: FortGraphLike | null = fortMeta?.graph ?? null;
    if (!graph?.layers?.length) return;

    const layers: FortLayerLike[] = graph.layers;
    const layerGap = layers.length <= 1 ? 0 : graphW / Math.max(1, layers.length - 1);
    const positions = new Map<string, { x: number; y: number }>();

    const lineGraphics = this.add.graphics();
    lineGraphics.setDepth(5);

    layers.forEach((layer: FortLayerLike, layerIndex: number) => {
      const nodeIds: string[] = Array.isArray(layer?.nodeIds) ? layer.nodeIds : [];
      const laneGap = nodeIds.length <= 1 ? 0 : graphH / Math.max(1, nodeIds.length - 1);
      nodeIds.forEach((nodeId: string, laneIndex: number) => {
        positions.set(nodeId, {
          x: graphX + layerIndex * layerGap,
          y: graphY + laneIndex * laneGap
        });
      });
    });

    const nodes: FortNodeLike[] = graph.nodes ?? [];
    nodes.forEach((node: FortNodeLike) => {
      const from = positions.get(node.id);
      if (!from) return;
      const nextIds: string[] = node.nextIds ?? [];
      nextIds.forEach((nextId: string) => {
        const to = positions.get(nextId);
        if (!to) return;
        lineGraphics.lineStyle(2, 0x35506b, 0.85);
        lineGraphics.lineBetween(from.x + 74, from.y, to.x - 74, to.y);
      });
    });

    const playerFortMeta = castFortMeta(this.player.fortressMeta);
    const availableIds = new Set(getFortressAvailableNodes(playerFortMeta).map((node: FortNodeLike) => node.id));
    const visitedIds = new Set<string>(playerFortMeta?.visitedNodeIds ?? []);

    nodes.forEach((node: FortNodeLike) => {
      const pos = positions.get(node.id);
      if (!pos) return;
      const isAvailable = availableIds.has(node.id);
      const isVisited = visitedIds.has(node.id);
      const isCurrent = playerFortMeta?.currentNodeId === node.id;
      const cardW = 148;
      const cardH = 62;
      const fill = isCurrent
        ? 0x30577a
        : isAvailable
          ? 0x1d324b
          : isVisited
            ? 0x1a2433
            : 0x121a26;
      const stroke = isAvailable ? 0x9fd6ff : (isVisited ? 0x5f7896 : 0x334458);
      const bgCard = this.add.rectangle(pos.x, pos.y, cardW, cardH, fill, 0.96);
      bgCard.setStrokeStyle(isAvailable ? 2 : 1, stroke, isAvailable ? 1 : 0.72);
      bgCard.setDepth(10);

      const icon = this.add.text(pos.x - 54, pos.y - 8, NODE_ICONS[node.type] ?? "◆", {
        fontFamily: EMOJI_FONT,
        fontSize: "20px",
        color: isAvailable ? "#ffffff" : "#8ba1b8"
      }).setOrigin(0.5).setDepth(11);

      const title = this.add.text(pos.x - 30, pos.y - 18, t(getFortressNodeI18nKey(node.type)), {
        fontFamily: UI_FONT,
        fontSize: "13px",
        color: isAvailable ? "#eaf6ff" : UI_COLORS.textSecondary,
        fontStyle: "bold",
        wordWrap: { width: 96 }
      }).setDepth(11);

      const subtitle = this.add.text(pos.x - 30, pos.y + 5, describeNode(node), {
        fontFamily: UI_FONT,
        fontSize: "10px",
        color: isAvailable ? UI_COLORS.textPrimary : UI_COLORS.textMuted,
        wordWrap: { width: 102 }
      }).setDepth(11);

      if (isAvailable) {
        bgCard.setInteractive({ useHandCursor: true });
        bgCard.on("pointerdown", () => this.handleNodeSelection(node));
      }

      this.nodeCards.push({ bg: bgCard, icon, title, subtitle });
    });

    const menuBtn = this.createFooterButton(panelX + panelW - 180, panelY + panelH - 54, 140, 36, t("menu.settingsBack"), () => {
      startManagedScene(this, "MainMenuScene", { selectedMode: this.gameModeId, openStartPanel: true });
    });
    menuBtn.bg.setFillStyle(0x344960, 0.96);
    menuBtn.bg.setStrokeStyle(1.5, 0xa0c8f6, 0.95);
  }

  buildMetaLine(): string {
    const loseLabel = getLoseConditionLabel(this.player?.loseCondition ?? this.gameModeConfig?.loseCondition ?? "survive");
    const aiLabel = t(getAiModeI18nKey(this.runState?.aiMode ?? "COOP_MEDIUM") ?? "difficulty.medium");
    const playerFortMeta = castFortMeta(this.player?.fortressMeta);
    return [
      `${t("label.round")}: ${this.player?.round ?? 1}`,
      `${t("label.gold")}: ${this.player?.gold ?? 0}`,
      `${t("label.hp")}: ${this.player?.hp ?? 0}`,
      `${t("label.level")}: ${this.player?.level ?? 1}`,
      `${t("difficulty.label")}: ${aiLabel}`,
      `${t("fortress.act")}: ${playerFortMeta?.actIndex ?? 1}`,
      `${t("fortress.loseMode")}: ${loseLabel}`
    ].join("  •  ");
  }

  createFooterButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    onClick: (() => void) | null
  ): FooterButton {
    const bg = this.add.rectangle(x, y, width, height, 0x22374d, 0.96);
    bg.setStrokeStyle(1.5, UI_COLORS.panelEdge, 0.95);
    bg.setInteractive({ useHandCursor: true });
    const text = this.add.text(x, y, label, {
      fontFamily: UI_FONT,
      fontSize: "14px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5);
    bg.on("pointerdown", () => onClick?.());
    return { bg, text };
  }

  handleNodeSelection(node: FortNodeLike | null | undefined): void {
    if (!this.player) return;
    this.player.fortressMeta = selectFortressNode(
      this.player.fortressMeta as unknown as Record<string, unknown> | null | undefined,
      node,
      { round: this.player.round }
    ) as typeof this.player.fortressMeta;
    const pending: PendingNode = getFortressPendingNode(this.player);
    if (!pending?.type) return;
    this.persistProgress();
    const payloadRec = pending.payload as Record<string, unknown> | null;
    if (pending.type === "pharmacy") {
      this.showPharmacyChoices(payloadRec?.serviceChoices ?? []);
      return;
    }
    if (pending.type === "beast_den") {
      this.showBeastDenChoices(payloadRec?.recruitOptions ?? []);
      return;
    }
    if (pending.type === "blacksmith") {
      this.showBlacksmithChoice(payloadRec ?? {});
      return;
    }
    this.startPlanningScene();
  }

  showPharmacyChoices(serviceChoices: unknown): void {
    if (!this.player) return;
    const choices = (Array.isArray(serviceChoices) ? serviceChoices : []).filter(isPharmacyChoice);
    const maxHp = Math.max(1, Math.floor(this.gameModeConfig?.startingHP ?? 100));
    const playerRef = this.player;
    showFortressPharmacyModal(this as unknown as ModalSceneLike, {
      serviceChoices: choices,
      onSelect: (choice: PharmacyChoiceLike) => {
        if (!playerRef) return;
        const hpDelta = Math.max(0, Math.floor(Number(choice.hpDelta ?? 0)));
        const goldDelta = Math.max(0, Math.floor(Number(choice.goldDelta ?? 0)));
        const xpResult = applyXpGain(playerRef, choice.xpDelta ?? 0);
        playerRef.hp = Math.min(maxHp, playerRef.hp + hpDelta);
        if (goldDelta > 0) playerRef.gold += goldDelta;
        const fm = castFortMeta(playerRef.fortressMeta);
        if (fm) {
          fm.pendingNodePayload = {
            ...(fm.pendingNodePayload ?? {}),
            serviceResult: {
              optionId: String(choice.id ?? "restore"),
              messageKey: `fortress.serviceResult.pharmacy.${String(choice.id ?? "restore")}`,
              messageArgs: {
                hp: hpDelta,
                gold: goldDelta,
                xp: xpResult.gained,
                levels: xpResult.levelsGained
              }
            }
          };
        }
        this.persistProgress();
        this.startPlanningScene();
      },
      onSkip: () => this.startPlanningScene()
    });
  }
  showBeastDenChoices(recruitOptions: unknown): void {
    if (!this.player) return;
    const unitIdBySummary = new Map<UnitSummary, string>();
    const options: UnitSummary[] = (Array.isArray(recruitOptions) ? recruitOptions : [])
      .map((unitId): UnitSummary | undefined => {
        if (typeof unitId !== "string") return undefined;
        const unitBase = UNIT_BY_ID[unitId];
        if (!unitBase || typeof unitBase !== "object") return undefined;
        const ub = unitBase as Record<string, unknown>;
        const summary: UnitSummary = {
          name: String(ub.name ?? unitId),
          tier: Number(ub.tier ?? 1),
          classType: String(ub.classType ?? "UNKNOWN"),
          icon: ub.icon as string | undefined,
          classVi: ub.classVi as string | undefined
        };
        unitIdBySummary.set(summary, unitId);
        return summary;
      })
      .filter((u): u is UnitSummary => u !== undefined);
    showFortressBeastDenModal(this as unknown as ModalSceneLike, {
      units: options,
      onSelect: (unit: UnitSummary) => {
        if (!this.player) return;
        const unitId = unitIdBySummary.get(unit) ?? unit.name;
        if (this.player.bench.length >= getBenchCap(this.player)) {
          this.statusText?.setText(t("fortress.benchFullSkip"));
          return;
        }
        const newUnit = createOwnedUnit(unitId, 1);
        if (newUnit) this.player.bench.push(newUnit);
        const fm = castFortMeta(this.player.fortressMeta);
        if (fm) {
          fm.pendingNodePayload = {
            ...(fm.pendingNodePayload ?? {}),
            serviceResult: {
              type: "beast_den",
              unitId,
              messageKey: "fortress.serviceResult.beastDen",
              messageArgs: {
                unit: unit.name,
                tier: unit.tier
              }
            }
          };
        }
        this.persistProgress();
        this.startPlanningScene();
      },
      onSkip: () => this.startPlanningScene()
    });
  }

  showBlacksmithChoice(payload: unknown): void {
    const forgePayload = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
    showFortressBlacksmithModal(this as unknown as ModalSceneLike, {
      forgeTier: Number(forgePayload.forgeTier ?? 1) || 1,
      onEnter: () => {
        if (!this.player) return;
        const fm = castFortMeta(this.player.fortressMeta);
        if (fm) {
          fm.pendingNodePayload = {
            ...(fm.pendingNodePayload ?? {}),
            serviceResult: {
              type: "blacksmith",
              messageKey: "fortress.serviceResult.blacksmith",
              messageArgs: {
                tier: Number(forgePayload.forgeTier ?? 1) || 1
              }
            }
          };
        }
        this.persistProgress();
        this.startPlanningScene();
      },
      onSkip: () => this.startPlanningScene()
    });
  }

  startPlanningScene(): void {
    this.persistProgress();
    if (!this.runState) return;
    startManagedScene(this, "PlanningScene", {
      settings: this.settings,
      mode: this.gameModeId,
      restoredState: serializeRunState(this.runState)
    });
  }
}
