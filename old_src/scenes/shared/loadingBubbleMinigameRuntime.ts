type MinigameSceneScale = {
  width?: number;
  height?: number;
};

type MinigameSceneInput = {
  on?: (event: string, handler: unknown) => unknown;
  off?: (event: string, handler: unknown) => unknown;
};

type MinigameSceneAdd = {
  rectangle: (
    x: number,
    y: number,
    w: number,
    h: number,
    color: number,
    alpha?: number
  ) => MinigameDisplayObject;
  circle: (
    x: number,
    y: number,
    radius: number,
    color: number,
    alpha?: number
  ) => MinigameDisplayObject;
  text: (
    x: number,
    y: number,
    text: string,
    style: MinigameTextStyle
  ) => MinigameDisplayObject;
};

interface MinigameTextStyle {
  fontFamily?: string;
  fontSize?: string;
  color?: string;
  fontStyle?: string;
  align?: string;
  wordWrap?: { width: number };
}

interface MinigameDisplayObject {
  setDepth?: (depth: number) => MinigameDisplayObject;
  setStrokeStyle?: (width?: number, color?: number, alpha?: number) => MinigameDisplayObject;
  setPosition?: (x: number, y: number) => MinigameDisplayObject;
  setOrigin?: (x?: number, y?: number) => MinigameDisplayObject;
  setInteractive?: (...args: unknown[]) => MinigameDisplayObject;
  setVisible?: (value: boolean) => MinigameDisplayObject;
  setAlpha?: (value: number) => MinigameDisplayObject;
  setText?: (text: string) => MinigameDisplayObject;
  setStyle?: (style: MinigameTextStyle) => MinigameDisplayObject;
  width?: number;
  destroy?: () => void;
  active?: boolean;
  texture?: { source?: Array<{ image?: unknown }> };
}

interface MinigameScene {
  scale?: MinigameSceneScale;
  input?: MinigameSceneInput;
  add: MinigameSceneAdd;
  [key: string]: unknown;
}

const SHOOTING_EMOJIS = ["🐾", "🍄", "🌰", "⭐", "🔥", "🍃"];
const MINIGAME_STATE_KEY = "loadingBubbleMinigame";

interface LoadingBubbleMinigameRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface LoadingBubbleMinigameBounds {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
}

interface LoadingBubbleMinigameLayout {
  width: number;
  height: number;
  panelLeft: number;
  panelTop: number;
  panelWidth: number;
  panelHeight: number;
  panelCenterX: number;
  panelCenterY: number;
  playfieldLeft: number;
  playfieldTop: number;
  playfieldWidth: number;
  playfieldHeight: number;
  playfieldBottom: number;
  playfieldCenterX: number;
  cannonX: number;
  cannonY: number;
  scoreX: number;
  scoreY: number;
  titleX: number;
  titleY: number;
  progressTextX: number;
  progressTextY: number;
  detailX: number;
  detailY: number;
  detailWrapWidth: number;
  instructionX: number;
  instructionY: number;
  progressBarLeft: number;
  progressBarWidth: number;
  progressBarY: number;
  popupBounds: LoadingBubbleMinigameRect;
}

type LoadingBubblePointer = { x?: number; y?: number };

type LoadingBubbleInteractiveScope =
  | "scene"
  | "bounds"
  | "playfield"
  | ((pointer: unknown, state: LoadingBubbleMinigameState) => boolean | void);

interface LoadingBubbleMinigameOptions {
  rng?: () => number;
  bounds?: LoadingBubbleMinigameBounds;
  depthBase?: number;
  showProgressBar?: boolean;
  interactiveScope?: LoadingBubbleInteractiveScope;
  onScoreChange?: (score: number, state: LoadingBubbleMinigameState) => void;
  onReset?: (state: LoadingBubbleMinigameState) => void;
  title?: string;
  progressText?: string;
  detailText?: string;
  instructionText?: string;
}

interface LoadingBubble {
  id: number;
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  elapsedMs: number;
  wobbleSeed: number;
  wobbleAmp: number;
  fill: MinigameDisplayObject;
  outline: MinigameDisplayObject;
  icon: MinigameDisplayObject;
}

