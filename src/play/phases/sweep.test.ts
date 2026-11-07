// The phase title sweep (phase 23): which phase changes sweep, when it is held back, and its fade and slide.
import { describe, expect, it } from "vitest";

import { SHAPE } from "../../ui/motion-tokens.ts";
import { busyBetween, sweepFrame, sweepName, type PhasePoint, type Seen } from "./sweep.ts";

const at = (phase: string, round = 3): PhasePoint => ({ phase, round });

describe("sweepName", () => {
  it("names a new phase of the round", () => {
    expect(sweepName(at("Resource"), at("Planning"), 1, false)).toBe("Planning");
    expect(sweepName(at("Combat"), at("Refresh"), 1, false)).toBe("Refresh");
  });

  it("names the Resource phase of the next round", () => {
    expect(sweepName(at("Refresh", 3), at("Resource", 4), 1, false)).toBe("Resource");
  });

  it("names nothing when the phase did not change", () => {
    expect(sweepName(at("Quest"), at("Quest"), 1, false)).toBeNull();
  });

  it("names nothing for the setup, the mulligan or the round's ends", () => {
    for (const now of ["Setup", "Mulligan", "Beginning of round", "End of round", ""]) expect(sweepName(at("Refresh"), at(now), 1, false)).toBeNull();
  });

  it("is skipped when the scale is under 1: under Quick (0.6) and under reduced motion (0), and plays at Slow (1.5)", () => {
    expect(sweepName(at("Resource"), at("Planning"), 1.5, false)).toBe("Planning");
    expect(sweepName(at("Resource"), at("Planning"), 0.6, false)).toBeNull();
    expect(sweepName(at("Resource"), at("Planning"), 0, false)).toBeNull();
  });

  it("is skipped when the state moves cards or changes a count", () => {
    expect(sweepName(at("Beginning of round"), at("Resource"), 1, true)).toBeNull();
    expect(sweepName(at("Resource"), at("Planning"), 1, true)).toBeNull();
  });

  it("is skipped when the phase goes back (Undo), in the round or across it", () => {
    expect(sweepName(at("Quest"), at("Planning"), 1, false)).toBeNull();
    expect(sweepName(at("Resource", 4), at("Refresh", 3), 1, false)).toBeNull();
  });

  it("names a phase reached from outside the seven", () => {
    expect(sweepName(at("Setup", 0), at("Resource", 1), 1, false)).toBe("Resource");
  });
});

describe("busyBetween", () => {
  const card = (zone: string, exhausted: boolean, damage = 0) => ({ zone, exhausted, damage, resources: 0, progress: 0 });
  const state = (cards: Seen["cards"]): Seen => ({ cards });
  const base = state({ a: card("play", false), b: card("hand", false) });

  it("is false when nothing moved, turned or counted differently", () => {
    expect(busyBetween(base, state({ a: card("play", false), b: card("hand", false) }))).toBe(false);
  });

  it("is true for a card that changed zone, turned, or took a count", () => {
    expect(busyBetween(base, state({ a: card("play", false), b: card("play", false) }))).toBe(true);
    expect(busyBetween(base, state({ a: card("play", true), b: card("hand", false) }))).toBe(true);
    expect(busyBetween(base, state({ a: card("play", false, 2), b: card("hand", false) }))).toBe(true);
  });

  it("is false for shadow cards dealt as Combat opens, and still true when anything else moves with them", () => {
    const deck = state({ a: card("engaged", false), s: card("encounterDeck", false) });
    expect(busyBetween(deck, state({ a: card("engaged", false), s: card("shadow", false) }), "Combat")).toBe(false);
    expect(busyBetween(deck, state({ a: card("engaged", true), s: card("shadow", false) }), "Combat")).toBe(true);
    // A deal into shadow outside the Combat phase's opening still counts.
    expect(busyBetween(deck, state({ a: card("engaged", false), s: card("shadow", false) }), "Quest")).toBe(true);
  });

  it("is false for the Resource phase's draw, resources gained and the Refresh phase's readying, and true for anything else", () => {
    const round = state({ h: card("heroes", true), d: card("deck", false), x: card("play", false) });
    const opened = { h: { ...card("heroes", false), resources: 1 }, d: card("hand", false) };
    expect(busyBetween(round, state({ ...opened, x: card("play", false) }), "Resource")).toBe(false);
    // A card discarded on the way in, a damage token or a card exhausted still counts.
    expect(busyBetween(round, state({ ...opened, x: card("discard", false) }), "Resource")).toBe(true);
    expect(busyBetween(round, state({ ...opened, x: card("play", false, 1) }), "Resource")).toBe(true);
    expect(busyBetween(round, state({ ...opened, x: card("play", true) }), "Resource")).toBe(true);
    // The same draw and gain entering another phase counts.
    expect(busyBetween(round, state({ ...opened, x: card("play", false) }), "Planning")).toBe(true);
  });
});

describe("sweepFrame", () => {
  it("fades in, holds, fades out, and slides 40 pt across its run", () => {
    expect(sweepFrame(0, SHAPE.sweepSlide)).toEqual({ opacity: 0, offset: -20 });
    expect(sweepFrame(0.5, SHAPE.sweepSlide).opacity).toBe(1);
    expect(sweepFrame(0.5, SHAPE.sweepSlide).offset).toBeCloseTo(0, 9);
    expect(sweepFrame(1, SHAPE.sweepSlide)).toEqual({ opacity: 0, offset: 20 });
    expect(sweepFrame(0.125, SHAPE.sweepSlide).opacity).toBeCloseTo(0.5, 9);
  });
});
