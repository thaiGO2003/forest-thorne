import * as THREE from "three";

/**
 * ============================================================================
 * 1. INTERFACES & TYPES
 * ============================================================================
 */

export interface PoolLimits {
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

export interface ActiveTween {
  target: THREE.Object3D;
  duration: number;
  elapsed: number;
  fromScale: number;
  toScale?: number;
  fromAlpha: number;
  toAlpha?: number;
  fromY: number;
  toY?: number;
  onComplete?: () => void;
  releaseKind?: string | null;
}

/**
 * ============================================================================
 * 2. CLASS DEFINITION
 * ============================================================================
 */

/**
 * Object pooling for 3D visual effects (rings, damage floaters, quads, graphics).
 * Pure Three.js implementation with no engine-specific external dependencies.
 */
export class ThreeFxPool {
  public limits: PoolLimits;
  public group: THREE.Group;

  private circles: Array<{ node: THREE.Mesh; inUse: boolean }> = [];
  private texts: Array<{ node: THREE.Sprite; inUse: boolean }> = [];
  private graphics: Array<{ node: THREE.Group; inUse: boolean }> = [];
  private rectangles: Array<{ node: THREE.Mesh; inUse: boolean }> = [];
  private activeTweens: ActiveTween[] = [];

  private sharedCircleGeometry = new THREE.RingGeometry(0.8, 1.0, 16);
  private sharedRectGeometry = new THREE.PlaneGeometry(1, 1);

  constructor(public scene: THREE.Scene, limits: Partial<PoolLimits> = DEFAULT_POOL_LIMITS) {
    this.limits = { ...DEFAULT_POOL_LIMITS, ...limits };
    this.group = new THREE.Group();
    this.group.name = "three-fx-pool";
    this.scene.add(this.group);
  }

  public prewarm({ circles = 0, texts = 0, graphics = 0, rectangles = 0 }: Partial<PoolLimits> = {}): void {
    for (let i = this.circles.length; i < circles; i += 1) {
      const node = this.createCircleNode();
      node.visible = false;
      this.circles.push({ node, inUse: false });
    }
    for (let i = this.texts.length; i < texts; i += 1) {
      const node = this.createTextNode();
      node.visible = false;
      this.texts.push({ node, inUse: false });
    }
    for (let i = this.graphics.length; i < graphics; i += 1) {
      const node = new THREE.Group();
      node.visible = false;
      this.group.add(node);
      this.graphics.push({ node, inUse: false });
    }
    for (let i = this.rectangles.length; i < rectangles; i += 1) {
      const node = this.createRectangleNode();
      node.visible = false;
      this.rectangles.push({ node, inUse: false });
    }
  }

  public acquireCircle(x: number, y: number, radius: number = 1, color: number = 0xffd17b, alpha: number = 1): THREE.Mesh {
    let entry = this.circles.find((item) => !item.inUse);
    if (!entry) {
      const node = this.createCircleNode();
      entry = { node, inUse: true };
      this.circles.push(entry);
    } else {
      entry.inUse = true;
    }
    const mesh = entry.node;
    mesh.position.set(x, y, 0);
    mesh.scale.set(radius, radius, 1);
    const mat = mesh.material as THREE.MeshBasicMaterial;
    mat.color.setHex(color);
    mat.opacity = alpha;
    mat.transparent = alpha < 1;
    mesh.visible = true;
    return mesh;
  }

  public releaseCircle(circle: THREE.Mesh | null | undefined): void {
    if (!circle) return;
    const entry = this.circles.find((item) => item.node === circle);
    if (entry) {
      entry.inUse = false;
      circle.visible = false;
    }
  }

  public acquireText(x: number, y: number, content: string | number, color: string = "#ffffff"): THREE.Sprite {
    let entry = this.texts.find((item) => !item.inUse);
    if (!entry) {
      const node = this.createTextNode();
      entry = { node, inUse: true };
      this.texts.push(entry);
    } else {
      entry.inUse = true;
    }
    const sprite = entry.node;
    sprite.position.set(x, y, 0);
    this.drawTextSprite(sprite, String(content), color);
    sprite.visible = true;
    return sprite;
  }

  public releaseText(text: THREE.Sprite | null | undefined): void {
    if (!text) return;
    const entry = this.texts.find((item) => item.node === text);
    if (entry) {
      entry.inUse = false;
      text.visible = false;
    }
  }

  public acquireRectangle(x: number, y: number, width: number = 1, height: number = 1, color: number = 0xffffff, alpha: number = 1): THREE.Mesh {
    let entry = this.rectangles.find((item) => !item.inUse);
    if (!entry) {
      const node = this.createRectangleNode();
      entry = { node, inUse: true };
      this.rectangles.push(entry);
    } else {
      entry.inUse = true;
    }
    const mesh = entry.node;
    mesh.position.set(x, y, 0);
    mesh.scale.set(width, height, 1);
    const mat = mesh.material as THREE.MeshBasicMaterial;
    mat.color.setHex(color);
    mat.opacity = alpha;
    mat.transparent = alpha < 1;
    mesh.visible = true;
    return mesh;
  }

  public releaseRectangle(rect: THREE.Mesh | null | undefined): void {
    if (!rect) return;
    const entry = this.rectangles.find((item) => item.node === rect);
    if (entry) {
      entry.inUse = false;
      rect.visible = false;
    }
  }