interface LoadingEmojiProjectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  glow: MinigameDisplayObject;
  text: MinigameDisplayObject;
}

interface LoadingBubbleMinigameState extends LoadingBubbleMinigameLayout {
  rng: () => number;
  bubbles: LoadingBubble[];
  projectiles: LoadingEmojiProjectile[];
  nextBubbleId: number;
  nextProjectileId: number;
  score: number;
  progress: number;
  spawnCooldownMs: number;
  shotIndex: number;
  titleText: MinigameDisplayObject | null;
  progressText: MinigameDisplayObject | null;
  detailText: MinigameDisplayObject | null;
  instructionText: MinigameDisplayObject | null;
  scoreText: MinigameDisplayObject | null;
  progressFill: MinigameDisplayObject | null;
  pointerDownHandler: ((pointer: unknown) => void) | null;
  parts: MinigameDisplayObject[];
  depthBase: number;
  showProgressBar: boolean;
  interactiveScope: LoadingBubbleInteractiveScope;
  onScoreChange: LoadingBubbleMinigameOptions["onScoreChange"];
  onReset: LoadingBubbleMinigameOptions["onReset"];
  isBounded: boolean;
  playfieldBounds: LoadingBubbleMinigameRect;
}

interface LoadingBubbleSpawnOverrides {
  radius?: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  wobbleAmp?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function randomBetween(min: number, max: number, rng: () => number = Math.random): number {
  return min + (max - min) * rng();
}

function destroyDisplayObject(node: MinigameDisplayObject | null | undefined): void {
  node?.destroy?.();
}

function getMinigameState(scene: MinigameScene | null | undefined): LoadingBubbleMinigameState | null {
  return (scene?.[MINIGAME_STATE_KEY] as LoadingBubbleMinigameState | null) ?? null;
}

function setMinigameState(scene: MinigameScene | null | undefined, state: LoadingBubbleMinigameState | null): void {
  if (scene) {
    scene[MINIGAME_STATE_KEY] = state;
  }
}

function trackPart(state: LoadingBubbleMinigameState, node: MinigameDisplayObject | null | undefined): MinigameDisplayObject | null {
  if (node) state.parts.push(node);
  return node ?? null;
}

function resolveFullScreenLayout(scene: MinigameScene): LoadingBubbleMinigameLayout {
  const width = scene.scale?.width ?? 1600;
  const height = scene.scale?.height ?? 900;
  const playfieldWidth = Math.min(960, width - 120);
  const playfieldHeight = Math.min(420, Math.floor(height * 0.4));
  const playfieldTop = Math.max(190, Math.floor(height * 0.24));
  const playfieldLeft = Math.floor(width * 0.5 - playfieldWidth * 0.5);
  const playfieldCenterX = Math.floor(width * 0.5);
  const playfieldBottom = playfieldTop + playfieldHeight;
  const cannonY = playfieldBottom + 52;
  const progressBarWidth = Math.min(780, Math.floor(width * 0.62));
  const progressBarLeft = Math.floor(width * 0.5 - progressBarWidth * 0.5);
  const progressBarY = Math.floor(height - 74);

  return {
    width,
    height,
    panelLeft: 0,
    panelTop: 0,
    panelWidth: width,
    panelHeight: height,
    panelCenterX: width * 0.5,
    panelCenterY: height * 0.5,
    playfieldLeft,
    playfieldTop,
    playfieldWidth,
    playfieldHeight,
    playfieldBottom,
    playfieldCenterX,
    cannonX: playfieldCenterX,
    cannonY,
    scoreX: playfieldLeft + 24,
    scoreY: playfieldTop + 18,
    titleX: width * 0.5,
    titleY: 86,
    progressTextX: width * 0.5,
    progressTextY: 132,
    detailX: width * 0.5,
    detailY: 168,
    detailWrapWidth: Math.min(980, width - 80),
    instructionX: width * 0.5,
    instructionY: cannonY + 34,
    progressBarLeft,
    progressBarWidth,
    progressBarY,
    popupBounds: {
      x: 0,
      y: 0,
      w: width,
      h: height
    }
  };
}

function resolveBoundedLayout(scene: MinigameScene, bounds: LoadingBubbleMinigameBounds): LoadingBubbleMinigameLayout {
  const width = scene.scale?.width ?? 1600;
  const height = scene.scale?.height ?? 900;
  const panelLeft = Math.floor(Number(bounds?.x ?? bounds?.left ?? 0));
  const panelTop = Math.floor(Number(bounds?.y ?? bounds?.top ?? 0));
  const panelWidth = Math.max(220, Math.floor(Number(bounds?.w ?? bounds?.width ?? 0)));
  const panelHeight = Math.max(220, Math.floor(Number(bounds?.h ?? bounds?.height ?? 0)));
  const playfieldLeft = panelLeft + 12;
  const playfieldWidth = Math.max(180, panelWidth - 24);
  const playfieldTop = panelTop + 76;
  const cannonY = panelTop + panelHeight - 34;
  const playfieldBottom = Math.max(playfieldTop + 120, cannonY - 40);
  const playfieldHeight = Math.max(120, playfieldBottom - playfieldTop);
  const playfieldCenterX = playfieldLeft + playfieldWidth * 0.5;

  return {
    width,
    height,
    panelLeft,
    panelTop,
    panelWidth,
    panelHeight,
    panelCenterX: panelLeft + panelWidth * 0.5,
    panelCenterY: panelTop + panelHeight * 0.5,
    playfieldLeft,
    playfieldTop,
    playfieldWidth,
    playfieldHeight,
    playfieldBottom,
    playfieldCenterX,
    cannonX: playfieldCenterX,
    cannonY,
    scoreX: playfieldLeft + 16,
    scoreY: playfieldTop + 12,
    titleX: panelLeft + panelWidth * 0.5,
    titleY: panelTop + 18,
    progressTextX: panelLeft + panelWidth * 0.5,
    progressTextY: panelTop + 42,
    detailX: panelLeft + panelWidth * 0.5,
    detailY: panelTop + 46,
    detailWrapWidth: Math.max(180, panelWidth - 32),
    instructionX: panelLeft + panelWidth * 0.5,
    instructionY: panelTop + panelHeight - 14,
    progressBarLeft: panelLeft + 16,
    progressBarWidth: Math.max(160, panelWidth - 32),
    progressBarY: panelTop + panelHeight - 26,
    popupBounds: {
      x: panelLeft,
      y: panelTop,
      w: panelWidth,
      h: panelHeight
    }
  };
}

function resolveLayout(scene: MinigameScene, options: LoadingBubbleMinigameOptions): LoadingBubbleMinigameLayout {
  return options?.bounds
    ? resolveBoundedLayout(scene, options.bounds)
    : resolveFullScreenLayout(scene);
}

function updateProgressBar(state: LoadingBubbleMinigameState): void {
  if (!state?.progressFill) return;
  const width = Math.max(0, Math.floor(state.progressBarWidth * state.progress));
  state.progressFill.width = width;
}

function updateScoreText(state: LoadingBubbleMinigameState): void {
  if (!state?.scoreText) return;
  state.scoreText.setText?.(`Đập bong bóng: ${state.score}`);
  state.onScoreChange?.(state.score, state);
}

function pointInRect(x: unknown, y: unknown, rect: LoadingBubbleMinigameRect | null | undefined): boolean {
  return Number.isFinite(x as number)
    && Number.isFinite(y as number)
    && !!rect
    && (x as number) >= rect.x
    && (x as number) <= rect.x + rect.w
    && (y as number) >= rect.y
    && (y as number) <= rect.y + rect.h;
}

function shouldHandlePointer(state: LoadingBubbleMinigameState, pointer: unknown): boolean {
  const scope = state.interactiveScope;
  if (typeof scope === "function") {
    return scope(pointer, state) !== false;
  }
  const pointerX = (pointer as LoadingBubblePointer)?.x;
  const pointerY = (pointer as LoadingBubblePointer)?.y;
  if (scope === "bounds") {
    return pointInRect(pointerX, pointerY, state.popupBounds);
  }
  if (scope === "playfield") {
    return pointInRect(pointerX, pointerY, state.playfieldBounds);
  }
  return true;
}

function createFullScreenChrome(scene: MinigameScene, state: LoadingBubbleMinigameState): void {
  const { width, height, playfieldCenterX, playfieldTop, playfieldHeight, playfieldWidth } = state;
  trackPart(state, scene.add.rectangle(width * 0.5, height * 0.5, width, height, 0x09131b, 1));
  trackPart(state, scene.add.circle(width * 0.24, height * 0.18, Math.floor(width * 0.16), 0x13314b, 0.18).setDepth?.(state.depthBase));
  trackPart(state, scene.add.circle(width * 0.78, height * 0.3, Math.floor(width * 0.12), 0x11462e, 0.16).setDepth?.(state.depthBase));
  trackPart(state, scene.add.rectangle(playfieldCenterX, playfieldTop + playfieldHeight * 0.5, playfieldWidth, playfieldHeight, 0x102033, 0.7)
    .setStrokeStyle?.(2, 0x4b87bb, 0.55)
    .setDepth?.(state.depthBase + 1));
}

function createBoundedChrome(scene: MinigameScene, state: LoadingBubbleMinigameState): void {
  const shadow = trackPart(
    state,
    scene.add.rectangle(state.panelCenterX, state.panelCenterY, state.panelWidth + 8, state.panelHeight + 8, 0x050c14, 0.22)
      .setDepth?.(state.depthBase)
  );
  shadow?.setInteractive?.();

  const panel = trackPart(
    state,
    scene.add.rectangle(state.panelCenterX, state.panelCenterY, state.panelWidth, state.panelHeight, 0x0c1724, 0.98)
      .setStrokeStyle?.(1.5, 0x5b8ab6, 0.85)
      .setDepth?.(state.depthBase + 1)
  );
  panel?.setInteractive?.();

  const accentWidth = Math.max(120, state.panelWidth - 18);
  trackPart(
    state,
    scene.add.rectangle(state.panelCenterX, state.panelTop + 8, accentWidth, 4, 0x7fd1ff, 0.8)
      .setDepth?.(state.depthBase + 2)
  );
  trackPart(
    state,
    scene.add.rectangle(
      state.playfieldCenterX,
      state.playfieldTop + state.playfieldHeight * 0.5,
      state.playfieldWidth,
      state.playfieldHeight,
      0x102033,
      0.74
    ).setStrokeStyle?.(2, 0x4b87bb, 0.58).setDepth?.(state.depthBase + 2)
  );
}

function createProgressBar(scene: MinigameScene, state: LoadingBubbleMinigameState): void {
  if (!state.showProgressBar) return;
  trackPart(
    state,
    scene.add.rectangle(state.progressBarLeft + state.progressBarWidth * 0.5, state.progressBarY + 10, state.progressBarWidth, 20, 0x15263b, 1)
      .setStrokeStyle?.(1, 0x4f7397, 1)
      .setDepth?.(state.depthBase + 2)
  );
  state.progressFill = trackPart(
    state,
    scene.add.rectangle(state.progressBarLeft, state.progressBarY + 10, 0, 16, 0x7fd1ff, 1)
      .setOrigin?.(0, 0.5)
      .setDepth?.(state.depthBase + 3)
  );
}

function installChrome(scene: MinigameScene, state: LoadingBubbleMinigameState, options: LoadingBubbleMinigameOptions): void {
  if (state.isBounded) {
    createBoundedChrome(scene, state);
  } else {
    createFullScreenChrome(scene, state);
  }

  state.titleText = trackPart(
    state,
    scene.add.text(state.titleX, state.titleY, options.title ?? "BÁ CHỦ KHU RỪNG", {
      fontFamily: "Consolas",
      fontSize: state.isBounded ? "24px" : "40px",
      color: "#f8ebb8",
      fontStyle: "bold"
    }).setOrigin?.(0.5).setDepth?.(state.depthBase + 4)
  );

  if (state.showProgressBar) {
    state.progressText = trackPart(
      state,
      scene.add.text(state.progressTextX, state.progressTextY, options.progressText ?? "Đang tải: 0%", {
        fontFamily: "Consolas",
        fontSize: state.isBounded ? "15px" : "22px",
        color: "#9be2ff"
      }).setOrigin?.(0.5).setDepth?.(state.depthBase + 4)
    );
  }

  state.detailText = trackPart(
    state,
    scene.add.text(state.detailX, state.detailY, options.detailText ?? "Bắn emoji để đập bong bóng trong lúc chờ tải.", {
      fontFamily: "Consolas",
      fontSize: state.isBounded ? "13px" : "17px",
      color: "#d8ecff",
      align: "center",
      wordWrap: { width: state.detailWrapWidth }
    }).setOrigin?.(0.5).setDepth?.(state.depthBase + 4)
  );

  state.scoreText = trackPart(
    state,
    scene.add.text(state.scoreX, state.scoreY, "Đập bong bóng: 0", {
      fontFamily: "Consolas",
      fontSize: state.isBounded ? "15px" : "18px",
      color: "#b6f7ff"
    }).setDepth?.(state.depthBase + 4)
  );

  state.instructionText = trackPart(
    state,
    scene.add.text(state.instructionX, state.instructionY, options.instructionText ?? "Bấm hoặc chạm để bắn emoji vào bong bóng.", {
      fontFamily: "Consolas",
      fontSize: state.isBounded ? "12px" : "16px",
      color: "#b4d8ff",
      align: "center"
    }).setOrigin?.(0.5).setDepth?.(state.depthBase + 4)
  );

  trackPart(
    state,
    scene.add.text(state.cannonX, state.cannonY, "🧺", {
      fontFamily: "Consolas",
      fontSize: state.isBounded ? "26px" : "34px",
      color: "#ffffff"
    }).setOrigin?.(0.5).setDepth?.(state.depthBase + 4)
  );

  trackPart(
    state,
    scene.add.text(state.cannonX, state.cannonY - 24, "🙂", {
      fontFamily: "Consolas",
      fontSize: state.isBounded ? "18px" : "22px",
      color: "#ffffff"
    }).setOrigin?.(0.5).setDepth?.(state.depthBase + 4)
  );

  createProgressBar(scene, state);
  updateScoreText(state);
}

export function installLoadingBubbleMinigame(scene: MinigameScene, options: LoadingBubbleMinigameOptions = {}): LoadingBubbleMinigameState {
  destroyLoadingBubbleMinigame(scene);

  const layout = resolveLayout(scene, options);
  const state: LoadingBubbleMinigameState = {
    ...layout,
    rng: typeof options.rng === "function" ? options.rng : Math.random,
    bubbles: [],
    projectiles: [],
    nextBubbleId: 1,
    nextProjectileId: 1,
    score: 0,
    progress: 0,
    spawnCooldownMs: 180,
    shotIndex: 0,
    titleText: null,
    progressText: null,
    detailText: null,
    instructionText: null,
    scoreText: null,
    progressFill: null,
    pointerDownHandler: null,
    parts: [],
    depthBase: Number.isFinite(Number(options.depthBase)) ? Number(options.depthBase) : 0,
    showProgressBar: options.showProgressBar !== false,
    interactiveScope: options.interactiveScope ?? "scene",
    onScoreChange: typeof options.onScoreChange === "function" ? options.onScoreChange : undefined,
    onReset: typeof options.onReset === "function" ? options.onReset : undefined,
    isBounded: !!options.bounds,
    playfieldBounds: { x: 0, y: 0, w: 0, h: 0 }
  };

  state.playfieldBounds = {
    x: state.playfieldLeft,
    y: state.playfieldTop,
    w: state.playfieldWidth,
    h: state.playfieldHeight
  };

  setMinigameState(scene, state);
  installChrome(scene, state, options);

  state.pointerDownHandler = (pointer: unknown) => {
    if (!shouldHandlePointer(state, pointer)) return;
    const pointerX = (pointer as LoadingBubblePointer)?.x;
    const pointerY = (pointer as LoadingBubblePointer)?.y;
    fireLoadingEmojiProjectile(scene, pointerX ?? state.cannonX, pointerY ?? state.playfieldTop + 30);
  };
  scene.input?.on?.("pointerdown", state.pointerDownHandler);
  state.onReset?.(state);

  return state;
}

export function getLoadingBubbleMinigameState(scene: MinigameScene | null | undefined): LoadingBubbleMinigameState | null {
  return getMinigameState(scene);
}

interface LoadingBubbleStatusOptions {
  title?: string;
  progressText?: string;
  detailText?: string;
  progress?: number;
}

export function setLoadingBubbleMinigameStatus(scene: MinigameScene | null | undefined, options: LoadingBubbleStatusOptions = {}): void {
  const state = getMinigameState(scene);
  if (!state) return;
  if (options.title != null) state.titleText?.setText?.(String(options.title));
  if (options.progressText != null) state.progressText?.setText?.(String(options.progressText));
  if (options.detailText != null) state.detailText?.setText?.(String(options.detailText));
  if (options.progress != null) {
    state.progress = clamp(Number(options.progress) || 0, 0, 1);
    updateProgressBar(state);
  }
}

export function fireLoadingEmojiProjectile(scene: MinigameScene | null | undefined, targetX: number, targetY: number): LoadingEmojiProjectile | null {
  const state = getMinigameState(scene);
  if (!state || !scene) return null;
  const resolvedTargetX = Number.isFinite(Number(targetX)) ? Number(targetX) : state.cannonX;
  const resolvedTargetY = Number.isFinite(Number(targetY)) ? Number(targetY) : state.playfieldTop + 30;
  const dx = resolvedTargetX - state.cannonX;
  const dy = resolvedTargetY - state.cannonY;
  const length = Math.max(1, Math.hypot(dx, dy));
  const speed = 620;
  const emoji = SHOOTING_EMOJIS[state.shotIndex % SHOOTING_EMOJIS.length];
  state.shotIndex += 1;
  const projectile: LoadingEmojiProjectile = {
    id: state.nextProjectileId++,
    x: state.cannonX,
    y: state.cannonY - 14,
    vx: (dx / length) * speed,
    vy: (dy / length) * speed,
    radius: 18,
    glow: scene.add.circle(state.cannonX, state.cannonY - 14, 20, 0xfff4a8, 0.22).setDepth?.(state.depthBase + 5) as MinigameDisplayObject,
    text: scene.add.text(state.cannonX, state.cannonY - 14, emoji, {
      fontFamily: "Consolas",
      fontSize: state.isBounded ? "18px" : "24px",
      color: "#ffffff"
    }).setOrigin?.(0.5).setDepth?.(state.depthBase + 6) as MinigameDisplayObject
  };
  state.projectiles.push(projectile);
  return projectile;
}

export function spawnLoadingBubble(scene: MinigameScene | null | undefined, overrides: LoadingBubbleSpawnOverrides = {}): LoadingBubble | null {
  const state = getMinigameState(scene);
  if (!state || !scene) return null;
  const radius = overrides.radius ?? randomBetween(18, 30, state.rng);
  const bubble: LoadingBubble = {
    id: state.nextBubbleId++,
    x: overrides.x ?? randomBetween(state.playfieldLeft + radius + 12, state.playfieldLeft + state.playfieldWidth - radius - 12, state.rng),
    y: overrides.y ?? (state.playfieldBottom + radius),
    radius,
    vx: overrides.vx ?? randomBetween(-24, 24, state.rng),
    vy: overrides.vy ?? randomBetween(-92, -54, state.rng),
    elapsedMs: 0,
    wobbleSeed: randomBetween(0, Math.PI * 2, state.rng),
    wobbleAmp: overrides.wobbleAmp ?? randomBetween(8, 16, state.rng),
    fill: scene.add.circle(0, 0, radius, 0x7dd4ff, 0.2).setDepth?.(state.depthBase + 4) as MinigameDisplayObject,
    outline: scene.add.circle(0, 0, radius, 0x000000, 0).setDepth?.(state.depthBase + 4) as MinigameDisplayObject,
    icon: scene.add.text(0, 0, "🫧", {
      fontFamily: "Consolas",
      fontSize: `${Math.max(16, Math.floor(radius * 0.95))}px`,
      color: "#dff8ff"
    }).setOrigin?.(0.5).setDepth?.(state.depthBase + 5) as MinigameDisplayObject
  };
  bubble.outline.setStrokeStyle?.(2, 0xcaf2ff, 0.85);
  bubble.fill.setPosition?.(bubble.x, bubble.y);
  bubble.outline.setPosition?.(bubble.x, bubble.y);
  bubble.icon.setPosition?.(bubble.x, bubble.y);
  state.bubbles.push(bubble);
  return bubble;
}

function removeBubble(state: LoadingBubbleMinigameState, bubbleIndex: number): void {
  const [bubble] = state.bubbles.splice(bubbleIndex, 1);
  destroyDisplayObject(bubble?.fill);
  destroyDisplayObject(bubble?.outline);
  destroyDisplayObject(bubble?.icon);
}

function removeProjectile(state: LoadingBubbleMinigameState, projectileIndex: number): void {
  const [projectile] = state.projectiles.splice(projectileIndex, 1);
  destroyDisplayObject(projectile?.glow);
  destroyDisplayObject(projectile?.text);
}

export function updateLoadingBubbleMinigame(scene: MinigameScene | null | undefined, deltaMs: number = 16): void {
  const state = getMinigameState(scene);
  if (!state) return;

  const dt = Math.max(0.001, deltaMs / 1000);
  state.spawnCooldownMs -= deltaMs;
  if (state.spawnCooldownMs <= 0) {
    spawnLoadingBubble(scene);
    state.spawnCooldownMs = state.progress >= 1 ? 180 : 280;
  }

  for (let bubbleIndex = state.bubbles.length - 1; bubbleIndex >= 0; bubbleIndex -= 1) {
    const bubble = state.bubbles[bubbleIndex];
    bubble.elapsedMs += deltaMs;
    bubble.x += bubble.vx * dt + Math.sin((bubble.elapsedMs * 0.005) + bubble.wobbleSeed) * bubble.wobbleAmp * dt;
    bubble.y += bubble.vy * dt;
    bubble.fill.setPosition?.(bubble.x, bubble.y);
    bubble.outline.setPosition?.(bubble.x, bubble.y);
    bubble.icon.setPosition?.(bubble.x, bubble.y);
    if (bubble.y + bubble.radius < state.playfieldTop - 72) {
      removeBubble(state, bubbleIndex);
    }
  }

  for (let projectileIndex = state.projectiles.length - 1; projectileIndex >= 0; projectileIndex -= 1) {
    const projectile = state.projectiles[projectileIndex];
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.glow.setPosition?.(projectile.x, projectile.y);
    projectile.text.setPosition?.(projectile.x, projectile.y);

    if (
      projectile.x < state.playfieldLeft - 80 ||
      projectile.x > state.playfieldLeft + state.playfieldWidth + 80 ||
      projectile.y < state.playfieldTop - 120 ||
      projectile.y > state.cannonY + 80
    ) {
      removeProjectile(state, projectileIndex);
      continue;
    }

    let popped = false;
    for (let bubbleIndex = state.bubbles.length - 1; bubbleIndex >= 0; bubbleIndex -= 1) {
      const bubble = state.bubbles[bubbleIndex];
      const distance = Math.hypot(projectile.x - bubble.x, projectile.y - bubble.y);
      if (distance > bubble.radius + projectile.radius) continue;
      removeBubble(state, bubbleIndex);
      state.score += 1;
      updateScoreText(state);
      removeProjectile(state, projectileIndex);
      popped = true;
      break;
    }
    if (popped) continue;
  }
}

export function destroyLoadingBubbleMinigame(scene: MinigameScene | null | undefined): void {
  const state = getMinigameState(scene);
  if (!state) return;
  scene?.input?.off?.("pointerdown", state.pointerDownHandler);
  state.bubbles.forEach((bubble) => {
    destroyDisplayObject(bubble.fill);
    destroyDisplayObject(bubble.outline);
    destroyDisplayObject(bubble.icon);
  });
  state.projectiles.forEach((projectile) => {
    destroyDisplayObject(projectile.glow);
    destroyDisplayObject(projectile.text);
  });
  state.parts.forEach((part) => destroyDisplayObject(part));
  setMinigameState(scene, null);
}
