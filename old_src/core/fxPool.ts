interface PoolLimits {
  circles: number;
  texts: number;
  graphics: number;
  rectangles: number;
}

const DEFAULT_POOL_LIMITS: PoolLimits = {
  circles: 64,
  texts: 32,
  graphics: 12,
  rectangles: 12
};

interface CircleEntry {
  node: Phaser.GameObjects.Arc;
  inUse: boolean;
}

interface TextEntry {
  node: Phaser.GameObjects.Text;
  inUse: boolean;
}

interface GraphicsEntry {
  node: Phaser.GameObjects.Graphics;
  inUse: boolean;
}


interface RectangleEntry {
  node: Phaser.GameObjects.Rectangle;
  inUse: boolean;
}

export type FxNode =
  | Phaser.GameObjects.Arc
  | Phaser.GameObjects.Text
  | Phaser.GameObjects.Graphics
  | Phaser.GameObjects.Rectangle;

function killTweenTargets(scene: Phaser.Scene | null | undefined, target: Phaser.GameObjects.GameObject | null | undefined) {
  if (!target) return;
  scene?.tweens?.killTweensOf?.(target);
}

function resetCircle(circle: Phaser.GameObjects.Arc | null | undefined) {
  if (!circle) return;
  circle.setActive(false);
  circle.setVisible(false);
  circle.setAlpha(1);
  circle.setScale(1);
  const body = circle.body as unknown as { enable?: boolean } | null | undefined;
  body?.enable !== undefined && (body.enable = false);
}

function resetText(text: Phaser.GameObjects.Text | null | undefined) {
  if (!text) return;
  text.setActive(false);
  text.setVisible(false);
  text.setAlpha(1);
  text.setScale(1);
  text.setAngle?.(0);
  if (typeof text.setText === "function") text.setText("");
}

function resetGraphics(graphics: Phaser.GameObjects.Graphics | null | undefined) {
  if (!graphics) return;
  graphics.setActive(false);
  graphics.setVisible(false);
  graphics.setAlpha(1);
  graphics.clear?.();
}

function resetRectangle(rect: Phaser.GameObjects.Rectangle | null | undefined) {
  if (!rect) return;
  rect.setActive(false);
  rect.setVisible(false);
  rect.setAlpha(1);
  rect.setScale(1);
  rect.setAngle?.(0);
}

export class FxPool {
  scene: Phaser.Scene;
  limits: PoolLimits;
  circles: CircleEntry[];
  texts: TextEntry[];
  graphics: GraphicsEntry[];
  rectangles: RectangleEntry[];

  constructor(scene: Phaser.Scene, limits: Partial<PoolLimits> = DEFAULT_POOL_LIMITS) {
    this.scene = scene;
    this.limits = { ...DEFAULT_POOL_LIMITS, ...limits };
    this.circles = [];
    this.texts = [];
    this.graphics = [];
    this.rectangles = [];
  }

  prewarm({ circles = 0, texts = 0, graphics = 0, rectangles = 0 }: Partial<PoolLimits> = {}) {
    for (let i = this.circles.length; i < circles; i += 1) {
      const node = this.scene.add.circle(0, 0, 8, 0xffffff, 0);
      node.setVisible(false);
      node.setActive(false);
      this.circles.push({ node, inUse: false });
    }
    for (let i = this.texts.length; i < texts; i += 1) {
      const node = this.scene.add.text(0, 0, "", { fontSize: "14px" });
      node.setVisible(false);
      node.setActive(false);
      this.texts.push({ node, inUse: false });
    }
    for (let i = this.graphics.length; i < graphics; i += 1) {
      const node = this.scene.add.graphics();
      node.setVisible(false);
      node.setActive(false);
      this.graphics.push({ node, inUse: false });
    }
    for (let i = this.rectangles.length; i < rectangles; i += 1) {
      const node = this.scene.add.rectangle(0, 0, 8, 4, 0xffffff, 0);
      node.setVisible(false);
      node.setActive(false);
      this.rectangles.push({ node, inUse: false });
    }
  }

  acquireCircle(x: number, y: number, radius: number, color: number, alpha = 1, depth = 8500): Phaser.GameObjects.Arc | null {
    const entry = this.circles.find((item) => !item.inUse) ?? this.createCircleEntry();
    if (!entry) return null;
    entry.inUse = true;
    const circle = entry.node;
    killTweenTargets(this.scene, circle);
    circle.setPosition(x, y);
    circle.setRadius(radius);
    circle.setFillStyle(color, alpha);
    circle.setStrokeStyle?.(0, color, 0);
    circle.setDepth(depth);
    circle.setActive(true);
    circle.setVisible(true);
    circle.setAlpha(alpha);
    circle.setScale(1);
    return circle;
  }

  releaseCircle(circle: Phaser.GameObjects.Arc | null | undefined) {
    const entry = this.circles.find((item) => item.node === circle);
    if (!entry) {
      circle?.destroy?.();
      return;
    }
    killTweenTargets(this.scene, circle);
    entry.inUse = false;
    resetCircle(circle);
  }

  acquireText(x: number, y: number, content: string | number | null | undefined, style: Phaser.Types.GameObjects.Text.TextStyle = {}, depth = 8600): Phaser.GameObjects.Text | null {
    const entry = this.texts.find((item) => !item.inUse) ?? this.createTextEntry();
    if (!entry) return null;
    entry.inUse = true;
    const text = entry.node;
    killTweenTargets(this.scene, text);
    if (typeof text.setStyle === "function") text.setStyle(style);
    text.setText(String(content ?? ""));
    text.setPosition(x, y);
    text.setDepth(depth);
    text.setActive(true);
    text.setVisible(true);
    text.setAlpha(1);
    text.setScale(1);
    return text;
  }

