export const SERVICE_WORKER_URL = "./sw.js";

interface WorkerVersionMessage {
  type: "SW_VERSION";
  version: string;
  cacheName: string;
  matches: boolean;
}

export interface ServiceWorkerClientOptions {
  production: boolean;
  appVersion: string;
  navigatorRef?: Navigator;
  documentRef?: Document;
  windowRef?: Window;
}

const reloadGuardKey = (appVersion: string) => `forest-throne-sw-reload:${appVersion}`;

function isVersionMessage(value: unknown): value is WorkerVersionMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<WorkerVersionMessage>;
  return message.type === "SW_VERSION"
    && typeof message.version === "string"
    && typeof message.cacheName === "string"
    && typeof message.matches === "boolean";
}

function requestWaitingActivation(registration: ServiceWorkerRegistration): void {
  registration.waiting?.postMessage({ type: "SKIP_WAITING" });
}

function waitForDocumentLoad(documentRef: Document, windowRef: Window): Promise<void> {
  if (documentRef.readyState === "complete") return Promise.resolve();
  return new Promise((resolve) => windowRef.addEventListener("load", () => resolve(), { once: true }));
}

/** A51.4 production-only service-worker registration and version recovery protocol. */
export async function registerForestThroneServiceWorker(
  options: ServiceWorkerClientOptions,
): Promise<ServiceWorkerRegistration | null> {
  const navigatorRef = options.navigatorRef ?? (typeof navigator === "undefined" ? undefined : navigator);
  const documentRef = options.documentRef ?? (typeof document === "undefined" ? undefined : document);
  const windowRef = options.windowRef ?? (typeof window === "undefined" ? undefined : window);
  if (!options.production || !navigatorRef || !documentRef || !windowRef || !("serviceWorker" in navigatorRef)) return null;

  await waitForDocumentLoad(documentRef, windowRef);

  const serviceWorker = navigatorRef.serviceWorker;
  const hadControllerAtBoot = serviceWorker.controller !== null;
  const guardKey = reloadGuardKey(options.appVersion);
  const registration = await serviceWorker.register(SERVICE_WORKER_URL);
  let mismatchDetected = false;

  const activateWhenInstalled = () => {
    const installing = registration.installing;
    if (!installing) {
      requestWaitingActivation(registration);
      return;
    }
    installing.addEventListener("statechange", () => {
      if (installing.state === "installed") requestWaitingActivation(registration);
    });
  };

  registration.addEventListener("updatefound", () => {
    if (mismatchDetected) activateWhenInstalled();
  });

  serviceWorker.addEventListener("message", (event) => {
    if (!isVersionMessage(event.data)) return;
    if (event.data.matches) {
      windowRef.sessionStorage.removeItem(guardKey);
      return;
    }
    mismatchDetected = true;
    void registration.update().then(() => {
      requestWaitingActivation(registration);
      if (!registration.waiting) activateWhenInstalled();
    });
  });

  serviceWorker.addEventListener("controllerchange", () => {
    if (!hadControllerAtBoot || windowRef.sessionStorage.getItem(guardKey) === "1") return;
    windowRef.sessionStorage.setItem(guardKey, "1");
    windowRef.location.reload();
  });

  const versionTarget = serviceWorker.controller ?? registration.active;
  versionTarget?.postMessage({ type: "CLIENT_VERSION", version: options.appVersion });
  return registration;
}
