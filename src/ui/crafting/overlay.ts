// Nested crafting overlay (item sheet / recipe library). It lives inside the crafting modal host so
// the workbench and its staged ingredients stay mounted, unlike a second global modal.
import { closeButton, disposeSurfaceTree, drawFit, h, INK, kitButton, nineSlice, SLICE, surface } from "../kit";

export interface CraftOverlayOptions {
  title: string;
  className?: string;
  closeLabel: string;
  onClose?: () => void;
  onDismiss?: () => void;
  onBack?: () => void;
  build: (body: HTMLElement, close: () => void) => void;
}

export interface CraftOverlay {
  el: HTMLElement;
  close(reason?: "dismiss" | "replace"): void;
  suspend(): void;
  resume(): void;
}

export function openCraftOverlay(host: HTMLElement, options: CraftOverlayOptions): CraftOverlay {
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const modalRoot = host.closest<HTMLElement>(".modal-root");
  modalRoot?.classList.add("craft-overlay-open");
  const el = h("div", "craft-overlay");
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-label", options.title);
  const shade = h("div", "craft-overlay-shade");
  surface(shade, (g, w, hh) => drawFit(g, "shade", 0, 0, w, hh));
  const panel = h("div", `kit-panel craft-overlay-panel ${options.className ?? ""}`.trim());
  panel.style.color = INK;
  surface(panel, (g, w, hh) => {
    // Backing fill closes the parchment texture's transparent grain so the modal underneath never
    // reads through the sheet; the visible chrome is still the authored 9-slice.
    g.fillStyle = "#f1e2bd";
    g.fillRect(0, 0, w, hh);
    nineSlice(g, "panel_parchment", SLICE.panel_parchment, 0, 0, w, hh);
  });
  const head = h("div", "craft-overlay-head");
  const back = options.onBack ? kitButton({ skin: "wood", label: "Quay lại", cls: "craft-overlay-back", onClick: options.onBack }) : null;
  if (back) head.append(back.el);
  head.append(h("h2", "craft-overlay-title", options.title));
  const close = closeButton(() => closeOverlay(), options.closeLabel);
  head.append(close);
  const body = h("div", "craft-overlay-body");
  panel.append(head, body);
  el.append(shade, panel);
  host.append(el);

  let closed = false;
  let suspended = false;
  let suspendedFocus: HTMLElement | null = null;
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    closeOverlay();
  };
  const onShade = (event: PointerEvent) => {
    event.stopPropagation();
    closeOverlay();
  };
  const closeOverlay = (reason: "dismiss" | "replace" = "dismiss") => {
    if (closed) return;
    closed = true;
    window.removeEventListener("keydown", onKeyDown, true);
    shade.removeEventListener("pointerdown", onShade);
    options.onClose?.();
    back?.dispose();
    disposeSurfaceTree(el);
    el.remove();
    modalRoot?.classList.remove("craft-overlay-open");
    if (reason !== "dismiss") return;
    if (options.onDismiss) options.onDismiss();
    else if (previous?.isConnected) previous.focus({ preventScroll: true });
  };
  const suspend = () => {
    if (closed || suspended) return;
    suspended = true;
    suspendedFocus = el.contains(document.activeElement) && document.activeElement instanceof HTMLElement
      ? document.activeElement : null;
    window.removeEventListener("keydown", onKeyDown, true);
    el.inert = true;
    el.style.display = "none";
  };
  const resume = () => {
    if (closed || !suspended) return;
    suspended = false;
    el.style.removeProperty("display");
    el.inert = false;
    modalRoot?.classList.add("craft-overlay-open");
    window.addEventListener("keydown", onKeyDown, true);
    const focus = suspendedFocus?.isConnected ? suspendedFocus : (back?.el ?? close);
    focus.focus({ preventScroll: true });
  };
  window.addEventListener("keydown", onKeyDown, true);
  shade.addEventListener("pointerdown", onShade);
  options.build(body, () => closeOverlay());
  close.focus({ preventScroll: true });
  return { el, close: closeOverlay, suspend, resume };
}
