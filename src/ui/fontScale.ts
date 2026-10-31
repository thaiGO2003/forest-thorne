/**
 * UI typography policy. Modal and tooltip copy is authored small for the old 1280×720 HUD;
 * doubling it keeps the same hierarchy on modern displays while the floor prevents the
 * smallest labels from becoming unreadable on compact screens.
 *
 * Keep this separate from 3D billboard text: world-space labels are sized by camera depth,
 * not by UI CSS.
 */
export const UI_FONT_SCALE = 2;
export const UI_FONT_MIN = 14;

/** Canvas text size for modal/UI surfaces: authored px × scale, never below the readable floor. */
export const uiFont = (px: number): number => Math.max(UI_FONT_MIN, Math.round(px * UI_FONT_SCALE));
