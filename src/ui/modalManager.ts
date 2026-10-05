// One modal owner shared by current screens and recovered views.
import { disposeTree } from "./lifecycle";
export interface ModalInstance { id: string; element: HTMLElement; close(): void }
export interface ModalOpenOptions { dismissible?: boolean; onClose?: () => void }
let current: ModalInstance | null = null;
let backdrop: HTMLElement | null = null;
let dismissible = true;
const listeners = new Set<(id: string | null) => void>();
const emit = () => { for (const listener of listeners) listener(current?.id ?? null); };
const onKey = (event: KeyboardEvent) => {
  if (!current) return;
  if (event.key === "Escape") {
    event.preventDefault(); event.stopImmediatePropagation();
    if (dismissible) current.close();
  } else if (event.key === "Tab") {
    const controls = Array.from(current.element.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]',
    )).filter((node) => node.getClientRects().length > 0);
    const first = controls[0], last = controls.at(-1);
    if (!first) { event.preventDefault(); current.element.focus(); }
    else if (event.shiftKey && (document.activeElement === first || document.activeElement === current.element)) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
};
function ensureBackdrop(): HTMLElement {
  if (backdrop) return backdrop;
  backdrop = document.createElement("div"); backdrop.className = "ui-modal-backdrop";
  Object.assign(backdrop.style, { position: "fixed", inset: "0", zIndex: "1000", display: "none", pointerEvents: "auto", background: "rgba(0,0,0,.65)" });
  backdrop.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    if (event.target === backdrop && dismissible) current?.close();
  });
  document.body.append(backdrop); window.addEventListener("keydown", onKey, true);
  return backdrop;
}
export function openModal(id: string, factory: (close: () => void) => HTMLElement, options: ModalOpenOptions = {}): () => void {
  closeModal();
  const host = ensureBackdrop(), restore = document.activeElement;
  const container = document.createElement("div"); container.className = "ui-modal-container";
  container.dataset.modal = id; container.setAttribute("role", "dialog"); container.setAttribute("aria-modal", "true"); container.tabIndex = -1;
  Object.assign(container.style, { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", maxHeight: "94dvh", maxWidth: "96vw", overflow: "auto" });
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    const wasCurrent = current?.element === container;
    if (wasCurrent) { current = null; host.style.display = "none"; }
    options.onClose?.(); disposeTree(container); container.remove();
    if (restore instanceof HTMLElement && restore.isConnected) restore.focus();
    if (wasCurrent) emit();
  };
  current = { id, element: container, close }; dismissible = options.dismissible !== false;
  try { container.append(factory(close)); } catch (error) { close(); throw error; }
  if (!closed) { host.append(container); host.style.display = "block"; container.focus(); emit(); }
  return close;
}
export function closeModal(id?: string): void { if (!id || current?.id === id) current?.close(); }
export const activeModal = () => current?.id ?? null;
export const hasOpenModal = () => current !== null;
export function onModalChange(listener: (id: string | null) => void): () => void {
  listeners.add(listener); return () => listeners.delete(listener);
}
export function disposeModalManager(): void {
  closeModal(); backdrop?.remove(); backdrop = null; window.removeEventListener("keydown", onKey, true); listeners.clear();
}
