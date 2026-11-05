// Rules: emce.caves-deck, emce.evil-creatures-deck, emce.treasure, emce.discover (data/rules/entries.json). The Wilderland family's pieces on every screen down to 667 x 375 with two seats, in the
// second pile slot phase 39b built (docs/design-system-table.md, Piles): the Evil Creatures pair, the Caves deck alone, a guarded treasure, and Discover's cards in the look strip. The canvas is what the table
// view leaves of the screen (sea-layout.test.ts).
import { describe, expect, it } from "vitest";

import { tableLayout, type CardSlot, type Rect, type TableLayout } from "./layout.ts";
import { hitBounds, slotBounds } from "./hits.ts";
import { wilderlandFixture, wilderlandViews, type WilderlandSpec } from "../store/wilderland-fixture.ts";
import { seaFixture, seaViews } from "../dream-chaser/sea-fixture.ts";
import { UI_SCALES, touch } from "../../ui/ui-scale.ts";

type Screen = { width: number; height: number; inset: number; scales: readonly number[] };
const S = UI_SCALES.small;
const M = UI_SCALES.medium;
const L = UI_SCALES.large;
const SCREENS: readonly Screen[] = [
  { width: 667, height: 375, inset: 0, scales: [S, M, L] },
  { width: 844, height: 390, inset: 47, scales: [S, M, L] },
  { width: 1024, height: 768, inset: 0, scales: [M, L] },
  { width: 1366, height: 1024, inset: 0, scales: [M, L] },
];

function canvas(screen: Screen, scale: number): { width: number; height: number } {
  const command = Math.round(Math.min(280, Math.max(210, (screen.width / scale) * 0.3)) * scale);
  return { width: Math.floor(screen.width - 2 * screen.inset - command), height: Math.floor(screen.height - (8 + 52) * scale) };
}

const overlap = (a: Rect, b: Rect): boolean => a.w > 0 && a.h > 0 && b.w > 0 && b.h > 0 && a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;

const EVIL: WilderlandSpec = { evilDeck: 5, evilDiscard: 2, allies: 3, staging: 5, engaged: 3, treasure: "guarded" };
const CAVES: WilderlandSpec = { caves: 6, allies: 3, staging: 5, engaged: 3, treasure: "free" };
const TABLES: readonly [string, WilderlandSpec][] = [
  ["Evil Creatures pair, one seat", EVIL],
  ["Caves deck, one seat", CAVES],
  ["Evil Creatures pair, two seats", { ...EVIL, seatCount: 2 }],
  ["crowded Evil Creatures table", { ...EVIL, staging: 12, engaged: 9 }],
];

function layoutOf(spec: WilderlandSpec, screen: Screen, scale: number, seat = 0, options: Parameters<typeof tableLayout>[4] = {}): TableLayout {
  const { views, piles } = wilderlandViews(wilderlandFixture(spec), seat);
  const size = canvas(screen, scale);
  return tableLayout(size.width, size.height, views, piles, { scale, ...options });
}

describe("the Wilderland family's table on every screen", () => {
  for (const screen of SCREENS) {
    for (const scale of screen.scales) {
      for (const [name, spec] of TABLES) {
        const at = `${name} ${screen.width}x${screen.height} insets ${screen.inset} at ${scale}`;
        it(`keeps no two zones or piles over each other: ${at}`, () => {
          const layout = layoutOf(spec, screen, scale);
          const rects: [string, Rect][] = [
            ["staging", layout.zones.staging],
            ["engaged", layout.zones.engaged],
            ["play", layout.zones.play],
            ...Object.entries(layout.piles).map(([id, rect]) => [id, rect] as [string, Rect]),
          ];
          for (let a = 0; a < rects.length; a += 1) {
            for (let b = a + 1; b < rects.length; b += 1) expect(overlap(rects[a]?.[1] as Rect, rects[b]?.[1] as Rect), `${rects[a]?.[0]} over ${rects[b]?.[0]}`).toBe(false);
          }
          expect(Object.keys(layout.piles).sort()).toEqual(spec.caves != null ? ["cavesDeck", "deck", "discard", "encounterDeck", "encounterDiscard"] : ["deck", "discard", "encounterDeck", "encounterDiscard", "evilCreaturesDeck", "evilCreaturesDiscard"]);
        });

        it(`gives every pile and fold stack a 44 pt hit, and keeps the rows' steps at a target or folds: ${at}`, () => {
          const layout = layoutOf(spec, screen, scale);
          const target = touch(scale, 44);
          for (const zone of ["staging", "engaged"] as const) {
            const row = layout.slots.filter((slot) => slot.zone === zone && (slot.kind === "card" || slot.kind === "pile")).sort((a, b) => a.x - b.x);
            for (let index = 0; index + 1 < row.length; index += 1) {
              const here = slotBounds(row[index] as CardSlot);
              const next = slotBounds(row[index + 1] as CardSlot);
              const visible = next.x - here.x;
              if (visible < here.w - 0.5 && zone !== "engaged") expect(visible, `${zone} ${row[index]?.id}`).toBeGreaterThanOrEqual(target - 0.5);
            }
          }
          for (const slot of layout.slots.filter((candidate) => candidate.kind === "pile")) {
            const hit = hitBounds(slot);
            expect(hit.w, slot.id).toBeGreaterThanOrEqual(44);
            expect(hit.h, slot.id).toBeGreaterThanOrEqual(44);
          }
        });
      }
    }
  }
});

