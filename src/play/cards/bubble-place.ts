// Where the keyword bubble (keyword-tips.tsx) hangs: under its chip or over it, on the side with more room, clamped inside the safe-area insets, and the height it
// may take there. Pure, so tests read it in Node. Window coordinates throughout, as `measureInWindow` gives a chip's.

/** A chip's place in the window, as `measureInWindow` gives it. */
export type Anchor = { x: number; y: number; width: number; height: number };

export type Insets = { top: number; bottom: number; left: number; right: number };

// Medium's sizes; the bubble draws them times the UI scale.
export const BUBBLE_WIDTH = 320;
const EDGE = 8;
const GAP = 6;

export type BubblePlace = {
  left: number;
  width: number;
  /** Under the chip (`top` is set) or over it (`bottom` is set). */
  below: boolean;
  top?: number;
  bottom?: number;
  /** The most height the whole bubble may take on its side, frame and padding included: its rule text scrolls to fit, its source and button never leave the screen. */
  room: number;
};

/** The bubble's place for a chip at `anchor`: the side of the chip with more room (under it on a tie), `room` tall at most, `left` clamped inside the insets. */
export function bubblePlace(anchor: Anchor, screen: { width: number; height: number }, insets: Insets, s: number): BubblePlace {
  const edge = EDGE * s;
  const gap = GAP * s;
  const width = Math.max(0, Math.min(BUBBLE_WIDTH * s, screen.width - insets.left - insets.right - 2 * edge));
  const left = Math.min(Math.max(insets.left + edge, anchor.x), screen.width - insets.right - edge - width);
  const roomBelow = screen.height - insets.bottom - edge - (anchor.y + anchor.height + gap);
  const roomAbove = anchor.y - gap - insets.top - edge;
  const below = roomBelow >= roomAbove;
  return below
    ? { left, width, below, top: anchor.y + anchor.height + gap, room: Math.max(0, roomBelow) }
    : { left, width, below, bottom: screen.height - anchor.y + gap, room: Math.max(0, roomAbove) };
}
