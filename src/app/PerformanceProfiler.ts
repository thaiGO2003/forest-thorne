export type PerformanceQuality = "low" | "medium" | "high";

export interface PerformanceSnapshot {
  fps: number;
  frameTimeMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  quality: PerformanceQuality;
  isThrottled: boolean;
  sampleCount: number;
}

export interface PerformanceSampleDetails {
  drawCalls?: number;
  triangles?: number;
  geometries?: number;
  textures?: number;
}

export interface PerformanceProfilerOptions {
  sampleWindow?: number;
  targetFps?: number;
  lowFpsThreshold?: number;
  drawCallThreshold?: number;
  adaptiveQuality?: boolean;
  quality?: PerformanceQuality;
  onDegrade?: (quality: PerformanceQuality, snapshot: PerformanceSnapshot) => void;
  onRecover?: (quality: PerformanceQuality, snapshot: PerformanceSnapshot) => void;
}

export interface PerformanceProfilerConfig {
  sampleWindow: number;
  targetFps: number;
  lowFpsThreshold: number;
  drawCallThreshold: number;
  adaptiveQuality: boolean;
}

export const DEFAULT_PERFORMANCE_CONFIG: Readonly<PerformanceProfilerConfig> = {
  sampleWindow: 60,
  targetFps: 60,
  lowFpsThreshold: 45,
  drawCallThreshold: 50,
  adaptiveQuality: true,
} as const;

const QUALITY_ORDER: readonly PerformanceQuality[] = ["low", "medium", "high"];
const QUALITY_BUDGET: Record<PerformanceQuality, number> = { high: 1, medium: 0.75, low: 0.5 };

export function vfxBudgetMultiplier(quality: PerformanceQuality, isThrottled: boolean): number {
  const value = QUALITY_BUDGET[quality] * (isThrottled ? 0.7 : 1);
  return Math.max(0.25, value);
}

export class PerformanceProfiler {
  private readonly config: PerformanceProfilerConfig;
  private readonly onDegrade?: PerformanceProfilerOptions["onDegrade"];
  private readonly onRecover?: PerformanceProfilerOptions["onRecover"];
  private readonly frameTimes: number[] = [];
  private previousTimestamp: number | null = null;
  private slowFrames = 0;
  private fastFrames = 0;
  private disposed = false;
  private snapshot: PerformanceSnapshot;

  constructor(options: PerformanceProfilerOptions = {}) {
    this.config = {
      sampleWindow: Math.max(1, Math.round(options.sampleWindow ?? DEFAULT_PERFORMANCE_CONFIG.sampleWindow)),
      targetFps: Math.max(1, Number(options.targetFps ?? DEFAULT_PERFORMANCE_CONFIG.targetFps)),
      lowFpsThreshold: Math.max(1, Number(options.lowFpsThreshold ?? DEFAULT_PERFORMANCE_CONFIG.lowFpsThreshold)),
      drawCallThreshold: Math.max(0, Number(options.drawCallThreshold ?? DEFAULT_PERFORMANCE_CONFIG.drawCallThreshold)),
      adaptiveQuality: options.adaptiveQuality ?? DEFAULT_PERFORMANCE_CONFIG.adaptiveQuality,
    };
    this.onDegrade = options.onDegrade;
    this.onRecover = options.onRecover;
    this.snapshot = {
      fps: this.config.targetFps,
      frameTimeMs: 1000 / this.config.targetFps,
      drawCalls: 0,
      triangles: 0,
      geometries: 0,
      textures: 0,
      quality: options.quality ?? "high",
      isThrottled: false,
      sampleCount: 0,
    };
  }

  getSnapshot(): PerformanceSnapshot {
    return { ...this.snapshot };
  }

  setQuality(quality: PerformanceQuality): void {
    if (this.disposed) return;
    this.snapshot.quality = quality;
    this.slowFrames = 0;
    this.fastFrames = 0;
  }

  getVfxBudgetMultiplier(): number {
    return vfxBudgetMultiplier(this.snapshot.quality, this.snapshot.isThrottled);
  }

  sample(timestampMs: number, details: PerformanceSampleDetails = {}): PerformanceSnapshot {
    if (this.disposed) return this.getSnapshot();
    const timestamp = Number.isFinite(timestampMs) ? timestampMs : 0;
    if (this.previousTimestamp === null) {
      this.previousTimestamp = timestamp;
      this.snapshot = {
        ...this.snapshot,
        drawCalls: Math.max(0, Math.round(details.drawCalls ?? this.snapshot.drawCalls)),
        triangles: Math.max(0, Math.round(details.triangles ?? this.snapshot.triangles)),
        geometries: Math.max(0, Math.round(details.geometries ?? this.snapshot.geometries)),
        textures: Math.max(0, Math.round(details.textures ?? this.snapshot.textures)),
      };
      return this.getSnapshot();
    }
    const rawDelta = timestamp - this.previousTimestamp;
    this.previousTimestamp = timestamp;
    const delta = Math.max(0.1, Number.isFinite(rawDelta) ? rawDelta : 0.1);
    this.frameTimes.push(delta);
    while (this.frameTimes.length > this.config.sampleWindow) this.frameTimes.shift();
    const average = this.frameTimes.reduce((sum, value) => sum + value, 0) / this.frameTimes.length;
    const fps = Math.min(120, Math.round(1000 / average));

    this.snapshot = {
      fps,
      frameTimeMs: average,
      drawCalls: Math.max(0, Math.round(details.drawCalls ?? this.snapshot.drawCalls)),
      triangles: Math.max(0, Math.round(details.triangles ?? this.snapshot.triangles)),
      geometries: Math.max(0, Math.round(details.geometries ?? this.snapshot.geometries)),
      textures: Math.max(0, Math.round(details.textures ?? this.snapshot.textures)),
      quality: this.snapshot.quality,
      isThrottled: this.snapshot.isThrottled,
      sampleCount: this.snapshot.sampleCount + 1,
    };

    this.updateAdaptiveQuality();
    return this.getSnapshot();
  }

  dispose(): void {
    this.disposed = true;
    this.slowFrames = 0;
    this.fastFrames = 0;
  }

  private updateAdaptiveQuality(): void {
    if (!this.config.adaptiveQuality) return;
    const underLoad = this.snapshot.fps < this.config.lowFpsThreshold
      || this.snapshot.drawCalls > this.config.drawCallThreshold;
    if (underLoad) {
      this.slowFrames++;
      this.fastFrames = 0;
      this.snapshot.isThrottled = true;
      if (this.slowFrames >= 30) {
        this.slowFrames = 0;
        const changed = this.stepQuality(-1);
        if (changed) this.onDegrade?.(this.snapshot.quality, this.getSnapshot());
      }
      return;
    }

    this.fastFrames++;
    this.slowFrames = 0;
    if (this.fastFrames >= 60) this.snapshot.isThrottled = false;
    if (this.fastFrames >= 180) {
      this.fastFrames = 0;
      const changed = this.stepQuality(1);
      if (changed) this.onRecover?.(this.snapshot.quality, this.getSnapshot());
    }
  }

  private stepQuality(direction: -1 | 1): boolean {
    const current = QUALITY_ORDER.indexOf(this.snapshot.quality);
    const next = Math.max(0, Math.min(QUALITY_ORDER.length - 1, current + direction));
    const quality = QUALITY_ORDER[next]!;
    if (quality === this.snapshot.quality) return false;
    this.snapshot.quality = quality;
    return true;
  }
}
