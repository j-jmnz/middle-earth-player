// How many effect pills a card's edge draws and how many hide behind the "N more" pill, from the room the card's height leaves (card-effects.ts badgeSplit). Pure: the canvas draws the pills (pieces.native.tsx Badges) and keeps a word pill clear of them
// (mark-pieces.native.tsx badgeReach); both read the layout from here, so the clear space matches the pill drawn. docs/design-system-table.md (Tokens and effects) says what stays drawn when the zones do not all fit.
import { badgeSplit } from "../cards/card-effects.ts";

import { TOKEN } from "./token-spots.ts";
import { FOOT_ROW, underMarkTop } from "./under-mark.ts";

/** Where the first effect pill stands below the card's top edge on a card tall enough to hold two rows under the title band, in points at Medium: a pill never covers the name there (the picture's title, or the name the table prints on a card with no picture). */
export const BADGE_TOP = 17;
/** Where the first pill stands on a shorter rect, the phone's 62 pt card and a stacked area's covered band: it keeps two rows (or the one row that fits) and gives up the title band. */
export const BADGE_TOP_SHORT = 3;
/** The height of one line of a placeholder name, in points at Medium: a name of two lines pushes the effect column down by one (`titleRows`). */
export const NAME_LINE = 14;

/** What stands at the foot of a card, in the effect column's way: the held or counted pill (`under`: its rect's height, whether it counts something, whether the card wears a number at its foot), a lifted pill (the open pick's number), and the plain foot pills (an engagement cost, a progress or loss number). */
export type FootMarks = { under: { height: number; counted: boolean; strip: boolean } | null; lifted: boolean; plain: boolean; committed: boolean; combat: boolean };

/** A committed hero's Willpower pill (`Badges`) and a defender's or attacker's combat pill (`CombatPill`): 15 pt tall, 3 pt above the card's foot. */
const WILL_TOP = 15 + 3;

/** The effect column of an upright card in a stacked play area's covered band, or null on any other card: `left` is how far it stands right of the card's edge, clear of the resource token that stands at the band's foot; `width` is the part of the card the next card in its row leaves visible. */
export type CoveredBand = { left: number; width: number };

/** The covered-band column for a card (`covered`: its slot has `coveredFrom`, `sideways`: it is exhausted, so its name runs along its turned side and its top edge holds tokens only; `visible`: the width the next card in the row leaves), or null. */
export function coveredBand(covered: boolean, sideways: boolean, resources: number, s: number, visible: number): CoveredBand | null {
  return covered && !sideways ? { left: resources > 0 ? (TOKEN + 1) * s : 0, width: visible } : null;
}

/**
 * Where a pill `width` wide stands across a card `cardWidth` wide at its foot (the Willpower pill, the combat pill): centered, but right of the resource token (`resources`) when the card is too narrow to clear it, and no wider than the card's rest. Offsets from the card's left edge.
 */
export function footPillSpan(cardWidth: number, width: number, resources: number, s: number): { left: number; width: number } {
  const centered = (cardWidth - width) / 2;
  const left = resources > 0 ? Math.max(centered, (TOKEN + 1) * s) : centered;
  return left === centered ? { left, width } : { left, width: Math.min(width, cardWidth - 1 * s - left) };
}

/** True when a pill `pillWidth` wide fits, with its 2 pt margins, in the `room` a covered card's row has right of its token (`CoveredBand`). */
export function pillFits(pillWidth: number, s: number, room: number): boolean {
  return 2 * s + pillWidth <= room - 2 * s;
}

/** How far below the card's top edge the highest pill at the foot stands (what the effect pills stop above), or null with none. `height` is the card's rect. */
export function footStop(height: number, s: number, marks: FootMarks): number | null {
  const tops = [
    marks.under ? underMarkTop(marks.under.height, s, marks.under.counted, marks.under.strip) : null,
    marks.lifted ? height - (2 * TOKEN + FOOT_ROW + 2) * s : null,
    marks.plain ? height - (TOKEN + FOOT_ROW) * s : null,
    marks.committed || marks.combat ? height - WILL_TOP * s : null,
  ].filter((top): top is number => top != null);
  return tops.length === 0 ? null : Math.min(...tops);
}

