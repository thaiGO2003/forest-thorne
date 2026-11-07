import { t, setLocale, getLocale } from "../i18n/index.js";
import { ThreeApp, type ThreeAppScene } from "./ThreeApp.js";

/**
 * ============================================================================
 * 1. INTERFACES & STRUCTURAL TYPES
 * ============================================================================
 */

/**
 * Menu callbacks supplied by the host application.
 */
export interface ThreeMainMenuCallbacks {
  onStart?: (modeId: string) => void;
  onSettings?: () => void;
  onLibrary?: () => void;
}

/**
 * ============================================================================
 * 2. CONSTANTS, ENUMS & MODULE STATE
 * ============================================================================
 */

/**
 * ============================================================================
 * 3. PRIVATE HELPERS & TYPE GUARDS
 * ============================================================================
 */

/**
 * ============================================================================
 * 4. PUBLIC EXPORTS & LIFECYCLE METHODS
 * ============================================================================
 */

/**
 * Pixel-style DOM main menu layered over the Three.js viewport.
 */
export class ThreeMainMenuScene implements ThreeAppScene {
  private app: ThreeApp | null = null;
  private root: HTMLDivElement | null = null;

  constructor(private readonly callbacks: ThreeMainMenuCallbacks = {}) {}

  /**
   * Mount the menu overlay and bind its controls.
   */
  public mount(app: ThreeApp): void {
    this.app = app;
    const root = document.createElement("div");
    root.className = "three-pixel-main-menu";
    root.style.pointerEvents = "auto";
    root.style.position = "absolute";
    root.style.inset = "0";
    root.style.display = "grid";
    root.style.placeItems = "center";
    root.style.background = "rgba(10, 15, 25, 0.72)";
    root.style.imageRendering = "pixelated";

    const panel = document.createElement("section");
    panel.style.width = "min(92vw, 560px)";
    panel.style.padding = "28px";
    panel.style.border = "4px solid #f6d889";
    panel.style.background = "#1b2438";
    panel.style.boxShadow = "8px 8px 0 #080b12";

    const title = document.createElement("h1");
    title.textContent = t("three.menu.label.title");
    title.style.margin = "0 0 8px";
    title.style.color = "#ffe9a6";
    title.style.fontFamily = "monospace";
    title.style.fontSize = "clamp(24px, 6vw, 46px)";
    panel.appendChild(title);

    const subtitle = document.createElement("p");
    subtitle.textContent = t("three.menu.label.subtitle");
    subtitle.style.color = "#b7d5e8";
    subtitle.style.fontFamily = "monospace";
    panel.appendChild(subtitle);

    panel.appendChild(this.createButton(t("three.menu.action.newGame"), () => this.callbacks.onStart?.("EndlessPvEClassic")));
    panel.appendChild(this.createButton(t("three.menu.action.library"), () => this.callbacks.onLibrary?.()));
    panel.appendChild(this.createButton(t("three.menu.action.settings"), () => this.callbacks.onSettings?.()));
    panel.appendChild(this.createLanguageButton());

    root.appendChild(panel);
    app.getHud().appendChild(root);
    this.root = root;
  }

  /**
   * Menu scenes are DOM-driven and do not need per-frame work.
   */
  public update(): void {}

  /**
   * Remove the menu overlay.
   */
  public unmount(): void {
    if (this.root && this.root.parentElement) {
      this.root.parentElement.removeChild(this.root);
    }
    this.root = null;
    this.app = null;
  }

  private createButton(label: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.style.display = "block";
    btn.style.width = "100%";
    btn.style.minHeight = "48px"; // Mobile touch target minimum 48px
    btn.style.margin = "12px 0";
    btn.style.padding = "12px 18px";
    btn.style.fontFamily = "monospace";
    btn.style.fontSize = "18px";
    btn.style.fontWeight = "bold";
    btn.style.color = "#131a29";
    btn.style.background = "#f4c653";
    btn.style.border = "3px solid #201a09";
    btn.style.boxShadow = "4px 4px 0 #000";
    btn.style.cursor = "pointer";

    btn.addEventListener("click", onClick);
    return btn;
  }

  private createLanguageButton(): HTMLButtonElement {
    const isVi = getLocale() === "vi";
    return this.createButton(
      `${t("three.menu.action.language")}: ${isVi ? "Tiếng Việt" : "English"}`,
      () => {
        setLocale(isVi ? "en" : "vi");
        if (this.app) {
          this.unmount();
          this.mount(this.app);
        }
      }
    );
  }
}

export default ThreeMainMenuScene;
