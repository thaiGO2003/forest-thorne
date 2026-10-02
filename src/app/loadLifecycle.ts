export const BOOT_MIN_VISIBLE_MS = 1400;
export const BOOT_READY_GRACE_MS = 120;

export interface RequestGate {
  begin(): number;
  isCurrent(token: number): boolean;
  invalidate(): void;
  dispose(): void;
}

/**
 * Generation gate for async screen work. Starting a new request invalidates every older token;
 * disposing the owner permanently invalidates all current/future completions.
 */
export function createRequestGate(): RequestGate {
  let generation = 0;
  let disposed = false;
  return {
    begin() {
      if (disposed) return -1;
      generation += 1;
      return generation;
    },
    isCurrent(token) {
      return !disposed && token > 0 && token === generation;
    },
    invalidate() {
      generation += 1;
    },
    dispose() {
      disposed = true;
      generation += 1;
    },
  };
}

/** A64/A115: loader stays visible >=1400ms and waits >=120ms after readiness. */
export function bootTransitionDelay(visibleSinceMs: number, readyAtMs: number): number {
  const elapsed = Math.max(0, readyAtMs - visibleSinceMs);
  return Math.max(BOOT_READY_GRACE_MS, BOOT_MIN_VISIBLE_MS - elapsed);
}

export function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}
