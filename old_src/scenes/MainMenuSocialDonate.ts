import { isDiscordActivity, openExternalLink } from "../platform/discordActivity.js";

/** Nội dung CK ngẫu nhiên — không dấu, tối đa 50 ký tự (quy ước VietQR Quick Link). */
export const DONATE_QR_ADD_INFO_MESSAGES: readonly string[] = [
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
];

export function pickRandomDonateQrAddInfo(randomFn: () => number = Math.random): string {
  const safeRandom = typeof randomFn === "function" ? randomFn : Math.random;
  const index = Math.floor(safeRandom() * DONATE_QR_ADD_INFO_MESSAGES.length);
  return DONATE_QR_ADD_INFO_MESSAGES[Math.max(0, Math.min(DONATE_QR_ADD_INFO_MESSAGES.length - 1, index))];
}

export function buildDonateQrUrl(amount: number, addInfo: string = pickRandomDonateQrAddInfo()): string {
  const params = new URLSearchParams({
    accountName: "LUONG QUOC THAI",
    addInfo: String(addInfo ?? "").trim().slice(0, 50) || pickRandomDonateQrAddInfo()
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
  gfx: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
  updateDisplay: (isSel: boolean, isHover?: boolean) => void;
};

type SceneWithButtonFactory = Phaser.Scene & {
  createButton: (
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    onClick: () => void,
    fill: number,
    stroke: number,
    parent?: Phaser.GameObjects.Container | null
  ) => Phaser.GameObjects.Container;
  tweens: { add(config: Record<string, unknown>): void };
  input: {
    keyboard?: { on?: (event: string, callback: (...args: unknown[]) => void) => void };
    on?: (event: string, callback: (...args: unknown[]) => void) => void;
  };
  load: {
    image: (key: string, url: string) => void;
    once: (event: string, callback: (...args: unknown[]) => void) => void;
    start: () => void;
    on: (event: string, callback: (...args: unknown[]) => void) => void;
  };
}

export function createSocialAndDonate(scene: SceneWithButtonFactory): void {
  const w = scene.scale.width;
  const h = scene.scale.height;

  // --- 1. Social Links (Bottom Left) ---
  const discordBtn = scene.add.text(24, h - 80, "💬 Tham gia Discord", {
    fontFamily: "Consolas",
    fontSize: "15px",
    color: "#ffffff",
    backgroundColor: "#5865F2",
    padding: { x: 10, y: 6 }
  }).setOrigin(0, 1).setInteractive({ useHandCursor: true });

  discordBtn.on("pointerdown", () => {
    void openExternalLink("https://discord.gg/YJVZT2v3");
  });
  discordBtn.on("pointerover", () => discordBtn.setAlpha(0.8));
  discordBtn.on("pointerout", () => discordBtn.setAlpha(1));

  const fbBtn = scene.add.text(24, h - 115, "📘 Theo dõi Facebook", {
    fontFamily: "Consolas",
    fontSize: "15px",
    color: "#ffffff",
    backgroundColor: "#1877F2",
    padding: { x: 10, y: 6 }
  }).setOrigin(0, 1).setInteractive({ useHandCursor: true });

  fbBtn.on("pointerdown", () => {
    void openExternalLink("https://www.facebook.com/thai.go.696692/");
  });
  fbBtn.on("pointerover", () => fbBtn.setAlpha(0.8));
  fbBtn.on("pointerout", () => fbBtn.setAlpha(1));

  const portalBtn = scene.add.text(24, h - 150, "🌐 DevGOVietnam.games", {
    fontFamily: "Consolas",
    fontSize: "15px",
    color: "#ffffff",
    backgroundColor: "#7c3aed",
    padding: { x: 10, y: 6 }
  }).setOrigin(0, 1).setInteractive({ useHandCursor: true });

  portalBtn.on("pointerdown", () => {
    void openExternalLink("https://devgovietnam.games");
  });
  portalBtn.on("pointerover", () => portalBtn.setAlpha(0.8));
  portalBtn.on("pointerout", () => portalBtn.setAlpha(1));

  // --- 2. Donate Panel (Modern UI) ---
  const panelW = 540;
  const panelH = 760;

  const donatePanel = scene.add.container(w * 0.5, h * 0.5);
  donatePanel.setDepth(1000);
  donatePanel.setVisible(false);

  // Dark overlay background with fade-in effect when shown
  const overlay = scene.add.rectangle(0, 0, w * 2, h * 2, 0x000000, 0.75);
  overlay.setInteractive(); // Block clicks
  donatePanel.add(overlay);

  // Helper function for shadow
  const drawShadow = (graphics: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number, radius: number, alpha: number): void => {
    graphics.fillStyle(0x000000, alpha);
    graphics.fillRoundedRect(x, y, width, height, radius);
  };

  // Main Card Background
  const cardBgGroup = scene.add.container(0, 0);
  donatePanel.add(cardBgGroup);

  // Drop Shadow for Card
  const shadowGfx = scene.add.graphics();
  drawShadow(shadowGfx, -panelW * 0.5 + 4, -panelH * 0.5 + 8, panelW, panelH, 20, 0.4);
  drawShadow(shadowGfx, -panelW * 0.5 + 8, -panelH * 0.5 + 16, panelW, panelH, 20, 0.2);
  cardBgGroup.add(shadowGfx);

  // Dark Navy + Purple Gradient Background
  const bgGfx = scene.add.graphics();
  bgGfx.fillGradientStyle(0x0f172a, 0x0f172a, 0x1e1b4b, 0x1e1b4b, 1, 1, 1, 1); // Dark navy to subtle purple
  bgGfx.fillRoundedRect(-panelW * 0.5, -panelH * 0.5, panelW, panelH, 20);
  // Subtle glow border
  bgGfx.lineStyle(1.5, 0x6366f1, 0.5);
  bgGfx.strokeRoundedRect(-panelW * 0.5, -panelH * 0.5, panelW, panelH, 20);
  cardBgGroup.add(bgGfx);

  // Title
  const title = scene.add.text(0, -panelH * 0.5 + 40, "Ủng hộ tác giả ❤️", {
    fontFamily: "Trebuchet MS, Consolas, sans-serif",
    fontSize: "32px",
    color: "#f8fafc",
    fontStyle: "bold"
  }).setOrigin(0.5);
  donatePanel.add(title);

  // Subtitle
  const desc = scene.add.text(0, -panelH * 0.5 + 95, "Cảm ơn bạn đã chơi game!\nSự ủng hộ của bạn giúp game phát triển tốt hơn.", {
    fontFamily: "Consolas",
    fontSize: "15px",
    color: "#cbd5e1",
    align: "center",
    lineSpacing: 6
  }).setOrigin(0.5);
  donatePanel.add(desc);

  // API-generated QR Card (compact2 template provides a beautiful white card layout out-of-the-box!)
  const qrContainer = scene.add.container(0, -panelH * 0.5 + 330);

  const qrLoadingText = scene.add.text(0, 0, "Đang tải mã QR...", {
    fontFamily: "Consolas",
    fontSize: "15px",
    color: "#94a3b8"
  }).setOrigin(0.5);
  qrContainer.add(qrLoadingText);

  const discordDonateTitle = scene.add.text(0, -24, "Mở mã QR bên ngoài Discord", {
    fontFamily: "Trebuchet MS, Consolas, sans-serif",
    fontSize: "22px",
    color: "#f8fafc",
    fontStyle: "bold",
    align: "center"
  }).setOrigin(0.5);
  discordDonateTitle.setVisible(false);
  qrContainer.add(discordDonateTitle);

  const discordDonateText = scene.add.text(0, 20, "Activity không tải QR ngoài origin.\nHãy mở trang ủng hộ để quét mã đầy đủ.", {
    fontFamily: "Consolas",
    fontSize: "15px",
    color: "#cbd5e1",
    align: "center",
    lineSpacing: 6,
    wordWrap: { width: 320 }
  }).setOrigin(0.5);
  discordDonateText.setVisible(false);
  qrContainer.add(discordDonateText);

  const discordDonateOpenBtn = scene.add.container(0, 118);
  discordDonateOpenBtn.setVisible(false);
  const discordDonateOpenGfx = scene.add.graphics();
  discordDonateOpenBtn.add(discordDonateOpenGfx);
  const discordDonateOpenHitArea = scene.add.rectangle(0, 0, 240, 48).setInteractive({ useHandCursor: true });
  discordDonateOpenBtn.add(discordDonateOpenHitArea);
  const discordDonateOpenText = scene.add.text(0, 0, "Mở trang QR", {
    fontFamily: "Consolas",
    fontSize: "16px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0.5);
  discordDonateOpenBtn.add(discordDonateOpenText);
  qrContainer.add(discordDonateOpenBtn);

  const qrAddInfoText = scene.add.text(0, -panelH * 0.5 + 500, "", {
    fontFamily: "Consolas",
    fontSize: "13px",
    color: "#94a3b8",
    align: "center",
    wordWrap: { width: panelW - 80 }
  }).setOrigin(0.5);
  donatePanel.add(qrAddInfoText);

  donatePanel.add(qrContainer);
  let currentQrImage: Phaser.GameObjects.Image | null = null;
  let qrLoadKey = 0;
  let currentQrAddInfo = pickRandomDonateQrAddInfo();

  // Amounts Data
  const amounts: DonateAmount[] = [
    { label: "5k", value: 5000, color: 0x0ea5e9 },       // Soft Cyan
    { label: "10k", value: 10000, color: 0x0ea5e9 },
    { label: "15k", value: 15000, color: 0x0ea5e9 },
    { label: "20k", value: 20000, color: 0x0ea5e9 },
    { label: "30k", value: 30000, color: 0x6366f1 },      // Indigo Purple
    { label: "50k", value: 50000, color: 0x6366f1 },
    { label: "100k", value: 100000, color: 0x6366f1 },
    { label: "200k", value: 200000, color: 0x6366f1 },
    { label: "500k", value: 500000, color: 0xd97706 },    // Subtle Gold
    { label: "Tùy tâm", value: 0, color: 0xd97706 }
  ];
  let selectedAmount = 20000;
  const amountBtns: ButtonState[] = [];

  // Helper to draw modern rounded pill button
  const drawPillButton = (gfx: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, baseColor: number, isSelected: boolean, isHover?: boolean): void => {
    gfx.clear();
    const r = h * 0.5; // Pill shape

    if (isSelected) {
      // Active Glow
      gfx.fillStyle(baseColor, 0.4);
      gfx.fillRoundedRect(x - w * 0.5 - 3, y - h * 0.5 - 3, w + 6, h + 6, r + 3);
      // Fill base
      gfx.fillStyle(baseColor, 0.9);
      gfx.fillRoundedRect(x - w * 0.5, y - h * 0.5, w, h, r);
      gfx.lineStyle(2, 0xffffff, 0.9);
      gfx.strokeRoundedRect(x - w * 0.5, y - h * 0.5, w, h, r);
    } else {
      if (isHover) {
        gfx.fillStyle(baseColor, 0.3);
        gfx.fillRoundedRect(x - w * 0.5, y - h * 0.5, w, h, r);
        gfx.lineStyle(1.5, baseColor, 0.8);
        gfx.strokeRoundedRect(x - w * 0.5, y - h * 0.5, w, h, r);
      } else {
        gfx.fillStyle(0x1e293b, 0.8); // Dark slate
        gfx.fillRoundedRect(x - w * 0.5, y - h * 0.5, w, h, r);
        gfx.lineStyle(1, 0x475569, 0.6);
        gfx.strokeRoundedRect(x - w * 0.5, y - h * 0.5, w, h, r);
      }
    }
  };

  const loadQrCode = (amount: number): void => {
    if (isDiscordActivity) {
      qrLoadingText.setVisible(false);
      discordDonateTitle.setVisible(true);
      discordDonateText.setVisible(true);
      discordDonateOpenBtn.setVisible(true);
      return;
    }

    qrLoadKey++;
    const myKey = qrLoadKey;
    const textureKey = `vietqr_${myKey}`;

    if (currentQrImage) {
      const oldTextureKey = currentQrImage.texture.key;
      currentQrImage.destroy();
      currentQrImage = null;
      if (scene.textures.exists(oldTextureKey)) {
        scene.textures.remove(oldTextureKey);
      }
    }
    qrLoadingText.setVisible(true);
    discordDonateTitle.setVisible(false);
    discordDonateText.setVisible(false);
    discordDonateOpenBtn.setVisible(false);

    currentQrAddInfo = pickRandomDonateQrAddInfo();
    qrAddInfoText.setText(`Nội dung CK: ${currentQrAddInfo}`);
    const url = buildDonateQrUrl(amount, currentQrAddInfo);

    scene.load.image(textureKey, url);
    scene.load.once(`filecomplete-image-${textureKey}`, () => {
      if (myKey !== qrLoadKey) {
        // Stale load requested by previous clicks. Clean it up and ignore.
        if (scene.textures.exists(textureKey)) scene.textures.remove(textureKey);
        return;
      }
      qrLoadingText.setVisible(false);
      currentQrImage = scene.add.image(0, 0, textureKey);
      // Scale the beautiful compact2 card perfectly to fit the panel
      const cardWidth = 280;
      const scale = cardWidth / currentQrImage.width;
      currentQrImage.setScale(scale);
      qrContainer.add(currentQrImage);
    });
    scene.load.start();
  };

  const updateDiscordDonateButton = (amount: number): void => {
    discordDonateOpenText.setText(amount > 0 ? `Mở QR ${Math.round(amount / 1000)}k` : "Mở QR tùy tâm");
  };

  discordDonateOpenHitArea.on("pointerover", () => {
    drawPillButton(discordDonateOpenGfx, 0, 0, 240, 48, 0x0ea5e9, true, true);
  });
  discordDonateOpenHitArea.on("pointerout", () => {
    drawPillButton(discordDonateOpenGfx, 0, 0, 240, 48, 0x0ea5e9, true, false);
  });
  discordDonateOpenHitArea.on("pointerdown", () => {
    void openExternalLink(buildDonateQrUrl(selectedAmount, currentQrAddInfo));
    scene.tweens.add({
      targets: discordDonateOpenBtn,
      scale: 0.96,
      duration: 50,
      yoyo: true
    });
  });

  // Amount Buttons Grid Layout
  const btnCols = 4; // 10 buttons -> 4 cols, 3 rows (last row shifted or centered)
  const btnW = 100;
  const btnH = 40;
  const btnGap = 12;
  const totalGridWidth = (btnCols * btnW) + ((btnCols - 1) * btnGap);
  const startX = -totalGridWidth * 0.5 + btnW * 0.5;
  const startY = panelH * 0.5 - 230;

  drawPillButton(discordDonateOpenGfx, 0, 0, 240, 48, 0x0ea5e9, true, false);

  amounts.forEach((amt, index) => {
    // Calculate layout (3 rows: 4 cols, 4 cols, 2 cols centered)
    let row: number;
    let col: number;
    let xOffset = 0;

    if (index < 4) {
      row = 0;
      col = index;
    } else if (index < 8) {
      row = 1;
      col = index - 4;
    } else {
      row = 2;
      col = index - 8;
      // Center the last two buttons: calculate offset
      const colsInThisRow = 2;
      const rowWidth = (colsInThisRow * btnW) + ((colsInThisRow - 1) * btnGap);
      xOffset = (totalGridWidth - rowWidth) * 0.5;
    }

    const x = startX + xOffset + col * (btnW + btnGap);
    const y = startY + row * (btnH + btnGap);

    const btnContainer = scene.add.container(x, y);
    const gfx = scene.add.graphics();
    btnContainer.add(gfx);

    const hitArea = scene.add.rectangle(0, 0, btnW, btnH).setInteractive({ useHandCursor: true });
    btnContainer.add(hitArea);

    const lblContent = amt.label;
    const text = scene.add.text(0, 0, lblContent, {
      fontFamily: "Consolas",
      fontSize: "15px",
      color: amt.value === selectedAmount ? "#ffffff" : "#94a3b8",
      fontStyle: amt.value === selectedAmount ? "bold" : "normal"
    }).setOrigin(0.5);
    btnContainer.add(text);

    const buttonState: ButtonState = {
      value: amt.value,
      color: amt.color,
      gfx,
      text,
      updateDisplay: (isSel, isHover = false) => {
        drawPillButton(gfx, 0, 0, btnW, btnH, amt.color, isSel, isHover);
        text.setColor((isSel || isHover) ? "#ffffff" : "#94a3b8");
        text.setFontStyle((isSel || isHover) ? "bold" : "normal");
      }
    };

    buttonState.updateDisplay(amt.value === selectedAmount);
    amountBtns.push(buttonState);

    hitArea.on("pointerover", () => {
      if (selectedAmount !== amt.value) buttonState.updateDisplay(false, true);
    });
    hitArea.on("pointerout", () => {
      if (selectedAmount !== amt.value) buttonState.updateDisplay(false, false);
    });
    hitArea.on("pointerdown", () => {
      selectedAmount = amt.value;
      amountBtns.forEach((b) => b.updateDisplay(b.value === selectedAmount));
      updateDiscordDonateButton(selectedAmount);
      loadQrCode(selectedAmount);

      // Click effect
      scene.tweens.add({
        targets: btnContainer,
        scale: 0.95,
        duration: 50,
        yoyo: true
      });
    });

    donatePanel.add(btnContainer);
  });

  // Close Button (Pill at bottom)
  const closeBtnY = panelH * 0.5 - 45;
  const closeGfx = scene.add.graphics();
  drawPillButton(closeGfx, 0, closeBtnY, 160, 44, 0x475569, false); // Gray neutral
  donatePanel.add(closeGfx);

  const closeHitArea = scene.add.rectangle(0, closeBtnY, 160, 44).setInteractive({ useHandCursor: true });
  donatePanel.add(closeHitArea);

  const closeText = scene.add.text(0, closeBtnY, "Đóng (ESC)", {
    fontFamily: "Consolas",
    fontSize: "16px",
    color: "#cbd5e1",
    fontStyle: "bold"
  }).setOrigin(0.5);
  donatePanel.add(closeText);

  closeHitArea.on("pointerover", () => {
    drawPillButton(closeGfx, 0, closeBtnY, 160, 44, 0x475569, false, true);
    closeText.setColor("#ffffff");
  });
  closeHitArea.on("pointerout", () => {
    drawPillButton(closeGfx, 0, closeBtnY, 160, 44, 0x475569, false, false);
    closeText.setColor("#cbd5e1");
  });
  closeHitArea.on("pointerdown", () => {
    donatePanel.setVisible(false);
    donatePanel.setScale(0.95); // reset scale
    donatePanel.setAlpha(0);
  });

  // Bind ESC key to close
  scene.input.keyboard?.on("keydown-ESC", () => {
    if (donatePanel.visible) {
      donatePanel.setVisible(false);
      donatePanel.setScale(0.95);
      donatePanel.setAlpha(0);
    }
  });

  // Show animation logic
  const showDonatePanel = (): void => {
    donatePanel.setVisible(true);
    updateDiscordDonateButton(selectedAmount);
    loadQrCode(selectedAmount);
    donatePanel.setAlpha(0);
    donatePanel.setScale(0.95);
    scene.tweens.add({
      targets: donatePanel,
      alpha: 1,
      scale: 1,
      duration: 250,
      ease: "Back.easeOut",
      overshoot: 1.2
    });
  };

  // --- 3. Floating CTA Buttons (Bottom Right) ---
  const createFloatingPillButton = (x: number, y: number, width: number, height: number, label: string, baseColor: number, onClick: () => void, isSelected = false): Phaser.GameObjects.Container => {
    const btnContainer = scene.add.container(x, y);
    const btnGfx = scene.add.graphics();
    const btnText = scene.add.text(0, 0, label, {
      fontFamily: "Consolas",
      fontSize: "18px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5);
    const btnHitArea = scene.add.rectangle(0, 0, width, height).setInteractive({ useHandCursor: true });

    const updateDisplay = (isHover = false): void => {
      drawPillButton(btnGfx, 0, 0, width, height, baseColor, isSelected, isHover);
      btnText.setColor((isSelected || isHover) ? "#ffffff" : "#cbd5e1");
    };

    updateDisplay();
    btnContainer.add(btnGfx);
    btnContainer.add(btnHitArea);
    btnContainer.add(btnText);

    btnHitArea.on("pointerover", () => updateDisplay(true));
    btnHitArea.on("pointerout", () => updateDisplay(false));
    btnHitArea.on("pointerdown", () => {
      onClick();
      scene.tweens.add({
        targets: btnContainer,
        scale: 0.96,
        duration: 50,
        yoyo: true
      });
    });

    return btnContainer;
  };

  const floatingBtnX = w - 120;
  const donateBtnY = h - 90;
  const shopBtnY = donateBtnY - 62;

  createFloatingPillButton(
    floatingBtnX,
    shopBtnY,
    200,
    48,
    "🛒 Ghé thăm shop",
    0xd97706,
    () => {
      void openExternalLink("https://devgovietnam.shop");
    }
  );

  const openBtnContainer = createFloatingPillButton(
    floatingBtnX,
    donateBtnY,
    200,
    48,
    "☕ ủng hộ tác giả",
    0x0ea5e9,
    showDonatePanel,
    true
  );

  // Add pulsing effect to the donate button
  scene.tweens.add({
    targets: openBtnContainer,
    scaleX: 1.04,
    scaleY: 1.04,
    alpha: 0.95,
    duration: 1200,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut"
  });
}