// The arithmetic of the web booklet reader (reader.tsx): how a page fits the window, how far Ctrl+wheel zooms, which key turns a page and when
// the wheel does. Pure, so it is tested without a browser.

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 4;
// A canvas bigger than this many pixels is drawn at a lower resolution: browsers refuse a canvas past about 16 million pixels or 16384 on a side.
export const PIXEL_BUDGET = 16_000_000;
const SIDE_LIMIT = 16_384;

export function clampPage(page: number, pageCount: number): number {
  return Math.min(Math.max(1, Math.floor(Number.isFinite(page) ? page : 1)), Math.max(1, pageCount));
}

export function clampZoom(zoom: number): number {
  return Math.min(Math.max(zoom, ZOOM_MIN), ZOOM_MAX);
}

/** The scale at which a whole page fits the window (zoom 1). */
export function fitScale(areaWidth: number, areaHeight: number, pageWidth: number, pageHeight: number): number {
  if (pageWidth <= 0 || pageHeight <= 0) return 1;
  return Math.max(0.05, Math.min(areaWidth / pageWidth, areaHeight / pageHeight));
}

// A wheel notch reports 100 (pixels) or 3 (lines); a trackpad pinch reports small deltas, many times a second.
const LINE_PIXELS = 16;
const PAGE_PIXELS = 400;
const ZOOM_PER_PIXEL = 0.0025;

export function wheelPixels(deltaY: number, deltaMode: number): number {
  return deltaMode === 1 ? deltaY * LINE_PIXELS : deltaMode === 2 ? deltaY * PAGE_PIXELS : deltaY;
}

/** The zoom after a Ctrl+wheel (or a pinch): rolling up (negative) zooms in. */
export function zoomAfterWheel(zoom: number, deltaPixels: number): number {
  return clampZoom(zoom * Math.exp(-deltaPixels * ZOOM_PER_PIXEL));
}

export const ZOOM_STEP = 1.25;

export type KeyAction = "next" | "previous" | "first" | "last" | "zoomIn" | "zoomOut" | "zoomReset" | "close";

/** What a key does in the reader; null for every other key, which keeps its own job (Tab, scrolling, the browser's shortcuts). */
export function keyAction(key: string, modifiers: { ctrl: boolean; meta: boolean; alt: boolean; shift: boolean }): KeyAction | null {
  if (modifiers.ctrl || modifiers.meta || modifiers.alt) return null;
  switch (key) {
    case "PageDown":
    case "ArrowRight":
      return "next";
    case "PageUp":
    case "ArrowLeft":
      return "previous";
    case " ":
      return modifiers.shift ? "previous" : "next";
    case "Home":
      return "first";
    case "End":
      return "last";
    case "+":
    case "=":
      return "zoomIn";
    case "-":
    case "_":
      return "zoomOut";
    case "0":
      return "zoomReset";
    // The desktop and the web have no Back button of the phone's: Escape closes the booklet, as it backs out of the table.
    case "Escape":
      return "close";
    default:
      return null;
  }
}

// The wheel turns a page only after a deliberate roll: the deltas add up to a threshold, and a turn locks the wheel for a moment, so a
// trackpad's long tail of small deltas turns one page, not ten.
export const WHEEL_THRESHOLD = 80;
export const WHEEL_LOCK_MS = 350;
const WHEEL_IDLE_MS = 200;

export type WheelState = { sum: number; last: number; lockedUntil: number };
export const wheelIdle: WheelState = { sum: 0, last: 0, lockedUntil: 0 };

/** Feeds one wheel event (in pixels) at time `now`; `turn` is +1 for the next page, -1 for the previous, 0 for none. */
export function stepWheel(state: WheelState, deltaPixels: number, now: number): { state: WheelState; turn: -1 | 0 | 1 } {
  if (now < state.lockedUntil) return { state: { ...state, last: now }, turn: 0 };
  const carried = now - state.last > WHEEL_IDLE_MS || Math.sign(state.sum) !== Math.sign(deltaPixels) ? 0 : state.sum;
  const sum = carried + deltaPixels;
  if (Math.abs(sum) >= WHEEL_THRESHOLD) return { state: { sum: 0, last: now, lockedUntil: now + WHEEL_LOCK_MS }, turn: sum > 0 ? 1 : -1 };
  return { state: { sum, last: now, lockedUntil: state.lockedUntil }, turn: 0 };
}

/** The pixel scale for a page drawn `cssScale` times its size on a screen with `ratio` device pixels per CSS pixel, lowered to stay in the budget. */
export function pixelScale(pageWidth: number, pageHeight: number, cssScale: number, ratio: number): number {
  const wanted = cssScale * Math.max(1, ratio);
  const area = pageWidth * pageHeight * wanted * wanted;
  const byArea = area > PIXEL_BUDGET ? wanted * Math.sqrt(PIXEL_BUDGET / area) : wanted;
  const bySide = Math.min(1, SIDE_LIMIT / Math.max(pageWidth * byArea, pageHeight * byArea));
  return byArea * bySide;
}
