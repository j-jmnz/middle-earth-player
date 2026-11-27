// Rules: docs/design-system-table.md (Tokens and effects). The count of effect pills hidden behind the "N more" pill, which badgeReach keeps a word pill clear of.
import { describe, expect, it } from "vitest";

import { BADGE_TOP, BADGE_TOP_SHORT, badgeLayout, badgeRoom, badgeShown, coveredBand, footStop, hiddenBadges, loneRow, type FootMarks } from "./badge-room.ts";
import { TOKEN } from "./token-spots.ts";
import { underMarkBox } from "./under-mark.ts";

const PILL = 15;

describe("loneRow", () => {
  // A 40 pt chip, a 14 pt count pill, a 52 pt "2 more" pill.
  it("puts the words beside the chip on a wide card, the bare count on a narrower one and a round pill over the chip's end on a narrow one", () => {
    expect(loneRow(40, 14, 52, 1, 120)).toEqual({ mode: "beside", compact: false, reach: 4 + 40 + 52 });
    expect(loneRow(40, 14, 52, 1, 70)).toEqual({ mode: "beside", compact: true, reach: 4 + 40 + 14 });
    expect(loneRow(40, 14, 52, 1, 56)).toEqual({ mode: "overlap", compact: true, reach: 40 - 4 + 14 });
  });

  it("is no lone row for a flag (no chip width) or a card too narrow for the round pill", () => {
    expect(loneRow(0, 14, 52, 1, 200).mode).toBeNull();
    expect(loneRow(40, 14, 52, 1, 40).mode).toBeNull();
  });
});

describe("hiddenBadges", () => {
  it("two pills on a card with room for one row hide both: the \"2 more\" pill is drawn alone, so the clear space counts it", () => {
    const small = 48;
    expect(badgeRoom(small, 1, PILL)).toBe(1);
    expect(hiddenBadges(2, small, 1, PILL)).toBe(2);
  });

  it("pills that all fit hide none, and past the cap the rest hide behind the pill", () => {
    expect(hiddenBadges(2, 200, 1, PILL)).toBe(0);
    expect(hiddenBadges(3, 200, 1, PILL)).toBe(1);
    expect(hiddenBadges(6, 200, 1, PILL)).toBe(4);
    expect(hiddenBadges(0, 48, 1, PILL)).toBe(0);
  });

  it("the first row stands below the title band on a card that holds two rows there, and the room counts only the rows under it", () => {
    expect(BADGE_TOP).toBeGreaterThanOrEqual(16);
    expect(badgeLayout(70, 1, PILL).top).toBe(BADGE_TOP);
    expect(badgeRoom(70, 1, PILL)).toBe(2);
    expect(badgeRoom(84, 1, PILL)).toBe(2);
    expect(badgeRoom(84 + 17, 1, PILL)).toBe(3);
  });

  it("a short card keeps its rows from the top edge: the phone's 62 pt card holds two, a 44 pt band one", () => {
    expect(badgeLayout(62, 1, PILL)).toEqual({ top: BADGE_TOP_SHORT, rows: 2 });
    expect(badgeLayout(44, 1, PILL)).toEqual({ top: BADGE_TOP_SHORT, rows: 1 });
    expect(badgeRoom(53, 1, PILL)).toBe(1);
  });

  it("a card with no room for a row above the resource token draws no pill, and none hides behind a \"more\" pill", () => {
    expect(badgeRoom(34, 1, PILL)).toBe(0);
    expect(badgeShown(2, 0)).toEqual({ shown: 0, hidden: 0 });
    expect(hiddenBadges(2, 34, 1, PILL)).toBe(0);
  });
});

// A box on the card, in points from its top edge.
type Box = { name: string; x: number; y: number; w: number; h: number };
const overlap = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const SCALES = [0.85, 1, 1.25, 1.5];
const HEIGHTS = [34, 44, 53, 62, 70, 84, 101];
const HELD: { name: string; marks: (h: number) => FootMarks; counted: boolean; strip: boolean; none?: true }[] = [
  { name: "no held pill", marks: () => ({ under: null, lifted: false, plain: false }), counted: false, strip: false, none: true },
  { name: "held pill", marks: (h) => ({ under: { height: h, counted: false, strip: false }, lifted: false, plain: false }), counted: false, strip: false },
  { name: "held pill over a committed hero's number", marks: (h) => ({ under: { height: h, counted: false, strip: true }, lifted: false, plain: false }), counted: false, strip: true },
  { name: "held pill with a count", marks: (h) => ({ under: { height: h, counted: true, strip: false }, lifted: false, plain: false }), counted: true, strip: false },
];

// Every box a card's foot and edge draw: the effect rows (and the "more" pill), the resource token, the held pill and the Willpower pill.
function boxes(h: number, s: number, effects: number, held: (typeof HELD)[number], resources: boolean): Box[] {
  const w = Math.max(h / 1.4, 44 * s);
  const pill = PILL * s;
  // A card with resources lifts its held pill above the token (the table passes `strip`), so the pill never covers the count.
  const lift = held.strip || resources;
  const marks = held.marks(h);
  if (marks.under) marks.under.strip = lift;
  const stop = footStop(h, s, marks);
  const { top, rows } = badgeLayout(h, s, pill, stop);
  const { shown, hidden } = badgeShown(effects, rows);
  const out: Box[] = [];
  for (let i = 0; i < shown + (hidden > 0 ? 1 : 0); i++) out.push({ name: `row ${i}`, x: 2 * s, y: top + i * (pill + 2 * s), w: 32 * s, h: pill });
  if (resources) out.push({ name: "token", x: 0, y: h - (TOKEN + 1) * s, w: (TOKEN + 1) * s, h: (TOKEN + 1) * s });
  if (marks.under) {
    const box = underMarkBox({ x: 0, y: 0, w, h }, 40 * s, 6 * s, s, held.counted, false, lift);
    out.push({ name: "held", x: box.x, y: box.y, w: box.width, h: box.height });
  }
  if (held.strip) out.push({ name: "willpower", x: w / 2 - 16 * s, y: h - pill - 3 * s, w: 32 * s, h: pill });
  return out;
}

