// On-screen camera pad for the shared 3D unit viewer. Keyboard arrows do the same thing, but the
// controls must be discoverable on touch and for players who never try arrow keys.
import { h, kitButton } from "./kit";
import type { PortraitViewer } from "../units/portraits";

export function mountPortraitControls(host: HTMLElement, viewer: PortraitViewer): () => void {
  const controls = h("div", "portrait-controls");
  controls.setAttribute("role", "group");
  controls.setAttribute("aria-label", "Điều khiển camera 3D");
  const buttons = [
    { dir: "up", label: "↑", aria: "Nâng camera", dx: 0, dy: 0.14 },
    { dir: "left", label: "←", aria: "Xoay camera sang trái", dx: 0.16, dy: 0 },
    { dir: "down", label: "↓", aria: "Hạ camera", dx: 0, dy: -0.14 },
    { dir: "right", label: "→", aria: "Xoay camera sang phải", dx: -0.16, dy: 0 },
  ].map((item) => {
    const button = kitButton({
      skin: "wood",
      label: item.label,
      size: 24,
      aria: item.aria,
      cls: `portrait-control portrait-${item.dir}`,
      onClick: () => viewer.moveCamera(item.dx, item.dy),
    });
    controls.append(button.el);
    return button;
  });
  host.append(controls);
  return () => {
    for (const button of buttons) button.dispose();
    controls.remove();
  };
}
