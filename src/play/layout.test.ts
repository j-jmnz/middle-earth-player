// The table's geometry at each UI scale (docs/plans/settings-theme-and-ui-scale.md, UI scale engine; user request, 2026-10-28): at Medium it is
// the table as it was; at Small and Large every card still fits the canvas, the hand keeps its 44 pt strip and its target, and the
// gutters and gaps are Medium's times the factor.
import { describe, expect, it } from "vitest";

import type { CardInstance } from "../rules/state.ts";

import { cardSize, handCardSize, hitBounds, MIN_TARGET, slotBounds, tableLayout, type LayoutViews, type PileViews } from "./layout.ts";
import { PILES, TABLE_ZONES, type PileView, type ZoneEntry, type ZoneId, type ZoneView } from "./selectors.ts";
import { UI_SCALES } from "./ui-scale.ts";

const card = (id: string, zone: CardInstance["zone"], extra: Partial<CardInstance> = {}): CardInstance => ({
  id,
  code: `c${id}`,
  zone,
  exhausted: false,
  damage: 0,
  progress: 0,
  resources: 0,
  host: null,
  attachments: [],
  committed: false,
  shadowId: null,
  face: "up",
  controller: 0,
  enteredPlay: 0,
  ...extra,
});

const entry = (c: CardInstance, extra: Partial<ZoneEntry> = {}): ZoneEntry => ({ card: c, attached: [], paired: [], fight: null, ...extra });
const ids = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => `${prefix}${i}`);

// A busy table: a quest stage, a location, five in staging, two enemies engaged (one with a character beside it and a shadow card under
// it), five allies and heroes in play (one exhausted), and a hand of `hand` cards.
function views(hand: number): { views: LayoutViews; piles: PileViews } {
  const zones: Record<ZoneId, readonly ZoneEntry[]> = {
    questStage: [entry(card("q", "questStage"))],
    staging: ids("s", 5).map((id) => entry(card(id, "staging"))),
    activeLocation: [entry(card("l", "activeLocation"))],
    secondActiveLocation: [],
    engaged: [
      entry(card("e0", "engaged"), { attached: [card("sh", "shadow", { face: "down" })], paired: [card("p0", "play")], fight: "defense" }),
      entry(card("e1", "engaged")),
    ],
    play: ids("p", 5).map((id, i) => entry(card(id, "play", { exhausted: i === 1, committed: i === 2 }))),
    hand: ids("h", hand).map((id) => entry(card(id, "hand"))),
  };
  const built = Object.fromEntries(TABLE_ZONES.map((zone) => [zone, { zone, seat: 0, entries: zones[zone] } satisfies ZoneView])) as unknown as LayoutViews;
  const piles = Object.fromEntries(PILES.map((pile) => [pile, { pile, seat: 0, ids: ["x"], top: null } satisfies PileView])) as unknown as PileViews;
  return { views: built, piles };
}

// The canvas the table view leaves at 844x390 and 667x375 (the command column beside it, the 52 pt bar over it), and a small one.
const CANVASES = [
  { width: 591, height: 338 },
  { width: 457, height: 323 },
  { width: 400, height: 300 },
];
const SCALES = [UI_SCALES.small, UI_SCALES.medium, UI_SCALES.large];