describe("the second slot for the Wilderland decks", () => {
  const screen = SCREENS[0] as Screen;

  it("stands the Evil Creatures pair under the encounter pair, the deck left and its discard pile right", () => {
    const layout = layoutOf(EVIL, screen, M);
    const { evilCreaturesDeck, evilCreaturesDiscard, encounterDeck, encounterDiscard } = layout.piles;
    expect(evilCreaturesDeck?.x).toBe(encounterDeck.x);
    expect(evilCreaturesDiscard?.x).toBe(encounterDiscard.x);
    expect(evilCreaturesDeck?.y).toBe(evilCreaturesDiscard?.y);
    // Level with the engagement area, below staging's piles.
    expect(evilCreaturesDeck?.y).toBeGreaterThan(encounterDeck.y);
    expect(evilCreaturesDeck?.y).toBeGreaterThanOrEqual(layout.zones.engaged.y);
  });

  it("takes the Caves deck alone into the left place and leaves the right one empty, with no outline", () => {
    const layout = layoutOf(CAVES, screen, M);
    expect(layout.piles.cavesDeck?.x).toBe(layout.piles.encounterDeck.x);
    expect(layout.piles.evilCreaturesDiscard).toBeUndefined();
    expect(layout.slots.some((slot) => slot.zone === "evilCreaturesDiscard")).toBe(false);
  });

  it("narrows the engagement area by the slot's width and a gap, as the Corsair pair does, and only while the game has the slot", () => {
    const plain = layoutOf({ allies: 3, staging: 5, engaged: 3 }, screen, M);
    const evil = layoutOf(EVIL, screen, M);
    const caves = layoutOf(CAVES, screen, M);
    const corsair = (() => {
      const fixture = seaFixture({ allies: 3, staging: 5, engaged: 3, corsairDeck: 5, corsairDiscard: 2 });
      const { views, piles } = seaViews(fixture);
      const size = canvas(screen, M);
      return tableLayout(size.width, size.height, views, piles, { scale: M });
    })();
    expect(Object.keys(plain.piles)).toHaveLength(4);
    expect(evil.zones.engaged.w).toBeLessThan(plain.zones.engaged.w);
    expect(caves.zones.engaged.w).toBe(evil.zones.engaged.w);
    expect(evil.zones.engaged.w).toBe(corsair.zones.engaged.w);
    expect(evil.zones.staging).toEqual(plain.zones.staging);
    expect(evil.zones.play).toEqual(plain.zones.play);
    expect(evil.zones.hand).toEqual(plain.zones.hand);
  });

  it("keeps the narrowed engagement row's steps at a 44 pt target where the cards overlap, and folds the rest, on the smallest screen", () => {
    const small = SCREENS[0] as Screen;
    const target = touch(S, 44);
    for (const spec of [{ ...EVIL, engaged: 9 }, { ...CAVES, engaged: 9 }]) {
      const layout = layoutOf(spec, small, S);
      const row = layout.slots.filter((slot) => slot.zone === "engaged" && slot.kind === "card").sort((a, b) => a.x - b.x);
      expect(row.length).toBeGreaterThan(1);
      for (let index = 0; index + 1 < row.length; index += 1) {
        const here = slotBounds(row[index] as CardSlot);
        const step = slotBounds(row[index + 1] as CardSlot).x - here.x;
        if (step < here.w - 0.5) expect(step, row[index]?.id).toBeGreaterThanOrEqual(target - 0.5);
      }
      // Every card stays inside the narrowed zone, clear of the slot's piles.
      for (const slot of row) expect(slot.x + slot.w).toBeLessThanOrEqual(layout.zones.engaged.x + layout.zones.engaged.w + 0.5);
    }
  });

  it("draws each pile as a pile slot with its count, the discard pile faced up", () => {
    const layout = layoutOf(EVIL, screen, M);
    const deck = layout.slots.find((slot) => slot.id === "pile:evilCreaturesDeck");
    const discard = layout.slots.find((slot) => slot.id === "pile:evilCreaturesDiscard");
    expect([deck?.count, deck?.faceDown, deck?.kind]).toEqual([5, true, "pile"]);
    expect([discard?.count, discard?.faceDown, discard?.code]).toEqual([2, false, "warg"]);
  });

  it("shows a dealt deck that is empty as an empty pile, which the canvas outlines", () => {
    const layout = layoutOf({ evilDeck: 0, caves: undefined }, screen, M);
    expect(layout.slots.find((slot) => slot.id === "pile:evilCreaturesDeck")?.count).toBe(0);
    expect(layout.slots.find((slot) => slot.id === "pile:evilCreaturesDiscard")?.count).toBe(0);
  });

  it("is shared: peeking at the other seat leaves both piles where they are", () => {
    const own = layoutOf({ ...EVIL, seatCount: 2 }, screen, M, 0);
    const peek = layoutOf({ ...EVIL, seatCount: 2 }, screen, M, 1);
    expect(peek.piles.evilCreaturesDeck).toEqual(own.piles.evilCreaturesDeck);
    expect(peek.piles.evilCreaturesDiscard).toEqual(own.piles.evilCreaturesDiscard);
  });
});

