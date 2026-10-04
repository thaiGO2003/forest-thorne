const WORKER_VERSION = "0.1.0";
const CACHE_NAMESPACE = "forest-throne-";
const CACHE_NAME = `${CACHE_NAMESPACE}${WORKER_VERSION}`;
const CORE_PRECACHE = ["./", "./index.html", "./manifest.json", "./favicon.ico"];
const CACHE_FIRST_SUFFIXES = [".woff2", ".ogg", ".mp3", ".png", ".jpg", ".svg"];

const shouldBypass = (url) => /-extension:$/.test(url.protocol);
const shouldCacheFirst = (url) => url.pathname.includes("/assets/")
  || CACHE_FIRST_SUFFIXES.some((suffix) => url.pathname.endsWith(suffix));

async function putStatus200(cache, request, response) {
  if (response.status === 200) await cache.put(request, response.clone());
  return response;
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const hit = await cache.match(request);
  if (hit) return hit;
  return putStatus200(cache, request, await fetch(request));
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    return await putStatus200(cache, request, await fetch(request));
  } catch {
    const hit = await cache.match(request);
    if (hit) return hit;
    if (request.mode === "navigate") {
      const shell = await cache.match("./index.html");
      if (shell) return shell;
    }
    return new Response("Network offline", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(CORE_PRECACHE.map(async (url) => {
      try {
        const response = await fetch(url, { cache: "reload" });
        if (response.status === 200) {
          await cache.put(url, response);
        } else if (url !== "./favicon.ico") {
          throw new Error(`Core precache failed: ${url} (${response.status})`);
        }
      } catch (error) {
        // The repo does not yet ship visual favicon artwork; all headless shell files stay mandatory.
        if (url !== "./favicon.ico") throw error;
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith(CACHE_NAMESPACE) && name !== CACHE_NAME)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (shouldBypass(url)) return;
  event.respondWith(shouldCacheFirst(url) ? cacheFirst(request) : networkFirst(request));
});

self.addEventListener("message", (event) => {
  const message = event.data;
  if (message?.type === "SKIP_WAITING") {
    void self.skipWaiting();
    return;
  }
  if (message?.type !== "CLIENT_VERSION") return;
  event.source?.postMessage({
    type: "SW_VERSION",
    version: WORKER_VERSION,
    cacheName: CACHE_NAME,
    matches: message.version === WORKER_VERSION,
  });
});
