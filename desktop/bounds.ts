// The window's remembered place (desktop/main.ts writes it to the profile folder on close and reads it at start). Pure: a saved value is checked against the
// displays as they are now, since a monitor may have gone.
import { MIN_HEIGHT, MIN_WIDTH } from "./identity.ts";

export type Rect = { x: number; y: number; width: number; height: number };
export type WindowState = { x?: number; y?: number; width: number; height: number; maximized: boolean };

export const DEFAULT_SIZE = { width: 1280, height: 800 };

// How much of the window must lie on a display for its position to be kept, so a window is never left where no one can reach it.
const MOST_HIDDEN = 100;

function whole(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) < 100_000;
}

function overlap(a: Rect, b: Rect): { width: number; height: number } {
  return {
    width: Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
    height: Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
  };
}

/**
 * The state to open the window with from the saved JSON and the displays' work areas. The size is the saved one, not below the window minimum and not beyond the
 * largest display; the position is kept only when at least 100 px of the window lie on a display. Anything else in the file is the default.
 */
export function restoreWindowState(saved: unknown, workAreas: readonly Rect[]): WindowState {
  const base: WindowState = { ...DEFAULT_SIZE, maximized: false };
  if (typeof saved !== "object" || saved === null) return base;
  const { x, y, width, height, maximized } = saved as Record<string, unknown>;
  const widest = Math.max(MIN_WIDTH, ...workAreas.map((area) => area.width));
  const tallest = Math.max(MIN_HEIGHT, ...workAreas.map((area) => area.height));
  const size = {
    width: whole(width) ? Math.min(Math.max(Math.round(width), MIN_WIDTH), widest) : base.width,
    height: whole(height) ? Math.min(Math.max(Math.round(height), MIN_HEIGHT), tallest) : base.height,
  };
  const state: WindowState = { ...size, maximized: maximized === true };
  if (whole(x) && whole(y)) {
    const place = { x: Math.round(x), y: Math.round(y), ...size };
    if (workAreas.some((area) => {
      const common = overlap(place, area);
      return common.width >= MOST_HIDDEN && common.height >= MOST_HIDDEN;
    })) {
      state.x = place.x;
      state.y = place.y;
    }
  }
  return state;
}
