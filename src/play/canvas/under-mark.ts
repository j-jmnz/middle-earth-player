// Rules: mec108.captured-cards (data/rules/entries.json). Where the pill of the cards under a card sits on it and what it says (docs/design-system-table.md, Cards, Escape from Mount Gram). Pure, so a test reads it.
import type { Rect } from "../layout/layout.ts";
import { handShown } from "../layout/layout.ts";
import { TOKEN } from "./token-spots.ts";

/** The pill's box: the words ("3 captured") when they fit inside the card, else a bare count with a facedown-card glyph ("count"), and the bare count alone on a card too narrow for both ("number"). */
export type UnderBox = { kind: "words" | "count" | "number"; x: number; y: number; width: number; height: number };

/** The foot row of a card: the engagement cost, the Aflame and Ship numbers stand here, centred at the bottom edge (FootPill). */
export const FOOT_ROW = 4;
/** The height of the progress strip a quest card or an active location wears at its foot, in points at Medium. */
export const STRIP = 15;

/** What the pill's place depends on besides the card: see `underMarkBox`. */
export type UnderOptions = { counted?: boolean; atEnd?: boolean; strip?: boolean; belowName?: boolean };

/**
 * `wordWidth` and `countWidth` are the text's width in the badge font ("3 captured" and "3"), `s` the UI scale. A pill that counts captured cards (`counted`) stands one row above the foot row, as the open pick's number does, clear of the engagement cost, the combat number and the
 * quest strip, which the foot of an enemy, a stage and an active location wear. A pill with no count (The Havens Burn's, a held card's) keeps the foot row, except as `strip` says.
 * `strip`: the card wears something at its foot, the progress strip (an active location, a quest stage) or the number of a committed character or a defender or attacker (the Willpower or combat pill): a pill with no count lifts one row too, so it never covers "0 / 2" or the number. A card with nothing there keeps its pill where it was.
 * `belowName`: see `underMarkTop`.
 * `atEnd`: the pill of an exhausted character (its sideways footprint) stands at the right end of the card, clear of the name and the stat chip at its left, and keeps to the glyph and count so it stays short.
 */
export function underMarkBox(rect: Rect, wordWidth: number, countWidth: number, s: number, options: UnderOptions = {}): UnderBox {
  const { counted = false, atEnd = false, strip = false, belowName = false } = options;
  const token = TOKEN * s;
  const room = rect.w - 4 * s;
  const top = rect.y + underMarkTop(rect.h, s, counted, strip, belowName);
  const words = wordWidth + 10 * s;
  const glyph = 7 * s + 2 * s + countWidth + 8 * s;
  // A pill with no count (Havens Burn's "2/5", "1 held") keeps its short text inside the card at the foot, as it always did.
  if (!counted) {
    const width = Math.min(room, words);
    return { kind: "words", x: rect.x + (rect.w - width) / 2, y: top, width, height: token };
  }
  const kind = !atEnd && words <= room ? "words" : glyph <= room ? "count" : "number";
  const width = kind === "words" ? words : kind === "count" ? glyph : Math.min(room, countWidth + 10 * s);
  return { kind, x: atEnd ? rect.x + rect.w - width - 2 * s : rect.x + (rect.w - width) / 2, y: top, width, height: token };
}

/** The bottom of a name of two lines on an upright card, in points at Medium: `BADGE_TOP` (17) plus `NAME_LINE` (14) of badge-room.ts, which imports this file. */
export const NAME_BOTTOM = 31;

/**
 * How far below the card's top edge the pill's top stands on a rect `height` tall (`underMarkBox` and `footStop` in badge-room.ts read it): the foot row, or one row up when the pill counts something or the card wears a number at its foot.
 * `belowName`: the card has nothing at its foot but its pill (a location in the staging area with cards under it): a counted pill stays in the foot row when the lifted row would cover the last line of a two-line name, as on the phone's 62 pt card.
 */
export function underMarkTop(height: number, s: number, counted: boolean, strip: boolean, belowName = false): number {
  const foot = height - TOKEN * s - FOOT_ROW * s;
  const lifted = foot - (TOKEN * s + 2 * s);
  return (counted || strip) && (strip || !belowName || lifted >= NAME_BOTTOM * s) ? lifted : foot;
}

/** The card's box for the pill of a card in the hand: the strip that shows above the bottom edge at rest, so the pill stands at its foot and is not drawn below the screen. Any other zone keeps the whole card. */
export function underRect(rect: Rect, hand: boolean, s: number): Rect {
  return hand ? { ...rect, h: Math.min(rect.h, handShown(rect.h, s)) } : rect;
}
