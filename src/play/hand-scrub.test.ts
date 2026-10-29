// The hand scrub (phase 25): the risen, spread hand and the card under the finger (docs/design-system.md, Table, Gestures).
import { describe, expect, it } from "vitest";

import { cardAt, cancelled, fanTilts, handSlots, pick, spreadLayout, startCard, startsScrub, ticksOn, SCRUB_HOLD_MS, SCRUB_SLOP, type Spread } from "./hand-scrub.ts";
import { cardSize, handCardSize, MIN_TARGET, type CardSlot, type Rect, type TableLayout } from "./layout.ts";
import { SHAPE } from "./motion-tokens.ts";
import { scrubPose } from "./scrub-pose.ts";
import { UI_SCALES } from "./ui-scale.ts";

const none: Rect = { x: 0, y: 0, w: 0, h: 0 };

// A layout with only a hand of `count` cards, laid out the way layout.ts does (its sizes; the fan's slight drop and tilt).
function layoutOf(count: number, width: number, height: number, bottom = 0, scale = 1): TableLayout {
  const card = cardSize(width, height);
  const size = handCardSize(card, width - 16, count);
  const handY = height - bottom - Math.max(52, Math.round(card.h * 0.56));
  const slots: CardSlot[] = Array.from({ length: count }, (_, index) => ({
    x: 8 + index * Math.max(MIN_TARGET, (width - 16 - size.w) / Math.max(1, count - 1)),
    y: handY + Math.abs(index - (count - 1) / 2) * 2,
    w: size.w,
    h: size.h,
    id: `h${index}`,
    code: "x",
    zone: "hand",
    kind: "card",
    exhausted: false,
    faceDown: false,
    landscape: false,
    resources: 0,
    damage: 0,
    progress: 0,
    tilt: (index - (count - 1) / 2) * 0.03,
    count: 0,
    committed: false,
  }));
  const hand: Rect = { x: 8, y: handY, w: width - 16, h: height - handY };
  return {
    width,
    height,
    scale,
    card,
    zones: { questStage: none, staging: none, activeLocation: none, secondActiveLocation: none, engaged: none, play: none, hand },
    piles: { deck: none, discard: none, encounterDeck: none, encounterDiscard: none },
    slots,
    marks: [],
    attacker: null,
  };
}

const CANVASES = [
  { width: 844, height: 390, bottom: 0 },
  { width: 667, height: 375, bottom: 21 },
  { width: 560, height: 320, bottom: 0 },
  // Large UI (the layout's scale 1.3): the margins, gaps and slices all grow.
  { width: 1000, height: 500, bottom: 0, scale: 1.3 },
];

