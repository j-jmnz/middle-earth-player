import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { expectOk } from "../rules/fixture.ts";
import { legalTargets } from "../rules/legal.ts";
import { legalIntents, reduce } from "../rules/reduce.ts";
import { withMode, type ScenarioState } from "../rules/state.ts";
import { loadPrinted } from "../../scripts/test-catalog.ts";
import { first, loadWorld, RING, table, type Layout, type World } from "../../scripts/past-scene.ts";

// Weathertop's Travel cost (141046:A:3, "Travel: The first player must exhaust The One Ring to travel here.") and
// rr.travel: "If the players cannot pay the Travel cost, then they cannot travel to that location."
const WEATHERTOP = "141046";

let world: World;

beforeAll(async () => {
  world = await loadWorld();
  world = { ...world, cards: new Map([...world.cards, ...(await loadPrinted([WEATHERTOP]))]) };
});

// An engaged enemy keeps the round in combat after the travel, before the refresh phase readies The One Ring again.
function travelWindow(ring: Layout["ring"]) {
  const { state, ctx } = table(world, { staging: [WEATHERTOP], ring, engaged: [{ code: "f0", seat: 0 }] });
  const travel: ScenarioState = { ...withMode(state, "travel"), phase: "Travel", boundaryPhase: "Travel", window: { kind: "travel" } };
  return { state: travel, ctx, weathertop: first(travel, WEATHERTOP) };
}

describe("Weathertop's Travel cost (141046:A:3, rr.travel)", () => {
  it("is paid by exhausting a ready One Ring, and the players travel there", () => {
    const { state, ctx, weathertop } = travelWindow("ready");
    expect(legalIntents(state, ctx).map((intent) => intent.type)).toContain("Travel");
    expect(legalTargets(state, { type: "Travel" }, ctx)).toEqual([weathertop]);
    const done = expectOk(reduce(state, { type: "Travel", locationId: weathertop }, ctx)).state;
    expect(done.activeLocation).toBe(weathertop);
    expect(done.phase).not.toBe("Refresh");
    expect(done.round).toBe(state.round);
    expect(done.cards[first(done, RING)]?.exhausted).toBe(true);
  });

  it("cannot be paid while The One Ring is exhausted: the players cannot travel there", () => {
    const { state, ctx, weathertop } = travelWindow("exhausted");
    expect(legalIntents(state, ctx).map((intent) => intent.type)).toEqual(["DeclineTravel"]);
    expect(legalTargets(state, { type: "Travel" }, ctx)).toEqual([]);
    const refused = reduce(state, { type: "Travel", locationId: weathertop }, ctx);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.reason).toBe("The players cannot pay that location's Travel cost");
  });

  it("cannot be paid when The One Ring is not in play", () => {
    const { state, ctx, weathertop } = travelWindow("none");
    expect(legalTargets(state, { type: "Travel" }, ctx)).toEqual([]);
    expect(reduce(state, { type: "Travel", locationId: weathertop }, ctx).ok).toBe(false);
  });

  it("is a record of the travel timing that exhausts The One Ring", () => {
    expect(EFFECTS.find((effect) => effect.id === "141046:travel:1")?.instructions).toEqual([{ verb: "Exhaust", target: { kind: "byCode", code: RING } }]);
  });
});