describe("a treasure guarded in the staging area", () => {
  it("stands as a guarded pair: the guard lies over the treasure it guards, in the next place of the row", () => {
    const fixture = wilderlandFixture({ staging: 2, treasure: "guarded" });
    const { views, piles } = wilderlandViews(fixture);
    const layout = tableLayout(591, 338, views, piles, {});
    const treasure = layout.slots.find((slot) => slot.id === fixture.ids.treasure);
    const guard = layout.slots.find((slot) => slot.id === fixture.ids.guard);
    expect(treasure?.zone).toBe("staging");
    expect(guard?.zone).toBe("staging");
    expect(guard?.x).toBeGreaterThan(treasure?.x ?? 0);
    expect(guard?.x).toBeLessThan((treasure?.x ?? 0) + (treasure?.w ?? 0));
  });

  it("folds as a guarded pair does, ahead of the locations and enemies, and never the pair a beat names", () => {
    const fixture = wilderlandFixture({ staging: 12, engaged: 4, treasure: "guarded" });
    const { views, piles } = wilderlandViews(fixture);
    const folded = tableLayout(300, 338, views, piles, {});
    expect(folded.folds?.length).toBeGreaterThan(0);
    const first = folded.folds?.find((fold) => fold.zone === "staging");
    expect(first?.cards).toContain(fixture.ids.treasure);
    const kept = tableLayout(300, 338, views, piles, { keep: new Set([fixture.ids.treasure ?? ""]) });
    expect(kept.slots.some((slot) => slot.id === fixture.ids.treasure)).toBe(true);
    expect(kept.folds?.some((fold) => fold.cards.includes(fixture.ids.treasure ?? ""))).toBe(false);
  });
});

describe("Discover's cards in the look strip", () => {
  it("leaves the staging band to the cards that stand there when asked, and uses the engagement band first", () => {
    const fixture = wilderlandFixture({ staging: 3, engaged: 2, evilDeck: 2 });
    const { views, piles } = wilderlandViews(fixture);
    const cards = [fixture.ids.evilDeck0, fixture.ids.evilDeck1].map((id) => fixture.state.cards[id ?? ""]).filter((card) => card != null);
    const layout = tableLayout(591, 338, views, piles, { look: cards.map((card) => ({ card, success: 0 })), lookLeavesStaging: true });
    const strip = layout.slots.filter((slot) => slot.success === 0);
    expect(strip).toHaveLength(2);
    expect(strip.map((slot) => slot.y)).toEqual(strip.map(() => layout.zones.engaged.y));
    // No staging card is covered by a strip card.
    for (const staged of layout.slots.filter((slot) => slot.zone === "staging" && slot.kind === "card")) {
      for (const slot of strip) expect(overlap(slotBounds(staged), slotBounds(slot)), staged.id).toBe(false);
    }
  });

  it("lays the cards at the table's card size over staging, with no success medallion", () => {
    const fixture = wilderlandFixture({ staging: 3, engaged: 2, evilDeck: 3 });
    const { views, piles } = wilderlandViews(fixture);
    const cards = [fixture.ids.evilDeck0, fixture.ids.evilDeck1, fixture.ids.evilDeck2].map((id) => fixture.state.cards[id ?? ""]).filter((card) => card != null);
    const layout = tableLayout(591, 338, views, piles, { look: cards.map((card) => ({ card, success: 0 })) });
    const strip = layout.slots.filter((slot) => slot.success === 0);
    expect(strip).toHaveLength(3);
    for (const slot of strip) expect([slot.w, slot.h]).toEqual([layout.card.w, layout.card.h]);
    expect(strip.map((slot) => slot.y)).toEqual(strip.map(() => layout.zones.staging.y));
    expect(strip.map((slot) => slot.x)).toEqual([...strip.map((slot) => slot.x)].sort((a, b) => a - b));
    expect(strip.every((slot) => slot.x >= layout.zones.staging.x && slot.x + slot.w <= layout.zones.staging.x + layout.zones.staging.w + 0.5)).toBe(true);
  });
});