  public acquireGraphics(): THREE.Group {
    let entry = this.graphics.find((item) => !item.inUse);
    if (!entry) {
      const node = new THREE.Group();
      this.group.add(node);
      entry = { node, inUse: true };
      this.graphics.push(entry);
    } else {
      entry.inUse = true;
    }
    entry.node.visible = true;
    return entry.node;
  }

  public releaseGraphics(graphics: THREE.Group | null | undefined): void {
    if (!graphics) return;
    const entry = this.graphics.find((item) => item.node === graphics);
    if (entry) {
      entry.inUse = false;
      graphics.visible = false;
      while (graphics.children.length > 0) {
        const child = graphics.children[0] as THREE.Mesh;
        graphics.remove(child);
        child.geometry?.dispose();
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material?.dispose();
      }
    }
  }

  public tween(
    target: THREE.Object3D,
    config: { duration: number; scale?: number; alpha?: number; y?: number; onComplete?: () => void },
    releaseKind: string | null = null
  ): void {
    const fromScale = target.scale.x;
    const fromAlpha = (target as THREE.Mesh).material ? ((target as THREE.Mesh).material as THREE.Material & { opacity?: number }).opacity ?? 1 : 1;
    const fromY = target.position.y;

    this.activeTweens.push({
      target,
      duration: Math.max(0.01, config.duration / 1000),
      elapsed: 0,
      fromScale,
      toScale: config.scale,
      fromAlpha,
      toAlpha: config.alpha,
      fromY,
      toY: config.y,
      onComplete: config.onComplete,
      releaseKind
    });
  }

  public update(delta: number): void {
    for (let i = this.activeTweens.length - 1; i >= 0; i -= 1) {
      const tween = this.activeTweens[i];
      tween.elapsed += delta;
      const progress = Math.min(1, tween.elapsed / tween.duration);

      if (tween.toScale !== undefined) {
        const currentScale = THREE.MathUtils.lerp(tween.fromScale, tween.toScale, progress);
        tween.target.scale.setScalar(currentScale);
      }
      if (tween.toAlpha !== undefined) {
        const mat = (tween.target as THREE.Mesh).material as (THREE.Material & { opacity?: number; transparent?: boolean }) | undefined;
        if (mat) {
          mat.opacity = THREE.MathUtils.lerp(tween.fromAlpha, tween.toAlpha, progress);
          mat.transparent = true;
        }
      }
      if (tween.toY !== undefined) {
        tween.target.position.y = THREE.MathUtils.lerp(tween.fromY, tween.toY, progress);
      }

      if (progress >= 1) {
        this.activeTweens.splice(i, 1);
        tween.onComplete?.();
        if (tween.releaseKind === "circle") this.releaseCircle(tween.target as THREE.Mesh);
        else if (tween.releaseKind === "text") this.releaseText(tween.target as THREE.Sprite);
        else if (tween.releaseKind === "rectangle") this.releaseRectangle(tween.target as THREE.Mesh);
        else if (tween.releaseKind === "graphics") this.releaseGraphics(tween.target as THREE.Group);
      }
    }
  }

  public getActiveCount(): number {
    const circles = this.circles.filter((c) => c.inUse).length;
    const texts = this.texts.filter((t) => t.inUse).length;
    const graphics = this.graphics.filter((g) => g.inUse).length;
    const rectangles = this.rectangles.filter((r) => r.inUse).length;
    return circles + texts + graphics + rectangles;
  }

  public releaseAll(): void {
    this.circles.forEach((item) => {
      item.inUse = false;
      item.node.visible = false;
    });
    this.texts.forEach((item) => {
      item.inUse = false;
      item.node.visible = false;
    });
    this.rectangles.forEach((item) => {
      item.inUse = false;
      item.node.visible = false;
    });
    this.graphics.forEach((item) => {
      item.inUse = false;
      item.node.visible = false;
    });
    this.activeTweens = [];
  }

  public destroy(): void {
    this.dispose();
  }

  public dispose(): void {
    this.releaseAll();
    this.scene.remove(this.group);
    this.sharedCircleGeometry.dispose();
    this.sharedRectGeometry.dispose();
    this.circles.forEach((item) => {
      (item.node.material as THREE.Material).dispose();
    });
    this.texts.forEach((item) => {
      (item.node.material as THREE.SpriteMaterial).map?.dispose();
      (item.node.material as THREE.SpriteMaterial).dispose();
    });
    this.rectangles.forEach((item) => {
      (item.node.material as THREE.Material).dispose();
    });
  }

  private createCircleNode(): THREE.Mesh {
    const material = new THREE.MeshBasicMaterial({ color: 0xffd17b, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(this.sharedCircleGeometry, material);
    mesh.rotation.x = -Math.PI / 2;
    this.group.add(mesh);
    return mesh;
  }

  private createRectangleNode(): THREE.Mesh {
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(this.sharedRectGeometry, material);
    this.group.add(mesh);
    return mesh;
  }

  private createTextNode(): THREE.Sprite {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 32;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(2, 0.5, 1);
    sprite.userData.canvas = canvas;
    this.group.add(sprite);
    return sprite;
  }

  private drawTextSprite(sprite: THREE.Sprite, content: string, color: string): void {
    const canvas = sprite.userData.canvas as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "bold 20px sans-serif";
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(content, canvas.width / 2, canvas.height / 2);
    const map = (sprite.material as THREE.SpriteMaterial).map;
    if (map) map.needsUpdate = true;
  }
}

export default ThreeFxPool;
