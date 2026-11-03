// App teardown hook (issue #12): app.dispose() existed but nothing in production ever called it,
// so audio contexts, listeners and the renderer survived a reload/HMR swap.
export interface TeardownTarget {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

export interface TeardownRegistration {
  unregister(): void;
  /** Exposed for tests: the exact page lifecycle events the app listens to. */
  readonly events: readonly string[];
}

export const TEARDOWN_EVENTS = ["pagehide", "beforeunload"] as const;

/**
 * Register `dispose` for page lifecycle + HMR. Returns an unregister handle; `dispose` is guarded so
 * a pagehide followed by beforeunload (both fire on a real reload) only tears down once.
 */
export function registerAppTeardown(
  target: TeardownTarget | null | undefined,
  dispose: () => void,
  hot?: { dispose(cb: () => void): void } | null,
): TeardownRegistration {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    try { dispose(); } catch { /* teardown must never block navigation */ }
  };
  const events = [...TEARDOWN_EVENTS];
  if (target) for (const event of events) target.addEventListener(event, run);
  hot?.dispose(run);
  return {
    events,
    unregister() {
      if (target) for (const event of events) target.removeEventListener(event, run);
    },
  };
}
