import { describe, expect, it } from "vitest";

import { cardFrame, halo, unturn } from "./frame.ts";
import { contains, hitSlot, slotBounds, type CardSlot } from "./layout.ts";
import { slotRotation } from "./motion.ts";

function slot(over: Partial<CardSlot> = {}): CardSlot {
  return { x: 100, y: 100, w: 60, h: 84, id: "c", code: "01001", zone: "hand", kind: "card", exhausted: false, faceDown: false, landscape: false, resources: 0, damage: 0, progress: 0, tilt: 0, count: 0, committed: false, ...over };
}

describe("cardFrame", () => {
  it("gives the turn slotRotation gives, for a fanned, an exhausted and a straight card", () => {
    for (const s of [slot({ tilt: 0.09 }), slot({ exhausted: true }), slot()]) {
      expect(cardFrame(s).rotation).toBe(slotRotation(s));
    }
    expect(cardFrame(slot({ tilt: 0.09 })).rotation).toBe(0.09);
    expect(cardFrame(slot({ exhausted: true })).rotation).toBe(Math.PI / 2);
    expect(cardFrame(slot()).rotation).toBe(0);
  });

  it("keeps the unturned size and the center, also for an exhausted card", () => {
    expect(cardFrame(slot({ exhausted: true }))).toMatchObject({ cx: 130, cy: 142, w: 60, h: 84 });
  });
});

describe("hitSlot with a tilt", () => {
  const tilted = slot({ tilt: 0.3 });
  const rotate = (px: number, py: number, angle: number) => {
    const { cx, cy } = cardFrame(tilted);
    return { x: cx + (px - cx) * Math.cos(angle) - (py - cy) * Math.sin(angle), y: cy + (px - cx) * Math.sin(angle) + (py - cy) * Math.cos(angle) };
  };

  it("hits a point inside the tilted card's corner that is outside the unturned rectangle", () => {
    // The top left corner, pulled a little toward the center, then turned as the card is drawn.
    const corner = rotate(tilted.x + 2, tilted.y + 2, tilted.tilt);
    expect(contains(slotBounds(tilted), corner.x, corner.y)).toBe(false);
    expect(hitSlot([tilted], corner.x, corner.y)).toBe(0);
  });

  it("misses a point inside the unturned rectangle that is outside the tilted card", () => {
    const corner = { x: tilted.x + 1, y: tilted.y + 1 };
    const turned = unturn(tilted, corner.x, corner.y);
    expect(contains(tilted, turned.x, turned.y)).toBe(false);
    expect(contains(slotBounds(tilted), corner.x, corner.y)).toBe(true);
    expect(hitSlot([tilted], corner.x, corner.y)).toBe(-1);
  });

  it("is the plain rectangle for a straight card and the sideways footprint for an exhausted one", () => {
    expect(hitSlot([slot()], 101, 101)).toBe(0);
    const lying = slot({ exhausted: true });
    expect(hitSlot([lying], 100 - 10, 142)).toBe(0);
    expect(hitSlot([lying], 130, 100 + 2)).toBe(-1);
  });
});

describe("halo", () => {
  // Abramowitz and Stegun 7.1.26, for x >= 0.
  function erfc(x: number): number {
    const k = 1 / (1 + 0.3275911 * x);
    return k * (0.254829592 + k * (-0.284496736 + k * (1.421413741 + k * (-1.453152027 + k * 1.061405429)))) * Math.exp(-x * x);
  }
  // The share of the halo's light left a distance past the card's edge: a Gaussian blur's falloff past a straight edge.
  const light = (picked: boolean, d: number) => {
    const { sigma, inset } = halo(picked);
    return 0.5 * erfc((d + inset) / (sigma * Math.SQRT2));
  };

  it("keeps the picked halo wider: brighter than the plain one from 3 pt past the edge", () => {
    for (const d of [3.5, 4, 5, 6]) expect(light(true, d)).toBeGreaterThan(light(false, d));
  });

  it("does not light the next card, 6 pt away", () => {
    expect(light(false, 6)).toBeLessThan(0.03);
    expect(light(true, 6)).toBeLessThan(0.06);
  });

  it("leaves the plain halo at full strength at the card's edge", () => {
    expect(halo(false).inset).toBe(0);
  });
});
