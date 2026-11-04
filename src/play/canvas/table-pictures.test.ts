// The size each card picture on the table is decoded at, and what a full table's copies weigh (user request, 2026-10-29: sharper
// pictures on the table).
import { describe, expect, it } from "vitest";

import type { CardSlot } from "../layout/layout.ts";
import { SHAPE } from "../../ui/motion-tokens.ts";
import { boxesKey, coverPixels, HAND_PICTURE_SCALE, pictureBoxes, pictureBytes, pictureRatio, pixelBoxes, redecode, SLACK } from "./table-pictures.ts";

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

// A bundled picture (scripts/build/pack-scans.ts, MAX_SIDE 1200).
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

describe("pictureRatio", () => {
  it("is the device's ratio on High and half of it, never below 1, on Low", () => {
    expect(pictureRatio(3, "high")).toBe(3);
    expect(pictureRatio(2, "high")).toBe(2);
    expect(pictureRatio(3, "low")).toBe(1.5);
    expect(pictureRatio(2, "low")).toBe(1);
    expect(pictureRatio(1, "low")).toBe(1);
  });

  it("turns point boxes into pixel boxes, which cover the same pixels as the points at that ratio", () => {
    const boxes = new Map([["A", { w: 54, h: 76 }]]);
    expect(pixelBoxes(boxes, 3).get("A")).toEqual({ w: 162, h: 228 });
    expect(coverPixels(SCAN, pixelBoxes(boxes, 3).get("A")!, 1)).toEqual(coverPixels(SCAN, { w: 54, h: 76 }, 3));
  });
});

describe("redecode", () => {
  it("decodes again when the copy is too small or more than twice what is needed, not for small changes", () => {
    expect(redecode(undefined, { w: 54, h: 76 }, SLACK)).toBe(true);
    expect(redecode({ w: 54, h: 76 }, { w: 54, h: 76 }, SLACK)).toBe(false);
    expect(redecode({ w: 54, h: 76 }, { w: 60, h: 84 }, SLACK)).toBe(true);
    // A hand that grows narrows its cards: the larger copy stays.
    expect(redecode({ w: 60, h: 84 }, { w: 54, h: 76 }, SLACK)).toBe(false);
    // A card played from the hand: its lifted-size copy is far larger than the table needs.
    expect(redecode({ w: 54 * HAND_PICTURE_SCALE, h: 76 * HAND_PICTURE_SCALE }, { w: 54, h: 76 }, SLACK)).toBe(true);
  });

  it("allows half a point short in the boxes' own unit: SLACK in points, SLACK times the ratio in pixels", () => {
    const wanted = { w: 54, h: 76 };
    expect(redecode({ w: 53.6, h: 75.6 }, wanted, SLACK)).toBe(false);
    expect(redecode({ w: 53.4, h: 76 }, wanted, SLACK)).toBe(true);
    // The same boxes in pixels at 3 a point: 1.5 pixels of slack is half a point, 0.5 pixel is not.
    const pixels = pixelBoxes(new Map([["A", wanted]]), 3).get("A")!;
    expect(redecode({ w: pixels.w - 1.4, h: pixels.h - 1.4 }, pixels, SLACK * 3)).toBe(false);
    expect(redecode({ w: pixels.w - 1.6, h: pixels.h }, pixels, SLACK * 3)).toBe(true);
    expect(redecode({ w: pixels.w - 1.4, h: pixels.h }, pixels, SLACK)).toBe(true);
  });
});

describe("boxesKey", () => {
  it("rounds the boxes to whole points and holds the ratio, so Low and High never share a key", () => {
    const a = new Map([["A", { w: 54.2, h: 75.9 }]]);
    const b = new Map([["A", { w: 53.8, h: 76.1 }]]);
    expect(boxesKey(a, 3)).toBe(boxesKey(b, 3));
    expect(boxesKey(a, 3)).not.toBe(boxesKey(new Map([["A", { w: 55, h: 76 }]]), 3));
    expect(boxesKey(a, 3)).not.toBe(boxesKey(a, 1.5));
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

  it("weigh at most about a quarter as much on Low as on High, under 4.5 MB on a 3x phone", () => {
    const boxes = pictureBoxes(table({ w: 54, h: 76 }, { w: 54, h: 76 }));
    const high = pictureBytes(boxes, SCAN, pictureRatio(3, "high"));
    const low = pictureBytes(boxes, SCAN, pictureRatio(3, "low"));
    expect(low / 2 ** 20).toBeLessThan(4.5);
    expect(low).toBeLessThanOrEqual(high * 0.27);
  });
});