describe("the table's layout at a UI scale", () => {
  it("is the same table at scale 1 as with no scale", () => {
    for (const canvas of CANVASES) {
      const { views: v, piles } = views(7);
      const plain = tableLayout(canvas.width, canvas.height, v, piles, {});
      const medium = tableLayout(canvas.width, canvas.height, v, piles, { scale: 1 });
      expect(medium).toEqual(plain);
      expect(cardSize(canvas.width, canvas.height, 1)).toEqual(cardSize(canvas.width, canvas.height));
    }
  });

  it("keeps every card on the table inside the canvas at Small and Large", () => {
    for (const scale of SCALES) {
      for (const canvas of CANVASES) {
        for (const hand of [0, 1, 5, 9, 12]) {
          const { views: v, piles } = views(hand);
          const layout = tableLayout(canvas.width, canvas.height, v, piles, { scale });
          for (const slot of layout.slots) {
            const at = `${scale} ${canvas.width}x${canvas.height} hand ${hand} ${slot.zone} ${slot.id}`;
            const box = slotBounds(slot);
            expect(box.x, at).toBeGreaterThanOrEqual(0);
            expect(box.x + box.w, at).toBeLessThanOrEqual(canvas.width + 0.5);
            if (slot.zone === "hand") {
              // The hand peeks up from the bottom edge: its top is on the canvas.
              expect(slot.y, at).toBeLessThan(canvas.height);
              continue;
            }
            expect(box.y, at).toBeGreaterThanOrEqual(0);
            // Whatever is not in the hand stands above the hand's strip.
            expect(box.y + box.h, at).toBeLessThanOrEqual(canvas.height);
          }
          for (const id of ["encounterDeck", "encounterDiscard", "deck", "discard"] as const) {
            const rect = layout.piles[id];
            expect(rect.x, id).toBeGreaterThanOrEqual(0);
            expect(rect.x + rect.w, id).toBeLessThanOrEqual(canvas.width);
          }
          expect(layout.scale).toBe(scale);
        }
      }
    }
  });

  it("scales the gutter, the gap and the cap with the factor", () => {
    for (const scale of SCALES) {
      const { views: v, piles } = views(3);
      const layout = tableLayout(2000, 1200, v, piles, { scale });
      // A canvas far larger than any phone: the card is at its cap (96 at Medium), the quest card stands one gutter in.
      expect(layout.card.w).toBe(Math.floor(96 * scale));
      expect(layout.zones.questStage.x).toBeCloseTo(8 * scale, 9);
      expect(layout.zones.staging.y).toBeCloseTo(8 * scale, 9);
    }
  });

  it("keeps 44 pt of each hand card to touch, and a hand strip as tall as a target, at every scale", () => {
    for (const scale of SCALES) {
      for (const canvas of CANVASES) {
        // (A hand of 12 on a canvas this narrow cannot keep 44 pt of each card at any scale: the card floor wins, as it always did.)
        for (const hand of [2, 6, 8]) {
          const { views: v, piles } = views(hand);
          const layout = tableLayout(canvas.width, canvas.height, v, piles, { scale });
          const cards = layout.slots.filter((slot) => slot.zone === "hand");
          expect(cards).toHaveLength(hand);
          for (let at = 1; at < cards.length; at += 1) {
            const step = (cards[at]?.x ?? 0) - (cards[at - 1]?.x ?? 0);
            expect(step, `${scale} ${canvas.width} hand ${hand} card ${at}`).toBeGreaterThanOrEqual(MIN_TARGET - 0.001);
          }
          // The hand's strip above the bottom edge is a target at least 44 pt tall (less the fan's drop at the ends).
          const strip = layout.zones.hand;
          expect(canvas.height - strip.y, `${scale} ${canvas.width}`).toBeGreaterThanOrEqual(MIN_TARGET);
          // Every card still shows at least a 44 pt target above the bottom edge.
          for (const slot of cards) expect(canvas.height - slot.y, `${scale} ${slot.id}`).toBeGreaterThanOrEqual(MIN_TARGET - 0.001);
        }
      }
    }
  });

  it("never narrows a hand card under the floor, and keeps the strip a target", () => {
    const base = { w: 60, h: 84 };
    for (const scale of SCALES) {
      const narrowed = handCardSize(base, 220, 5, scale);
      expect(narrowed.w).toBeGreaterThanOrEqual(Math.round(36 * scale));
      expect(handCardSize(base, 220, 1, scale)).toEqual(base);
      // The strip of each card but the last: the width less the card, over the gaps between them, is at least 44.
      expect((220 - narrowed.w) / 4).toBeGreaterThanOrEqual(MIN_TARGET - 0.001);
    }
  });

  it("grows a pile smaller than 44 pt to a 44 pt hit target at every scale", () => {
    for (const scale of SCALES) {
      const { views: v, piles } = views(3);
      const layout = tableLayout(300, 260, v, piles, { scale });
      for (const slot of layout.slots.filter((candidate) => candidate.kind === "pile")) {
        const box = hitBounds(slot);
        expect(box.w, slot.id).toBeGreaterThanOrEqual(Math.min(MIN_TARGET, slot.w));
        expect(box.h, slot.id).toBeGreaterThanOrEqual(Math.min(MIN_TARGET, slot.h));
      }
    }
  });
});
