// A crowded top row that runs on under the command column (row-reach.ts; docs/design-system-table.md, Spacing and the play area's rows):
// it takes the room only when it would squeeze or fold, keeps staging's piles at its right end (the screen's edge) and skips the engagement
// area's, and leaves an uncrowded table exactly as it was.
import { describe, expect, it } from "vitest";

import type { CardInstance } from "../../rules/core/state.ts";

import { tableLayout, type LayoutViews, type PileViews, type TableLayout } from "./layout.ts";
import { slotBounds } from "./hits.ts";
import { foldRow, type FoldGroup } from "./row-fold.ts";
import { rowFeet } from "./column-reach.ts";
import { reachRow } from "./row-reach.ts";
import { PILES, TABLE_ZONES, type PileView, type ZoneEntry, type ZoneId, type ZoneView } from "../store/selectors.ts";

const card = (id: string, zone: CardInstance["zone"]): CardInstance => ({ id, code: `c${id}`, zone, exhausted: false, damage: 0, progress: 0, resources: 0, host: null, attachments: [], committed: false, shadowId: null, face: "up", controller: 0, enteredPlay: 0 });
const entry = (c: CardInstance): ZoneEntry => ({ card: c, attached: [], paired: [], fight: null });
const ids = (prefix: string, count: number) => Array.from({ length: count }, (_, at) => `${prefix}${at}`);

function table(staging: number, engaged: number): { views: LayoutViews; piles: PileViews } {
  const zones: Record<ZoneId, readonly ZoneEntry[]> = {
    questStage: [entry(card("q", "questStage"))],
    staging: ids("s", staging).map((id) => entry(card(id, "staging"))),
    activeLocation: [],
    secondActiveLocation: [],
    engaged: ids("e", engaged).map((id) => entry(card(id, "engaged"))),
    play: ids("p", 4).map((id) => entry(card(id, "play"))),
    hand: ids("h", 5).map((id) => entry(card(id, "hand"))),
  };
  const views = Object.fromEntries(TABLE_ZONES.map((zone) => [zone, { zone, seat: 0, entries: zones[zone] } satisfies ZoneView])) as unknown as LayoutViews;
  const piles = Object.fromEntries(PILES.map((pile) => [pile, { pile, seat: 0, ids: ["x"], top: null } satisfies PileView])) as unknown as PileViews;
  return { views, piles };
}

// The canvas an 844 x 390 phone leaves left of its command column, and the column's width there (command.ts); a tablet's.
const CANVASES = [
  { width: 591, height: 338, column: 253 },
  { width: 760, height: 700, column: 280 },
];

const folded = (layout: TableLayout, zone: "staging" | "engaged") => layout.folds?.find((fold) => fold.zone === zone)?.cards.length ?? 0;
const zoneSlots = (layout: TableLayout, zone: "staging" | "engaged") => layout.slots.filter((slot) => slot.zone === zone);

