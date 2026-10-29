// The combat spotlight's gate (phase 24): the store opens one for each moment's attacks, the canvas plays them and ends it (done, or
// skipped by a tap, Back, Undo or a new moment), and the banner, the settle, the scrim and the card motions read it.
import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../rules/fixture.ts";
import { reduce, startScenario, type ReduceContext } from "../rules/reduce.ts";
import { playUntil, type Reduced } from "../../scripts/combat-policy.ts";
import { starterStart, starterWorld } from "../../scripts/starter-game.ts";

import { clashesOf } from "./clash.ts";
import { endGate, leaveGate, NO_SPOTLIGHT, openGate, spotlightHolds, spotlightOpen } from "./spotlight-gate.ts";
import { createTableStore } from "./store.ts";

const DECK = "stealth-and-steadfastness";
let ctx: ReduceContext;

beforeAll(async () => {
  ctx = (await starterWorld(DECK)).ctx;
});

// The first attack of the seeded game.
function attack(seed: number, keep: number, wanted: (reduced: Reduced) => boolean): Reduced {
  const start = expectOk(reduce(startScenario(starterStart(DECK, seed), ctx), { type: "Keep" }, ctx)).state;
  const found = playUntil(ctx, start, keep, (reduced) => clashesOf(reduced.prev, reduced.next, reduced.steps).length > 0 && wanted(reduced));
  if (!found) throw new Error(`Seed ${seed} never reached that attack`);
  return found;
}

describe("the gate", () => {
  it("opens for a moment with attacks and not for one without", () => {
    const reduced = attack(2, 1, () => true);
    const clashes = clashesOf(reduced.prev, reduced.next, reduced.steps);
    expect(openGate(4, clashes)).toEqual({ seq: 4, clashes, ended: null, leaving: false });
    expect(openGate(5, [])).toMatchObject({ seq: 5, ended: "done", leaving: true });
    expect(NO_SPOTLIGHT.ended).toBe("done");
  });

  it("holds the table while attacks play, on a canvas, at a scale above 0 only", () => {
    const reduced = attack(2, 1, () => true);
    const gate = openGate(1, clashesOf(reduced.prev, reduced.next, reduced.steps));
    expect(spotlightHolds(gate, 1, true)).toBe(true);
    expect(spotlightHolds(gate, 0.6, true)).toBe(true);
    // Reduced motion plays none, and the web has no canvas to play it on: the banner carries the attack.
    expect(spotlightHolds(gate, 0, true)).toBe(false);
    expect(spotlightHolds(gate, 1, false)).toBe(false);
    expect(spotlightHolds(NO_SPOTLIGHT, 1, true)).toBe(false);
  });

  it("ends once, by the run or by a tap, and only for its own moment", () => {
    const reduced = attack(2, 1, () => true);
    const gate = openGate(3, clashesOf(reduced.prev, reduced.next, reduced.steps));
    expect(endGate(gate, "done", 2)).toBe(gate);
    const skipped = endGate(gate, "skipped");
    expect(skipped).toMatchObject({ ended: "skipped", leaving: true });
    expect(spotlightHolds(skipped, 1, true)).toBe(false);
    expect(endGate(skipped, "done")).toBe(skipped);
  });

  it("is open until it ends, whatever the scale: what Android Back skips first", () => {
    const reduced = attack(2, 1, () => true);
    const gate = openGate(1, clashesOf(reduced.prev, reduced.next, reduced.steps));
    expect(spotlightOpen(gate)).toBe(true);
    expect(spotlightOpen(endGate(gate, "skipped"))).toBe(false);
    expect(spotlightOpen(NO_SPOTLIGHT)).toBe(false);
    expect(spotlightOpen(openGate(2, []))).toBe(false);
  });

  it("marks the gate as leaving once the last attack begins to go back", () => {
    const reduced = attack(2, 1, () => true);
    const gate = openGate(1, clashesOf(reduced.prev, reduced.next, reduced.steps));
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
    expect(gate.clashes).toEqual(clashesOf(reduced.prev, reduced.next, reduced.steps));
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
});
