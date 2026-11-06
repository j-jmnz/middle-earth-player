// Size classes, not devices (docs/design-system.md, Standard 8 and Tablets). Material 3's
// window size classes on the window's width in logical points (its points over the UI scale), so Split View, Stage Manager and a
// foldable lay out by the room they have, and the same code serves a phone and a tablet. Pure, so a test reads it in Node; the hooks
// that feed it are use-size-class.ts.

export type SizeClass = "compact" | "medium" | "expanded";

/** A tablet: a screen whose shorter side is at least this many points. Only a tablet rotates the tabs. */
export const TABLET_MIN_SIDE = 600;
/** The width at which compact becomes medium, in logical points. */
export const MEDIUM_MIN = 600;
/** The width at which medium becomes expanded: the navigation rail, and the two-pane screens. */
export const EXPANDED_MIN = 840;
/** A reading column: about 50 to 75 characters of body text. */
export const READABLE = 640;
/** A list or grid column that is not prose. */
export const WIDE = 1040;
/** The navigation rail's width, before the left safe inset. */
export const RAIL = 88;
/** The group of buttons in a pinned action bar on a wide screen. */
export const ACTION_GROUP = 420;
/** The action bar's button group in a medium window: centred, and narrower than the 640 reading column. */
export const MEDIUM_ACTION_GROUP = 480;
/** The widest a floating paper sheet gets outside compact. */
export const SHEET_MAX = 560;
/** Under this height a window is short: a phone on its side. */
export const SHORT_WINDOW = 480;

/** The gap between two panes, in logical points. */
export const PANE_GAP = 24;

/** Whether the screen (not the window) is a tablet: the shorter of its sides is at least 600 points. */
export function isTabletScreen(width: number, height: number): boolean {
  return Math.min(width, height) >= TABLET_MIN_SIDE;
}

/** The window's size class, from its width in screen points and the UI scale. */
export function sizeClass(windowWidth: number, scale = 1): SizeClass {
  const logical = windowWidth / scale;
  if (logical >= EXPANDED_MIN) return "expanded";
  if (logical >= MEDIUM_MIN) return "medium";
  return "compact";
}

/** A window too short for the tall layouts (a phone in landscape), by its height in screen points. */
export function isShortWindow(windowHeight: number, scale = 1): boolean {
  return windowHeight / scale < SHORT_WINDOW;
}

/** Whether the tabs sit in a rail at the left rather than a dock at the foot. */
export function showsRail(size: SizeClass): boolean {
  return size === "expanded";
}

/** A column's widest width in screen points, or null in compact, where the column is the screen. */
export function capWidth(size: SizeClass, max: "readable" | "wide", scale = 1): number | null {
  if (size === "compact") return null;
  return (max === "readable" ? READABLE : WIDE) * scale;
}

/** The inset on each side of a list `width` wide that centres a capped column; 0 in compact or when the list is already narrower. */
export function gutter(width: number, size: SizeClass, max: "readable" | "wide", scale = 1): number {
  const cap = capWidth(size, max, scale);
  if (cap == null) return 0;
  return Math.max(0, Math.floor((width - cap) / 2));
}

export type PaneKind = "list-detail" | "supporting";

const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));

/**
 * The two panes of an expanded screen, in screen points, for `width` of room. `side` is the fixed pane (the list of a list-detail,
 * or the supporting pane): a share of the width held between the kind's range (list-detail 320 to 400, supporting 320 to 480, at
 * Medium) or `range` when a screen needs another (the deck editor's 360 to 440). `main` is the rest after the 24 point gap.
 * `side` is floored first, so the two panes and the gap never add up to more than `width`.
 */
export function paneWidths(kind: PaneKind, width: number, scale = 1, range?: { min: number; max: number }): { side: number; main: number; gap: number } {
  const gap = PANE_GAP * scale;
  const [share, low, high] = kind === "list-detail" ? [0.34, 320, 400] : [0.36, 320, 480];
  const min = (range?.min ?? low) * scale;
  const max = (range?.max ?? high) * scale;
  const side = Math.floor(Math.min(clamp(width * share, min, max), Math.max(0, width - gap)));
  return { side, main: Math.floor(Math.max(0, width - side - gap)), gap };
}

/**
 * How many columns of about `target` logical points (and `gap` between them) fit in `width` screen points, never fewer than `min`.
 * The gap and target are Medium's numbers; the width is divided by the scale.
 */
export function columnsFor(width: number, target: number, gap: number, scale = 1, min = 1): number {
  const logical = width / scale;
  return Math.max(min, Math.floor((logical + gap) / (target + gap)));
}
