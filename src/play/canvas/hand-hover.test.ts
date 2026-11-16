// The mouse over the hand and the wheel (docs/design-system-table.md, Pointer): which card the pointer lifts, and how far the wheel steps it.
import { describe, expect, it } from "vitest";

import { hoverCard, stepCard, WHEEL_STEP, wheelPixels, wheelSteps } from "./hand-hover.ts";
import { spreadLayout, type Spread } from "./hand-scrub.ts";
import { cardSize, handCardSize, MIN_TARGET, type CardSlot, type Rect, type TableLayout } from "../layout/layout.ts";

const none: Rect = { x: 0, y: 0, w: 0, h: 0 };
const CANVAS = { width: 1280, height: 640, bottom: 0 };

// A layout with only a hand of five cards at the foot of the canvas, the way layout.ts lays one out.
function handLayout(count: number): TableLayout {
  const { width, height } = CANVAS;
  const card = cardSize(width, height);
  const size = handCardSize(card, width - 16, count);
  const handY = height - Math.max(52, Math.round(card.h * 0.56));
  const slots: CardSlot[] = Array.from({ length: count }, (_, index) => ({
    x: 8 + index * Math.max(MIN_TARGET, (width - 16 - size.w) / Math.max(1, count - 1)),
    y: handY,
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
    tilt: 0,
    count: 0,
    committed: false,
  }));
  const hand: Rect = { x: 8, y: handY, w: width - 16, h: height - handY };
  return {
    width,
    height,
    scale: 1,
    card,
    zones: { questStage: none, staging: none, activeLocation: none, secondActiveLocation: none, engaged: none, play: none, hand },
    piles: { deck: none, discard: none, encounterDeck: none, encounterDiscard: none },
    slots,
    marks: [],
    attacker: null,
  };
}

const layout = handLayout(5);
const spread: Spread = spreadLayout(layout, CANVAS);
const first = layout.slots[0] as CardSlot;
const last = layout.slots[4] as CardSlot;

describe("hoverCard", () => {
  it("opens the hand for a pointer on a hand card and lifts that card", () => {
    expect(hoverCard(spread, layout.slots, first.x + first.w / 2, first.y + first.h / 2, false)).toBe(0);
    expect(hoverCard(spread, layout.slots, last.x + last.w / 2, last.y + last.h / 2, false)).toBe(4);
  });

  it("does not open the hand for a pointer over the table", () => {
    expect(hoverCard(spread, layout.slots, CANVAS.width / 2, 40, false)).toBe(-1);
  });

  it("keeps an open hand open on the lifted card, which stands above the resting hand", () => {
    const risen = spread.slots[2] as Rect;
    expect(hoverCard(spread, layout.slots, risen.x + risen.w / 2, risen.y + risen.h / 2, true)).toBe(2);
  });

  it("closes an open hand when the pointer is well above it or past its ends", () => {
    expect(hoverCard(spread, layout.slots, CANVAS.width / 2, 10, true)).toBe(-1);
    expect(hoverCard(spread, [], 0, CANVAS.height - 5, true)).toBe(-1);
  });
});

describe("the wheel", () => {
  it("is one step a mouse notch and sums a trackpad's small deltas", () => {
    expect(wheelSteps(100)).toEqual({ steps: 1, rest: 100 - WHEEL_STEP });
    expect(wheelSteps(-100)).toEqual({ steps: -1, rest: -100 + WHEEL_STEP });
    let total = 0;
    let steps = 0;
    for (let i = 0; i < 10; i++) {
      const next = wheelSteps(total + 12);
      steps += next.steps;
      total = next.rest;
    }
    expect(steps).toBe(2);
  });

  it("reads a line and a page delta in pixels", () => {
    expect(wheelPixels(3, 1)).toBe(48);
    expect(wheelPixels(-1, 2)).toBe(-WHEEL_STEP);
    expect(wheelPixels(100, 0)).toBe(100);
  });

  it("steps the lifted card and stops at the hand's ends", () => {
    expect(stepCard(2, 5, 1)).toBe(3);
    expect(stepCard(4, 5, 1)).toBe(4);
    expect(stepCard(0, 5, -2)).toBe(0);
    expect(stepCard(-1, 5, 1)).toBe(0);
    expect(stepCard(0, 0, 1)).toBe(-1);
  });
});