/**
 * Where the effect column starts and how many rows it holds. The rows stop 1 pt above the resource token (always reserved) and above the pill `stop` says stands at the foot (`footStop`); a pill that would run past either is left out, down to none, since the preview lists every effect.
 * The column starts under the title band (`BADGE_TOP`) when the rect holds two rows there and the token, else at `BADGE_TOP_SHORT`, so a short card keeps its rows. `pill` is a pill's height in points.
 * An upright card in a stacked play area's covered band (`covered`) always starts under the title band, so its name stays readable: the column stands right of the resource token (`CoveredBand.left`), so the token no longer limits the rows, and the pills that do not fit give way as they do on any card.
 */
export function badgeLayout(height: number, s: number, pill: number, stop: number | null = null, covered: CoveredBand | null = null, titleRows = 1): { top: number; rows: number } {
  const tokenFloor = covered ? height - 1 * s : height - (TOKEN + 2) * s;
  const floor = stop == null ? tokenFloor : Math.min(tokenFloor, stop - 1 * s);
  const rowsFrom = (limit: number, top: number) => Math.max(0, Math.floor((limit - top + 2 * s) / (pill + 2 * s)));
  // A name of several lines (a placeholder that does not fit one) pushes the column down by each line after the first, so no pill covers it.
  const titleTop = (BADGE_TOP + (titleRows - 1) * NAME_LINE) * s;
  if (covered) return { top: BADGE_TOP * s, rows: rowsFrom(floor, BADGE_TOP * s) };
  const top = rowsFrom(tokenFloor, titleTop) >= 2 || titleRows > 1 ? titleTop : BADGE_TOP_SHORT * s;
  return { top, rows: rowsFrom(floor, top) };
}

/** The rows of pills that fit (0 when not even one does). */
export function badgeRoom(height: number, s: number, pill: number, stop: number | null = null, covered: CoveredBand | null = null, titleRows = 1): number {
  return badgeLayout(height, s, pill, stop, covered, titleRows).rows;
}

/** What `total` effect pills draw in `rows` rows: none when no row fits, else `badgeSplit`. */
export function badgeShown(total: number, rows: number): { shown: number; hidden: number } {
  return rows < 1 ? { shown: 0, hidden: 0 } : badgeSplit(total, rows);
}

/** The effect pills left out of a card that has `total` of them in `height`: 0 when they all fit, up to all of them when the room leaves one row for the "more" pill alone. */
export function hiddenBadges(total: number, height: number, s: number, pill: number, stop: number | null = null, covered: CoveredBand | null = null, titleRows = 1): number {
  return badgeShown(total, badgeRoom(height, s, pill, stop, covered, titleRows)).hidden;
}

/**
 * The one effect pill a card keeps when its edge has room for a single row and more than one effect is on it: the Attack chip when it has one (an enemy's Attack is what the player faces), else the first. It stands with the "N more" pill beside it
 * on the same row when the card is wide enough (`Badges`); `stats` are the stat chips in order, the flags follow them.
 */
export function lonePick(stats: readonly { stat: string }[]): number {
  return Math.max(0, stats.findIndex((badge) => badge.stat === "attack"));
}

/**
 * How the kept chip and the "N more" pill share the one row of a card (`Badges`; `badgeReach` reads the same answer): `beside` when the pill's count fits at the chip's right, `overlap` when only a small round pill fits over the chip's end,
 * null when the chip is no stat (`keptWidth` 0) or even that does not fit. `compact`: the pill holds the bare count, as the full words do not fit. `reach` is how far the pills stand from the card's left edge.
 * `keptWidth` is the chip's width, `countWidth` the bare count's pill and `moreWidth` the full "N more" pill (both with their padding), `cardWidth` the card's.
 */
export function loneRow(keptWidth: number, countWidth: number, moreWidth: number, s: number, cardWidth: number): { mode: "beside" | "overlap" | null; compact: boolean; reach: number } {
  if (keptWidth <= 0) return { mode: null, compact: false, reach: 0 };
  const beside = 2 * s + keptWidth + 2 * s + countWidth <= cardWidth - 2 * s;
  const overlap = !beside && 2 * s + keptWidth + 6 * s <= cardWidth - 2 * s;
  if (!beside && !overlap) return { mode: null, compact: false, reach: 0 };
  const compact = 2 * s + keptWidth + 2 * s + moreWidth > cardWidth - 2 * s;
  return { mode: beside ? "beside" : "overlap", compact, reach: beside ? 4 * s + keptWidth + (compact ? countWidth : moreWidth) : keptWidth - 4 * s + countWidth };
}