describe("spreadLayout", () => {
  it("spreads one, five and nine cards inside the canvas width", () => {
    for (const canvas of CANVASES) {
      for (const count of [1, 5, 9]) {
        const spread = spreadLayout(layoutOf(count, canvas.width, canvas.height, canvas.bottom, canvas.scale), canvas);
        expect(spread.slots).toHaveLength(count);
        for (const slot of spread.slots) {
          expect(slot.x).toBeGreaterThanOrEqual(0);
          expect(slot.x + slot.w).toBeLessThanOrEqual(canvas.width);
          expect(slot.y).toBeGreaterThanOrEqual(0);
          // Above the bottom edge and its inset: whole cards.
          expect(slot.y + slot.h).toBeLessThanOrEqual(canvas.height - canvas.bottom);
        }
        expect(spread.left).toBe(spread.slots[0]?.x);
        expect(spread.right).toBe((spread.slots[count - 1]?.x ?? 0) + (spread.slots[0]?.w ?? 0));
      }
    }
  });

  it("grows the cards to the scrub's scale and centers the hand", () => {
    const canvas = CANVASES[0] as (typeof CANVASES)[number];
    const layout = layoutOf(3, canvas.width, canvas.height);
    const spread = spreadLayout(layout, canvas);
    expect(spread.scale).toBe(SHAPE.scrubScale);
    expect(spread.slots[0]?.w).toBeCloseTo((layout.slots[0]?.w ?? 0) * SHAPE.scrubScale, 9);
    expect((spread.left + spread.right) / 2).toBeCloseTo(canvas.width / 2, 9);
    expect(spread.ids).toEqual(["h0", "h1", "h2"]);
    expect(spread.top).toBe(Math.min(...spread.slots.map((slot) => slot.y)));
  });

  it("keeps at least a 44 pt slice of every card", () => {
    for (const canvas of CANVASES) {
      for (const count of [2, 3, 5, 7, 9, 12]) {
        const spread = spreadLayout(layoutOf(count, canvas.width, canvas.height, canvas.bottom, canvas.scale), canvas);
        for (let index = 0; index < count - 1; index += 1) {
          const step = (spread.slots[index + 1]?.x ?? 0) - (spread.slots[index]?.x ?? 0);
          expect(step, `${count} cards on ${canvas.width}`).toBeGreaterThanOrEqual(MIN_TARGET - 1e-9);
        }
        // The last card shows whole.
        expect(spread.slots[count - 1]?.w).toBeGreaterThanOrEqual(MIN_TARGET);
      }
    }
  });

  it("overlaps evenly when the hand is long and leaves a gap between cards when it is short", () => {
    const canvas = CANVASES[0] as (typeof CANVASES)[number];
    const long = spreadLayout(layoutOf(9, canvas.width, canvas.height), canvas);
    const steps = long.slots.slice(1).map((slot, index) => slot.x - (long.slots[index]?.x ?? 0));
    for (const step of steps) expect(step).toBeCloseTo(steps[0] ?? 0, 9);
    expect(steps[0]).toBeLessThan(long.slots[0]?.w ?? 0);
    const short = spreadLayout(layoutOf(2, canvas.width, canvas.height), canvas);
    expect((short.slots[1]?.x ?? 0) - (short.slots[0]?.x ?? 0)).toBeGreaterThan(short.slots[0]?.w ?? 0);
  });

  it("keeps consecutive centers at least a slice apart with the fan, 44 pt and 44 x the layout scale at Large", () => {
    for (const canvas of CANVASES) {
      const reach = MIN_TARGET * (canvas.scale ?? 1);
      for (const count of [2, 5, 9, 12]) {
        const spread = spreadLayout(layoutOf(count, canvas.width, canvas.height, canvas.bottom, canvas.scale), canvas);
        spread.centers.slice(1).forEach((center, index) => expect(center - (spread.centers[index] ?? 0), `${count} cards on ${canvas.width}`).toBeGreaterThanOrEqual(Math.min(reach, MIN_TARGET) - 1e-9));
      }
    }
  });

  it("fans the risen hand: symmetric tilts that sum to 0, the middle card highest, at most FAN_MAX in all", () => {
    for (const canvas of CANVASES) {
      for (const count of [2, 3, 4, 5, 7, 9, 12]) {
        const spread = spreadLayout(layoutOf(count, canvas.width, canvas.height, canvas.bottom, canvas.scale), canvas);
        const tilts = spread.slots.map((slot) => slot.tilt);
        expect(tilts.reduce((sum, tilt) => sum + tilt, 0)).toBeCloseTo(0, 9);
        tilts.forEach((tilt, index) => expect(tilt).toBeCloseTo(-(tilts[count - 1 - index] ?? 0), 9));
        for (let index = 1; index < count; index += 1) expect(tilts[index] ?? 0).toBeGreaterThan(tilts[index - 1] ?? 0);
        expect((tilts[count - 1] ?? 0) - (tilts[0] ?? 0)).toBeLessThanOrEqual(SHAPE.fanMax + 1e-9);
        const ys = spread.slots.map((slot) => slot.y);
        const highest = Math.min(...ys);
        expect(spread.top).toBe(highest);
        // The middle is the highest, and the cards drop symmetrically toward the ends.
        expect(ys[Math.floor((count - 1) / 2)]).toBeCloseTo(highest, 9);
        ys.forEach((y, index) => expect(y).toBeCloseTo(ys[count - 1 - index] ?? 0, 9));
      }
    }
    expect(fanTilts(1)).toEqual([0]);
    expect(fanTilts(3)[2]).toBeCloseTo(SHAPE.fanStep, 9);
    expect((fanTilts(20)[19] ?? 0) - (fanTilts(20)[0] ?? 0)).toBeCloseTo(SHAPE.fanMax, 9);
  });

  it("keeps every turned card inside the canvas", () => {
    for (const canvas of CANVASES) {
      for (const count of [1, 2, 3, 5, 7, 9, 12]) {
        const spread = spreadLayout(layoutOf(count, canvas.width, canvas.height, canvas.bottom, canvas.scale), canvas);
        for (const slot of spread.slots) {
          const halfW = (slot.w / 2) * Math.cos(slot.tilt) + (slot.h / 2) * Math.sin(Math.abs(slot.tilt));
          const halfH = (slot.h / 2) * Math.cos(slot.tilt) + (slot.w / 2) * Math.sin(Math.abs(slot.tilt));
          const cx = slot.x + slot.w / 2;
          const cy = slot.y + slot.h / 2;
          const at = `${count} cards on ${canvas.width}`;
          expect(cx - halfW, at).toBeGreaterThanOrEqual(-1e-9);
          expect(cx + halfW, at).toBeLessThanOrEqual(canvas.width + 1e-9);
          expect(cy - halfH, at).toBeGreaterThanOrEqual(-1e-9);
          expect(cy + halfH, at).toBeLessThanOrEqual(canvas.height - canvas.bottom + 1e-9);
        }
      }
    }
  });

  it("keeps the lifted card and its grown neighbours inside the canvas at every hand size, at Small and Large", () => {
    for (const scale of [UI_SCALES.small, UI_SCALES.large]) {
      // (A hand of 12 on a canvas narrower than these cannot keep 44 pt of each card at any scale: layout.test.ts.)
      for (const canvas of [...CANVASES, { width: 591, height: 338, bottom: 0 }]) {
        for (let count = 1; count <= 12; count += 1) {
          const layout = layoutOf(count, canvas.width, canvas.height, canvas.bottom, scale);
          const spread = spreadLayout(layout, canvas);
          for (let under = 0; under < count; under += 1) {
            for (let at = Math.max(0, under - 2); at <= Math.min(count - 1, under + 2); at += 1) {
              const slot = layout.slots[at] as CardSlot;
              const target = spread.slots[at] as (typeof spread.slots)[number];
              const pose = scrubPose(slot, target, { rise: 1, apart: 1, lift: 1 }, Math.abs(at - under), spread.room);
              const w = slot.w * pose.scale;
              const h = slot.h * pose.scale;
              const cx = slot.x + slot.w / 2 + pose.dx;
              const cy = slot.y + slot.h / 2 + pose.dy;
              // Turned by what is left of the fan's tilt (none for the lifted card).
              const turn = Math.abs(slot.tilt + pose.rot);
              const halfW = (w / 2) * Math.cos(turn) + (h / 2) * Math.sin(turn);
              const halfH = (h / 2) * Math.cos(turn) + (w / 2) * Math.sin(turn);
              const where = `${scale} ${canvas.width}x${canvas.height} ${count} cards, ${under} lifted, card ${at}`;
              expect(cx - halfW, where).toBeGreaterThanOrEqual(-1e-6);
              expect(cx + halfW, where).toBeLessThanOrEqual(canvas.width + 1e-6);
              expect(cy - halfH, where).toBeGreaterThanOrEqual(-1e-6);
              expect(cy + halfH, where).toBeLessThanOrEqual(canvas.height - canvas.bottom + 1e-6);
            }
          }
          // The cancel line is the risen hand's top less a slice, whatever the lifted card's grow: a finger on the risen hand
          // never cancels.
          expect(cancelled(spread, spread.top)).toBe(false);
          expect(cancelled(spread, spread.top - (spread.reach ?? MIN_TARGET) - 1)).toBe(true);
          expect(spread.room.lift).toBeLessThanOrEqual(SHAPE.scrubLiftScale);
        }
      }
    }
  });

  it("is empty for an empty hand", () => {
    const canvas = CANVASES[0] as (typeof CANVASES)[number];
    const spread = spreadLayout(layoutOf(0, canvas.width, canvas.height), canvas);
    expect(spread.ids).toEqual([]);
    expect(cardAt(spread, 100)).toBe(-1);
    expect(pick(spread, 100, 380)).toBe(-1);
  });

  it("reads the hand slots layout.ts gives, in order", () => {
    expect(handSlots(layoutOf(4, 844, 390)).map((slot) => slot.id)).toEqual(["h0", "h1", "h2", "h3"]);
  });
});

