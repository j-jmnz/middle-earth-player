// The table settings panel's width (docs/design-system.md, Table, Reading panels): 40% of the canvas, kept between 360 and 460 pt at
// the UI scale, so a three-word Segmented (Small, Medium, Large) fits at Large, and never wider than the room the screen leaves.
// Pure, so a test reads it.
export const SETTINGS_PANEL_MIN = 360;
export const SETTINGS_PANEL_MAX = 460;
const SHARE = 0.4;

/** `canvas` is the table canvas's width, `room` the most the screen can give the panel (its width less the insets and a margin). */
export function settingsPanelWidth(canvas: number, s: number, room: number): number {
  const wanted = Math.min(Math.max(SHARE * canvas, SETTINGS_PANEL_MIN * s), SETTINGS_PANEL_MAX * s);
  return Math.min(wanted, Math.max(room, 0));
}
