/**
 * ThreeMainMenuSocialDonate.ts
 *
 * Social links (Discord, Facebook, Portal) and VietQR donation modal for Three.js.
 * Provides interactive donation options, QR code generation, and external links.
 */

import { isDiscordActivity, openExternalLink } from "../platform/discordActivity.js";

type AnyObj = Record<string, unknown>;

export const DONATE_QR_ADD_INFO_MESSAGES: readonly string[] = Object.freeze([
  "Game hay toi donate cho ban ne",
  "Tien cafe de phat trien game tiep",
  "Ung ho team lam game vui hon",
  "Cam on ban da choi game nay",
  "Moi ban ly tra sua nha dev",
  "Donate tinh nguyen cho team nhe",
  "Game vui qua ung ho them nhe",
  "Mua ca phe dong vien team dev",
  "Thanks for playing donate nhe",
  "Tien nuoc ung ho lam game tiep",
  "Game ngon ung ho mot ly cafe",
  "Thich game thi moi ban mua tra sua",
  "Ho tro dev lam them mode moi",
  "Cam on ban da ung ho tinh nguyen",
  "Mot ly cafe cho team phat trien"
]);

export function pickRandomDonateQrAddInfo(randomFn: () => number = Math.random): string {
  const safeRandom = typeof randomFn === "function" ? randomFn : Math.random;
  const index = Math.floor(safeRandom() * DONATE_QR_ADD_INFO_MESSAGES.length);
  return DONATE_QR_ADD_INFO_MESSAGES[Math.max(0, Math.min(DONATE_QR_ADD_INFO_MESSAGES.length - 1, index))];
}

export function buildDonateQrUrl(amount: number, addInfo: string = pickRandomDonateQrAddInfo()): string {
  const params = new URLSearchParams({
    accountName: "LUONG QUOC THAI",
    addInfo
  });
  if (amount > 0) params.set("amount", String(Math.round(Number(amount) || 0)));
  return `https://img.vietqr.io/image/tpbank-6039352614-compact2.png?${params.toString()}`;
}

type DonateAmount = {
  label: string;
  value: number;
  color: number;
};

type ButtonState = {
  value: number;
  color: number;
  gfx: AnyObj;
  text: AnyObj;
  updateDisplay: (isSel: boolean, isHover?: boolean) => void;
};

export interface SceneWithButtonFactory {
  scale?: { width: number; height: number };
  add: {
    text: (x: number, y: number, text: string, style?: AnyObj) => AnyObj;
    container: (x?: number, y?: number) => AnyObj;
    rectangle: (x: number, y: number, w: number, h: number, fill: number, alpha?: number) => AnyObj;
    graphics: () => AnyObj;
    image?: (x: number, y: number, key: string) => AnyObj;
  };
  textures?: {
    exists: (key: string) => boolean;
    remove: (key: string) => void;
  };
  tweens?: { add: (config: Record<string, unknown>) => void };
  input?: {
    keyboard?: { on?: (event: string, callback: (...args: unknown[]) => void) => void };
    on?: (event: string, callback: (...args: unknown[]) => void) => void;
  };
  load?: {
    image: (key: string, url: string) => void;
    once: (event: string, callback: (...args: unknown[]) => void) => void;
    start: () => void;
    on: (event: string, callback: (...args: unknown[]) => void) => void;
  };
  createButton?: (
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    onClick: () => void,
    fill: number,
    stroke: number,
    parent?: AnyObj | null
  ) => AnyObj;
}

