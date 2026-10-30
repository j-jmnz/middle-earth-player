// Rules: mec109.multiple-staging-areas, rr.active-location, rr.travel, rr.step-3-4, rr.step-4-2, rr.player-elimination (data/rules/entries.json). Each seat has an active
// location of its own while stages are separate (Seat.active, families/breaking-areas.ts): it travels to a location of its own staging area, in player order, and its own
// questing progress goes on its own active location first.
import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../fixture.ts";
import { legalIntents, legalTargets, reduce, type PlayerIntent, type ScenarioState } from "../reduce.ts";
import { moveCard } from "../zones.ts";
import { areaOf, discardArea, viewOf, withView } from "./breaking-areas.ts";
import { loadBreakingWorld, makeBreaking, type BreakingLayout, type BreakingTable, type BreakingWorld } from "../../../scripts/breaking-scene.ts";

let world: BreakingWorld;

beforeAll(async () => {
  world = await loadBreakingWorld();
}, 60_000);

const heroes = [["strong"], ["weak"]] as const;
const make = (layout: BreakingLayout = {}) => makeBreaking(world, { seats: 2, stage: "separate", frodo: false, heroes, threats: [30, 30], ...layout });

function send(table: BreakingTable, state: ScenarioState, intent: PlayerIntent): ScenarioState {
  return expectOk(reduce(state, intent, table.ctx)).state;
}

describe("the travel phase with separate staging", () => {
  // Each seat has a location in its own staging area. The window is the one the machine opens for seat 0 first.
  const layout: BreakingLayout = { areas: [["place", "grunt"], ["place"]], phase: "Travel" };
  const opened = (table: BreakingTable): ScenarioState => ({ ...table.state, travelDone: [0] });

  it("offers each seat, in player order, only the locations of its own staging area", () => {
    const table = make(layout);
    const state = opened(table);
    const own = state.seats[0].staging.filter((id) => state.cards[id]?.code === "place");
    expect(legalTargets(state, { type: "Travel" }, table.ctx)).toEqual(own);
    const next = send(table, state, { type: "DeclineTravel" });
    // Seat 1 has its window now, and the Travel phase waits for it.
    expect(next.window?.kind).toBe("travel");
    expect(next.activeSeat).toBe(1);
    expect(next.phase).toBe("Travel");
    expect(legalTargets(next, { type: "Travel" }, table.ctx)).toEqual(next.seats[1].staging.filter((id) => next.cards[id]?.code === "place"));
    const done = send(table, next, { type: "DeclineTravel" });
    expect(done.phase).not.toBe("Travel");
  });

  it("makes the location the seat's own active location: the other seat's slot stays empty and its location can be traveled to as well", () => {
    const table = make(layout);
    const state = opened(table);
    const place0 = legalTargets(state, { type: "Travel" }, table.ctx)[0] ?? "";
    const after0 = send(table, state, { type: "Travel", locationId: place0 });
    expect(after0.cards[place0]?.zone).toBe("activeLocation");
    expect(after0.seats[0].active).toBe(place0);
    expect(after0.seats[1].active).toBeUndefined();
    expect(after0.seats[0].staging).not.toContain(place0);
    // The shared slots mirror the seats' (seat 0's, seat 1's).
    expect(after0.activeLocation).toBe(place0);
    expect(after0.secondActiveLocation).toBeNull();
    expect(after0.activeSeat).toBe(1);
    expect(after0.window?.kind).toBe("travel");
    // Seat 1 still travels although seat 0 has an active location.
    const place1 = legalTargets(after0, { type: "Travel" }, table.ctx)[0] ?? "";
    expect(place1).not.toBe("");
    const after1 = send(table, after0, { type: "Travel", locationId: place1 });
    expect(after1.seats[1].active).toBe(place1);
    expect(after1.seats[0].active).toBe(place0);
    expect(after1.activeLocation).toBe(place0);
    expect(after1.secondActiveLocation).toBe(place1);
    expect(after1.phase).not.toBe("Travel");
    expect(viewOf(after1, 0).activeLocation).toBe(place0);
    expect(viewOf(after1, 0).secondActiveLocation).toBeNull();
    expect(viewOf(after1, 1).activeLocation).toBe(place1);
  });

  it("offers only to decline to a seat that has an active location already, and refuses a location of another seat's area", () => {
    const table = make({ ...layout, active: ["place", null] });
    const state = opened(table);
    expect(legalTargets(state, { type: "Travel" }, table.ctx)).toEqual([]);
    expect(legalIntents(state, table.ctx).map((intent) => intent.type)).toEqual(["DeclineTravel"]);
    const next = send(table, state, { type: "DeclineTravel" });
    const foreign = state.seats[0].staging.find((id) => state.cards[id]?.code === "place") ?? "";
    const rejected = reduce(next, { type: "Travel", locationId: foreign }, table.ctx);
    expect(rejected.ok).toBe(false);
  });
});

describe("the quest with separate staging and active locations", () => {
  it("puts a seat's questing progress on its own active location first, then on its own stage", () => {
    // Seat 0: willpower 6 against threat 0 in its area: 6 progress, 4 on its own active place, 2 on its stage 3B (which takes progress while Frodo's Choice is in play).
    const table = make({ areas: [["142068"], []], active: ["place", "place"] });
    let state = table.state;
    state = send(table, state, { type: "Commit", cardIds: [table.heroes[0]?.[0] ?? ""] });
    state = send(table, state, { type: "Pass" });
    state = send(table, state, { type: "Commit", cardIds: [table.heroes[1]?.[0] ?? ""] });
    state = send(table, state, { type: "Pass" });
    for (let guard = 0; guard < 20 && state.phase === "Quest"; guard += 1) state = send(table, state, { type: "Pass" });
    expect(state.cards[state.seats[0].stage ?? ""]?.progress).toBe(2);
    // The active place of seat 0 was explored (4 points) and left play; seat 1's own quest (willpower 1) put its 1 progress on its own active place.
    expect(state.seats[0].active).toBeUndefined();
    expect(state.activeLocation).toBeNull();
    expect(state.cards[state.seats[1].active ?? ""]?.progress).toBe(1);
    expect(state.cards[state.seats[1].stage ?? ""]?.progress).toBe(0);
  });
});

describe("the areas of an eliminated seat", () => {
  it("discards its active location with its staging area and stage", () => {
    const table = make({ areas: [["grunt"], ["scout"]], active: ["place", "place"] });
    const active = table.state.seats[1].active ?? "";
    const next = discardArea(table.state, 1);
    expect(next.cards[active]?.zone).toBe("encounterDiscard");
    expect(next.seats[1].active).toBeUndefined();
    expect(next.secondActiveLocation).toBeNull();
    expect(next.seats[0].active).toBe(table.state.seats[0].active);
  });

  it("drops a seat's active location when the card leaves play from any view", () => {
    const table = make({ areas: [[], []], active: [null, "place"] });
    const active = table.state.seats[1].active ?? "";
    // A view of the other seat keeps it, and the card moving out of the zone drops it from the seat and from the shared slot.
    expect(withView(table.state, 0, (view) => view).seats[1].active).toBe(active);
    expect(areaOf(table.state, active)).toBeNull();
    const moved = moveCard(table.state, active, { zone: "encounterDiscard" });
    expect(moved.seats[1].active).toBeUndefined();
    expect(moved.secondActiveLocation).toBeNull();
  });
});
