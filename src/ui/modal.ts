// One-active-modal host (§40, §52, A22, A60). Back origins are transition callbacks, not a global stack.
// Replacement disposes the old view without user-dismissal callbacks or focus stealing.
import { closeButton, disposeSurfaceTree, drawFit, h, kitButton, nineSlice, label, LABEL, SLICE, surface, threeSlice, type KitButton } from "./kit";
import { uiFont } from "./fontScale";
import { ICONS } from "../core/emojiIcon";

export interface ModalHandle {
  id: string;
  body: HTMLDivElement;
  close(): void;
  setTitle(t: string): void;
  setCloseLabel(t: string): void;
  setHeaderActionLabel(t: string): void;
}

export interface ModalOptions {
  id: string;
  title: string;
  /** Size preset; content scrolls inside the body, never the page (§53). */
  size?: "sm" | "md" | "lg" | "full";
  closeLabel?: string;
  /** Result/augment overlays may forbid dismissal until a choice is made. */
  dismissible?: boolean;
  onClose?: () => void;
  /** Restore a specific parent surface; absent on root and mandatory modals. */
  onBack?: { label: string; restore(): void };
  headerAction?: { icon: string; label: string; onClick(): void };
}

export interface ModalHost {
  open(o: ModalOptions): ModalHandle;
  closeActive(reason?: "dismiss" | "replace"): void;
  dispose(): void;
  active(): string | null;
  /** True when any modal owns input; board/HUD input must check this (A88). */
  blocking(): boolean;
  onChange(fn: (id: string | null) => void): () => void;
}

export function createModalHost(layer: HTMLElement): ModalHost {
  let current: { handle: ModalHandle; root: HTMLElement; o: ModalOptions; restore: Element | null } | null = null;
  const listeners = new Set<(id: string | null) => void>();
  let restorePageScroll: (() => void) | null = null;
  const pendingChanges: (string | null)[] = [];
  let emitting = false;
  const emit = () => {
    pendingChanges.push(current?.o.id ?? null);
    if (emitting) return;
    emitting = true;
    try {
      while (pendingChanges.length) {
        const id = pendingChanges.shift()!;
        for (const fn of listeners) fn(id);
      }
    } finally {
      emitting = false;
      pendingChanges.length = 0;
    }
  };

  type CloseReason = "dismiss" | "back" | "replace";
  const close = (reason: CloseReason = "dismiss", notify = true) => {
    if (!current) return;
    const c = current;
    current = null; // Reentrant callbacks cannot clean this modal twice.
    disposeSurfaceTree(c.root);
    c.root.remove();
    restorePageScroll?.();
    restorePageScroll = null;
    layer.dataset.open = "false";
    if (notify) emit();
    if (reason === "back") c.o.onBack?.restore();
    else if (reason === "dismiss") c.o.onClose?.();
    // Navigation callbacks may open another modal. Never steal its focus.
    if (!current && reason === "dismiss" && c.restore instanceof HTMLElement && c.restore.isConnected) c.restore.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && current && current.o.dismissible !== false) { e.preventDefault(); close("dismiss"); }
  };
  addEventListener("keydown", onKeyDown);

  return {
    open(o) {
      const previousRestore = current?.restore ?? document.activeElement;
      close("replace", false); // Replacement is one transition, not a user dismissal.
      const htmlOverflow = document.documentElement.style.overflow;
      const bodyOverflow = document.body.style.overflow;
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      restorePageScroll = () => {
        document.documentElement.style.overflow = htmlOverflow;
        document.body.style.overflow = bodyOverflow;
      };
      const restore = previousRestore;
      const root = h("div", "modal-root");
      const closeCurrent = (reason: CloseReason) => { if (current?.root === root) close(reason); };
      const shade = h("div", "modal-shade");
      surface(shade, (g, w, hh) => drawFit(g, "shade", 0, 0, w, hh));
      shade.addEventListener("pointerdown", (e) => { e.stopPropagation(); if (o.dismissible !== false) closeCurrent("dismiss"); });

      const frame = h("div", `modal-frame modal-${o.size ?? "md"}`);
      frame.setAttribute("role", "dialog");
      frame.setAttribute("aria-modal", "true");
      frame.dataset.modal = o.id;
      surface(frame, (g, w, hh) => nineSlice(g, "panel_parchment", SLICE.panel_parchment, 0, 18, w, hh - 18));

      let title = o.title;
      const hasClose = o.dismissible !== false;
      const hasBack = Boolean(o.onBack && hasClose);
      const buttonCount = Number(hasClose) + Number(hasBack) + Number(Boolean(o.headerAction));
      const head = h("div", "modal-head");
      const ribbon = surface(head, (g, w, hh) => {
        const edge = matchMedia("(max-width: 760px)").matches ? 8 : 14;
        const cluster = buttonCount ? edge + buttonCount * 44 + (buttonCount - 1) * 4 : 0;
        const desired = Math.max(240, title.length * 24 + 100);
        const rw = Math.max(0, Math.min(w - cluster - 8, desired));
        const x = buttonCount >= 2 && desired <= w - 2 * cluster ? (w - rw) / 2 : 0;
        threeSlice(g, "ribbon", SLICE.ribbon, x, 0, rw, hh);
        label(g, title, x + rw / 2, hh * 0.44, { size: uiFont(Math.round(hh * 0.36)), fill: LABEL, maxW: Math.max(20, rw - 108), font: "heading" });
      });
      frame.setAttribute("aria-label", title);
      const body = h("div", "modal-body");
      frame.append(head, body);
      let closeControl: HTMLButtonElement | null = null;
      if (hasBack && o.onBack) {
        const back = kitButton({ skin: "icon", icon: ICONS.back, aria: o.onBack.label, cls: "modal-back", onClick: () => closeCurrent("back") });
        frame.append(back.el);
      }
      let headerAction: KitButton | null = null;
      if (o.headerAction) {
        headerAction = kitButton({ skin: "icon", icon: o.headerAction.icon, aria: o.headerAction.label, cls: "modal-header-action", onClick: o.headerAction.onClick });
        frame.append(headerAction.el);
      }
      if (hasClose) {
        closeControl = closeButton(() => closeCurrent("dismiss"), o.closeLabel ?? "Đóng");
        closeControl.classList.add("modal-close");
        frame.append(closeControl);
      }
      root.append(shade, frame);
      layer.append(root);
      layer.dataset.open = "true";
      const handle: ModalHandle = {
        id: o.id, body, close: () => closeCurrent("dismiss"),
        setTitle(t) { title = t; frame.setAttribute("aria-label", t); ribbon.paint(); },
        setCloseLabel(t) { closeControl?.setAttribute("aria-label", t); },
        setHeaderActionLabel(t) { headerAction?.setAria(t); },
      };
      current = { handle, root, o, restore };
      frame.tabIndex = -1;
      frame.focus();
      emit();
      return handle;
    },
    closeActive: (reason: "dismiss" | "replace" = "dismiss") => close(reason),
    dispose() {
      close("replace");
      removeEventListener("keydown", onKeyDown);
      listeners.clear();
    },
    active: () => current?.o.id ?? null,
    blocking: () => current !== null,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
