export const SERVICE_WORKER_VERSION = "0.1.0";
export const SERVICE_WORKER_CACHE_NAMESPACE = "forest-throne-";
export const SERVICE_WORKER_CACHE_NAME = `${SERVICE_WORKER_CACHE_NAMESPACE}${SERVICE_WORKER_VERSION}`;
export const SERVICE_WORKER_PRECACHE = ["./", "./index.html", "./manifest.json", "./favicon.ico"] as const;

export type ServiceWorkerFetchStrategy = "bypass" | "cache-first" | "network-first" | "untouched";

const CACHE_FIRST_SUFFIXES = [".woff2", ".ogg", ".mp3", ".png", ".jpg", ".svg"] as const;

export function serviceWorkerFetchStrategy(method: string, rawUrl: string): ServiceWorkerFetchStrategy {
  if (method.toUpperCase() !== "GET") return "untouched";
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return "network-first";
  }
  if (!url.protocol.startsWith("http")) return "bypass";
  const path = url.pathname.toLowerCase();
  if (path.includes("/assets/") || CACHE_FIRST_SUFFIXES.some((suffix) => path.endsWith(suffix))) {
    return "cache-first";
  }
  return "network-first";
}

export function staleForestThroneCaches(keys: readonly string[]): string[] {
  return keys.filter((key) =>
    key.startsWith(SERVICE_WORKER_CACHE_NAMESPACE) && key !== SERVICE_WORKER_CACHE_NAME);
}

export interface ServiceWorkerVersionReply {
  type: "SW_VERSION";
  version: string;
  cacheName: string;
  matches: boolean;
}

export function serviceWorkerVersionReply(clientVersion: unknown): ServiceWorkerVersionReply {
  return {
    type: "SW_VERSION",
    version: SERVICE_WORKER_VERSION,
    cacheName: SERVICE_WORKER_CACHE_NAME,
    matches: clientVersion === SERVICE_WORKER_VERSION,
  };
}
