import Phaser from "phaser";
import { getAiModeI18nKey, getCoopPlayerCapacity, getCoopPlayerSlots } from "../core/aiModes.js";
import {
  buildCoopSaveSummary,
  COOP_SAVE_SELECTION_IDS,
  COOP_SAVE_SELECTION_NEW,
  COOP_SAVE_SLOT_AUTO,
  loadCoopSaveSlots,
  remapCoopResumeStateForHost,
  resolveCoopSaveSelection,
  type CoopSaveEntry,
  type CoopSaveSelectionId,
  type CoopSaveSlotId,
  type CoopSaveSummary
} from "../core/coopSaveSlots.js";
import { getGameModeConfig, getRequiredPlayerCapacityForGameMode, isPvpGameMode } from "../core/gameModeRuntime.js";
import { t } from "../i18n/index.js";
import { createMenuButton, type MenuButton } from "./MainMenuUIHelpers.js";
import { CoopP2PTransport } from "../network/coopP2PTransport.js";
import {
  COOP_MESSAGE_TYPES,
  COOP_SESSION_TYPES,
  formatCoopConnectionLabel,
  slotIndexToKey,
  slotKeyToIndex
} from "../network/coopConfig.js";
import { clearCoopSession, createCoopSession, updateCoopSession } from "../network/coopSession.js";
import { startManagedScene } from "./sceneLazyRouting.js";

type PromptHandler = (message?: string, defaultValue?: string) => string | null;
type LobbyRole = "host" | "guest";
type SignalMode = "offer" | "answer";
type PendingLobbyAction = "create" | "join" | "ready";
type SaveMode = "new" | "resume";

interface UnknownRecord {
  [key: string]: unknown;
}

interface UiSettings extends UnknownRecord {
  aiMode?: string;
}

interface CoopLobbyInitData {
  settings?: UiSettings | null;
  selectedMode?: string;
  aiMode?: string;
  requiredPlayerCapacity?: number;
}

interface RoomPlayer extends UnknownRecord {
  slotIndex: number;
  playerId: string;
  ready: boolean;
}

interface RoomState extends UnknownRecord {
  roomCode: string;
  requiredCapacity: number;
  hostSlotIndex: number;
  aiMode: string;
  selectedMode: string;
  saveSlotId: string;
  saveMode: string;
  resumeSummary: CoopSaveSummary | null;
  resumeState?: unknown;
  players: RoomPlayer[];
}

interface CoopSaveButtonState {
  selected?: boolean;
  occupied?: boolean;
}

interface CoopSaveButtonConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  fill: number;
  stroke: number;
  emptyFill: number;
  emptyStroke: number;
  selectedFill: number;
  selectedStroke: number;
  onClick?: () => void;
}

interface CoopSaveButton {
  bg: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
  selected: boolean;
  occupied: boolean;
  pressed: boolean;
  setLabel(value: string): CoopSaveButton;
  setState(state?: CoopSaveButtonState): CoopSaveButton;
}

interface CoopSaveSummaryLineInput {
  summary?: CoopSaveSummary | null;
  selectionId?: string;
  roomActive?: boolean;
  roomSaveMode?: SaveMode;
}

interface LocalSignalMessage extends UnknownRecord {
  senderId?: string;
  kind?: string;
  answerText?: string;
  sessionId?: string;
  roomCode?: string;
  targetSlot?: string | null;
}

interface LocalSignalRelay {
  senderId: string;
  post(message: LocalSignalMessage): void;
  close(): void;
}

interface LocalSignalRelayOptions {
  senderId?: string;
  onMessage?: ((message: LocalSignalMessage) => void) | null;
  channelFactory?: typeof BroadcastChannel;
}

interface TransportPayload extends UnknownRecord {
  slot?: string;
  sourceSlot?: string;
  slotIndex?: number;
  playerId?: string;
  sourcePeerId?: string;
  remotePeerId?: string;
  ready?: boolean;
}

interface AcceptedOfferMetadata extends UnknownRecord {
  selectedMode?: string;
  aiMode?: string;
  saveSlotId?: string;
  saveMode?: string;
  resumeSummary?: CoopSaveSummary | null;
}

interface ResumeStateView extends UnknownRecord {
  coopDifficulty?: string;
  aiMode?: string;
}

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" ? value as UnknownRecord : null;
}

function asRoomState(value: unknown): RoomState | null {
  return value && typeof value === "object" ? value as RoomState : null;
}

function asTransportPayload(value: unknown): TransportPayload {
  return value && typeof value === "object" ? value as TransportPayload : {};
}

function asAcceptedOfferMetadata(value: unknown): AcceptedOfferMetadata {
  return value && typeof value === "object" ? value as AcceptedOfferMetadata : {};
}

function formatDifficultyLabel(aiMode: unknown): string {
  const key = getAiModeI18nKey(typeof aiMode === "string" && aiMode !== null ? aiMode : "COOP_MEDIUM");
  const translated = key ? t(key) : "";
  return translated !== key && translated ? translated : String(aiMode ?? "");
}

async function copyTextToClipboard(value: unknown): Promise<boolean> {
  const text = String(value ?? "");
  const clipboard = globalThis?.navigator?.clipboard;
  if (typeof clipboard?.writeText === "function") {
    await clipboard.writeText(text);
    return true;
  }

  const doc = globalThis?.document;
  const body = doc?.body;
  if (!doc?.createElement || !body?.appendChild) {
    throw new Error("Clipboard unavailable");
  }

  const textarea = doc.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "readonly");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  body.appendChild(textarea);
  textarea.focus?.();
  textarea.select?.();
  textarea.setSelectionRange?.(0, text.length);

  const copied = typeof doc.execCommand === "function" ? doc.execCommand("copy") : false;
  body.removeChild(textarea);
  if (!copied) {
    throw new Error("Clipboard unavailable");
  }
  return true;
}

function openManualCopyPrompt(promptText: string, value: unknown): boolean {
  const nativePromptHost = globalThis?.window ?? globalThis;
  const promptHandler = typeof nativePromptHost?.prompt === "function"
    ? nativePromptHost.prompt.bind(nativePromptHost)
    : null;
  if (typeof promptHandler !== "function") return false;
  promptHandler(promptText, String(value ?? ""));
  return true;
}

function normalizeCoopConnectionErrorMessage(error: unknown): string {
  const record = asRecord(error);
  const rawMessage = record?.message ?? record?.error ?? record?.details ?? "";
  const normalized = String(rawMessage ?? "").trim();
  if (!normalized) return t("coopLobby.status.connectionFailed");
  return normalized;
}

function getCoopSaveSelectionLabel(selectionId: unknown): string {
  switch (selectionId) {
    case COOP_SAVE_SELECTION_NEW:
      return t("coopLobby.saveSelection.new");
    case COOP_SAVE_SLOT_AUTO:
      return t("coopLobby.saveSelection.auto");
    case "SAVE_1":
      return t("coopLobby.saveSelection.slot1");
    case "SAVE_2":
      return t("coopLobby.saveSelection.slot2");
    case "SAVE_3":
      return t("coopLobby.saveSelection.slot3");
    default:
      return String(selectionId ?? "");
  }
}

