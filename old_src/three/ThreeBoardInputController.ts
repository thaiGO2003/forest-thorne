/**
 * ============================================================================
 * 1. IMPORTS & DEPENDENCIES
 * ============================================================================
 */
import {
  beginSharedBoardPan,
  endSharedBoardPan,
  updateSharedBoardPan,
  zoomSharedBoardView
} from "./ThreeBoardViewport.js";
import type { ThreeBoardViewportHost, Point2D } from "./ThreeBoardViewport.js";

/**
 * ============================================================================
 * 2. INTERFACES & STRUCTURAL TYPES
 * ============================================================================
 */

export type InputResult = boolean | void | null | undefined;

export interface PointerLike {
  x: number;
  y: number;
  event?: { buttons?: number; altKey?: boolean; ctrlKey?: boolean };
  button?: number;
  rightButtonDown?(): boolean;
  middleButtonDown?(): boolean;
  [key: string]: unknown;
}

export interface ThreeInputHostLike {
  isPanPointer?(pointer: PointerLike): boolean;
  input?: {
    on(event: string, fn: (...args: never[]) => void): void;
  };
  [key: string]: unknown;
}

export interface SharedBoardInputOptions {
  handleWheel?(pointer: unknown, dy: number): InputResult;
  handlePointerDown?(pointer: PointerLike): InputResult;
  handlePointerMove?(pointer: PointerLike): InputResult;
  handlePointerRelease?(pointer: PointerLike): InputResult;
  allowBoardPanStart?(pointer: PointerLike): boolean;
  getFinishPanOptions?(pointer: PointerLike): { clearHighlightsOnTap?: boolean } | undefined;
}

export type SharedBoardInputInstaller = (host: unknown, options?: SharedBoardInputOptions) => void;

/**
 * ============================================================================
 * 3. CONSTANTS, ENUMS & MODULE STATE
 * ============================================================================
 */

/**
 * ============================================================================
 * 4. PRIVATE HELPERS & TYPE GUARDS
 * ============================================================================
 */

function wasHandled(result: InputResult): boolean {
  return result === true;
}

/**
 * ============================================================================
 * 5. PUBLIC EXPORTS & LIFECYCLE METHODS
 * ============================================================================
 */

/**
 * Detect whether a pointer event corresponds to a board panning gesture
 * (Right mouse button, Middle mouse button, or Alt/Ctrl + Left Click).
 *
 * Source: src/scenes/shared/sceneBoardInputController.ts:30-39
 */
export function isSharedPanPointer(pointer: PointerLike | null | undefined): boolean {
  if (!pointer) return false;
  const buttons = pointer.event?.buttons ?? 0;
  if (typeof pointer.rightButtonDown === "function" && pointer.rightButtonDown()) return true;
  if (typeof pointer.middleButtonDown === "function" && pointer.middleButtonDown()) return true;
  if (pointer.button === 2 || pointer.button === 1) return true;
  if ((buttons & 2) !== 0 || (buttons & 4) !== 0) return true;
  if ((buttons & 1) !== 0 && (pointer.event?.altKey || pointer.event?.ctrlKey)) return true;
  return false;
}

/**
 * Install board view zoom, pan, and pointer handlers onto an input host.
 *
 * Source: src/scenes/shared/sceneBoardInputController.ts:52-95
 */
export function installSharedBoardViewInput(
  host: unknown,
  options: SharedBoardInputOptions = {}
): void {
  const {
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerRelease,
    allowBoardPanStart,
    getFinishPanOptions
  } = options;

  const inputHost = host as ThreeInputHostLike;
  const panHost = host as ThreeBoardViewportHost;
  const input = inputHost?.input;

  if (!input || typeof input.on !== "function") return;

  input.on("wheel", (...args: never[]) => {
    const pointer = args[0];
    const dy = typeof args[3] === "number" ? args[3] : 0;
    if (wasHandled(handleWheel?.(pointer, dy))) return;
    zoomSharedBoardView(panHost, pointer as Point2D, dy);
  });

  input.on("pointerdown", (pointer: unknown) => {
    const p = pointer as PointerLike;
    if (wasHandled(handlePointerDown?.(p))) return;
    if (allowBoardPanStart && !allowBoardPanStart(p)) return;
    if (inputHost.isPanPointer && inputHost.isPanPointer(p)) {
      beginSharedBoardPan(panHost, p, { immediate: true });
      return;
    }
    beginSharedBoardPan(panHost, p);
  });

  input.on("pointermove", (pointer: unknown) => {
    if (wasHandled(handlePointerMove?.(pointer as PointerLike))) return;
    updateSharedBoardPan(panHost, pointer as Point2D);
  });

  const releaseDrag = (pointer: unknown) => {
    if (wasHandled(handlePointerRelease?.(pointer as PointerLike))) return;
    endSharedBoardPan(panHost);
    const finishOpts = getFinishPanOptions?.(pointer as PointerLike);
    if (finishOpts?.clearHighlightsOnTap && typeof panHost.clearHighlights === "function") {
      panHost.clearHighlights();
    }
  };

  input.on("pointerup", releaseDrag);
  input.on("pointerupoutside", releaseDrag);
}
