// How many effect pills a card's edge draws and how many hide behind the "N more" pill, from the room the card's height leaves (card-effects.ts badgeSplit). Pure: the canvas draws the pills (pieces.native.tsx Badges) and keeps a word pill clear of them
// (mark-pieces.native.tsx badgeReach); both read the count from here, so the clear space matches the pill drawn.
import { badgeSplit } from "../cards/card-effects.ts";

import { TOKEN } from "./token-spots.ts";

/** The rows of pills that fit between the top edge and the resource token at the bottom left (at least 1). `pill` is a pill's height in points. */
export function badgeRoom(height: number, s: number, pill: number): number {
  return Math.max(1, Math.floor((height - TOKEN * s - 6 * s) / (pill + 2 * s)));
}

/** The effect pills left out of a card that has `total` of them in `height`: 0 when they all fit, up to all of them when the room leaves one row for the "more" pill alone. */
export function hiddenBadges(total: number, height: number, s: number, pill: number): number {
  return badgeSplit(total, badgeRoom(height, s, pill)).hidden;
}
