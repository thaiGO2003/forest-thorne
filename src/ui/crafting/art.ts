// Shared crafting item art: authored SVG when available, authored classic emoji otherwise.
import { hasItemArt, itemIconChar } from "../../core/itemPresentation";
import { h } from "../kit";

export function itemArt(id: string, cls: string): HTMLElement {
  if (!hasItemArt(id)) {
    const icon = h("span", cls, itemIconChar(id));
    icon.setAttribute("aria-hidden", "true");
    return icon;
  }
  const image = h("img", cls);
  image.src = `${import.meta.env.BASE_URL}assets/items/${id}.svg`;
  image.alt = "";
  image.decoding = "async";
  image.draggable = false;
  return image;
}
