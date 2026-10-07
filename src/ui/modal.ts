// Coordinated modal stack (§40, §52, A22, A60). Exactly one major modal owns input: opening a new
// one closes the previous; the shade blocks click-through; Escape and the minus control close.
import { closeButton, drawFit, h, nineSlice, label, SLICE, surface } from "./kit";

export interface ModalHandle { id: string; body: HTMLDivElement; close(): void; setTitle(t: string): void }

export interface ModalOptions {
  id: string;
  title: string;
  /** Size preset; content scrolls inside the body, never the page (§53). */
  size?: "sm" | "md" | "lg" | "full";
  closeLabel?: string;
  /** Result/augment overlays may forbid dismissal until a choice is made. */
  dismissible?: boolean;
  onClose?: () => void;
}

export interface ModalHost {
  open(o: ModalOptions): ModalHandle;
  closeActive(): void;
  active(): string | null;
  /** True when any modal owns input; board/HUD input must check this (A88). */
  blocking(): boolean;
  onChange(fn: (id: string | null) => void): () => void;
}

export function createModalHost(layer: HTMLElement): ModalHost {
  let current: { handle: ModalHandle; root: HTMLElement; o: ModalOptions; restore: Element | null } | null = null;
  const listeners = new Set<(id: string | null) => void>();
  const emit = () => { for (const fn of listeners) fn(current?.o.id ?? null); };

  const close = () => {
    if (!current) return;
    const c = current;
    current = null;
    c.root.remove();
    layer.dataset.open = "false";
    c.o.onClose?.();
    if (c.restore instanceof HTMLElement) c.restore.focus();
    emit();
  };

  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && current && current.o.dismissible !== false) { e.preventDefault(); close(); }
  });

  return {
    open(o) {
      close(); // no accidental modal-on-modal stacking
      const restore = document.activeElement;
      const root = h("div", "modal-root");
      const shade = h("div", "modal-shade");
      surface(shade, (g, w, hh) => drawFit(g, "shade", 0, 0, w, hh));
      shade.addEventListener("pointerdown", (e) => { e.stopPropagation(); if (o.dismissible !== false) close(); });

      const frame = h("div", `modal-frame modal-${o.size ?? "md"}`);
      frame.setAttribute("role", "dialog");
      frame.setAttribute("aria-modal", "true");
      frame.dataset.modal = o.id;
      surface(frame, (g, w, hh) => nineSlice(g, "panel_parchment", SLICE.panel_parchment, 0, 18, w, hh - 18));

      let title = o.title;
      const head = h("div", "modal-head");
      const ribbon = surface(head, (g, w, hh) => {
        const rw = Math.min(w - 40, Math.max(220, title.length * 15 + 80));
        nineSlice(g, "ribbon", SLICE.ribbon, (w - rw) / 2, 0, rw, hh, 1.5);
        label(g, title, w / 2, hh * 0.44, { size: Math.round(hh * 0.36), maxW: rw - 60 });
      });
      frame.setAttribute("aria-label", title);
      const body = h("div", "modal-body");
      frame.append(head, body);
      if (o.dismissible !== false) {
        const x = closeButton(close, o.closeLabel ?? "Đóng");
        x.classList.add("modal-close");
        frame.append(x);
      }
      root.append(shade, frame);
      layer.append(root);
      layer.dataset.open = "true";
      const handle: ModalHandle = {
        id: o.id, body, close,
        setTitle(t) { title = t; frame.setAttribute("aria-label", t); ribbon.paint(); },
      };
      current = { handle, root, o, restore };
      frame.tabIndex = -1;
      frame.focus();
      emit();
      return handle;
    },
    closeActive: close,
    active: () => current?.o.id ?? null,
    blocking: () => current !== null,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
