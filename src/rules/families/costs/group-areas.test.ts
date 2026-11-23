// Rules: mec108.create-staging-area, hob.staging-area-creating, rr.cost (data/rules/entries.json).
// A group payment ("the players may pay", `group: true`: Inspiring Presence 12143:A:1, Hidden Path 132066) is made only by the players who share the payer's staging area.
// Escape from Mount Gram starts its players in separate staging areas.
import { beforeAll, describe, expect, it } from "vitest";

import type { ReduceContext } from "../../engine/reduce.ts";
import { updateCard } from "../../core/state.ts";
import { sharing } from "../breaking/areas.ts";
import { begin } from "../../../../test/scenarios/escape-from-mount-gram/begun.ts";
import { gramWorld } from "../../../../test/scenarios/escape-from-mount-gram/game.ts";
import { spendablePools } from "./verbs.ts";

describe("A group payment in separate staging areas", () => {
  let ctx: ReduceContext;
  beforeAll(async () => {
    ctx = (await gramWorld("strong")).ctx;
  }, 120_000);

  it("pays from the heroes of the payer's own area, not from the other player's", () => {
    const state = begin(ctx, 2);
    expect(state.separate).toBe(true);
    expect(sharing(state, 0)).toEqual([0]);
    const funded = Object.values(state.cards).filter((card) => card.zone === "heroes").reduce((next, card) => updateCard(next, card.id, { resources: 2 }), state);
    const own = new Set(funded.seats[0]?.heroes);
    for (const seat of [0, 1]) {
      const { pools } = spendablePools(funded, seat, { group: true }, ctx);
      expect(pools.length, `seat ${seat}`).toBeGreaterThan(0);
      expect(pools.every((id) => own.has(id) === (seat === 0)), `seat ${seat}`).toBe(true);
    }
  });

  it("pays from every player's heroes once the areas are joined", () => {
    const state = begin(ctx, 2);
    const { separate: _separate, ...joined } = state;
    const funded = Object.values(joined.cards).filter((card) => card.zone === "heroes").reduce((next, card) => updateCard(next, card.id, { resources: 2 }), joined);
    const seats = new Set(spendablePools(funded, 0, { group: true }, ctx).pools.map((id) => funded.cards[id]?.controller));
    expect(seats).toEqual(new Set([0, 1]));
  });
});