describe("a row under the command column", () => {
  it("leaves an uncrowded table exactly as it was, whatever the reach", () => {
    for (const canvas of CANVASES) {
      const { views, piles } = table(3, 2);
      const plain = tableLayout(canvas.width, canvas.height, views, piles);
      for (const reach of [0, 1, 2] as const) expect(tableLayout(canvas.width, canvas.height, views, piles, { column: canvas.column, reach })).toEqual(plain);
    }
  });

  it("folds fewer of a crowded staging row's groups with reach 1 and moves the encounter piles to the screen's edge, past every staging card", () => {
    for (const canvas of CANVASES) {
      const { views, piles } = table(16, 2);
      const plain = tableLayout(canvas.width, canvas.height, views, piles);
      const reached = tableLayout(canvas.width, canvas.height, views, piles, { column: canvas.column, reach: 1 });
      expect(folded(plain, "staging"), `${canvas.width}`).toBeGreaterThan(0);
      expect(folded(reached, "staging"), `${canvas.width}`).toBeLessThan(folded(plain, "staging"));
      // The pair moves right by the column's width, to the screen's edge; the player's piles stay where they were.
      expect(reached.piles.encounterDeck.x).toBe(plain.piles.encounterDeck.x + canvas.column);
      expect(reached.piles.encounterDiscard.x + reached.piles.encounterDiscard.w).toBeLessThanOrEqual(canvas.width + canvas.column);
      expect(reached.piles.deck).toEqual(plain.piles.deck);
      for (const slot of zoneSlots(reached, "staging")) {
        const box = slotBounds(slot);
        expect(box.x + box.w, slot.id).toBeLessThanOrEqual(reached.piles.encounterDeck.x + 0.5);
      }
      expect(Math.max(...zoneSlots(reached, "staging").map((slot) => slot.x + slot.w))).toBeGreaterThan(canvas.width);
      // The rows the reach does not cover, the hand and the play area stay as they were.
      expect(zoneSlots(reached, "engaged")).toEqual(zoneSlots(plain, "engaged"));
      expect(reached.slots.filter((slot) => slot.zone === "hand" || slot.zone === "play")).toEqual(plain.slots.filter((slot) => slot.zone === "hand" || slot.zone === "play"));
    }
  });

  it("keeps the victory display at staging's right end, after the encounter pair, when the row reaches", () => {
    for (const canvas of CANVASES) {
      const { views, piles } = table(16, 2);
      const withVictory = { ...piles, victory: { pile: "victory", seat: 0, ids: ["v"], top: null } } as PileViews;
      const reached = tableLayout(canvas.width, canvas.height, views, withVictory, { column: canvas.column, reach: 1 });
      const victory = reached.piles.victory;
      expect(victory).toBeDefined();
      expect(victory!.x).toBeGreaterThan(reached.piles.encounterDiscard.x);
      expect(victory!.x + victory!.w).toBeLessThanOrEqual(canvas.width + canvas.column);
      for (const slot of zoneSlots(reached, "staging")) expect(slotBounds(slot).x + slotBounds(slot).w, slot.id).toBeLessThanOrEqual(reached.piles.encounterDeck.x + 0.5);
    }
  });

  it("reaches the engagement area only with reach 2", () => {
    for (const canvas of CANVASES) {
      const { views, piles } = table(2, 14);
      const plain = tableLayout(canvas.width, canvas.height, views, piles);
      expect(folded(plain, "engaged"), `${canvas.width}`).toBeGreaterThan(0);
      expect(tableLayout(canvas.width, canvas.height, views, piles, { column: canvas.column, reach: 1 })).toEqual(plain);
      const reached = tableLayout(canvas.width, canvas.height, views, piles, { column: canvas.column, reach: 2 });
      expect(folded(reached, "engaged")).toBeLessThan(folded(plain, "engaged"));
    }
  });

  it("keeps both rows' feet the same at every reach when a card that folds has an attachment", () => {
    for (const canvas of CANVASES) {
      const { views, piles } = table(16, 2);
      const staging = views.staging.entries.map((e, at) => (at === 4 ? { ...e, attached: [card("sa", "staging")] } : e));
      const withAttachment = { ...views, staging: { ...views.staging, entries: staging } } as LayoutViews;
      const feet = ([0, 1, 2] as const).map((reach) => rowFeet(tableLayout(canvas.width, canvas.height, withAttachment, piles, { column: canvas.column, reach })));
      expect(feet[1], `${canvas.width}`).toEqual(feet[0]);
      expect(feet[2], `${canvas.width}`).toEqual(feet[0]);
      const plain = rowFeet(tableLayout(canvas.width, canvas.height, views, piles, { column: canvas.column }));
      expect(feet[0]?.staging).toBeGreaterThan(plain.staging);
    }
  });

  it("takes no room with no column", () => {
    const { views, piles } = table(16, 14);
    expect(tableLayout(591, 338, views, piles, { reach: 2 })).toEqual(tableLayout(591, 338, views, piles));
  });
});

describe("reachRow", () => {
  const ROW = { x: 0, width: 300, gap: 6, target: 44, stackW: 40 };
  const groups = (count: number): FoldGroup[] => ids("g", count).map((id) => ({ id, width: 60, cards: [id], rank: 1, pinned: false }));

  it("is foldRow's plan for a row that fits a gap apart, or with no reach", () => {
    expect(reachRow(groups(4), ROW, { hole: 100, extra: 200 })).toEqual(foldRow(groups(4), ROW));
    expect(reachRow(groups(9), ROW, null)).toEqual(foldRow(groups(9), ROW));
  });

  it("carries the groups that would cross the row's end past the hole, and keeps the rest inside the extra room", () => {
    const plan = reachRow(groups(7), ROW, { hole: 100, extra: 200 });
    const xs = plan.xs.filter((x): x is number => x != null);
    expect(plan.stack).toBeNull();
    expect(xs.filter((x) => x < 300).every((x) => x + 60 <= 300)).toBe(true);
    expect(xs.filter((x) => x >= 300).every((x) => x >= 400 && x + 60 <= 600.5)).toBe(true);
    expect(xs.some((x) => x >= 400)).toBe(true);
  });
});
