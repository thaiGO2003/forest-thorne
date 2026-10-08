import { describe, expect, it, vi } from "vitest";
import { registerForestThroneServiceWorker, SERVICE_WORKER_URL } from "../src/platform/serviceWorker";

interface ListenerMap { [type: string]: ((event: any) => void)[] | undefined }

const listenable = <T extends object>(target: T) => {
  const listeners: ListenerMap = {};
  return Object.assign(target, {
    addEventListener(type: string, listener: (event: any) => void) {
      (listeners[type] ??= []).push(listener);
    },
    emit(type: string, event: any = {}) {
      for (const listener of listeners[type] ?? []) listener(event);
    },
  });
};

function harness(readyState: DocumentReadyState = "complete", hadController = true) {
  const controller = hadController ? { postMessage: vi.fn() } : null;
  const waiting = { postMessage: vi.fn() };
  const registration = listenable({
    waiting,
    installing: null as ServiceWorker | null,
    active: controller,
    update: vi.fn(async () => registration),
  });
  const serviceWorker = listenable({
    controller,
    register: vi.fn(async () => registration),
  });
  const loadListeners: (() => void)[] = [];
  const store = new Map<string, string>();
  const reload = vi.fn();
  const documentRef = { readyState } as Document;
  const windowRef = {
    addEventListener(type: string, listener: () => void) {
      if (type === "load") loadListeners.push(listener);
    },
    sessionStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
    },
    location: { reload },
  } as unknown as Window;
  const navigatorRef = { serviceWorker } as unknown as Navigator;
  return { controller, waiting, registration, serviceWorker, loadListeners, store, reload, documentRef, windowRef, navigatorRef };
}

describe("A51.4 service-worker client", () => {
  it("registers only in production and waits for page load", async () => {
    const h = harness("loading");
    expect(await registerForestThroneServiceWorker({
      production: false, appVersion: "0.1.0", navigatorRef: h.navigatorRef, documentRef: h.documentRef, windowRef: h.windowRef,
    })).toBeNull();
    expect(h.serviceWorker.register).not.toHaveBeenCalled();

    const pending = registerForestThroneServiceWorker({
      production: true, appVersion: "0.1.0", navigatorRef: h.navigatorRef, documentRef: h.documentRef, windowRef: h.windowRef,
    });
    expect(h.serviceWorker.register).not.toHaveBeenCalled();
    h.loadListeners[0]!();
    await pending;
    expect(h.serviceWorker.register).toHaveBeenCalledWith(SERVICE_WORKER_URL);
    expect(h.controller?.postMessage).toHaveBeenCalledWith({ type: "CLIENT_VERSION", version: "0.1.0" });
  });

  it("updates mismatched workers and requests waiting-worker activation", async () => {
    const h = harness();
    await registerForestThroneServiceWorker({
      production: true, appVersion: "0.2.0", navigatorRef: h.navigatorRef, documentRef: h.documentRef, windowRef: h.windowRef,
    });
    h.serviceWorker.emit("message", { data: { type: "SW_VERSION", version: "0.1.0", cacheName: "forest-throne-0.1.0", matches: false } });
    await Promise.resolve();
    await Promise.resolve();
    expect(h.registration.update).toHaveBeenCalledTimes(1);
    expect(h.waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });

  it("reloads once on controller replacement and clears the guard after a version match", async () => {
    const h = harness();
    await registerForestThroneServiceWorker({
      production: true, appVersion: "0.1.0", navigatorRef: h.navigatorRef, documentRef: h.documentRef, windowRef: h.windowRef,
    });
    h.serviceWorker.emit("controllerchange");
    h.serviceWorker.emit("controllerchange");
    expect(h.reload).toHaveBeenCalledTimes(1);
    expect(h.store.get("forest-throne-sw-reload:0.1.0")).toBe("1");

    h.serviceWorker.emit("message", { data: { type: "SW_VERSION", version: "0.1.0", cacheName: "forest-throne-0.1.0", matches: true } });
    expect(h.store.has("forest-throne-sw-reload:0.1.0")).toBe(false);
  });
});
