interface ViewportLike {
    visualViewport?: { width?: unknown; height?: unknown };
    innerWidth?: unknown;
    innerHeight?: unknown;
    screen?: { width?: unknown; height?: unknown };
    devicePixelRatio?: unknown;
    navigator?: { userAgent?: unknown };
}

function isMobileLikeViewport(viewport: ViewportLike | null | undefined): boolean {
  const width = Number(viewport?.visualViewport?.width ?? viewport?.innerWidth ?? viewport?.screen?.width ?? 0);
  const height = Number(viewport?.visualViewport?.height ?? viewport?.innerHeight ?? viewport?.screen?.height ?? 0);
  const shortestEdge = Math.min(width || Number.MAX_SAFE_INTEGER, height || Number.MAX_SAFE_INTEGER);
  const userAgent = String(viewport?.navigator?.userAgent ?? "");
  return shortestEdge <= 900 || /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);
}

export function getRenderDevicePixelRatio(viewport: ViewportLike | null | undefined = globalThis.window as unknown as ViewportLike | null): number {
  const rawDpr = Number(viewport?.devicePixelRatio ?? 1);
  const safeDpr = Number.isFinite(rawDpr) && rawDpr > 0 ? rawDpr : 1;
  const maxDpr = isMobileLikeViewport(viewport) ? 2 : 5;
  return Math.max(1, Math.min(safeDpr, maxDpr));
}
