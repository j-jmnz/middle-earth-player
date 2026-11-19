// The combat spotlight's gate (phase 24): the store opens one for each moment's attacks, the canvas plays them and ends it (done, or
// skipped by a tap, Back, Undo or a new moment), and the banner, the settle, the scrim and the card motions read it.
import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../../rules/core/test-fixture.ts";
import { reduce, startScenario, type ReduceContext } from "../../rules/engine/reduce.ts";
import { playUntil, type Reduced } from "../../../test/harness/combat-policy.ts";
import { starterStart, starterWorld } from "../../../test/scenarios/a-shadow-of-the-past/game.ts";

import { clashesOf } from "../store/clash.ts";
import { endGate, leaveGate, nextGate, NO_SPOTLIGHT, openGate, spotlightHolds, spotlightOpen } from "./gate.ts";
import { createTableStore } from "../store/store.ts";

const DECK = "stealth-and-steadfastness";
let ctx: ReduceContext;

beforeAll(async () => {
  ctx = (await starterWorld(DECK)).ctx;
});

// The first attack of the seeded game.
function attack(seed: number, keep: number, wanted: (reduced: Reduced) => boolean): Reduced {
  const start = expectOk(reduce(startScenario(starterStart(DECK, seed), ctx), { type: "Keep" }, ctx)).state;
  const found = playUntil(ctx, start, keep, (reduced) => clashesOf(reduced.prev, reduced.next, reduced.steps, ctx.cards).length > 0 && wanted(reduced));
  if (!found) throw new Error(`Seed ${seed} never reached that attack`);
  return found;
}

describe("the gate", () => {
  it("opens for a moment with attacks and not for one without", () => {
    const reduced = attack(2, 1, () => true);
    const clashes = clashesOf(reduced.prev, reduced.next, reduced.steps, ctx.cards);
    expect(openGate(4, clashes)).toEqual({ seq: 4, clashes, ended: null, leaving: false, before: null, after: null });
    expect(openGate(5, [])).toMatchObject({ seq: 5, ended: "done", leaving: true });
    expect(NO_SPOTLIGHT.ended).toBe("done");
  });

  it("holds the table while attacks play, on a canvas, at a scale above 0 only", () => {
    const reduced = attack(2, 1, () => true);
    const gate = openGate(1, clashesOf(reduced.prev, reduced.next, reduced.steps, ctx.cards));
    expect(spotlightHolds(gate, 1, true)).toBe(true);
    expect(spotlightHolds(gate, 0.6, true)).toBe(true);
    // Reduced motion plays none, and the web has no canvas to play it on: the banner carries the attack.
    expect(spotlightHolds(gate, 0, true)).toBe(false);
    expect(spotlightHolds(gate, 1, false)).toBe(false);
    expect(spotlightHolds(NO_SPOTLIGHT, 1, true)).toBe(false);
  });

  it("ends once, by the run or by a tap, and only for its own moment", () => {
    const reduced = attack(2, 1, () => true);
    const gate = openGate(3, clashesOf(reduced.prev, reduced.next, reduced.steps, ctx.cards));
    expect(endGate(gate, "done", 2)).toBe(gate);
    const skipped = endGate(gate, "skipped");
    expect(skipped).toMatchObject({ ended: "skipped", leaving: true });
    expect(spotlightHolds(skipped, 1, true)).toBe(false);
    expect(endGate(skipped, "done")).toBe(skipped);
  });

  it("is open until it ends, whatever the scale: what Android Back skips first", () => {
    const reduced = attack(2, 1, () => true);
    const gate = openGate(1, clashesOf(reduced.prev, reduced.next, reduced.steps, ctx.cards));
    expect(spotlightOpen(gate)).toBe(true);
    expect(spotlightOpen(endGate(gate, "skipped"))).toBe(false);
    expect(spotlightOpen(NO_SPOTLIGHT)).toBe(false);
    expect(spotlightOpen(openGate(2, []))).toBe(false);
  });

  it("marks the gate as leaving once the last attack begins to go back", () => {
    const reduced = attack(2, 1, () => true);
    const gate = openGate(1, clashesOf(reduced.prev, reduced.next, reduced.steps, ctx.cards));
    const leaving = leaveGate(gate);
    expect(leaving.leaving).toBe(true);
    expect(spotlightHolds(leaving, 1, true)).toBe(true);
    expect(leaveGate(gate, 9)).toBe(gate);
  });
});

