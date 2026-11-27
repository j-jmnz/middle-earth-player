// Where the Stormcaller stage's marks stand on its card (mark-pieces.native.tsx, StageMarks). Pure, so a test reads it.
import { BADGE_TOP } from "./badge-room.ts";

/** A mark's height in points at Medium: the number pill and the "Apart" plate. */
export const STAGE_MARK_H = 11;
/** How far down the canvas the plate may hang above a card at least: the room the seats' threat dials and the top bar keep at the canvas's top, in points at Medium. */
export const ABOVE_FLOOR = 6;

/**
 * Where the "Apart" plate stands, from the canvas's top (`rect` is the stage's rect on the canvas, `pillY` the number pill's top). Under the picture's title
 * band when the card is tall enough for the plate and the pill both; else hanging just above the card, so the pill keeps its whole words and the title its
 * name; and where the card stands too near the canvas's top for that (the plate would leave the canvas, or stand over the row above it), just above the
 * pill inside the card, so it is always on the canvas.
 */
export function apartPlateY(rect: { y: number; h: number }, pillY: number, s: number): number {
  const height = STAGE_MARK_H * s;
  const below = rect.y + BADGE_TOP * s + 1 * s;
  if (below + height + 1 * s <= pillY) return below;
  const above = rect.y - height - 1 * s;
  if (above >= ABOVE_FLOOR * s) return above;
  return Math.max(rect.y + 1 * s, pillY - height - 1 * s);
}
