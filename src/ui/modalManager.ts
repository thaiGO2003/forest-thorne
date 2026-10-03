// Modal stack and focus management (spec §5.2, §34, A67).
// Enforces single-active-modal invariant, backdrop dismiss, and ESC closing.

export interface ModalInstance {
  id: string;
  element: HTMLElement;
  close: () => void;
}

const stack: ModalInstance[] = [];
let backdrop: HTMLElement | null = null;

function ensureBackdrop(): HTMLElement {
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.className = "ui-modal-backdrop";
    backdrop.style.position = "fixed";
    backdrop.style.inset = "0";
    backdrop.style.zIndex = "1000";
    backdrop.style.display = "none";
    backdrop.style.pointerEvents = "auto";
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop && stack.length > 0) {
        stack[stack.length - 1]!.close();
      }
    });
    document.body.appendChild(backdrop);

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && stack.length > 0) {
        e.preventDefault();
        stack[stack.length - 1]!.close();
      }
    });
  }
  return backdrop;
}

export function openModal(id: string, contentFactory: (close: () => void) => HTMLElement): () => void {
  const bd = ensureBackdrop();

  // Close previous if single-modal invariant required
  while (stack.length > 0) {
    stack.pop()!.close();
  }

  const container = document.createElement("div");
  container.className = "ui-modal-container";
  container.style.position = "absolute";
  container.style.top = "50%";
  container.style.left = "50%";
  container.style.transform = "translate(-50%, -50%)";
  container.style.zIndex = "1001";

  const close = () => {
    const idx = stack.findIndex((m) => m.id === id);
    if (idx !== -1) stack.splice(idx, 1);
    container.remove();
    if (stack.length === 0) {
      bd.style.display = "none";
    }
  };

  const modalEl = contentFactory(close);
  container.appendChild(modalEl);
  bd.appendChild(container);
  bd.style.display = "block";

  stack.push({ id, element: container, close });
  return close;
}

export function closeModal(id?: string): void {
  if (id) {
    const m = stack.find((item) => item.id === id);
    m?.close();
  } else if (stack.length > 0) {
    stack[stack.length - 1]!.close();
  }
}
