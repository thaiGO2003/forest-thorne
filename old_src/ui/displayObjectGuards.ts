export function isDisplayObjectAlive(obj: unknown): obj is { active?: boolean; scene?: unknown } {
  return !!obj && obj !== null && typeof obj === "object" && (obj as { active?: boolean; scene?: unknown }).active !== false && !!(obj as { active?: boolean; scene?: unknown }).scene;
}

export function isRenderableText(text: unknown): text is { texture: { source: unknown[] } & { source?: unknown[] } } {
  if (!isDisplayObjectAlive(text)) return false;
  const texture = (text as { texture: { source?: unknown[] } }).texture;
  const source = texture?.source?.[0];
  return !!source;
}

export function safeSetVisible(obj: unknown, visible: boolean): void {
  if (!isDisplayObjectAlive(obj)) return;
  const o = obj as { setVisible?: (v: boolean) => void };
  if (typeof o.setVisible !== "function") return;
  o.setVisible(visible);
}

export function safeSetText(text: unknown, value: unknown): void {
  if (!isRenderableText(text)) return;
  const t = text as { setText?: (v: unknown) => void };
  if (typeof t.setText !== "function") return;
  t.setText(value);
}

export function safeSetColor(text: unknown, value: string): void {
  if (!isRenderableText(text)) return;
  const t = text as { setColor?: (v: string) => void };
  if (typeof t.setColor !== "function") return;
  t.setColor(value);
}

export function safeSetTint(obj: unknown, tint: number): void {
  if (!isRenderableText(obj)) return;
  const o = obj as { setTint?: (v: number) => void };
  if (typeof o.setTint !== "function") return;
  o.setTint(tint);
}

export function safeSetFillStyle(shape: unknown, ...args: unknown[]): void {
  if (!isDisplayObjectAlive(shape)) return;
  const s = shape as { setFillStyle?: (...args: unknown[]) => void };
  if (typeof s.setFillStyle !== "function") return;
  s.setFillStyle(...args);
}

export function safeSetStrokeStyle(shape: unknown, ...args: unknown[]): void {
  if (!isDisplayObjectAlive(shape)) return;
  const s = shape as { setStrokeStyle?: (...args: unknown[]) => void };
  if (typeof s.setStrokeStyle !== "function") return;
  s.setStrokeStyle(...args);
}

export function safeSetAlpha(obj: unknown, value: number): void {
  if (!isDisplayObjectAlive(obj)) return;
  const o = obj as { setAlpha?: (v: number) => void };
  if (typeof o.setAlpha !== "function") return;
  o.setAlpha(value);
}

export function safeSetY(obj: unknown, value: number): void {
  if (!isDisplayObjectAlive(obj)) return;
  const o = obj as { setY?: (v: number) => void };
  if (typeof o.setY !== "function") return;
  o.setY(value);
}

export function safeShiftY(obj: unknown, delta: number): void {
  if (!isDisplayObjectAlive(obj)) return;
  const o = obj as { y?: number };
  if (typeof o.y !== "number") return;
  o.y -= delta;
}

export function safeDestroy(obj: unknown): void {
  if (!obj) return;
  const o = obj as { destroy?: () => void };
  if (typeof o.destroy !== "function") return;
  o.destroy();
}