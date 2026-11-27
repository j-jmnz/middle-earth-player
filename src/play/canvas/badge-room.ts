// How many effect pills a card's edge draws and how many hide behind the "N more" pill, from the room the card's height leaves (card-effects.ts badgeSplit). Pure: the canvas draws the pills (pieces.native.tsx Badges) and keeps a word pill clear of them
// (mark-pieces.native.tsx badgeReach); both read the layout from here, so the clear space matches the pill drawn. docs/design-system-table.md (Tokens and effects) says what stays drawn when the zones do not all fit.
import { badgeSplit } from "../cards/card-effects.ts";

import { TOKEN } from "./token-spots.ts";
import { FOOT_ROW, underMarkTop } from "./under-mark.ts";

/** Where the first effect pill stands below the card's top edge on a card tall enough to hold two rows under the title band, in points at Medium: a pill never covers the name there (the picture's title, or the name the table prints on a card with no picture). */
export const BADGE_TOP = 17;
/** Where the first pill stands on a shorter rect, the phone's 62 pt card and a stacked area's covered band: it keeps two rows (or the one row that fits) and gives up the title band. */
export const BADGE_TOP_SHORT = 3;

/** What stands at the foot of a card, in the effect column's way: the held or counted pill (`under`: its rect's height, whether it counts something, whether the card wears a number at its foot), a lifted pill (the open pick's number), and the plain foot pills (an engagement cost, a progress or loss number). */
export type FootMarks = { under: { height: number; counted: boolean; strip: boolean } | null; lifted: boolean; plain: boolean };

/** How far below the card's top edge the highest pill at the foot stands (what the effect pills stop above), or null with none. `height` is the card's rect. */
export function footStop(height: number, s: number, marks: FootMarks): number | null {
  const tops = [
    marks.under ? underMarkTop(marks.under.height, s, marks.under.counted, marks.under.strip) : null,
    marks.lifted ? height - (2 * TOKEN + FOOT_ROW + 2) * s : null,
    marks.plain ? height - (TOKEN + FOOT_ROW) * s : null,
  ].filter((top): top is number => top != null);
  return tops.length === 0 ? null : Math.min(...tops);
}

/**
 * Where the effect column starts and how many rows it holds. The rows stop 1 pt above the resource token (always reserved) and above the pill `stop` says stands at the foot (`footStop`); a pill that would run past either is left out, down to none, since the preview lists every effect.
 * The column starts under the title band (`BADGE_TOP`) when the rect holds two rows there and the token, else at `BADGE_TOP_SHORT`, so a short card keeps its rows. `pill` is a pill's height in points.
 */
export function badgeLayout(height: number, s: number, pill: number, stop: number | null = null): { top: number; rows: number } {
  const tokenFloor = height - (TOKEN + 2) * s;
  const floor = stop == null ? tokenFloor : Math.min(tokenFloor, stop - 1 * s);
  const rowsFrom = (limit: number, top: number) => Math.max(0, Math.floor((limit - top + 2 * s) / (pill + 2 * s)));
  const top = rowsFrom(tokenFloor, BADGE_TOP * s) >= 2 ? BADGE_TOP * s : BADGE_TOP_SHORT * s;
  return { top, rows: rowsFrom(floor, top) };
}

/** The rows of pills that fit (0 when not even one does). */
export function badgeRoom(height: number, s: number, pill: number, stop: number | null = null): number {
  return badgeLayout(height, s, pill, stop).rows;
}

/** What `total` effect pills draw in `rows` rows: none when no row fits, else `badgeSplit`. */
export function badgeShown(total: number, rows: number): { shown: number; hidden: number } {
  return rows < 1 ? { shown: 0, hidden: 0 } : badgeSplit(total, rows);
}

/** The effect pills left out of a card that has `total` of them in `height`: 0 when they all fit, up to all of them when the room leaves one row for the "more" pill alone. */
export function hiddenBadges(total: number, height: number, s: number, pill: number, stop: number | null = null): number {
  return badgeShown(total, badgeRoom(height, s, pill, stop)).hidden;
}

/**
 * The one effect pill a card keeps when its edge has room for a single row and more than one effect is on it: the Attack chip when it has one (an enemy's Attack is what the player faces), else the first. It stands with the "N more" pill beside it
 * on the same row when the card is wide enough (`Badges`); `stats` are the stat chips in order, the flags follow them.
 */
export function lonePick(stats: readonly { stat: string }[]): number {
  return Math.max(0, stats.findIndex((badge) => badge.stat === "attack"));
}
