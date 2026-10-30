// Rules: mec109.setting-up-the-game, mec109.setup, rr.setup, mec109.multiple-staging-areas (data/rules/entries.json). Breaking of the Fellowship's start: stage 1A's Setup
// (142061:A:1) and the cards the scenario data deals, true solo and two-handed. Records for the stage 3 and 4 cards, the encounter cards and the campaign card are phase 16b
// and 16c.
import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../rules/fixture.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../rules/reduce.ts";
import { restricted } from "../rules/restrictions.ts";
import { syncConstants } from "../rules/constants.ts";
import { breakingGameWorld, breakingStart } from "../../scripts/breaking-game.ts";
import { codesOf } from "../../scripts/past-scene.ts";
import { ARGONATH, FRODOS_CHOICE, PARTH_GALEN, SARN_GEBIR, SEAT_OF_SEEING } from "../../scripts/breaking-scene.ts";

let ctx: ReduceContext;

beforeAll(async () => {
  ctx = (await breakingGameWorld()).ctx;
}, 60_000);

function begin(seatCount: 1 | 2, seed = 3): ScenarioState {
  let state = startScenario(breakingStart(seatCount, seed), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  return syncConstants(state, ctx);
}

describe("stage 1A: the Setup (142061:A:1)", () => {
  it.each([1, 2] as const)("sets Frodo's Choice, Seat of Seeing and Parth Galen aside and adds The Argonath and Sarn Gebir to the staging area, with %i player(s)", (seats) => {
    const state = begin(seats);
    expect(codesOf(state, state.setAside).sort()).toEqual([FRODOS_CHOICE, PARTH_GALEN, SEAT_OF_SEEING].sort());
    expect(codesOf(state, state.staging).sort()).toEqual([ARGONATH, SARN_GEBIR].sort());
    expect(state.cards[state.questStage ?? ""]?.code).toBe("142061");
    expect(state.questDeck.map((id) => state.cards[id]?.code)).toEqual(["142062", "142063", "142064", "142065", "142066", "142067"]);
    // One shared staging area, one stage: nothing is separate until stage 2B.
    expect(state.separate).toBeUndefined();
    expect(state.seats.every((seat) => seat.staging.length === 0 && seat.stage === undefined)).toBe(true);
  });

  it("holds the stage back while The Argonath is in play, and skips the encounter phase, from the first round", () => {
    const state = begin(1);
    expect(restricted(state, ctx, "advance").length).toBeGreaterThan(0);
    expect(state.modifiers.some((modifier) => modifier.stat === "skipEncounter" && modifier.instanceId === "table")).toBe(true);
  });
});
