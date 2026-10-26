// Token changes between two states (phase 23): the pops and the floating numbers read these, and the UI works out no number of its own.
import { describe, expect, it } from "vitest";

import { clamp01 } from "./motion-curves.ts";
import { MOTION } from "./motion-tokens.ts";
import { floatWords, tokenDeltas, type Counted } from "./token-deltas.ts";
import { FLOAT_MS, POP_MS, floatAt, fxPlan, fxSpan, tokenPopScale } from "./token-fx.ts";
import { tokenSpot, TOKEN } from "./token-spots.ts";

const counts = (damage: number, resources: number, progress: number) => ({ damage, resources, progress });

function state(cards: Record<string, ReturnType<typeof counts>>): Counted {
  return { cards };
}

describe("tokenDeltas", () => {
  it("lists damage +2, resource -1 and progress +3", () => {
    const prev = state({ hero: counts(1, 3, 0), quest: counts(0, 0, 2) });
    const next = state({ hero: counts(3, 2, 0), quest: counts(0, 0, 5) });
    expect(tokenDeltas(prev, next)).toEqual([
      { cardId: "hero", token: "resources", change: -1 },
      { cardId: "hero", token: "damage", change: 2 },
      { cardId: "quest", token: "progress", change: 3 },
    ]);
  });

  it("lists nothing when the counts are equal", () => {
    const same = state({ hero: counts(1, 3, 0), quest: counts(0, 0, 2) });
    expect(tokenDeltas(same, state({ hero: counts(1, 3, 0), quest: counts(0, 0, 2) }))).toEqual([]);
    expect(tokenDeltas(same, same)).toEqual([]);
  });

  it("skips a card the earlier state did not have", () => {
    expect(tokenDeltas(state({}), state({ fresh: counts(0, 1, 0) }))).toEqual([]);
  });

  it("lists a count that fell to zero", () => {
    expect(tokenDeltas(state({ a: counts(0, 2, 0) }), state({ a: counts(0, 0, 0) }))).toEqual([{ cardId: "a", token: "resources", change: -2 }]);
  });
});

describe("floatWords", () => {
  it("is gold +n for a gain and threat-red -n for damage or a loss", () => {
    expect(floatWords({ token: "resources", change: 2 })).toEqual({ text: "+2", gain: true });
    expect(floatWords({ token: "resources", change: -1 })).toEqual({ text: "−1", gain: false });
    expect(floatWords({ token: "damage", change: 2 })).toEqual({ text: "−2", gain: false });
    expect(floatWords({ token: "damage", change: -1 })).toEqual({ text: "+1", gain: true });
    expect(floatWords({ token: "progress", change: 3 })).toEqual({ text: "+3", gain: true });
  });
});

describe("token fx", () => {
  it("pops 1 -> 1.4 -> 1 within about 300 ms", () => {
    expect(POP_MS).toBe(300);
    expect(tokenPopScale(0, 1)).toBe(1);
    expect(tokenPopScale(MOTION.tokenPopRise.ms, 1)).toBeCloseTo(1.4, 5);
    expect(tokenPopScale(POP_MS, 1)).toBe(1);
  });

  it("floats up 20 pt and is gone after 700 ms", () => {
    expect(FLOAT_MS).toBe(700);
    expect(floatAt(0, 1).dy).toBeCloseTo(0, 9);
    expect(floatAt(0, 1).opacity).toBe(1);
    expect(floatAt(500, 1).dy).toBeCloseTo(-20, 5);
    expect(floatAt(FLOAT_MS, 1).opacity).toBe(0);
    expect(floatAt(100, 1).opacity).toBe(1);
  });

  it("runs 0.6 as long at Quick", () => {
    expect(floatAt(FLOAT_MS * 0.6, 0.6).opacity).toBeCloseTo(0, 5);
    expect(clamp01(tokenPopScale(MOTION.tokenPopRise.ms * 0.6, 0.6) - 1)).toBeCloseTo(0.4, 5);
  });
});

describe("tokenSpot", () => {
  const rect = { x: 100, y: 50, w: 60, h: 84 };
  it("puts resources bottom left, damage top right and progress bottom right", () => {
    expect(tokenSpot(rect, "resources")).toEqual({ cx: 100 + TOKEN / 2 + 1, cy: 50 + 84 - TOKEN / 2 - 1 });
    expect(tokenSpot(rect, "damage")).toEqual({ cx: 100 + 60 - TOKEN / 2 - 1, cy: 50 + TOKEN / 2 + 1 });
    expect(tokenSpot(rect, "progress")).toEqual({ cx: 100 + 60 - TOKEN / 2 - 1, cy: 50 + 84 - TOKEN / 2 - 1 });
  });
});

describe("fxPlan", () => {
  it("starts a pop when its card has arrived and leaves out a card that is not on the table", () => {
    const deltas = [
      { cardId: "a", token: "damage" as const, change: 2 },
      { cardId: "b", token: "resources" as const, change: -1 },
      { cardId: "gone", token: "progress" as const, change: 1 },
    ];
    const plan = fxPlan(deltas, (id) => (id === "a" ? 0 : id === "b" ? 420 : null));
    expect(plan.map((item) => [item.delta.cardId, item.start])).toEqual([
      ["a", 0],
      ["b", 420],
    ]);
    expect(fxSpan(plan)).toBe(420 + FLOAT_MS);
    expect(fxSpan([])).toBe(0);
  });
});
