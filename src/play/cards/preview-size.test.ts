import { describe, expect, it } from "vitest";

import { chipRowHeight, inspectSize, previewSideSize, previewSize, previewStrip, tokenLines } from "./preview-size.ts";

describe("the long-press preview", () => {
  it("fills a phone's width with a portrait card and leaves room for the buttons", () => {
    const size = previewSize(390, 760, false);
    expect(size.width).toBe(342);
    expect(size.height).toBeLessThanOrEqual(760 - 140);
    expect(size.width / size.height).toBeCloseTo(0.705, 2);
  });

  it("is bounded by the height on a short screen and on a tablet by a reading size", () => {
    expect(previewSize(800, 400, false).height).toBeLessThanOrEqual(260);
    expect(previewSize(1024, 1366, false).width).toBe(440);
  });

  it("lays a quest card on its side", () => {
    const size = previewSize(390, 760, true);
    expect(size.width).toBeGreaterThan(size.height);
    expect(size.width).toBeLessThanOrEqual(358);
  });

  it("on a landscape table, stands the card at the left as tall as the screen and leaves the right for its effects", () => {
    const size = previewSideSize(844, 390, false);
    expect(size.height).toBe(390 - 32);
    expect(size.width).toBeLessThan(844 * 0.55);
    expect(size.width / size.height).toBeCloseTo(0.705, 2);
    expect(previewSideSize(844, 390, true).width).toBeGreaterThan(previewSideSize(844, 390, true).height);
  });
});

describe("the Card screen's picture", () => {
  it("is sized by the pane's height and keeps the card's shape", () => {
    const size = inspectSize(600, 500);
    expect(size.height).toBe(468);
    expect(size.width / size.height).toBeCloseTo(0.705, 2);
  });

  it("is capped at 420 points wide on a roomy pane", () => {
    expect(inspectSize(700, 900).width).toBe(420);
  });

  it("is bounded by a narrow pane's width", () => {
    expect(inspectSize(300, 900).width).toBe(268);
  });

  it("scales the room and the card together", () => {
    const base = inspectSize(700, 900);
    const large = inspectSize(700 * 1.15, 900 * 1.15, 1.15);
    expect(large.width).toBe(Math.round(base.width * 1.15));
    expect(large.height).toBe(Math.round(base.height * 1.15));
  });
});

describe("the strip under an upright card", () => {
  const TOKENS = "3 damage · 2 progress · 4 resources · Exhausted";

  it("is Medium's at the phone's default text size: a 44 pt row of the cards with it and a two-line tokens line", () => {
    expect(tokenLines(TOKENS, 300)).toBe(2);
    expect(previewStrip({ chips: true, tokenRows: 2 })).toBe(44 + 16 + 12 + 40);
    expect(previewStrip({ chips: false, tokenRows: 0 })).toBe(0);
    // One row of keyword chips: a 44 pt target and an 8 pt gap, never more however many chips there are.
    expect(previewStrip({ chips: false, tokenRows: 0, keywords: true })).toBe(44 + 8);
    // The chip row holds the label's line at a larger text size: the 44 pt target at 200%, the taller capsule past it.
    expect(chipRowHeight(1, 2)).toBe(44);
    expect(chipRowHeight(1, 3)).toBe(17 * 3 + 10);
    expect(previewStrip({ chips: false, tokenRows: 0, keywords: true }, 1, 2)).toBe(44 + 8);
    expect(previewStrip({ chips: false, tokenRows: 0, keywords: true }, 1, 3)).toBe(17 * 3 + 10 + 8);
    expect(previewStrip({ chips: true, tokenRows: 2, keywords: true })).toBe(44 + 16 + 44 + 8 + 12 + 40);
    expect(previewStrip({ chips: true, tokenRows: 0 }, 1.15)).toBe(Math.max(44, 44 * 1.15) + 16 * 1.15);
  });

  it("at a font scale of 2 counts the tokens line's own lines, each twice as tall, and takes them from the card, not the buttons", () => {
    const rows = tokenLines(TOKENS, 300, 1, 2);
    expect(rows).toBe(Math.ceil(TOKENS.length / Math.floor(300 / (7.2 * 2))));
    expect(rows).toBeGreaterThan(2);
    const strip = previewStrip({ chips: true, tokenRows: rows }, 1, 2);
    expect(strip).toBe(44 + 16 + 12 + rows * 20 * 2);
    const room = 667 - strip;
    expect(previewSize(390, room, false).height).toBeLessThan(previewSize(390, 667 - previewStrip({ chips: true, tokenRows: 2 }), false).height);
  });
});