describe("the effect rows, the resource token and the foot pills never overlap", () => {
  it("holds at every rect height and UI scale, with 0, 1 and 2 effect pills and each held pill", () => {
    for (const s of SCALES) {
      for (const h of HEIGHTS) {
        for (const held of HELD) {
          for (const effects of [0, 1, 2, 5]) {
            for (const resources of [true, false]) {
              const all = boxes(h, s, effects, held, resources);
              for (const [i, a] of all.entries()) {
                // The Willpower pill and the resource token share the foot of a narrow card as they always did (the engine's numbers, not the effect column), so that pair is not asked.
                for (const b of all.slice(i + 1).filter((box) => ![a.name, box.name].every((name) => name === "token" || name === "willpower"))) expect(overlap(a, b), `h ${h} s ${s} ${effects} effects, ${held.name}, resources ${resources}: ${a.name} over ${b.name}`).toBe(false);
              }
            }
          }
        }
      }
    }
  });

  it("the 62 pt card keeps two effect rows at Medium with no pill at its foot, and one beside a held pill", () => {
    const none = HELD[0]!;
    expect(badgeShown(2, badgeRoom(62, 1, PILL, footStop(62, 1, none.marks(62))))).toEqual({ shown: 2, hidden: 0 });
    for (const held of HELD.slice(1)) {
      const rows = badgeRoom(62, 1, PILL, footStop(62, 1, held.marks(62)));
      expect(rows, held.name).toBeGreaterThanOrEqual(1);
    }
    // Mugash under a committed hero with one effect pill: the pill and the lifted held pill both stand.
    expect(badgeShown(1, badgeRoom(62, 1, PILL, footStop(62, 1, HELD[2]!.marks(62)))).shown).toBe(1);
  });

  it("an exhausted hero's 44 pt rect, a stacked area's 44 pt band and the smallest card keep their one pill off the token, or draw none", () => {
    for (const h of [34, 44]) {
      const all = boxes(h, 1, 1, HELD[0]!, true);
      expect(all.filter((box) => box.name.startsWith("row")).length, `h ${h}`).toBe(h === 44 ? 1 : 0);
    }
  });

  it("the foot stop is the highest pill at the foot, and null with none", () => {
    expect(footStop(100, 1, { under: null, lifted: false, plain: false })).toBeNull();
    expect(footStop(100, 1, { under: null, lifted: false, plain: true })).toBe(78);
    expect(footStop(100, 1, { under: null, lifted: true, plain: true })).toBe(58);
    expect(footStop(100, 1, { under: { height: 100, counted: false, strip: false }, lifted: false, plain: false })).toBe(78);
    expect(footStop(100, 1, { under: { height: 60, counted: true, strip: false }, lifted: false, plain: false })).toBe(18);
  });
});

describe("an upright card in a stacked area's covered band", () => {
  it("keeps the title band clear and puts its one pill row right of the resource token", () => {
    for (const s of SCALES) {
      const band = 44 * s;
      const covered = coveredBand(true, false, 2, s);
      expect(covered, `s ${s}`).toEqual({ left: (TOKEN + 1) * s });
      // Without the rule the column starts at the top edge and covers the name.
      expect(badgeLayout(band, s, PILL * s, null, null).top).toBe(BADGE_TOP_SHORT * s);
      expect(badgeLayout(band, s, PILL * s, null, covered)).toEqual({ top: BADGE_TOP * s, rows: 1 });
      // A hero with no token needs no shift.
      expect(coveredBand(true, false, 0, s)).toEqual({ left: 0 });
    }
  });

  it("the pill clears the token, and gives way to a committed hero's Willpower pill", () => {
    const covered = coveredBand(true, false, 1, 1)!;
    const { top, rows } = badgeLayout(44, 1, PILL, null, covered);
    expect(overlap({ name: "row", x: 2 + covered.left, y: top, w: 32, h: PILL }, { name: "token", x: 0, y: 44 - (TOKEN + 1), w: TOKEN + 1, h: TOKEN + 1 })).toBe(false);
    expect(rows).toBe(1);
    const committed = footStop(44, 1, { under: null, lifted: false, plain: false, committed: true });
    expect(committed).toBe(44 - 18);
    expect(badgeRoom(44, 1, PILL, committed, covered)).toBe(0);
  });

  it("changes no other card: an exhausted card, a card outside a covered band and the committed foot stop on a tall card", () => {
    expect(coveredBand(false, false, 3, 1)).toBeNull();
    expect(coveredBand(true, true, 3, 1)).toBeNull();
    for (const h of HEIGHTS) {
      const free = badgeRoom(h, 1, PILL, null);
      expect(badgeRoom(h, 1, PILL, footStop(h, 1, { under: null, lifted: false, plain: false, committed: true }))).toBe(free);
    }
  });
});