describe("cardAt", () => {
  const canvas = CANVASES[0] as (typeof CANVASES)[number];

  it("finds each card at its center", () => {
    for (const count of [1, 5, 9]) {
      const spread = spreadLayout(layoutOf(count, canvas.width, canvas.height), canvas);
      spread.centers.forEach((center, index) => expect(cardAt(spread, center)).toBe(index));
    }
  });

  it("finds the first and last card at and beyond the edges", () => {
    const spread = spreadLayout(layoutOf(5, canvas.width, canvas.height), canvas);
    expect(cardAt(spread, spread.left)).toBe(0);
    expect(cardAt(spread, spread.right)).toBe(4);
    expect(cardAt(spread, -50)).toBe(0);
    expect(cardAt(spread, canvas.width + 50)).toBe(4);
  });

  it("changes card halfway between two centers", () => {
    const spread = spreadLayout(layoutOf(5, canvas.width, canvas.height), canvas);
    const mid = ((spread.centers[1] ?? 0) + (spread.centers[2] ?? 0)) / 2;
    expect(cardAt(spread, mid - 0.5)).toBe(1);
    expect(cardAt(spread, mid + 0.5)).toBe(2);
  });
});

describe("cancelled and pick", () => {
  const canvas = CANVASES[0] as (typeof CANVASES)[number];
  const spread: Spread = spreadLayout(layoutOf(5, canvas.width, canvas.height), canvas);
  const inside = spread.top + 20;

  it("cancels more than 44 pt above the top of the risen hand, and not at or below that line", () => {
    expect(cancelled(spread, spread.top - MIN_TARGET - 1)).toBe(true);
    expect(cancelled(spread, 0)).toBe(true);
    expect(cancelled(spread, spread.top - MIN_TARGET)).toBe(false);
    expect(cancelled(spread, spread.top - 1)).toBe(false);
    expect(cancelled(spread, spread.top)).toBe(false);
    expect(cancelled(spread, canvas.height - 1)).toBe(false);
  });

  it("picks the card under the finger, and none above the hand", () => {
    expect(pick(spread, spread.centers[3] ?? 0, inside)).toBe(3);
    expect(pick(spread, spread.centers[3] ?? 0, spread.top - MIN_TARGET - 1)).toBe(-1);
  });

  it("picks none off the ends of the hand, past half a slice", () => {
    expect(pick(spread, spread.left - MIN_TARGET / 2 + 1, inside)).toBe(0);
    expect(pick(spread, spread.left - MIN_TARGET / 2 - 1, inside)).toBe(-1);
    expect(pick(spread, spread.right + MIN_TARGET / 2 + 1, inside)).toBe(-1);
  });
});