  releaseText(text: Phaser.GameObjects.Text | null | undefined) {
    const entry = this.texts.find((item) => item.node === text);
    if (!entry) {
      text?.destroy?.();
      return;
    }
    killTweenTargets(this.scene, text);
    entry.inUse = false;
    resetText(text);
  }

  acquireGraphics(depth = 8500): Phaser.GameObjects.Graphics | null {
    const entry = this.graphics.find((item) => !item.inUse) ?? this.createGraphicsEntry();
    if (!entry) return null;
    entry.inUse = true;
    const graphics = entry.node;
    killTweenTargets(this.scene, graphics);
    graphics.clear?.();
    graphics.setDepth(depth);
    graphics.setActive(true);
    graphics.setVisible(true);
    graphics.setAlpha(1);
    return graphics;
  }

  releaseGraphics(graphics: Phaser.GameObjects.Graphics | null | undefined) {
    const entry = this.graphics.find((item) => item.node === graphics);
    if (!entry) {
      graphics?.destroy?.();
      return;
    }
    killTweenTargets(this.scene, graphics);
    entry.inUse = false;
    resetGraphics(graphics);
  }

  acquireRectangle(x: number, y: number, width: number, height: number, color: number, alpha = 1, depth = 8500): Phaser.GameObjects.Rectangle | null {
    const entry = this.rectangles.find((item) => !item.inUse) ?? this.createRectangleEntry();
    if (!entry) return null;
    entry.inUse = true;
    const rect = entry.node;
    killTweenTargets(this.scene, rect);
    rect.setPosition(x, y);
    rect.setSize(width, height);
    rect.setFillStyle(color, alpha);
    rect.setDepth(depth);
    rect.setActive(true);
    rect.setVisible(true);
    rect.setAlpha(alpha);
    rect.setScale(1);
    rect.setAngle(0);
    return rect;
  }

  releaseRectangle(rect: Phaser.GameObjects.Rectangle | null | undefined) {
    const entry = this.rectangles.find((item) => item.node === rect);
    if (!entry) {
      rect?.destroy?.();
      return;
    }
    killTweenTargets(this.scene, rect);
    entry.inUse = false;
    resetRectangle(rect);
  }

  tween(target: Phaser.GameObjects.GameObject, config: Phaser.Types.Tweens.TweenBuilderConfig, releaseKind: string | null = null) {
    const scene = this.scene;
    const onComplete = config.onComplete as (() => void) | undefined;
    return scene.tweens.add({
      ...config,
      targets: target,
      onComplete: () => {
        onComplete?.();
        if (releaseKind === "circle") this.releaseCircle(target as Phaser.GameObjects.Arc);
        else if (releaseKind === "text") this.releaseText(target as Phaser.GameObjects.Text);
        else if (releaseKind === "graphics") this.releaseGraphics(target as Phaser.GameObjects.Graphics);
        else if (releaseKind === "rectangle") this.releaseRectangle(target as Phaser.GameObjects.Rectangle);
      }
    });
  }

  createCircleEntry(): CircleEntry | null {
    if (this.circles.length >= this.limits.circles) return null;
    const node = this.scene.add.circle(0, 0, 8, 0xffffff, 0);
    node.setVisible(false);
    const entry = { node, inUse: false };
    this.circles.push(entry);
    return entry;
  }

  createTextEntry(): TextEntry | null {
    if (this.texts.length >= this.limits.texts) return null;
    const node = this.scene.add.text(0, 0, "", { fontSize: "14px" });
    node.setVisible(false);
    const entry = { node, inUse: false };
    this.texts.push(entry);
    return entry;
  }

  createGraphicsEntry(): GraphicsEntry | null {
    if (this.graphics.length >= this.limits.graphics) return null;
    const node = this.scene.add.graphics();
    node.setVisible(false);
    const entry = { node, inUse: false };
    this.graphics.push(entry);
    return entry;
  }

  createRectangleEntry(): RectangleEntry | null {
    if (this.rectangles.length >= this.limits.rectangles) return null;
    const node = this.scene.add.rectangle(0, 0, 8, 4, 0xffffff, 0);
    node.setVisible(false);
    const entry = { node, inUse: false };
    this.rectangles.push(entry);
    return entry;
  }

  drain() {
    this.circles.forEach((entry) => entry.node?.destroy?.());
    this.texts.forEach((entry) => entry.node?.destroy?.());
    this.graphics.forEach((entry) => entry.node?.destroy?.());
    this.rectangles.forEach((entry) => entry.node?.destroy?.());
    this.circles = [];
    this.texts = [];
    this.graphics = [];
    this.rectangles = [];
  }
}

export function releaseFxNode(pool: FxPool | null | undefined, node: FxNode | null | undefined, kind = "circle") {
  if (!node) return;
  if (!pool) {
    node.destroy?.();
    return;
  }
  if (kind === "text") pool.releaseText(node as Phaser.GameObjects.Text);
  else if (kind === "graphics") pool.releaseGraphics(node as Phaser.GameObjects.Graphics);
  else if (kind === "rectangle") pool.releaseRectangle(node as Phaser.GameObjects.Rectangle);
  else pool.releaseCircle(node as Phaser.GameObjects.Arc);
}