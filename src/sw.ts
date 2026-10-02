import {
  SERVICE_WORKER_CACHE_NAME,
  SERVICE_WORKER_PRECACHE,
  serviceWorkerFetchStrategy,
  serviceWorkerVersionReply,
  staleForestThroneCaches,
} from "./platform/serviceWorkerPolicy";

type ExtendableEventLike = Event & { waitUntil(promise: Promise<unknown>): void };
type FetchEventLike = ExtendableEventLike & { request: Request; respondWith(response: Promise<Response> | Response): void };
type MessageEventLike = MessageEvent<unknown> & { source: { postMessage(message: unknown): void } | null };

interface WorkerRuntime {
  skipWaiting(): Promise<void>;
  clients: { claim(): Promise<void> };
  addEventListener(type: string, listener: EventListener): void;
}

const runtime = globalThis as unknown as Partial<WorkerRuntime>;

async function cacheFirst(request: Request): Promise<Response> {
  const cache = await caches.open(SERVICE_WORKER_CACHE_NAME);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.status === 200) await cache.put(request, response.clone());
  return response;
}

async function networkFirst(request: Request): Promise<Response> {
  const cache = await caches.open(SERVICE_WORKER_CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.status === 200) await cache.put(request, response.clone());
    return response;
  } catch {
    const hit = await cache.match(request);
    if (hit) return hit;
    if (request.mode === "navigate") {
      const shell = await cache.match("./index.html");
      if (shell) return shell;
    }
    return new Response("Network offline", { status: 503 });
  }
}

if (runtime.addEventListener && runtime.skipWaiting && runtime.clients) {
  runtime.addEventListener("install", ((event: ExtendableEventLike) => {
    event.waitUntil((async () => {
      const cache = await caches.open(SERVICE_WORKER_CACHE_NAME);
      await cache.addAll([...SERVICE_WORKER_PRECACHE]);
      await runtime.skipWaiting!();
    })());
  }) as EventListener);

  runtime.addEventListener("activate", ((event: ExtendableEventLike) => {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(staleForestThroneCaches(keys).map((key) => caches.delete(key)));
      await runtime.clients!.claim();
    })());
  }) as EventListener);

  runtime.addEventListener("fetch", ((event: FetchEventLike) => {
    const strategy = serviceWorkerFetchStrategy(event.request.method, event.request.url);
    if (strategy === "untouched" || strategy === "bypass") return;
    event.respondWith(strategy === "cache-first" ? cacheFirst(event.request) : networkFirst(event.request));
  }) as EventListener);

  runtime.addEventListener("message", ((event: MessageEventLike) => {
    const data = event.data;
    if (!data || typeof data !== "object") return;
    const message = data as Record<string, unknown>;
    if (message.type === "SKIP_WAITING") {
      void runtime.skipWaiting!();
      return;
    }
    if (message.type === "CLIENT_VERSION") {
      event.source?.postMessage(serviceWorkerVersionReply(message.version));
    }
  }) as EventListener);
}
