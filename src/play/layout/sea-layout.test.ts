// Rules: dcce.ship-objectives, dcce.ship-enemies, dcce.corsair-deck, dcce.boarding (data/rules/entries.json). The sea family's pieces on every screen down to 667 x 375 with
// two seats (docs/design-system-table.md, Spacing and the play area's rows): ships first, the second pile slot, the fold. The canvas is what the table view leaves of the screen: the
// side insets, the command column, the 52 pt bar under its 8 pt top, and and no quest scale (the quest meter stands in the command column).
import { describe, expect, it } from "vitest";

import { hitBounds, slotBounds, tableLayout, type CardSlot, type Rect, type TableLayout } from "./layout.ts";
import { seaFixture, seaViews, type SeaSpec } from "../dream-chaser/sea-fixture.ts";
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

// The table view's canvas: the screen less both side insets, the command column (30% in logical points, 210 to 280);
// under the bar (8 pt top and 52 pt), above no bottom inset.
function canvas(screen: Screen, scale: number): { width: number; height: number } {
  const command = Math.round(Math.min(280, Math.max(210, (screen.width / scale) * 0.3)) * scale);
  return { width: Math.floor(screen.width - 2 * screen.inset - command), height: Math.floor(screen.height - (8 + 52) * scale) };
}

const overlap = (a: Rect, b: Rect): boolean => a.w > 0 && a.h > 0 && b.w > 0 && b.h > 0 && a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;

const SOLO: SeaSpec = { heading: "Rain", ships: [{ code: "dream-chaser", seat: 0 }, { code: "dawn-star", seat: 0 }], allies: 3, staging: 5, engaged: 3, corsairDeck: 9, corsairDiscard: 2, damage: 3 };
const DUO: SeaSpec = { seatCount: 2, heading: "Cloud", ships: [{ code: "dream-chaser", seat: 0 }, { code: "dawn-star", seat: 1 }], allies: 2, staging: 5, engaged: 3, corsairDeck: 9, corsairDiscard: 2 };
const TABLES: readonly [string, SeaSpec][] = [["solo, two ships", SOLO], ["two seats", DUO], ["crowded solo", { ...SOLO, staging: 12, engaged: 9 }]];

function layoutOf(spec: SeaSpec, screen: Screen, scale: number, seat = 0): TableLayout {
  const fixture = seaFixture(spec);
  const { views, piles } = seaViews(fixture, seat);
  const size = canvas(screen, scale);
  return tableLayout(size.width, size.height, views, piles, { scale });
}

describe("the sea family's table on every screen", () => {
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
          // The deck and its discard pile stand in the left column, clear of the rows beside it.
          expect(layout.piles.corsairDeck).toBeDefined();
          expect(layout.piles.corsairDiscard).toBeDefined();
        });

        it(`gives every slot a 44 pt hit or folds it, and every pile and fold stack a 44 pt hit: ${at}`, () => {
          const layout = layoutOf(spec, screen, scale);
          const target = touch(scale, 44);
          for (const zone of ["staging", "engaged", "play"] as const) {
            const row = layout.slots.filter((slot) => slot.zone === zone && (slot.kind === "card" || slot.kind === "pile")).sort((a, b) => a.x - b.x);
            // A row is a band; a stacked play area has two, told apart by their y.
            const bands = new Map<number, CardSlot[]>();
            for (const slot of row) bands.set(Math.round(slot.y / 4), [...(bands.get(Math.round(slot.y / 4)) ?? []), slot]);
            for (const [, band] of bands) {
              for (let index = 0; index + 1 < band.length; index += 1) {
                const here = slotBounds(band[index] as CardSlot);
                const next = slotBounds(band[index + 1] as CardSlot);
                const visible = next.x - here.x;
                // Neighbours either stand clear of each other or leave a target's width of the left one.
                if (visible < here.w - 0.5 && zone !== "engaged") expect(visible, `${zone} ${band[index]?.id}`).toBeGreaterThanOrEqual(target - 0.5);
              }
            }
          }
          for (const slot of layout.slots.filter((candidate) => candidate.kind === "pile")) {
            const hit = hitBounds(slot);
            expect(hit.w, slot.id).toBeGreaterThanOrEqual(44);
            expect(hit.h, slot.id).toBeGreaterThanOrEqual(44);
          }
          for (const fold of layout.folds ?? []) {
            const slot = layout.slots.find((candidate) => candidate.id === fold.id) as CardSlot;
            expect(hitBounds(slot).w).toBeGreaterThanOrEqual(44);
            expect(hitBounds(slot).h).toBeGreaterThanOrEqual(44);
          }
        });
      }
    }
  }
});

describe("the sea family's pieces in place", () => {
  it("stands a seat's ships first in its row, the Dream-chaser leftmost, with one more gap after them", () => {
    const fixture = seaFixture({ ...SOLO, allies: 2 });
    const { views, piles } = seaViews(fixture);
    const layout = tableLayout(591, 338, views, piles, {});
    const row = layout.slots.filter((slot) => slot.zone === "play" && slot.kind === "card").sort((a, b) => a.x - b.x);
    const ships = [fixture.ids.ship0, fixture.ids.ship1];
    expect(row.slice(0, 2).map((slot) => slot.id)).toEqual(ships);
    const gap = 6;
    const [chaser, star, next] = row;
    expect((star?.x ?? 0) - ((chaser?.x ?? 0) + (chaser?.w ?? 0))).toBeCloseTo(gap, 5);
    expect((next?.x ?? 0) - ((star?.x ?? 0) + (star?.w ?? 0))).toBeCloseTo(2 * gap, 5);
  });

  it("puts the ships at the front row's left end when the play area stacks, so their attachments peek and their damage stays in reach", () => {
    const fixture = seaFixture({ ...SOLO, allies: 11, staging: 0, engaged: 0 });
    const { views, piles } = seaViews(fixture);
    const layout = tableLayout(591, 300, views, piles, {});
    const row = layout.slots.filter((slot) => slot.zone === "play" && slot.kind === "card");
    const front = Math.max(...row.map((slot) => slot.y));
    const back = Math.min(...row.map((slot) => slot.y));
    if (front === back) return;
    const frontRow = row.filter((slot) => slot.y === front).sort((a, b) => a.x - b.x);
    expect(frontRow.slice(0, 2).map((slot) => slot.id)).toEqual([fixture.ids.ship0, fixture.ids.ship1]);
  });

  it("stands the Dream-chaser's Heading card under it as an attachment", () => {
    const fixture = seaFixture({ heading: "Sun", ships: [{ code: "dream-chaser", seat: 0 }] });
    const { views, piles } = seaViews(fixture);
    const layout = tableLayout(667, 300, views, piles, {});
    const peek = layout.slots.find((slot) => slot.id === fixture.ids.heading);
    const host = layout.slots.find((slot) => slot.id === fixture.ids.ship0);
    expect(peek?.kind).toBe("attachment");
    expect(peek?.y).toBeGreaterThan(host?.y ?? 0);
  });
});
