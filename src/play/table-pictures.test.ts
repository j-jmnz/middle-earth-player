// The size each card picture on the table is decoded at, and what a full table's copies weigh (user request, 2026-10-29: sharper
// pictures on the table).
import { describe, expect, it } from "vitest";

import type { CardSlot } from "./layout.ts";
import { SHAPE } from "./motion-tokens.ts";
import { coverPixels, HAND_PICTURE_SCALE, pictureBoxes, pictureBytes, redecode } from "./table-pictures.ts";

const slot = (id: string, code: string, zone: CardSlot["zone"], w: number, h: number, extra: Partial<CardSlot> = {}): CardSlot => ({
  id,
  code,
  zone,
  kind: "card",
  x: 0,
  y: 0,
  w,
  h,
  exhausted: false,
  faceDown: false,
  landscape: false,
  resources: 0,
  damage: 0,
  progress: 0,
  tilt: 0,
  count: 0,
  committed: false,
  ...extra,
});

// A bundled picture (scripts/pack-scans.ts, MAX_SIDE 1200).
const SCAN = { w: 857, h: 1200 };

describe("pictureBoxes", () => {
  it("decodes a hand card at the scrub's lifted size and any other card at its slot's", () => {
    const boxes = pictureBoxes([slot("a", "A", "hand", 50, 70), slot("b", "B", "play", 54, 76), slot("q", "Q", "questStage", 81, 58, { landscape: true })]);
    expect(HAND_PICTURE_SCALE).toBeCloseTo(SHAPE.scrubScale * SHAPE.scrubLiftScale, 9);
    expect(boxes.get("A")?.w).toBeCloseTo(50 * HAND_PICTURE_SCALE, 9);
    expect(boxes.get("B")).toEqual({ w: 54, h: 76 });
    expect(boxes.get("Q")).toEqual({ w: 81, h: 58 });
  });

  it("keeps one box per code, the largest of its slots, and none for a face-down card or an empty pile", () => {
    const boxes = pictureBoxes([slot("a", "A", "play", 54, 76), slot("b", "A", "hand", 40, 56), slot("c", "C", "play", 54, 76, { faceDown: true }), slot("d", "", "discard", 30, 42)]);
    expect([...boxes.keys()]).toEqual(["A"]);
    expect(boxes.get("A")?.w).toBeCloseTo(40 * HAND_PICTURE_SCALE, 9);
  });
});

describe("coverPixels", () => {
  it("covers the box at the screen's pixel ratio, keeping the picture's own shape, never past the file", () => {
    expect(coverPixels(SCAN, { w: 54, h: 76 }, 3)).toEqual({ w: 163, h: 228 });
    // A sideways quest card keeps its shape: its sideways picture covers the sideways box.
    const quest = coverPixels({ w: 1200, h: 857 }, { w: 81, h: 58 }, 2);
    expect(quest.w / quest.h).toBeCloseTo(1200 / 857, 2);
    expect(quest.w).toBeGreaterThanOrEqual(162);
    expect(coverPixels({ w: 300, h: 420 }, { w: 200, h: 280 }, 3)).toEqual({ w: 300, h: 420 });
  });
});

describe("redecode", () => {
  it("decodes again when the copy is too small or more than twice what is needed, not for small changes", () => {
    expect(redecode(undefined, { w: 54, h: 76 })).toBe(true);
    expect(redecode({ w: 54, h: 76 }, { w: 54, h: 76 })).toBe(false);
    expect(redecode({ w: 54, h: 76 }, { w: 60, h: 84 })).toBe(true);
    // A hand that grows narrows its cards: the larger copy stays.
    expect(redecode({ w: 60, h: 84 }, { w: 54, h: 76 })).toBe(false);
    // A card played from the hand: its lifted-size copy is far larger than the table needs.
    expect(redecode({ w: 54 * HAND_PICTURE_SCALE, h: 76 * HAND_PICTURE_SCALE }, { w: 54, h: 76 })).toBe(true);
  });
});

describe("a full table's pictures", () => {
  // About 40 distinct codes (the handover's full table): eight in hand, the rest on the table.
  function table(card: { w: number; h: number }, hand: { w: number; h: number }) {
    return [...Array.from({ length: 8 }, (_, i) => slot(`h${i}`, `H${i}`, "hand", hand.w, hand.h)), ...Array.from({ length: 32 }, (_, i) => slot(`t${i}`, `T${i}`, "play", card.w, card.h))];
  }

  it("weigh under 16 MB on a 3x phone and under 36 MB on a 2x 12.9-inch tablet at Large (its card at the 120 pt cap, 138 pt)", () => {
    const phone = pictureBytes(pictureBoxes(table({ w: 54, h: 76 }, { w: 54, h: 76 })), SCAN, 3);
    const tablet = pictureBytes(pictureBoxes(table({ w: 138, h: 193 }, { w: 138, h: 193 })), SCAN, 2);
    expect(phone / 2 ** 20).toBeLessThan(16);
    expect(tablet / 2 ** 20).toBeLessThan(36);
  });
});
