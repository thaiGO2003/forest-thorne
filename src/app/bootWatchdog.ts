export const BOOT_WATCHDOG_MS = 10_000;

export interface BootWatchdogOptions {
  isTest?: boolean;
  isBootComplete(): boolean;
  hasAppInstance(): boolean;
  onTimeout(): void;
  setTimer?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
}

export interface BootWatchdog {
  dispose(): void;
}

export function createBootWatchdog(options: BootWatchdogOptions): BootWatchdog {
  const setTimer = options.setTimer ?? setTimeout;
  const clearTimer = options.clearTimer ?? clearTimeout;
  if (options.isTest) return { dispose: () => undefined };

  let disposed = false;
  const timer = setTimer(() => {
    if (disposed || options.isBootComplete() || options.hasAppInstance()) return;
    options.onTimeout();
  }, BOOT_WATCHDOG_MS);

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      clearTimer(timer);
    },
  };
}
