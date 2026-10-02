import { APP_VERSION } from "../core/appMeta";

export const SERVICE_WORKER_RELOAD_GUARD_PREFIX = "forest-throne.sw-reload.";

export interface ServiceWorkerLike {
  postMessage(message: unknown): void;
}

export interface ServiceWorkerRegistrationLike {
  waiting: ServiceWorkerLike | null;
  active: ServiceWorkerLike | null;
  update(): Promise<void>;
}

export interface ServiceWorkerContainerLike {
  controller: ServiceWorkerLike | null;
  register(scriptUrl: string): Promise<ServiceWorkerRegistrationLike>;
  addEventListener(type: "controllerchange" | "message", listener: EventListener): void;
  removeEventListener(type: "controllerchange" | "message", listener: EventListener): void;
}

export interface ServiceWorkerClientOptions {
  isProduction: boolean;
  readyState: DocumentReadyState;
  serviceWorker?: ServiceWorkerContainerLike | null;
  sessionStorage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  addWindowLoadListener?: (listener: () => void) => void;
  removeWindowLoadListener?: (listener: () => void) => void;
  reload?: () => void;
  scriptUrl?: string;
  appVersion?: string;
}

export interface ServiceWorkerClientHandle {
  registration: Promise<ServiceWorkerRegistrationLike | null>;
  dispose(): void;
}

export function startServiceWorkerClient(options: ServiceWorkerClientOptions): ServiceWorkerClientHandle {
  const serviceWorker = options.serviceWorker ?? null;
  if (!options.isProduction || !serviceWorker) {
    return { registration: Promise.resolve(null), dispose: () => undefined };
  }

  const appVersion = options.appVersion ?? APP_VERSION;
  const guardKey = `${SERVICE_WORKER_RELOAD_GUARD_PREFIX}${appVersion}`;
  const hadControllerAtBoot = serviceWorker.controller !== null;
  let disposed = false;
  let registration: ServiceWorkerRegistrationLike | null = null;
  let resolveRegistration: (value: ServiceWorkerRegistrationLike | null) => void = () => undefined;
  const registrationPromise = new Promise<ServiceWorkerRegistrationLike | null>((resolve) => {
    resolveRegistration = resolve;
  });

  const onControllerChange: EventListener = () => {
    if (disposed || !hadControllerAtBoot || !options.reload) return;
    const storage = options.sessionStorage;
    if (storage?.getItem(guardKey) === "1") return;
    storage?.setItem(guardKey, "1");
    options.reload();
  };

  const onMessage: EventListener = (event) => {
    const data = (event as MessageEvent<unknown>).data;
    if (!data || typeof data !== "object") return;
    const message = data as Record<string, unknown>;
    if (message.type !== "SW_VERSION") return;
    if (message.matches === true) {
      options.sessionStorage?.removeItem(guardKey);
      return;
    }
    void registration?.update().then(() => {
      registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
    });
  };

  serviceWorker.addEventListener("controllerchange", onControllerChange);
  serviceWorker.addEventListener("message", onMessage);

  const register = async () => {
    try {
      registration = await serviceWorker.register(options.scriptUrl ?? "./sw.js");
      (registration.active ?? serviceWorker.controller)?.postMessage({
        type: "CLIENT_VERSION",
        version: appVersion,
      });
      resolveRegistration(registration);
    } catch {
      resolveRegistration(null);
    }
  };

  const onLoad = () => {
    options.removeWindowLoadListener?.(onLoad);
    void register();
  };

  if (options.readyState === "complete") void register();
  else options.addWindowLoadListener?.(onLoad);

  return {
    registration: registrationPromise,
    dispose() {
      if (disposed) return;
      disposed = true;
      options.removeWindowLoadListener?.(onLoad);
      serviceWorker.removeEventListener("controllerchange", onControllerChange);
      serviceWorker.removeEventListener("message", onMessage);
    },
  };
}