describe("startsScrub", () => {
  const canvas = CANVASES[0] as (typeof CANVASES)[number];
  const layout = layoutOf(3, canvas.width, canvas.height);
  const spread = spreadLayout(layout, canvas);
  const play = { ...(layout.slots[0] as CardSlot), id: "p", zone: "play" as const };

  it("starts on a hand card or on the strip between cards, not on another card or outside the hand", () => {
    const strip = spread.strip;
    expect(startsScrub(spread, layout.slots, 10, 10, 1)).toBe(true);
    expect(startsScrub(spread, layout.slots, strip.x + 4, strip.y + 4, -1)).toBe(true);
    expect(startsScrub(spread, [...layout.slots, play], 10, 10, 3)).toBe(false);
    expect(startsScrub(spread, layout.slots, strip.x + 4, strip.y - 10, -1)).toBe(false);
  });
});

describe("startCard", () => {
  it("starts on the pressed card even where the spread's nearest center is another", () => {
    const canvas = CANVASES[0] as (typeof CANVASES)[number];
    const layout = layoutOf(3, canvas.width, canvas.height);
    const spread = spreadLayout(layout, canvas);
    // A spread whose centers sit far from the fan: the nearest center is not the card under the finger.
    const shifted: Spread = { ...spread, centers: spread.centers.map((center) => center + 300) };
    const second = layout.slots[1] as CardSlot;
    const x = second.x + second.w / 2;
    const y = second.y + second.h - 4;
    expect(cardAt(shifted, x)).not.toBe(1);
    expect(startCard(shifted, layout.slots, x, y)).toBe(1);
  });

  it("falls back to the nearest center on the strip between cards", () => {
    const canvas = CANVASES[0] as (typeof CANVASES)[number];
    const spread = spreadLayout(layoutOf(3, canvas.width, canvas.height), canvas);
    expect(startCard(spread, [], 100, 380)).toBe(cardAt(spread, 100));
  });
});

describe("the hold and the selection tick", () => {
  it("holds 150 ms within 6 pt", () => {
    expect(SCRUB_HOLD_MS).toBe(150);
    expect(SCRUB_SLOP).toBe(6);
  });

  it("ticks when the scrub starts on a card and when the card under the finger changes, and nowhere else", () => {
    expect(ticksOn(-1, 2)).toBe(true);
    expect(ticksOn(2, 3)).toBe(true);
    expect(ticksOn(3, 3)).toBe(false);
    expect(ticksOn(3, -1)).toBe(false);
    expect(ticksOn(-1, -1)).toBe(false);
    // Off the hand and back onto the same card ticks again: the finger came back to it.
    expect(ticksOn(-1, 3)).toBe(true);
  });
});
