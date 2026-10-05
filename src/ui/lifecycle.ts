// Release DOM resources with the owning screen/modal, including canvas observers.
const cleanups = new WeakMap<Element, Set<() => void>>();
export function ownCleanup(element: Element, cleanup: () => void): () => void {
  let owned = cleanups.get(element);
  if (!owned) { owned = new Set(); cleanups.set(element, owned); }
  let active = true;
  const release = () => {
    if (!active) return;
    active = false; owned.delete(release); cleanup();
  };
  owned.add(release); return release;
}
export function disposeTree(element: Element): void {
  for (const child of Array.from(element.children)) disposeTree(child);
  for (const cleanup of Array.from(cleanups.get(element) ?? [])) cleanup();
  cleanups.delete(element);
}
