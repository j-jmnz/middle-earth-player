// The name a card is drawn as while its picture is still downloading (pieces.native.tsx, CardBody): where its lines stand and how far they
// shrink. Pure, so a test reads it with a fixed-width font. The name runs along the card's top edge, from 5 pt in. Three things stand over it
// on the screen: the damage token at the card's top right, the effect pills down its left edge (they set how many lines the name may take), and
// the pills at its foot. A card lying sideways (exhausted) is turned a quarter, but its tokens and pills stay upright: the damage token then
// stands over the START of the first line, and the foot pills over the lines' END (the screen's foot is the card's right end).
import { damageReach } from "./token-spots.ts";
import { wrapName } from "./wrap.ts";

/** How far a name shrinks to fit before it is cut with an ellipsis. */
export const NAME_FLOOR = 0.7;
/** Where a name starts from the card's left edge, in points at Medium. */
const NAME_LEFT = 5;

export type NameBox = {
  /** The name. */
  name: string;
  /** The card's width, unturned. */
  w: number;
  /** The UI scale. */
  s: number;
  /** The width the Stormcaller's area leaves bare of a covered card, or null. */
  shown: number | null;
  /** The lines the name may take: 1 where effect pills stand under it, 2 on a stage, 3 by default. */
  lines: number | undefined;
  /** The damage token stands on the card. */
  damage: boolean;
  /** The card lies sideways (exhausted). */
  sideways: boolean;
  /** Sideways only: where the highest pill at the card's foot stands, from the turned card's top (badge-room.ts, footStop); the lines stop above it. */
  foot: number | null;
  measure: (text: string) => number;
};

export type NameLayout = {
  lines: readonly string[];
  /** The scale of the lines (a bare card's 0.7 times the squeeze). */
  scale: number;
  /** How far the first line starts from the name's left, in the lines' own units: a sideways card's damage token stands over it. */
  indent: number;
  /** True when the name fits one line at the floor, with nothing cut. */
  fitsOne: boolean;
  /** True when a word or a line was cut with an ellipsis. */
  cut: boolean;
};

// The narrowest the lines may be, in points: a foot pill that leaves less than this does not take the name's room away.
const LEAST_LINE = 24;

/** The unscaled widths of the lines: `across` for most of them and `first` for the first (the damage token's room). `bare` is 0.7 on a covered card. */
function widths(a: NameBox): { bare: number; across: number; first: number; indent: number } {
  const { w, s } = a;
  const bare = a.shown != null && a.shown < w ? 0.7 : 1;
  const wide = bare === 1 ? w - 2 * NAME_LEFT * s : ((a.shown ?? w) - 8 * s) / bare;
  const stopped = a.sideways && a.foot != null ? Math.max(LEAST_LINE * s, Math.min(wide, a.foot - (NAME_LEFT + 1) * s)) : wide;
  if (!a.damage || bare !== 1) return { bare, across: stopped, first: stopped, indent: 0 };
  // Upright, the token stands at the line's far end: the first line is shorter. Sideways, it stands over the line's start: the first line starts later.
  if (!a.sideways) return { bare, across: stopped, first: w - damageReach(s) - (NAME_LEFT + 1) * s, indent: 0 };
  const indent = Math.max(0, damageReach(s) + 1 * s - NAME_LEFT * s);
  return { bare, across: stopped, first: stopped - indent, indent };
}

/** How a name lays out: its lines, the scale they are drawn at and where the first starts. A name (or its widest word) that does not fit shrinks to the floor before it is cut. */
export function placeholderName(a: NameBox): NameLayout {
  const { bare, across, first, indent } = widths(a);
  const words = a.name.split(/\s+/).filter((word) => word.length > 0);
  const widest = Math.max(0, ...words.map((word) => a.measure(word)));
  const full = a.measure(a.name);
  // One line: the whole name against the first line. Several: the widest word against a line (a word is never split, so it is cut where it does not fit); a line wider than the first one takes it on the next.
  const needed = a.lines === 1 ? full : widest;
  const room = a.lines === 1 ? first : across;
  const squeeze0 = needed > room && room / needed >= NAME_FLOOR ? room / needed : 1;
  const fitsOne = full <= first || first / full >= NAME_FLOOR;
  const lay = (squeeze: number): NameLayout => {
    const lines = wrapName(a.name, across / squeeze, a.measure, a.lines, first / squeeze);
    const cut = lines.join(" ").split(/\s+/).filter((word) => word.length > 0).join(" ") !== words.join(" ");
    return { lines, scale: bare * squeeze, indent: indent / (bare * squeeze), fitsOne, cut };
  };
  const first0 = lay(squeeze0);
  if (a.lines === 1 || !first0.cut) return first0;
  // Several lines and some text cut: shrink, step by step down to the floor, until the whole name fits the lines it may take.
  for (let squeeze = squeeze0 - 0.05; squeeze >= NAME_FLOOR - 1e-9; squeeze -= 0.05) {
    const tried = lay(squeeze);
    if (!tried.cut) return tried;
  }
  return first0;
}

/** The fewest lines (up to `most`) that show the name whole at the floor size, or `most` when even those cut it. A card with effect pills asks it to make the pill column start under the name. */
export function nameRows(a: NameBox, most: number): number {
  for (let rows = 1; rows < most; rows += 1) {
    if (!placeholderName({ ...a, lines: rows }).cut) return rows;
  }
  return most;
}

/** Whether a name fits one line, at the floor at most: when it does not, a card with effect pills gives the name a second line and the pills start under it. */
export function nameFitsOne(a: NameBox): boolean {
  return placeholderName({ ...a, lines: 1 }).fitsOne;
}