function formatSavedAt(savedAt: number): string {
  if (!Number.isFinite(savedAt)) return "--";
  try {
    return new Intl.DateTimeFormat(undefined, {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(savedAt);
  } catch (_error) {
    const date = new Date(savedAt);
    return Number.isFinite(date.getTime()) ? date.toLocaleString() : "--";
  }
}

function createCoopSaveButton(scene: Phaser.Scene, config: CoopSaveButtonConfig): CoopSaveButton {
  const bg = scene.add.rectangle(config.x, config.y, config.width, config.height, config.fill, 0.92)
    .setStrokeStyle(2, config.stroke, 1)
    .setInteractive({ useHandCursor: true });
  const text = scene.add.text(config.x, config.y, config.label, {
    fontFamily: "Consolas",
    fontSize: "16px",
    color: "#f1f8ff"
  }).setOrigin(0.5);
  const button: CoopSaveButton = {
    bg,
    text,
    selected: false,
    occupied: false,
    pressed: false,
    setLabel(value: string) {
      text.setText(value);
      return button;
    },
    setState({ selected = false, occupied = false }: CoopSaveButtonState = {}) {
      button.selected = selected;
      button.occupied = occupied;
      const fill = selected
        ? config.selectedFill
        : (occupied ? config.fill : config.emptyFill);
      const stroke = selected
        ? config.selectedStroke
        : (occupied ? config.stroke : config.emptyStroke);
      const color = selected
        ? "#ffffff"
        : (occupied ? "#f1f8ff" : "#b6c0ca");
      bg.setFillStyle(fill, 0.94);
      bg.setStrokeStyle(2, stroke, 1);
      text.setColor(color);
      return button;
    }
  };
  bg.on("pointerover", () => {
    if (button.pressed) return;
    bg.setFillStyle(button.selected ? config.selectedFill : (button.occupied ? config.fill : config.emptyFill), 1);
  });
  bg.on("pointerout", () => {
    button.pressed = false;
    button.setState({ selected: button.selected, occupied: button.occupied });
  });
  bg.on("pointerdown", () => {
    button.pressed = true;
    bg.setFillStyle(button.selected ? config.selectedFill : (button.occupied ? config.fill : config.emptyFill), 0.86);
    config.onClick?.();
  });
  return button;
}

function buildCoopSaveSummaryLine({
  summary = null,
  selectionId = COOP_SAVE_SELECTION_NEW,
  roomActive = false,
  roomSaveMode = "new"
}: CoopSaveSummaryLineInput = {}): string {
  const label = getCoopSaveSelectionLabel(selectionId);
  if (summary) {
    const summaryPrefix = roomActive ? t("coopLobby.saveSummary.roomUsing") : label;
    return `${summaryPrefix}: ${t("coopLobby.saveSummary.round", { round: summary.round })} • ${t("coopLobby.saveSummary.hearts", { hearts: summary.hearts })} • ${formatSavedAt(summary.savedAt)}`;
  }
  if (roomActive) {
    return roomSaveMode === "resume"
      ? t("coopLobby.saveSummary.roomResumeMissing")
      : t("coopLobby.saveSummary.roomNew", { label });
  }
  if (selectionId === COOP_SAVE_SELECTION_NEW) {
    return t("coopLobby.saveSummary.newGame");
  }
  return t("coopLobby.saveSummary.empty", { label });
}

function resolveRequiredPlayerCapacity(scene: { getRequiredPlayerCapacity?: () => number; selectedMode?: string; aiMode?: string }): number {
  if (typeof scene?.getRequiredPlayerCapacity === "function") {
    return scene.getRequiredPlayerCapacity();
  }
  return getRequiredPlayerCapacityForGameMode(scene?.selectedMode ?? "EndlessPvEClassic", scene?.aiMode ?? "COOP_MEDIUM");
}

const COOP_LOCAL_SIGNAL_CHANNEL = "homeserver-forest-throne-classic-coop-signal-v1";

function createLocalSignalSenderId(): string {
  if (typeof globalThis?.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `coop_local_${Math.random().toString(36).slice(2, 10)}`;
}

function createCoopLocalSignalRelay({
  senderId = createLocalSignalSenderId(),
  onMessage = null,
  channelFactory = globalThis?.BroadcastChannel
}: LocalSignalRelayOptions = {}): LocalSignalRelay {
  if (typeof channelFactory !== "function") {
    return {
      senderId,
      post(_message: LocalSignalMessage): void {},
      close(): void {}
    };
  }

  const channel = new channelFactory(COOP_LOCAL_SIGNAL_CHANNEL);
  const handleMessage = (event: MessageEvent<unknown>): void => {
    const payload = asRecord(event.data) as LocalSignalMessage | null;
    if (!payload || payload.senderId === senderId) return;
    onMessage?.(payload);
  };
  if (typeof channel.addEventListener === "function") {
    channel.addEventListener("message", handleMessage);
  } else {
    channel.onmessage = handleMessage;
  }

  return {
    senderId,
    post(message: LocalSignalMessage): void {
      if (!message || typeof message !== "object") return;
      channel.postMessage({
        ...message,
        senderId
      });
    },
    close(): void {
      if (typeof channel.removeEventListener === "function") {
        channel.removeEventListener("message", handleMessage);
      } else if (channel.onmessage === handleMessage) {
        channel.onmessage = null;
      }
      channel.close?.();
    }
  };
}

export function getCoopLobbyGuidePanels(): Array<{ title: string; body: string }> {
  return [
    {
      title: t("coopLobby.guide.createRoom.title"),
      body: [
        t("coopLobby.guide.createRoom.step1"),
        t("coopLobby.guide.createRoom.step2"),
        t("coopLobby.guide.createRoom.step3")
      ].join("\n")
    },
    {
      title: t("coopLobby.guide.joinRoom.title"),
      body: [
        t("coopLobby.guide.joinRoom.step1"),
        t("coopLobby.guide.joinRoom.step2"),
        t("coopLobby.guide.joinRoom.step3")
      ].join("\n")
    }
  ];
}

export function getCoopLobbyLayout(width: number, height: number) {
  const panelWidth = Math.max(1, width);
  const panelHeight = Math.max(1, height);
  const panelCenterX = width * 0.5;
  const panelCenterY = height * 0.5;
  const panelTop = panelCenterY - panelHeight * 0.5;
  const panelBottom = panelCenterY + panelHeight * 0.5;

  const titleY = panelTop + Math.max(48, Math.round(panelHeight * 0.075));
  const difficultyY = titleY + 40;
  const roomCodeLabelY = difficultyY + 52;
  const roomCodeY = roomCodeLabelY + 40;
  const roomCodeRowWidth = Math.min(panelWidth - 80, 420);
  const roomCodeCopyButtonWidth = Math.min(148, Math.max(112, Math.round(roomCodeRowWidth * 0.32)));
  const roomCodeCopyGap = 12;
  const roomCodeFieldWidth = roomCodeRowWidth - roomCodeCopyButtonWidth - roomCodeCopyGap;
  const roomCodeRowLeft = panelCenterX - roomCodeRowWidth * 0.5;
  const roomCodeFieldX = roomCodeRowLeft + roomCodeFieldWidth * 0.5;
  const roomCodeCopyButtonX = roomCodeRowLeft + roomCodeFieldWidth + roomCodeCopyGap + roomCodeCopyButtonWidth * 0.5;
  const roomCodeHintY = roomCodeY + 40;
  const saveButtonGap = 10;
  const saveButtonHeight = 32;
  const saveButtonRowWidth = Math.min(panelWidth - 96, 620);
  const saveButtonWidth = Math.floor((saveButtonRowWidth - saveButtonGap * (COOP_SAVE_SELECTION_IDS.length - 1)) / COOP_SAVE_SELECTION_IDS.length);
  const saveButtonRowLeft = panelCenterX - saveButtonRowWidth * 0.5;
  const saveButtonsY = roomCodeHintY + 34;
  const saveSummaryY = saveButtonsY + saveButtonHeight * 0.5 + 16;
  const saveSummaryWidth = panelWidth - 120;
  const inviteSlotButtonWidth = 90;
  const inviteSlotButtonHeight = 30;
  const inviteSlotButtonGap = 10;
  const inviteSlotRowWidth = inviteSlotButtonWidth * 3 + inviteSlotButtonGap * 2;
  const inviteSlotRowLeft = panelCenterX - inviteSlotRowWidth * 0.5;
  const inviteSlotsY = saveSummaryY + 34;

  const guidePanelWidth = 280;
  const guidePanelOffset = 210;
  const guidePanelTop = inviteSlotsY + inviteSlotButtonHeight * 0.5 + 18;
  const actionButtonHeight = 54;
  const readyButtonHeight = 50;
  const statusBottomPad = 30;
  const statusBlockHeight = 112;
  const statusTextY = panelBottom - statusBottomPad - statusBlockHeight * 0.5;
  const readyStatusGap = 24;
  const readyButtonY = statusTextY - statusBlockHeight * 0.5 - readyStatusGap - readyButtonHeight * 0.5;
  const backButtonY = readyButtonY;
  const actionReadyGap = 20;
  const actionButtonY = readyButtonY - readyButtonHeight * 0.5 - actionReadyGap - actionButtonHeight * 0.5;
  const actionButtonTop = actionButtonY - actionButtonHeight * 0.5;
  const guidePanelBottom = actionButtonTop - 18;
  const guidePanelHeight = Math.max(132, Math.min(170, guidePanelBottom - guidePanelTop));
  const guidePanelY = guidePanelTop + guidePanelHeight * 0.5;
  const guideTitleTopY = guidePanelTop + 16;
  const guideBodyTopY = guidePanelTop + 46;
  const statusTextWidth = panelWidth - 140;

  return {
    panelWidth,
    panelHeight,
    panelCenterX,
    panelCenterY,
    panelTop,
    panelBottom,
    titleY,
    difficultyY,
    roomCodeLabelY,
    roomCodeY,
    roomCodeRowWidth,
    roomCodeRowLeft,
    roomCodeFieldX,
    roomCodeFieldWidth,
    roomCodeCopyGap,
    roomCodeCopyButtonX,
    roomCodeCopyButtonWidth,
    roomCodeHintY,
    saveButtonGap,
    saveButtonHeight,
    saveButtonRowWidth,
    saveButtonWidth,
    saveButtonRowLeft,
    saveButtonsY,
    saveSummaryY,
    saveSummaryWidth,
    inviteSlotButtonWidth,
    inviteSlotButtonHeight,
    inviteSlotButtonGap,
    inviteSlotRowWidth,
    inviteSlotRowLeft,
    inviteSlotsY,
    guidePanelY,
    guidePanelTop,
    guidePanelBottom,
    guidePanelWidth,
    guidePanelHeight,
    guidePanelOffset,
    guideTitleTopY,
    guideBodyTopY,
    actionButtonY,
    actionButtonHeight,
    actionButtonTop,
    readyButtonHeight,
    readyButtonY,
    backButtonY,
    statusTextY,
    statusBottomPad,
    statusBlockHeight,
    statusTextWidth
  };
}

export class CoopLobbyScene extends Phaser.Scene {
  settings: UiSettings | null;
  selectedMode: string;
  aiMode: string;
  requiredPlayerCapacity: number | null;
  client: CoopP2PTransport | null;
  roomCode: string;
  connected: boolean;
  focusedInput: string;
  localPlayerId: string | null;
  localReady: boolean;
  currentRoomState: RoomState | null;
  statusText: Phaser.GameObjects.Text | null;
  roomCodeValueText: Phaser.GameObjects.Text | null;
  roomCodeHintText: Phaser.GameObjects.Text | null;
  roomCodeZone: Phaser.GameObjects.Rectangle | null = null;
  inviteSlotButtons: Array<{ slotKey: string; button: CoopSaveButton }>;
  selectedInviteSlot: string;
  copyRoomButton: MenuButton | null;
  createRoomButton: MenuButton | null;
  joinRoomButton: MenuButton | null;
  titleText: Phaser.GameObjects.Text | null;
  difficultyText: Phaser.GameObjects.Text | null;
  readyButton: MenuButton | null;
  coopSaveEntries: Partial<Record<CoopSaveSelectionId, CoopSaveEntry | null>>;
  selectedSaveSelectionId: CoopSaveSelectionId;
  saveSelectionButtons: Array<{ selectionId: CoopSaveSelectionId; button: CoopSaveButton }>;
  saveSummaryText: Phaser.GameObjects.Text | null;
  pendingResumeState: unknown;
  pendingResumeSummary: CoopSaveSummary | null;
  pendingActiveSaveSlotId: string;
  pendingSaveMode: SaveMode;
  lastConnectionErrorMessage: string;
  _unsubscribeFns: Array<() => void>;
  _keyDownHandler: ((event: KeyboardEvent) => void) | null;
  _planningLaunchRequested: boolean;
  pendingLobbyAction: PendingLobbyAction | null;
  lobbyRole: LobbyRole | null;
  activeSignalMode: SignalMode | null;
  activeSignalText: string;
  activeSignalSlot: string | null;
  localSignalRelay: LocalSignalRelay | null;
  _localSignalAutoApplyInFlight: boolean;
  localSignalChannelFactory?: typeof BroadcastChannel;
  requestTextPrompt?: PromptHandler;
  writeClipboardText?: (value: string) => Promise<unknown>;

  constructor() {
    super("CoopLobbyScene");
    this.settings = null;
    this.selectedMode = "EndlessPvEClassic";
    this.aiMode = "COOP_MEDIUM";
    this.requiredPlayerCapacity = null;
    this.client = null;
    this.roomCode = "";
    this.connected = false;
    this.focusedInput = "roomCode";
    this.localPlayerId = null;
    this.localReady = false;
    this.currentRoomState = null;
    this.statusText = null;
    this.roomCodeValueText = null;
    this.roomCodeHintText = null;
    this.inviteSlotButtons = [];
    this.selectedInviteSlot = "P2";
    this.copyRoomButton = null;
    this.createRoomButton = null;
    this.joinRoomButton = null;
    this.titleText = null;
    this.difficultyText = null;
    this.readyButton = null;
    this.coopSaveEntries = {};
    this.selectedSaveSelectionId = COOP_SAVE_SELECTION_NEW;
    this.saveSelectionButtons = [];
    this.saveSummaryText = null;
    this.pendingResumeState = null;
    this.pendingResumeSummary = null;
    this.pendingActiveSaveSlotId = COOP_SAVE_SLOT_AUTO;
    this.pendingSaveMode = "new";
    this.lastConnectionErrorMessage = "";
    this._unsubscribeFns = [];
    this._keyDownHandler = null;
    this._planningLaunchRequested = false;
    this.pendingLobbyAction = null;
    this.lobbyRole = null;
    this.activeSignalMode = null;
    this.activeSignalText = "";
    this.activeSignalSlot = null;
    this.localSignalRelay = null;
    this._localSignalAutoApplyInFlight = false;
  }

  init(data: CoopLobbyInitData = {}): void {
    clearCoopSession();
    this.settings = data?.settings ?? {};
    this.selectedMode = data?.selectedMode ?? "EndlessPvEClassic";
    this.aiMode = data?.aiMode ?? this.settings.aiMode ?? "COOP_MEDIUM";
    const requiredCapacity = data.requiredPlayerCapacity;
    this.requiredPlayerCapacity = Number.isInteger(requiredCapacity)
      ? Math.max(2, Math.min(4, requiredCapacity as number))
      : null;
    this.roomCode = "";
    this.connected = false;
    this.localPlayerId = null;
    this.localReady = false;
    this.currentRoomState = null;
    this.pendingResumeState = null;
    this.pendingResumeSummary = null;
    this.pendingActiveSaveSlotId = COOP_SAVE_SLOT_AUTO;
    this.pendingSaveMode = "new";
    this.lastConnectionErrorMessage = "";
    this._planningLaunchRequested = false;
    this.pendingLobbyAction = null;
    this.lobbyRole = null;
    this.activeSignalMode = null;
    this.activeSignalText = "";
    this.activeSignalSlot = "P2";
    this.selectedInviteSlot = "P2";
    this.inviteSlotButtons = [];
    this._localSignalAutoApplyInFlight = false;
  }

  create(): void {
    const { width, height } = this.scale;
    const guidePanels = getCoopLobbyGuidePanels();
    const layout = getCoopLobbyLayout(width, height);
    this.refreshLocalSaveEntries();
    this.cameras.main.setBackgroundColor("#11141b");

    this.add.rectangle(width * 0.5, height * 0.5, width, height, 0x11141b, 1);
    this.add.rectangle(layout.panelCenterX, layout.panelCenterY, layout.panelWidth, layout.panelHeight, 0x132234, 0.92)
      .setStrokeStyle(2, 0x7fb8ff, 0.7);

    this.titleText = this.add.text(layout.panelCenterX, layout.titleY, t("coopLobby.title"), {
      fontFamily: "Consolas",
      fontSize: "34px",
      color: "#ffeab0"
    }).setOrigin(0.5);

    this.difficultyText = this.add.text(layout.panelCenterX, layout.difficultyY, "", {
      fontFamily: "Consolas",
      fontSize: "20px",
      color: "#ccecff"
    }).setOrigin(0.5);

    this.add.text(layout.panelCenterX, layout.roomCodeLabelY, t("coopLobby.roomCodeLabel"), {
      fontFamily: "Consolas",
      fontSize: "18px",
      color: "#ffebb0"
    }).setOrigin(0.5);

    this.roomCodeZone = this.add.rectangle(layout.roomCodeFieldX, layout.roomCodeY, layout.roomCodeFieldWidth, 56, 0x203348, 0.96)
      .setStrokeStyle(2, 0x8fc7ff, 1)
      .setInteractive({ useHandCursor: true });
    this.roomCodeZone.on("pointerdown", () => {
      void this.handleRoomCodeFieldPointerDown();
    });

    this.roomCodeValueText = this.add.text(layout.roomCodeFieldX, layout.roomCodeY, "", {
      fontFamily: "Consolas",
      fontSize: "18px",
      color: "#ffffff",
      align: "center",
      wordWrap: { width: layout.roomCodeFieldWidth - 16 }
    }).setOrigin(0.5);

    this.copyRoomButton = createMenuButton(this, layout.roomCodeCopyButtonX, layout.roomCodeY, layout.roomCodeCopyButtonWidth, 44, t("coopLobby.copyRoomCode"), () => {
      void this.handleCopyRoomCode();
    }, 0x35597d, 0xa5d7ff);
    this.copyRoomButton.setEnabled(false);

    this.roomCodeHintText = this.add.text(layout.panelCenterX, layout.roomCodeHintY, t("coopLobby.roomCodeHint"), {
      fontFamily: "Consolas",
      fontSize: "14px",
      color: "#8fb9df",
      align: "center",
      wordWrap: { width: layout.roomCodeRowWidth + 120 }
    }).setOrigin(0.5);

    this.saveSelectionButtons = (COOP_SAVE_SELECTION_IDS as readonly CoopSaveSelectionId[]).map((selectionId: CoopSaveSelectionId, index: number) => {
      const button = createCoopSaveButton(this, {
        x: layout.saveButtonRowLeft + index * (layout.saveButtonWidth + layout.saveButtonGap) + layout.saveButtonWidth * 0.5,
        y: layout.saveButtonsY,
        width: layout.saveButtonWidth,
        height: layout.saveButtonHeight,
        label: getCoopSaveSelectionLabel(selectionId),
        fill: selectionId === COOP_SAVE_SELECTION_NEW ? 0x2b6a4f : 0x26435d,
        stroke: selectionId === COOP_SAVE_SELECTION_NEW ? 0x8bffd7 : 0xa5d7ff,
        emptyFill: selectionId === COOP_SAVE_SELECTION_NEW ? 0x2b6a4f : 0x29313d,
        emptyStroke: selectionId === COOP_SAVE_SELECTION_NEW ? 0x8bffd7 : 0x7d8ea1,
        selectedFill: selectionId === COOP_SAVE_SELECTION_NEW ? 0x3d8f6a : 0x365d84,
        selectedStroke: 0xffebb0,
        onClick: () => this.setSelectedSaveSelection(selectionId)
      });
      return { selectionId, button };
    });

    this.saveSummaryText = this.add.text(layout.panelCenterX, layout.saveSummaryY, "", {
      fontFamily: "Consolas",
      fontSize: "14px",
      color: "#cfe7ff",
      align: "center",
      wordWrap: { width: layout.saveSummaryWidth }
    }).setOrigin(0.5);

    this.inviteSlotButtons = ["P2", "P3", "P4"].map((slotKey: string, index: number) => {
      const button = createCoopSaveButton(this, {
        x: layout.inviteSlotRowLeft + index * (layout.inviteSlotButtonWidth + layout.inviteSlotButtonGap) + layout.inviteSlotButtonWidth * 0.5,
        y: layout.inviteSlotsY,
        width: layout.inviteSlotButtonWidth,
        height: layout.inviteSlotButtonHeight,
        label: slotKey,
        fill: 0x26435d,
        stroke: 0xa5d7ff,
        emptyFill: 0x29313d,
        emptyStroke: 0x7d8ea1,
        selectedFill: 0x365d84,
        selectedStroke: 0xffebb0,
        onClick: () => {
          this.selectedInviteSlot = slotKey;
          this.refreshInviteSlotButtons();
          this.refreshActionButtons();
        }
      });
      return { slotKey, button };
    });

    guidePanels.forEach((panel: { title: string; body: string }, index: number) => {
      const panelX = layout.panelCenterX + (index === 0 ? -layout.guidePanelOffset : layout.guidePanelOffset);
      this.add.rectangle(panelX, layout.guidePanelY, layout.guidePanelWidth, layout.guidePanelHeight, 0x183046, 0.96)
        .setStrokeStyle(2, index === 0 ? 0x8bffd7 : 0x9cd0ff, 0.7);
      this.add.text(panelX, layout.guideTitleTopY, panel.title, {
        fontFamily: "Consolas",
        fontSize: "17px",
        color: "#ffeab0",
        align: "center"
      }).setOrigin(0.5, 0);
      this.add.text(panelX, layout.guideBodyTopY, panel.body, {
        fontFamily: "Consolas",
        fontSize: "14px",
        color: "#ccecff",
        align: "center",
        lineSpacing: 3,
        wordWrap: { width: layout.guidePanelWidth - 36 }
      }).setOrigin(0.5, 0);
    });

    this.createRoomButton = createMenuButton(this, width * 0.5 - 190, layout.actionButtonY, 220, 54, t("coopLobby.createRoom"), () => {
      void this.handleCreateRoom();
    }, 0x2f8f6f, 0x8bffd7);

    this.joinRoomButton = createMenuButton(this, width * 0.5 + 190, layout.actionButtonY, 220, 54, t("coopLobby.joinRoom"), () => {
      void this.handleJoinRoom();
    }, 0x284b78, 0x9cd0ff);

    this.readyButton = createMenuButton(this, width * 0.5 - 118, layout.readyButtonY, 220, 50, t("coopLobby.ready"), () => {
      void this.handleToggleReady();
    }, 0x2b5874, 0x9cd0ff);
    this.readyButton.setEnabled(false);

    createMenuButton(this, width * 0.5 + 118, layout.backButtonY, 220, 50, t("ui.back"), () => {
      this.goBackToMenu();
    }, 0x3b4e66, 0xb6d3ff);

    this.statusText = this.add.text(layout.panelCenterX, layout.statusTextY, "", {
      fontFamily: "Consolas",
      fontSize: "16px",
      color: "#ccecff",
      align: "center",
      lineSpacing: 4,
      wordWrap: { width: layout.statusTextWidth }
    }).setOrigin(0.5);

    this.refreshDifficultyText();
    this.refreshRoomCodeField();
    this.refreshSaveSelectionUi();
    this.refreshInviteSlotButtons();
    this.setStatus(t("coopLobby.status.offlinePrompt"));
    this.installInputHandlers();
    this.bindClient();
    this.bindLocalSignalRelay();
    this.events.once("shutdown", () => this.shutdown());
    this.events.once("destroy", () => this.shutdown());
  }

  installInputHandlers(): void {
    this._keyDownHandler = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        this.goBackToMenu();
        return;
      }
      if (event.key === "Enter") {
        void this.handleJoinRoom();
      }
    };
    this.input.keyboard?.on("keydown", this._keyDownHandler);
  }

  openSignalPrompt(mode: SignalMode = "offer"): string | false {
    const nativePromptHost = globalThis?.window ?? globalThis;
    const promptHandler = typeof this.requestTextPrompt === "function"
      ? this.requestTextPrompt.bind(this)
      : (typeof nativePromptHost?.prompt === "function" ? nativePromptHost.prompt.bind(nativePromptHost) : null);
    if (typeof promptHandler !== "function") return false;

    const promptKey = mode === "answer" ? "coopLobby.answerPrompt" : "coopLobby.offerPrompt";
    const nextValue = promptHandler(t(promptKey), "");
    if (nextValue === null) {
      this.refreshRoomCodeField();
      return false;
    }

    const normalized = String(nextValue ?? "").trim();
    return normalized || false;
  }

  openManualCopyPrompt(value: unknown): boolean {
    const promptHandler = typeof this.requestTextPrompt === "function"
      ? this.requestTextPrompt.bind(this)
      : openManualCopyPrompt;
    const promptKey = this.activeSignalMode === "answer"
      ? "coopLobby.copyAnswerManualPrompt"
      : (this.activeSignalMode === "offer"
        ? "coopLobby.copyOfferManualPrompt"
        : "coopLobby.copyRoomCodeManualPrompt");
    return promptHandler(t(promptKey), String(value ?? "")) !== false;
  }

  handleRoomCodeFieldPointerDown(): boolean {
    this.focusedInput = "signal";
    this.refreshRoomCodeField();
    if (this.activeSignalText) {
      void this.handleCopyRoomCode();
      return false;
    }
    void this.handleJoinRoom();
    return true;
  }

  refreshLocalSaveEntries(): void {
    this.coopSaveEntries = loadCoopSaveSlots(undefined);
  }

  setSelectedSaveSelection(selectionId: CoopSaveSelectionId): void {
    if (!COOP_SAVE_SELECTION_IDS.includes(selectionId)) return;
    this.selectedSaveSelectionId = selectionId;
    const config = this.getCurrentSaveSelectionConfig();
    this.pendingResumeState = config.resumeState;
    this.pendingResumeSummary = config.resumeSummary;
    this.pendingActiveSaveSlotId = config.activeSaveSlotId;
    this.pendingSaveMode = config.saveMode;
    this.refreshSaveSelectionUi();
  }

  getCurrentSaveSelectionConfig(): {
    selectionId: CoopSaveSelectionId;
    activeSaveSlotId: CoopSaveSlotId;
    saveMode: SaveMode;
    resumeState: unknown;
    resumeSummary: CoopSaveSummary | null;
    entry: CoopSaveEntry | null;
  } {
    return resolveCoopSaveSelection(this.selectedSaveSelectionId);
  }

  refreshDifficultyText(): void {
    const modeConfig = getGameModeConfig(this.selectedMode);
    const subtitle = isPvpGameMode(this.selectedMode)
      ? `${modeConfig?.nameEn ?? modeConfig?.name ?? this.selectedMode} • ${resolveRequiredPlayerCapacity(this)} người`
      : formatDifficultyLabel(this.aiMode);
    this.difficultyText?.setText(subtitle);
  }

  getDisplayedResumeSummary(): CoopSaveSummaryLineInput {
    if (this.currentRoomState?.resumeSummary) {
      const roomState = this.currentRoomState;
      return {
        summary: roomState.resumeSummary,
        selectionId: roomState.saveSlotId ?? COOP_SAVE_SLOT_AUTO,
        roomActive: true,
        roomSaveMode: roomState.saveMode === "resume" ? "resume" : "new"
      };
    }
    const config = this.getCurrentSaveSelectionConfig();
    return {
      summary: config.resumeSummary,
      selectionId: this.selectedSaveSelectionId,
      roomActive: false,
      roomSaveMode: config.saveMode
    };
  }

  refreshSaveSelectionUi(): void {
    this.refreshLocalSaveEntries();
    this.saveSelectionButtons.forEach(({ selectionId, button }: { selectionId: CoopSaveSelectionId; button: CoopSaveButton }) => {
      const occupied = selectionId !== COOP_SAVE_SELECTION_NEW && !!this.coopSaveEntries?.[selectionId];
      button.setLabel(getCoopSaveSelectionLabel(selectionId));
      button.setState({
        selected: this.selectedSaveSelectionId === selectionId,
        occupied
      });
    });
    const display = this.getDisplayedResumeSummary();
    this.saveSummaryText?.setText(buildCoopSaveSummaryLine(display));
  }

  getInviteSlotKeys(): string[] {
    const requiredCapacity = resolveRequiredPlayerCapacity(this);
    return getCoopPlayerSlots(requiredCapacity >= 4 ? "COOP4_MEDIUM" : "COOP_MEDIUM")
      .filter((slotKey: string) => slotKey !== "P1");
  }

  isInviteSlotConnected(slotKey: string): boolean {
    return this.isInviteSlotConnectedInPayload(this.currentRoomState, slotKey);
  }

  isInviteSlotConnectedInPayload(payload: RoomState | null, slotKey: string): boolean {
    const normalizedSlot = slotIndexToKey(slotKeyToIndex(slotKey, 1));
    const players = Array.isArray(payload?.players) ? payload.players : [];
    return players.some((player: RoomPlayer) => slotIndexToKey(player?.slotIndex) === normalizedSlot);
  }

  hasPendingHostOffer(slotKey: string | null = this.activeSignalSlot): boolean {
    if (this.lobbyRole !== "host" || this.activeSignalMode !== "offer" || !this.activeSignalText) {
      return false;
    }
    if (!slotKey) return true;
    return slotIndexToKey(slotKeyToIndex(this.activeSignalSlot, 1)) === slotIndexToKey(slotKeyToIndex(slotKey, 1));
  }

  hasPendingGuestAnswer(): boolean {
    return this.lobbyRole === "guest" && this.activeSignalMode === "answer" && Boolean(this.activeSignalText);
  }

  hasLocalAuthoritativePlayer(payload: RoomState | null = this.currentRoomState): boolean {
    const players = Array.isArray(payload?.players) ? payload.players : [];
    if (!this.localPlayerId) return false;
    return players.some((player: RoomPlayer) => player?.playerId === this.localPlayerId);
  }

  hasAuthoritativeConnection(payload: RoomState | null = this.currentRoomState): boolean {
    const players = Array.isArray(payload?.players) ? payload.players : [];
    if (!players.length) return false;
    if (this.localPlayerId && this.hasLocalAuthoritativePlayer(payload)) {
      return players.some((player: RoomPlayer) => player?.playerId !== this.localPlayerId);
    }
    return players.length > 1;
  }

  shouldClearActiveSignalForPayload(payload: RoomState | null = this.currentRoomState): boolean {
    if (this.hasPendingHostOffer()) {
      return this.isInviteSlotConnectedInPayload(payload, this.activeSignalSlot ?? this.selectedInviteSlot ?? "P2");
    }
    if (this.hasPendingGuestAnswer()) {
      return this.hasLocalAuthoritativePlayer(payload) && this.hasAuthoritativeConnection(payload);
    }
    return false;
  }

  bindLocalSignalRelay(): void {
    this.localSignalRelay?.close?.();
    this.localSignalRelay = createCoopLocalSignalRelay({
      channelFactory: this.localSignalChannelFactory,
      onMessage: (message: LocalSignalMessage) => {
        void this.handleLocalSignalMessage(message);
      }
    });
  }

  publishLocalAnswerSignal({ answerText = "", sessionId = "", roomCode = "", targetSlot = "" }: { answerText?: string; sessionId?: string; roomCode?: string; targetSlot?: string } = {}): void {
    const normalizedAnswer = String(answerText ?? "").trim();
    if (!normalizedAnswer) return;
    this.localSignalRelay?.post?.({
      kind: "answer",
      answerText: normalizedAnswer,
      sessionId: typeof sessionId === "string" ? sessionId.trim() : "",
      roomCode: formatCoopConnectionLabel(roomCode ?? this.roomCode ?? ""),
      targetSlot: slotIndexToKey(slotKeyToIndex(targetSlot, 1))
    });
  }

  async handleLocalSignalMessage(message: LocalSignalMessage): Promise<void> {
    if (!message || message.kind !== "answer") return;
    if (this.lobbyRole !== "host" || this._localSignalAutoApplyInFlight) return;

    const targetSlot = slotIndexToKey(slotKeyToIndex(message.targetSlot ?? this.activeSignalSlot, 1));
    const answerText = String(message.answerText ?? "").trim();
    const normalizedRoomCode = formatCoopConnectionLabel(message.roomCode ?? "");
    const expectedRoomCode = formatCoopConnectionLabel(this.roomCode ?? this.currentRoomState?.roomCode ?? "");
    const expectedSessionId = typeof this.client?.sessionId === "string" ? this.client.sessionId.trim() : "";
    const incomingSessionId = typeof message.sessionId === "string" ? message.sessionId.trim() : "";

    if (!this.hasPendingHostOffer(targetSlot) || !answerText) return;
    if (normalizedRoomCode && expectedRoomCode && normalizedRoomCode !== expectedRoomCode) return;
    if (incomingSessionId && expectedSessionId && incomingSessionId !== expectedSessionId) return;

    this._localSignalAutoApplyInFlight = true;
    this.lastConnectionErrorMessage = "";
    this.setPendingLobbyAction("join");
    this.setStatus(t("coopLobby.status.applyingAnswer"));

    try {
      await this.client?.applyAnswerForSlot(targetSlot, answerText);
      this.setPendingLobbyAction(null);
    } catch (error) {
      const normalizedMessage = normalizeCoopConnectionErrorMessage(error);
      this.lastConnectionErrorMessage = normalizedMessage;
      this.setPendingLobbyAction(null);
      this.setStatus(t("coopLobby.status.error", { message: normalizedMessage }));
    } finally {
      this._localSignalAutoApplyInFlight = false;
    }
  }

  refreshInviteSlotButtons(): void {
    const visibleSlots = new Set(this.getInviteSlotKeys());
    if (!visibleSlots.has(this.selectedInviteSlot)) {
      this.selectedInviteSlot = this.getInviteSlotKeys()[0] ?? "P2";
    }
    this.inviteSlotButtons.forEach(({ slotKey, button }: { slotKey: string; button: CoopSaveButton }) => {
      const visible = visibleSlots.has(slotKey);
      button.bg.setVisible(visible);
      button.text.setVisible(visible);
      if (!visible) return;
      button.setState({
        selected: this.selectedInviteSlot === slotKey,
        occupied: this.isInviteSlotConnected(slotKey) || (
          this.activeSignalMode === "offer"
          && this.activeSignalSlot === slotKey
          && Boolean(this.activeSignalText)
        )
      });
    });
  }

  getSignalUiState(): { joinLabelKey: string; copyLabelKey: string; hintKey: string } {
    if (this.hasPendingHostOffer()) {
      return {
        joinLabelKey: "coopLobby.applyAnswer",
        copyLabelKey: "coopLobby.copyOffer",
        hintKey: "coopLobby.roomCodeHintAnswer"
      };
    }
    if (this.hasPendingGuestAnswer()) {
      return {
        joinLabelKey: "coopLobby.replaceOffer",
        copyLabelKey: "coopLobby.copyAnswer",
        hintKey: "coopLobby.roomCodeHintGuestAnswer"
      };
    }
    return {
      joinLabelKey: "coopLobby.joinRoom",
      copyLabelKey: "coopLobby.copyRoomCode",
      hintKey: "coopLobby.roomCodeHint"
    };
  }

  getDisplayFieldText(): string {
    const label = formatCoopConnectionLabel(this.currentRoomState?.roomCode ?? this.roomCode ?? "");
    if (this.hasPendingGuestAnswer()) {
      return label
        ? `${label} • ${this.activeSignalSlot ?? "P2"} • ${t("coopLobby.field.answerReady")}`
        : t("coopLobby.field.answerReady");
    }
    if (this.hasPendingHostOffer()) {
      return label
        ? `${label} • ${this.activeSignalSlot ?? "P2"} • ${t("coopLobby.field.offerReady")}`
        : t("coopLobby.field.offerReady");
    }
    if (this.hasAuthoritativeConnection()) {
      return label
        ? `${label} • ${t("coopLobby.field.connected")}`
        : t("coopLobby.field.connected");
    }
    if (this.lobbyRole === "host" && label) {
      return `${label} • ${t("coopLobby.field.awaitingAnswer")}`;
    }
    return t("coopLobby.field.awaitingOffer");
  }

  upsertRoomPlayer(slotKey: string, playerId: unknown, ready = false): RoomPlayer[] {
    const normalizedSlotIndex = slotKeyToIndex(slotKey, 0);
    const players = Array.isArray(this.currentRoomState?.players)
      ? this.currentRoomState.players.map((player: RoomPlayer) => ({ ...player }))
      : [];
    const existingIndex = players.findIndex((player: RoomPlayer) => player?.slotIndex === normalizedSlotIndex);
    const nextPlayer: RoomPlayer = {
      slotIndex: normalizedSlotIndex,
      playerId: typeof playerId === "string" && playerId ? playerId : `slot_${slotKey}`,
      ready: !!ready
    };
    if (existingIndex >= 0) {
      players[existingIndex] = {
        ...players[existingIndex],
        ...nextPlayer
      };
    } else {
      players.push(nextPlayer);
    }
    players.sort((left: RoomPlayer, right: RoomPlayer) => (left?.slotIndex ?? 99) - (right?.slotIndex ?? 99));
    return players;
  }

  removeRoomPlayer(slotKey: string): RoomPlayer[] {
    const normalizedSlotIndex = slotKeyToIndex(slotKey, 0);
    const players = Array.isArray(this.currentRoomState?.players)
      ? this.currentRoomState.players.filter((player: RoomPlayer) => player?.slotIndex !== normalizedSlotIndex)
      : [];
    return players;
  }

  buildHostRoomStatePayload({ includeResumeState = false }: { includeResumeState?: boolean } = {}): RoomState {
    const payload: RoomState = {
      roomCode: formatCoopConnectionLabel(this.roomCode),
      requiredCapacity: this.getRequiredPlayerCapacity(),
      hostSlotIndex: 0,
      aiMode: this.aiMode,
      selectedMode: this.selectedMode,
      saveSlotId: this.pendingActiveSaveSlotId,
      saveMode: this.pendingSaveMode,
      resumeSummary: this.pendingResumeSummary,
      players: this.upsertRoomPlayer("P1", this.localPlayerId, this.localReady)
    };
    if (includeResumeState && this.pendingResumeState) {
      payload.resumeState = this.pendingResumeState;
    }
    return payload;
  }

  applyRoomStatePayload(payload: RoomState | null, { broadcast = false, prefix = "" }: { broadcast?: boolean; prefix?: string } = {}): void {
    this.currentRoomState = payload ? JSON.parse(JSON.stringify(payload)) as RoomState : null;
    this.roomCode = formatCoopConnectionLabel(payload?.roomCode ?? this.roomCode);
    if (typeof payload?.selectedMode === "string" && payload.selectedMode) {
      this.selectedMode = payload.selectedMode;
    }
    if (typeof payload?.aiMode === "string" && payload.aiMode) {
      this.aiMode = payload.aiMode;
    }
    this.pendingActiveSaveSlotId = typeof payload?.saveSlotId === "string"
      ? payload.saveSlotId
      : this.pendingActiveSaveSlotId;
    this.pendingSaveMode = payload?.saveMode === "resume" || payload?.saveMode === "new"
      ? payload.saveMode
      : this.pendingSaveMode;
    this.pendingResumeSummary = payload?.resumeSummary ?? this.pendingResumeSummary;
    if (payload?.resumeState && typeof payload.resumeState === "object") {
      this.pendingResumeState = payload.resumeState;
    }
    this.connected = this.hasAuthoritativeConnection(payload);
    this.localReady = this.resolveLocalReadyFromState();
    if (this.shouldClearActiveSignalForPayload(payload)) {
      this.activeSignalMode = null;
      this.activeSignalText = "";
    }

    updateCoopSession({
      client: this.client,
      roomCode: this.roomCode,
      playerId: this.localPlayerId,
      playerCapacity: this.getRequiredPlayerCapacity(),
      localSlot: this.resolveLocalSlotFromState(),
      hostSlot: slotIndexToKey(payload?.hostSlotIndex),
      aiMode: this.aiMode,
      selectedMode: this.selectedMode,
      readyBySlot: this.resolveReadyBySlotFromState(),
      roomPlayers: Array.isArray(payload?.players) ? payload.players.map((player: RoomPlayer) => ({ ...player })) : [],
      sessionType: COOP_SESSION_TYPES.P2P_HOST_RELAY,
      activeSaveSlotId: this.pendingActiveSaveSlotId,
      saveMode: this.pendingSaveMode,
      resumeSummary: this.pendingResumeSummary,
      resumeState: this.pendingResumeState
    });

    if (broadcast && this.lobbyRole === "host") {
      try {
        this.client?.send({
          type: COOP_MESSAGE_TYPES.ROOM_STATE,
          payload: this.pendingSaveMode === "resume"
            ? { ...payload, resumeState: this.pendingResumeState }
            : payload
        });
      } catch (error) {
        console.warn("[CoopLobbyScene] Failed to broadcast room state.", error);
      }
    }

    this.refreshDifficultyText();
    this.refreshSaveSelectionUi();
    this.refreshInviteSlotButtons();
    this.refreshRoomCodeField();
    this.refreshActionButtons();
    this.refreshStatusFromState(prefix);
    this.maybeStartPlanningScene();
  }

  hasAuthoritativeRoom(): boolean {
    return Boolean(formatCoopConnectionLabel(this.currentRoomState?.roomCode ?? this.roomCode ?? ""));
  }

  setPendingLobbyAction(action: unknown = null): void {
    this.pendingLobbyAction = typeof action === "string" && action.trim()
      ? action as PendingLobbyAction
      : null;
    this.refreshActionButtons();
  }

  refreshActionButtons(): void {
    const signalUi = this.getSignalUiState();
    const selectedSlotConnected = this.isInviteSlotConnected(this.selectedInviteSlot);
    const canGenerateOffer = this.lobbyRole === "host"
      ? !selectedSlotConnected
      : !this.currentRoomState?.roomCode;
    const canPromptSignal = this.lobbyRole === "host"
      ? Boolean(this.activeSignalText && this.activeSignalMode === "offer" && this.activeSignalSlot === this.selectedInviteSlot)
      : !this.currentRoomState?.roomCode;
    this.createRoomButton?.setEnabled(this.pendingLobbyAction !== "create" && canGenerateOffer);
    this.joinRoomButton?.setEnabled(this.pendingLobbyAction !== "join" && canPromptSignal);
    this.readyButton?.setEnabled(Boolean(this.currentRoomState?.roomCode) && this.pendingLobbyAction !== "ready");
    this.joinRoomButton?.setLabel(t(signalUi.joinLabelKey));
    this.copyRoomButton?.setLabel(t(signalUi.copyLabelKey));
    this.roomCodeHintText?.setText(t(signalUi.hintKey));
  }

  markLobbyConnected(): void {
    this.connected = true;
    this.lastConnectionErrorMessage = "";
  }

  bindClient(): void {
    const client = new CoopP2PTransport();
    this.client = client;
    this._unsubscribeFns = [
      client.on("open", (rawPayload: unknown) => {
        const payload = asTransportPayload(rawPayload);
        if (this.lobbyRole === "host") {
          const slotKey = typeof payload?.slot === "string" ? payload.slot : this.activeSignalSlot ?? this.selectedInviteSlot;
          this.currentRoomState = {
            ...(this.currentRoomState ?? this.buildHostRoomStatePayload()),
            players: this.upsertRoomPlayer(slotKey, payload?.remotePeerId ?? payload?.sourcePeerId ?? `slot_${slotKey}`, false)
          };
          if (this.activeSignalSlot === slotKey) {
            this.activeSignalText = "";
            this.activeSignalMode = null;
          }
          this.markLobbyConnected();
          this.applyRoomStatePayload(this.buildHostRoomStatePayload({
            includeResumeState: this.pendingSaveMode === "resume"
          }), {
            broadcast: true,
            prefix: t("coopLobby.status.directConnected")
          });
          return;
        }
        this.markLobbyConnected();
        this.refreshStatusFromState(t("coopLobby.status.directConnected"));
      }),
      client.on("message", () => {
        if (this.lobbyRole !== "host") {
          this.markLobbyConnected();
        }
      }),
      client.on("close", () => {
        const hadActiveRoom = Boolean(this.currentRoomState?.roomCode ?? this.roomCode ?? this.activeSignalText);
        const preservedErrorMessage = this.lastConnectionErrorMessage;
        this.connected = false;
        this.localReady = false;
        this.currentRoomState = null;
        this.lobbyRole = null;
        this.activeSignalMode = null;
        this.activeSignalText = "";
        this.setPendingLobbyAction(null);
        this.refreshSaveSelectionUi();
        this.refreshInviteSlotButtons();
        if (preservedErrorMessage && !hadActiveRoom) {
          this.setStatus(t("coopLobby.status.error", { message: preservedErrorMessage }));
          return;
        }
        this.setStatus(t("coopLobby.status.disconnected"));
      }),
      client.on("error", (error: unknown) => {
        const message = normalizeCoopConnectionErrorMessage(error);
        this.lastConnectionErrorMessage = message;
        this.setPendingLobbyAction(null);
        this.setStatus(t("coopLobby.status.error", { message }));
      }),
      client.on(COOP_MESSAGE_TYPES.ROOM_STATE, (value: unknown) => {
        const payload = asRoomState(value);
        this.markLobbyConnected();
        this.applyRoomStatePayload(payload);
      }),
      client.on(COOP_MESSAGE_TYPES.PLAYER_READY, (value: unknown) => {
        const payload = asTransportPayload(value);
        if (this.lobbyRole !== "host") return;
        const slotKey = typeof payload?.sourceSlot === "string"
          ? payload.sourceSlot
          : slotIndexToKey(payload?.slotIndex);
        this.currentRoomState = {
          ...(this.currentRoomState ?? this.buildHostRoomStatePayload()),
          players: this.upsertRoomPlayer(
            slotKey,
            payload?.playerId ?? payload?.sourcePeerId ?? `slot_${slotKey}`,
            payload?.ready === true
          )
        };
        this.applyRoomStatePayload(this.buildHostRoomStatePayload({
          includeResumeState: this.pendingSaveMode === "resume"
        }), {
          broadcast: true,
          prefix: t("coopLobby.status.readyUpdated")
        });
      }),
      client.on(COOP_MESSAGE_TYPES.PLAYER_DISCONNECTED, (value: unknown) => {
        const payload = asTransportPayload(value);
        this._planningLaunchRequested = false;
        this.setPendingLobbyAction(null);
        if (this.lobbyRole === "host") {
          const slotKey = typeof payload?.slot === "string"
            ? payload.slot
            : (typeof payload?.sourceSlot === "string" ? payload.sourceSlot : this.selectedInviteSlot);
          this.currentRoomState = {
            ...(this.currentRoomState ?? this.buildHostRoomStatePayload()),
            players: this.removeRoomPlayer(slotKey)
          };
          if (this.activeSignalSlot === slotKey) {
            this.activeSignalText = "";
            this.activeSignalMode = null;
          }
          this.applyRoomStatePayload(this.buildHostRoomStatePayload({
            includeResumeState: this.pendingSaveMode === "resume"
          }), {
            broadcast: true,
            prefix: t("coopLobby.status.playerDisconnected")
          });
          return;
        }
        this.connected = false;
        this.currentRoomState = null;
        this.activeSignalMode = null;
        this.activeSignalText = "";
        this.refreshSaveSelectionUi();
        this.refreshInviteSlotButtons();
        this.refreshStatusFromState(t("coopLobby.status.playerDisconnected"));
      }),
      client.on(COOP_MESSAGE_TYPES.PLANNING_INTENT, () => {
        this.refreshStatusFromState(t("coopLobby.status.planningIntent"));
      }),
      client.on(COOP_MESSAGE_TYPES.AUTHORITATIVE_SNAPSHOT, () => {
        this.refreshStatusFromState(t("coopLobby.status.authoritativeSnapshot"));
      }),
      client.on(COOP_MESSAGE_TYPES.COMBAT_START, () => {
        this.refreshStatusFromState(t("coopLobby.status.combatStart"));
      }),
      client.on(COOP_MESSAGE_TYPES.COMBAT_RESULT, () => {
        this.refreshStatusFromState(t("coopLobby.status.combatResult"));
      })
    ];
  }

  resolveLocalReadyFromState(): boolean {
    const players = this.currentRoomState?.players;
    if (!Array.isArray(players)) return this.localReady;
    const localPlayer = players.find((player: RoomPlayer) => player?.playerId === this.localPlayerId);
    return localPlayer ? !!localPlayer.ready : this.localReady;
  }

  resolveLocalSlotFromState(): string {
    const players = Array.isArray(this.currentRoomState?.players) ? this.currentRoomState.players : [];
    const localPlayer = players.find((player: RoomPlayer) => player?.playerId === this.localPlayerId);
    return slotIndexToKey(localPlayer?.slotIndex);
  }

  getRequiredPlayerCapacity(): number {
    const configuredCapacity = this.requiredPlayerCapacity;
    if (Number.isInteger(configuredCapacity) && configuredCapacity !== null && configuredCapacity > 1) {
      return Math.max(2, Math.min(4, configuredCapacity));
    }
    const fromState = Number.isInteger(this.currentRoomState?.requiredCapacity)
      ? this.currentRoomState!.requiredCapacity
      : null;
    if (fromState) return Math.max(2, Math.min(4, fromState));
    return getRequiredPlayerCapacityForGameMode(this.selectedMode, this.aiMode) || getCoopPlayerCapacity(this.aiMode);
  }

  resolveReadyBySlotFromState(): Record<string, boolean> {
    const requiredCapacity = resolveRequiredPlayerCapacity(this);
    const readyBySlot: Record<string, boolean> = {};
    getCoopPlayerSlots(requiredCapacity >= 4 ? "COOP4_MEDIUM" : "COOP_MEDIUM").forEach((slot: string) => {
      readyBySlot[slot] = false;
    });
    const players = Array.isArray(this.currentRoomState?.players) ? this.currentRoomState.players : [];
    players.forEach((player: RoomPlayer) => {
      readyBySlot[slotIndexToKey(player?.slotIndex)] = !!player?.ready;
    });
    return readyBySlot;
  }

  maybeStartPlanningScene(): void {
    if (this._planningLaunchRequested) return;
    const requiredCapacity = typeof this.getRequiredPlayerCapacity === "function"
      ? this.getRequiredPlayerCapacity()
      : CoopLobbyScene.prototype.getRequiredPlayerCapacity.call(this);
    const players = Array.isArray(this.currentRoomState?.players) ? this.currentRoomState.players : [];
    if (players.length < requiredCapacity) return;
    if (players.some((player: RoomPlayer) => !player?.ready)) return;
    const localSlot = this.resolveLocalSlotFromState();
    const readyBySlot = this.resolveReadyBySlotFromState();
    const restoredState = this.pendingResumeState && typeof this.pendingResumeState === "object"
      ? this.pendingResumeState
      : null;
    this._planningLaunchRequested = true;
    createCoopSession({
      client: this.client,
      roomCode: formatCoopConnectionLabel(this.currentRoomState?.roomCode ?? this.roomCode),
      playerId: this.localPlayerId,
      playerCapacity: requiredCapacity,
      localSlot,
      hostSlot: slotIndexToKey(this.currentRoomState?.hostSlotIndex),
      aiMode: this.aiMode,
      selectedMode: this.selectedMode,
      readyBySlot,
      roomPlayers: Array.isArray(this.currentRoomState?.players)
        ? this.currentRoomState.players.map((player: RoomPlayer) => ({ ...player }))
        : [],
      sessionType: COOP_SESSION_TYPES.P2P_HOST_RELAY,
      activeSaveSlotId: typeof this.currentRoomState?.saveSlotId === "string"
        ? this.currentRoomState.saveSlotId
        : this.pendingActiveSaveSlotId,
      saveMode: typeof this.currentRoomState?.saveMode === "string"
        ? this.currentRoomState.saveMode
        : this.pendingSaveMode,
      resumeSummary: this.currentRoomState?.resumeSummary ?? this.pendingResumeSummary,
      resumeState: restoredState
    });
    this.client = null;
    if (restoredState) {
      startManagedScene(this, "PlanningScene", {
        settings: {
          ...this.settings,
          aiMode: this.aiMode
        },
        mode: this.selectedMode,
        aiMode: this.aiMode,
        coopSession: true,
        restoredState
      });
      return;
    }
    startManagedScene(this, "PlanningScene", {
      settings: {
        ...this.settings,
        aiMode: this.aiMode
      },
      mode: this.selectedMode,
      aiMode: this.aiMode,
      forceNewRun: true,
      coopSession: true
    });
  }

  refreshRoomCodeField(): void {
    const copyValue = this.activeSignalText || formatCoopConnectionLabel(this.currentRoomState?.roomCode ?? this.roomCode ?? "");
    this.roomCodeValueText?.setText(this.getDisplayFieldText());
    this.roomCodeZone?.setStrokeStyle(2, this.focusedInput === "signal" ? 0x75ffd4 : 0x8fc7ff, 1);
    this.copyRoomButton?.setEnabled(Boolean(copyValue));
  }

  setStatus(message: string): void {
    this.statusText?.setText(message);
    this.readyButton?.setLabel(this.localReady ? t("coopLobby.unready") : t("coopLobby.ready"));
    this.refreshActionButtons?.();
  }

  refreshStatusFromState(prefix = ""): void {
    const roomCode = this.currentRoomState?.roomCode ?? this.roomCode ?? "-";
    const players = Array.isArray(this.currentRoomState?.players) ? this.currentRoomState.players : [];
    const requiredCapacity = resolveRequiredPlayerCapacity(this);
    const readyCount = players.filter((player: RoomPlayer) => player?.ready).length;
    const occupancy = `${players.length}/${requiredCapacity}`;
    const waiting = players.length < requiredCapacity
      ? t("coopLobby.status.waitingForTeammate")
      : readyCount < requiredCapacity
        ? t("coopLobby.status.waitingForReady")
        : t("coopLobby.status.allReady");
    const lines: string[] = [];
    if (prefix) lines.push(prefix);
    lines.push(this.connected ? t("coopLobby.status.connected") : t("coopLobby.status.offline"));
    lines.push(t("coopLobby.status.roomLine", { roomCode }));
    lines.push(t("coopLobby.status.slotsLine", { occupancy }));
    lines.push(t("coopLobby.status.readyLine", { readyCount, requiredCount: requiredCapacity }));
    lines.push(waiting);
    this.setStatus(lines.join("\n"));
  }

  async handleCreateRoom(): Promise<void> {
    if (this.pendingLobbyAction === "create") {
      return;
    }
    const requiredCapacity = this.getRequiredPlayerCapacity();
    if (![2, 4].includes(requiredCapacity)) {
      this.setStatus(t("coopLobby.status.modeUnsupported"));
      return;
    }
    const inviteSlot = this.selectedInviteSlot ?? this.getInviteSlotKeys()[0] ?? "P2";
    if (this.lobbyRole === "host" && this.isInviteSlotConnected(inviteSlot)) {
      this.setStatus(t("coopLobby.status.slotConnected", { slot: inviteSlot }));
      return;
    }
    const saveConfig = this.getCurrentSaveSelectionConfig();
    const normalizedResumeStateValue = saveConfig.resumeState
      ? remapCoopResumeStateForHost(saveConfig.resumeState, {
          desiredLocalSlot: "P1",
          desiredHostSlot: "P1"
        })
      : null;
    const normalizedResumeState = asRecord(normalizedResumeStateValue) as ResumeStateView | null;
    const resumeSummary = normalizedResumeState
      ? buildCoopSaveSummary(normalizedResumeState, {
          slotId: saveConfig.activeSaveSlotId,
          savedAt: saveConfig.resumeSummary?.savedAt
        })
      : null;
    const effectiveAiMode = normalizedResumeState?.coopDifficulty ?? normalizedResumeState?.aiMode ?? this.aiMode;
    const effectiveSelectedMode = resumeSummary?.selectedMode ?? this.selectedMode;

    this.pendingResumeState = normalizedResumeState;
    this.pendingResumeSummary = resumeSummary;
    this.pendingActiveSaveSlotId = saveConfig.activeSaveSlotId;
    this.pendingSaveMode = normalizedResumeState ? "resume" : saveConfig.saveMode;
    this.aiMode = effectiveAiMode;
    this.selectedMode = effectiveSelectedMode;
    this.refreshDifficultyText();
    this.refreshSaveSelectionUi();
    this.setPendingLobbyAction("create");
    this.setStatus(t("coopLobby.status.creatingRoom"));
    this.lastConnectionErrorMessage = "";
    try {
      if (this.lobbyRole !== "host" || !this.client?.isHostRole?.()) {
        const room = await this.client!.createRoom({
          requiredCapacity,
          aiMode: effectiveAiMode,
          selectedMode: effectiveSelectedMode,
          saveSlotId: this.pendingActiveSaveSlotId,
          saveMode: this.pendingSaveMode,
          resumeSummary
        });
        this.lobbyRole = "host";
        this.localPlayerId = room.playerId;
        this.roomCode = room.roomCode;
        this.localReady = false;
        this.currentRoomState = {
          roomCode: room.roomCode,
          requiredCapacity,
          hostSlotIndex: 0,
          aiMode: effectiveAiMode,
          selectedMode: effectiveSelectedMode,
          saveSlotId: this.pendingActiveSaveSlotId,
          saveMode: this.pendingSaveMode,
          resumeSummary,
          players: this.upsertRoomPlayer("P1", room.playerId, false)
        };
        this.applyRoomStatePayload(this.buildHostRoomStatePayload({
          includeResumeState: this.pendingSaveMode === "resume"
        }), {
          prefix: t("coopLobby.status.roomCreated")
        });
      }

      const offerText = await this.client!.createOfferForSlot(inviteSlot, {
        requiredCapacity,
        aiMode: effectiveAiMode,
        selectedMode: effectiveSelectedMode,
        saveSlotId: this.pendingActiveSaveSlotId,
        saveMode: this.pendingSaveMode,
        resumeSummary
      });
      this.activeSignalMode = "offer";
      this.activeSignalText = offerText;
      this.activeSignalSlot = inviteSlot;
      this.refreshInviteSlotButtons();
      this.refreshRoomCodeField();
      this.refreshActionButtons();
      this.setStatus(t("coopLobby.status.awaitingDirectPeer", { slot: inviteSlot }));
      this.setPendingLobbyAction(null);
    } catch (error) {
      this.setPendingLobbyAction(null);
      const message = normalizeCoopConnectionErrorMessage(error);
      this.lastConnectionErrorMessage = message;
      this.setStatus(t("coopLobby.status.error", { message }));
    }
  }

  async handleJoinRoom(): Promise<void> {
    if (this.pendingLobbyAction === "join") {
      return;
    }
    if (this.currentRoomState?.roomCode && this.lobbyRole !== "host") {
      this.refreshStatusFromState();
      return;
    }
    const promptMode = this.lobbyRole === "host" && this.activeSignalMode === "offer" && this.activeSignalText
      ? "answer"
      : "offer";
    const signalText = this.openSignalPrompt(promptMode);
    if (!signalText) {
      this.refreshRoomCodeField();
      return;
    }
    this.setPendingLobbyAction("join");
    this.lastConnectionErrorMessage = "";
    try {
      if (promptMode === "answer") {
        await this.client!.applyAnswerForSlot(this.activeSignalSlot ?? this.selectedInviteSlot, signalText);
        this.setPendingLobbyAction(null);
        this.setStatus(t("coopLobby.status.applyingAnswer"));
        return;
      }

      const accepted = await this.client!.acceptOffer(signalText, {
        aiMode: this.aiMode,
        selectedMode: this.selectedMode
      });
      this.lobbyRole = "guest";
      const metadata = asAcceptedOfferMetadata(accepted.metadata);
      this.localPlayerId = accepted.playerId;
      this.roomCode = accepted.roomCode;
      this.localReady = false;
      this.connected = false;
      this.currentRoomState = null;
      this.activeSignalMode = "answer";
      this.activeSignalText = accepted.answerText;
      this.activeSignalSlot = accepted.localSlot ?? "P2";
      this.selectedInviteSlot = accepted.localSlot ?? this.selectedInviteSlot;
      this.selectedMode = typeof metadata.selectedMode === "string"
        ? metadata.selectedMode
        : this.selectedMode;
      this.aiMode = typeof metadata.aiMode === "string"
        ? metadata.aiMode
        : this.aiMode;
      this.pendingActiveSaveSlotId = typeof metadata.saveSlotId === "string"
        ? metadata.saveSlotId
        : COOP_SAVE_SLOT_AUTO;
      this.pendingSaveMode = metadata.saveMode === "resume" || metadata.saveMode === "new"
        ? metadata.saveMode
        : "new";
      this.pendingResumeSummary = metadata.resumeSummary ?? null;
      this.pendingResumeState = null;
      this.refreshDifficultyText();
      this.refreshSaveSelectionUi();
      this.refreshInviteSlotButtons();
      this.refreshRoomCodeField();
      this.refreshActionButtons();
      this.publishLocalAnswerSignal({
        answerText: accepted.answerText,
        sessionId: accepted.sessionId,
        roomCode: accepted.roomCode,
        targetSlot: accepted.localSlot ?? "P2"
      });
      this.setStatus(t("coopLobby.status.answerReadyPending", { slot: this.activeSignalSlot ?? "P2" }));
      this.setPendingLobbyAction(null);
    } catch (error) {
      this.setPendingLobbyAction(null);
      const message = normalizeCoopConnectionErrorMessage(error);
      this.lastConnectionErrorMessage = message;
      this.setStatus(t("coopLobby.status.error", { message }));
    }
  }

  async handleToggleReady(): Promise<void> {
    if (this.pendingLobbyAction === "ready") {
      return;
    }
    const localSlot = this.resolveLocalSlotFromState();
    if (!this.currentRoomState?.roomCode || !localSlot) {
      this.setStatus(t("coopLobby.status.readyBlocked"));
      return;
    }
    const nextReady = !this.localReady;
    this.localReady = nextReady;
    this.setPendingLobbyAction("ready");
    this.setStatus(nextReady ? t("coopLobby.status.sendingReady") : t("coopLobby.status.clearingReady"));
    this.lastConnectionErrorMessage = "";
    try {
      if (this.lobbyRole === "host") {
        this.currentRoomState = {
          ...(this.currentRoomState ?? this.buildHostRoomStatePayload()),
          players: this.upsertRoomPlayer("P1", this.localPlayerId, nextReady)
        };
        this.applyRoomStatePayload(this.buildHostRoomStatePayload({
          includeResumeState: this.pendingSaveMode === "resume"
        }), {
          broadcast: true,
          prefix: t("coopLobby.status.readyUpdated")
        });
        this.setPendingLobbyAction(null);
        return;
      }

      this.client!.send({
        type: COOP_MESSAGE_TYPES.PLAYER_READY,
        payload: {
          ready: nextReady,
          playerId: this.localPlayerId,
          slot: localSlot
        }
      });
      this.setPendingLobbyAction(null);
      this.refreshActionButtons();
    } catch (error) {
      this.setPendingLobbyAction(null);
      const message = normalizeCoopConnectionErrorMessage(error);
      this.lastConnectionErrorMessage = message;
      this.localReady = !nextReady;
      this.setStatus(t("coopLobby.status.error", { message }));
    }
  }

  async handleCopyRoomCode(): Promise<boolean> {
    const copyValue = this.activeSignalText || formatCoopConnectionLabel(this.currentRoomState?.roomCode ?? this.roomCode);
    if (!copyValue) {
      this.refreshStatusFromState(t("coopLobby.status.copyBlocked"));
      return false;
    }

    const copyHandler = typeof this.writeClipboardText === "function"
      ? this.writeClipboardText.bind(this)
      : copyTextToClipboard;

    try {
      await copyHandler(copyValue);
      this.refreshStatusFromState(t("coopLobby.status.copySuccess"));
      return true;
    } catch (error) {
      console.warn("[CoopLobbyScene] Failed to copy coop signal.", error);
      const prompted = this.openManualCopyPrompt(copyValue);
      this.refreshStatusFromState(t(prompted ? "coopLobby.status.copyManual" : "coopLobby.status.copyFailed"));
      return prompted;
    }
  }

  goBackToMenu(): void {
    this._planningLaunchRequested = false;
    this.client?.close(1000, "Leaving coop lobby");
    clearCoopSession();
    this.scene.start("MainMenuScene", {
      openStartPanel: true,
      selectedMode: this.selectedMode
    });
  }

  shutdown(): void {
    if (this._keyDownHandler) {
      this.input.keyboard?.off("keydown", this._keyDownHandler);
      this._keyDownHandler = null;
    }
    if (Array.isArray(this._unsubscribeFns)) {
      this._unsubscribeFns.forEach((unsubscribe: () => void) => unsubscribe?.());
    }
    this._unsubscribeFns = [];
    this.localSignalRelay?.close?.();
    this.localSignalRelay = null;
    this.client?.close();
    this.client = null;
  }
}