export function createSocialAndDonate(scene: SceneWithButtonFactory): void {
  const w = scene?.scale?.width ?? 1600;
  const h = scene?.scale?.height ?? 900;

  // --- 1. Social Links (Bottom Left) ---
  const discordBtn = scene.add.text(24, h - 80, "💬 Tham gia Discord", {
    fontFamily: "Consolas",
    fontSize: "15px",
    color: "#ffffff",
    backgroundColor: "#5865F2",
    padding: { x: 10, y: 6 }
  });
  if (typeof discordBtn.setOrigin === "function") discordBtn.setOrigin(0, 1);
  if (typeof discordBtn.setInteractive === "function") discordBtn.setInteractive({ useHandCursor: true });

  if (typeof discordBtn.on === "function") {
    discordBtn.on("pointerdown", () => {
      void openExternalLink("https://discord.gg/YJVZT2v3");
    });
    discordBtn.on("pointerover", () => {
      if (typeof discordBtn.setAlpha === "function") discordBtn.setAlpha(0.8);
    });
    discordBtn.on("pointerout", () => {
      if (typeof discordBtn.setAlpha === "function") discordBtn.setAlpha(1);
    });
  }

  const fbBtn = scene.add.text(24, h - 115, "📘 Theo dõi Facebook", {
    fontFamily: "Consolas",
    fontSize: "15px",
    color: "#ffffff",
    backgroundColor: "#1877F2",
    padding: { x: 10, y: 6 }
  });
  if (typeof fbBtn.setOrigin === "function") fbBtn.setOrigin(0, 1);
  if (typeof fbBtn.setInteractive === "function") fbBtn.setInteractive({ useHandCursor: true });

  if (typeof fbBtn.on === "function") {
    fbBtn.on("pointerdown", () => {
      void openExternalLink("https://www.facebook.com/thai.go.696692/");
    });
    fbBtn.on("pointerover", () => {
      if (typeof fbBtn.setAlpha === "function") fbBtn.setAlpha(0.8);
    });
    fbBtn.on("pointerout", () => {
      if (typeof fbBtn.setAlpha === "function") fbBtn.setAlpha(1);
    });
  }

  const portalBtn = scene.add.text(24, h - 150, "🌐 DevGOVietnam.games", {
    fontFamily: "Consolas",
    fontSize: "15px",
    color: "#ffffff",
    backgroundColor: "#7c3aed",
    padding: { x: 10, y: 6 }
  });
  if (typeof portalBtn.setOrigin === "function") portalBtn.setOrigin(0, 1);
  if (typeof portalBtn.setInteractive === "function") portalBtn.setInteractive({ useHandCursor: true });

  if (typeof portalBtn.on === "function") {
    portalBtn.on("pointerdown", () => {
      void openExternalLink("https://devgovietnam.games");
    });
    portalBtn.on("pointerover", () => {
      if (typeof portalBtn.setAlpha === "function") portalBtn.setAlpha(0.8);
    });
    portalBtn.on("pointerout", () => {
      if (typeof portalBtn.setAlpha === "function") portalBtn.setAlpha(1);
    });
  }

  // --- 2. Donate Panel ---
  const panelW = 540;
  const panelH = 760;

  const donatePanel = scene.add.container(w * 0.5, h * 0.5);
  if (typeof donatePanel.setDepth === "function") donatePanel.setDepth(1000);
  if (typeof donatePanel.setVisible === "function") donatePanel.setVisible(false);

  const overlay = scene.add.rectangle(0, 0, w * 2, h * 2, 0x000000, 0.75);
  if (typeof overlay.setInteractive === "function") overlay.setInteractive();
  if (typeof donatePanel.add === "function") donatePanel.add(overlay);

  const cardBgGroup = scene.add.container(0, 0);
  if (typeof donatePanel.add === "function") donatePanel.add(cardBgGroup);

  const title = scene.add.text(0, -panelH * 0.5 + 40, "Ủng hộ tác giả ❤️", {
    fontFamily: "Trebuchet MS, Consolas, sans-serif",
    fontSize: "32px",
    color: "#f8fafc",
    fontStyle: "bold"
  });
  if (typeof title.setOrigin === "function") title.setOrigin(0.5);
  if (typeof donatePanel.add === "function") donatePanel.add(title);

  const desc = scene.add.text(0, -panelH * 0.5 + 95, "Cảm ơn bạn đã chơi game!\nSự ủng hộ của bạn giúp game phát triển tốt hơn.", {
    fontFamily: "Consolas",
    fontSize: "15px",
    color: "#cbd5e1",
    align: "center",
    lineSpacing: 6
  });
  if (typeof desc.setOrigin === "function") desc.setOrigin(0.5);
  if (typeof donatePanel.add === "function") donatePanel.add(desc);

  const qrContainer = scene.add.container(0, -panelH * 0.5 + 330);
  const qrLoadingText = scene.add.text(0, 0, "Đang tải mã QR...", {
    fontFamily: "Consolas",
    fontSize: "15px",
    color: "#94a3b8"
  });
  if (typeof qrLoadingText.setOrigin === "function") qrLoadingText.setOrigin(0.5);
  if (typeof qrContainer.add === "function") qrContainer.add(qrLoadingText);

  if (typeof donatePanel.add === "function") donatePanel.add(qrContainer);

  const amounts: DonateAmount[] = [
    { label: "5k", value: 5000, color: 0x0ea5e9 },
    { label: "10k", value: 10000, color: 0x0ea5e9 },
    { label: "15k", value: 15000, color: 0x0ea5e9 },
    { label: "20k", value: 20000, color: 0x0ea5e9 },
    { label: "30k", value: 30000, color: 0x6366f1 },
    { label: "50k", value: 50000, color: 0x6366f1 },
    { label: "100k", value: 100000, color: 0x6366f1 },
    { label: "200k", value: 200000, color: 0x6366f1 },
    { label: "500k", value: 500000, color: 0xd97706 },
    { label: "Tùy tâm", value: 0, color: 0xd97706 }
  ];

  let selectedAmount = 20000;
  const amountBtns: ButtonState[] = [];

  const loadQrCode = (amount: number): void => {
    selectedAmount = amount;
    if (isDiscordActivity) {
      if (typeof qrLoadingText.setVisible === "function") qrLoadingText.setVisible(false);
      return;
    }
  };

  const btnGridW = 460;
  const btnCols = 5;
  const btnColW = btnGridW / btnCols;
  const btnH = 34;
  const btnYStart = -panelH * 0.5 + 560;

  amounts.forEach((item, idx) => {
    const col = idx % btnCols;
    const row = Math.floor(idx / btnCols);
    const btnX = -btnGridW * 0.5 + col * btnColW + btnColW * 0.5;
    const btnY = btnYStart + row * 44;

    const btnGfx = scene.add.graphics();
    const btnText = scene.add.text(btnX, btnY, item.label, {
      fontFamily: "Trebuchet MS, Consolas, sans-serif",
      fontSize: "14px",
      color: "#ffffff",
      fontStyle: "bold"
    });
    if (typeof btnText.setOrigin === "function") btnText.setOrigin(0.5);

    const hitArea = scene.add.rectangle(btnX, btnY, btnColW - 8, btnH, 0x000000, 0.001);
    if (typeof hitArea.setInteractive === "function") hitArea.setInteractive({ useHandCursor: true });

    const btnState: ButtonState = {
      value: item.value,
      color: item.color,
      gfx: btnGfx,
      text: btnText,
      updateDisplay: () => {}
    };

    if (typeof hitArea.on === "function") {
      hitArea.on("pointerdown", () => {
        loadQrCode(item.value);
        amountBtns.forEach((b) => b.updateDisplay(b.value === item.value));
      });
    }

    if (typeof donatePanel.add === "function") {
      donatePanel.add(btnGfx);
      donatePanel.add(btnText);
      donatePanel.add(hitArea);
    }
    amountBtns.push(btnState);
  });

  const donateBtn = scene.add.text(w - 24, h - 80, "❤️ Ủng hộ game", {
    fontFamily: "Trebuchet MS, Consolas, sans-serif",
    fontSize: "16px",
    color: "#ffffff",
    backgroundColor: "#e11d48",
    padding: { x: 14, y: 8 },
    fontStyle: "bold"
  });
  if (typeof donateBtn.setOrigin === "function") donateBtn.setOrigin(1, 1);
  if (typeof donateBtn.setInteractive === "function") donateBtn.setInteractive({ useHandCursor: true });

  const openDonateModal = () => {
    if (typeof donatePanel.setVisible === "function") donatePanel.setVisible(true);
    loadQrCode(selectedAmount);
  };

  const closeDonateModal = () => {
    if (typeof donatePanel.setVisible === "function") donatePanel.setVisible(false);
  };

  if (typeof donateBtn.on === "function") {
    donateBtn.on("pointerdown", openDonateModal);
  }

  if (typeof overlay.on === "function") {
    overlay.on("pointerdown", closeDonateModal);
  }
}

export default {
  DONATE_QR_ADD_INFO_MESSAGES,
  pickRandomDonateQrAddInfo,
  buildDonateQrUrl,
  createSocialAndDonate
};
