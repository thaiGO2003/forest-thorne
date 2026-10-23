function hashSeedString(seedText: unknown = ""): number {
  const input = String(seedText || "");
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

export function normalizeSeed(seed: unknown = 1): number {
  if (Number.isFinite(seed)) {
    const normalized = Math.floor(seed as number) >>> 0;
    return normalized === 0 ? 1 : normalized;
  }
  if (typeof seed === "string" && seed.trim()) {
    const normalized = hashSeedString(seed.trim()) >>> 0;
    return normalized === 0 ? 1 : normalized;
  }
  return 1;
}

export function createSeededRandom(seed: unknown = 1): () => number {
  let state = normalizeSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let next = Math.imul(state ^ (state >>> 15), 1 | state);
    next ^= next + Math.imul(next ^ (next >>> 7), 61 | next);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}
