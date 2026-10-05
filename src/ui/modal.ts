// Recovered views delegate to modalManager, the sole modal input owner.
import { closeButton, h, panelEl } from "./kit";
import { activeModal, closeModal, hasOpenModal, onModalChange, openModal } from "./modalManager";
export interface ModalHandle { id: string; body: HTMLDivElement; close(): void; setTitle(title: string): void }
export interface ModalOptions {
  id: string; title: string; size?: "sm" | "md" | "lg" | "full";
  closeLabel?: string; dismissible?: boolean; onClose?: () => void;
}
export interface ModalHost {
  open(options: ModalOptions): ModalHandle; closeActive(): void; active(): string | null;
  blocking(): boolean; onChange(listener: (id: string | null) => void): () => void;
}
export function createModalHost(): ModalHost {
  return {
    open(options) {
      const frame = panelEl("panel_parchment", `modal-frame modal-${options.size ?? "md"}`);
      const title = h("h2", "modal-head", options.title);
      const body = h("div", "modal-body");
      frame.append(title, body);
      const close = openModal(options.id, (dismiss) => {
        if (options.dismissible !== false) frame.append(closeButton(dismiss, options.closeLabel ?? "Đóng"));
        return frame;
      }, options);
      return { id: options.id, body, close, setTitle(value) { title.textContent = value; } };
    },
    closeActive: closeModal, active: activeModal, blocking: hasOpenModal, onChange: onModalChange,
  };
}
