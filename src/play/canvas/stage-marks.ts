// Where the Stormcaller stage's marks stand on its card (mark-pieces.native.tsx, StageMarks). Pure, so a test reads it.
import { BADGE_TOP } from "./badge-room.ts";

/** A mark's height in points at Medium: the number pill and the "Apart" plate. */
export const STAGE_MARK_H = 11;

/**
 * Where the "Apart" plate stands, from the card's top (`y`, `h` its rect). Under the picture's title band when the card is tall enough for the plate and the
 * pill (`pillY`, from the card's top) both; otherwise just above the pill, inside the card, so it never hangs over the row above (a card at the canvas's
 * top has no room there) and the pill keeps its whole words.
 */
export function apartPlateY(rect: { y: number; h: number }, pillY: number, s: number): number {
  const height = STAGE_MARK_H * s;
  const below = rect.y + BADGE_TOP * s + 1 * s;
  if (below + height + 1 * s <= pillY) return below;
  return Math.max(rect.y + 1 * s, pillY - height - 1 * s);
}