describe("the store's gate", () => {
  it("opens it with the attacks of an accepted intent, and a tap ends it", () => {
    const reduced = attack(2, 1, () => true);
    const store = createTableStore({ ctx, game: reduced.prev });
    expect(store.getState().spotlight.clashes).toEqual([]);
    expect(store.getState().dispatch(reduced.intent)).toBe(true);
    const gate = store.getState().spotlight;
    expect(gate.clashes).toEqual(clashesOf(reduced.prev, reduced.next, reduced.steps, ctx.cards));
    expect(gate).toMatchObject({ seq: store.getState().moment?.seq, ended: null });
    store.getState().leaveSpotlight();
    expect(store.getState().spotlight.leaving).toBe(true);
    store.getState().endSpotlight();
    expect(store.getState().spotlight.ended).toBe("skipped");
    // A run that finishes after a tap changes nothing.
    store.getState().endSpotlight("done");
    expect(store.getState().spotlight.ended).toBe("skipped");
  });

  it("leaves it alone for an intent with no steps, closes it for one with no attack, and ends it on Undo", () => {
    const reduced = attack(2, 1, () => true);
    const store = createTableStore({ ctx, game: reduced.prev });
    store.getState().dispatch(reduced.intent);
    const open = store.getState().spotlight;
    expect(open.ended).toBeNull();
    // Undo takes the attack back: nothing is replayed and the spotlight ends.
    if (store.getState().history.length > 0) {
      store.getState().undo();
      expect(store.getState().spotlight.ended).not.toBeNull();
    }
    // Another intent that shows a banner and has no attack opens a gate that is already closed.
    const quiet = playUntil(ctx, expectOk(reduce(startScenario(starterStart(DECK, 2), ctx), { type: "Keep" }, ctx)).state, 1, (found) => found.steps.length > 0 && !found.steps.some((step) => step.kind === "strike"));
    if (!quiet) throw new Error("No quiet moment");
    const second = createTableStore({ ctx, game: quiet.prev });
    second.getState().dispatch(quiet.intent);
    expect(second.getState().spotlight).toMatchObject({ clashes: [], ended: "done" });
  });

  it("keeps the attack's gate through the moments the table answers after it in the same tap (rr.attacks-outside-the-combat-phase)", () => {
    const reduced = attack(2, 1, () => true);
    const store = createTableStore({ ctx, game: reduced.prev });
    store.getState().dispatch(reduced.intent);
    const open = store.getState().spotlight;
    expect(open).toMatchObject({ before: reduced.prev, after: store.getState().game });
    // The next send with steps and no attack (the table passing on after an immediate attack) leaves the gate, and its states, be.
    expect(store.getState().dispatch({ type: "Pass" })).toBe(true);
    const now = store.getState();
    expect(now.moment?.kind === "sent" ? now.moment.steps.length : 0).toBeGreaterThan(0);
    expect(now.spotlight).toBe(open);
  });
});

describe("nextGate", () => {
  it("leaves an open gate be for a moment with no attacks, and opens a new one otherwise", () => {
    const reduced = attack(2, 1, () => true);
    const clashes = clashesOf(reduced.prev, reduced.next, reduced.steps, ctx.cards);
    const open = openGate(1, clashes, reduced.prev, reduced.next);
    expect(nextGate(open, 2, [], reduced.next, reduced.next)).toBe(open);
    // Once it ended, a quiet moment closes it as before.
    expect(nextGate(endGate(open, "done"), 2, [], reduced.next, reduced.next)).toMatchObject({ seq: 2, clashes: [], ended: "done" });
    // New attacks open their own gate.
    expect(nextGate(open, 3, clashes, reduced.prev, reduced.next)).toMatchObject({ seq: 3, ended: null, before: reduced.prev });
  });
});
