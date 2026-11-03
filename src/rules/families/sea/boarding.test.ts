import { describe, expect, it } from "vitest";

import { expectOk } from "../../fixture.ts";
import { reduce } from "../../reduce.ts";
import { engageWith } from "../../quest.ts";
import type { ScenarioState } from "../../state.ts";
import { moveCard, spawn } from "../../zones.ts";
import { board, boardNow, boardingOf } from "./boarding.ts";
import { enemy, hero, seaTable, send, shipEnemy, until, type Table } from "./table.ts";

// Rules: dcce.boarding, dcce.ship-enemies (data/rules/entries.json). When a ship-enemy with Boarding X engages a player from the staging area, the top
// X cards of the Corsair deck are revealed and the enemies put into play engaged with that player. Nothing else triggers it.

// A ship in the staging area with Boarding 2 and three pirates in the Corsair deck, parked at the optional engagement.
function table(boarding = 2): Table {
  const built = seaTable({
    cards: [hero("aragorn"), shipEnemy("corsair", { keywords: { boarding }, engagementCost: 20 }), enemy("pirate", { health: 3 })],
    effects: [],
    heroes: [{ code: "aragorn" }],
    staging: [{ code: "corsair" }],
  });
  let state: ScenarioState = { ...built.state, corsairDeck: [], corsairDiscard: [] };
  for (let pirate = 0; pirate < 3; pirate += 1) state = spawn(state, "pirate", { zone: "corsairDeck" }).state;
  return { ...built, state };
}

const engagedCodes = (state: ScenarioState, seat = 0): string[] => (state.seats[seat]?.engaged ?? []).map((id) => state.cards[id]?.code ?? "?").sort();

describe("Boarding X (dcce.boarding)", () => {
  it("reveals X Corsair cards into play engaged with the player when the ship engages from the staging area (the engagement check)", () => {
    const { state, ids, ctx } = table();
    const next = until(send(state, { type: "DeclineEngage" }, ctx), ctx, (current) => current.phase === "Combat");
    expect(engagedCodes(next)).toEqual(["corsair", "pirate", "pirate"]);
    expect(next.cards[ids.corsair!]?.zone).toBe("engaged");
    expect(next.corsairDeck).toHaveLength(1);
  });

  it("names the ship on the engage step of each Corsair card its keyword revealed, and on no other", () => {
    const { state, ids, ctx } = table();
    const result = expectOk(reduce(state, { type: "DeclineEngage" }, ctx));
    const engages = result.steps.flatMap((step) => (step.kind === "engage" ? [step] : []));
    expect(engages).toHaveLength(3);
    expect(engages.filter((step) => step.boarding === ids.corsair).map((step) => step.enemyId)).toHaveLength(2);
    expect(engages.find((step) => step.enemyId === ids.corsair)?.boarding).toBeUndefined();
  });

  it("resolves when the player engages the ship optionally", () => {
    const { state, ids, ctx } = table();
    const poor = { ...state, seats: [{ ...state.seats[0]!, threat: 5 }, state.seats[1]!] as typeof state.seats };
    const next = until(send(poor, { type: "Engage", enemyId: ids.corsair! }, ctx), ctx, (current) => current.phase === "Combat");
    expect(engagedCodes(next)).toEqual(["corsair", "pirate", "pirate"]);
  });

  it("does not resolve for a ship engaging from another player's play area", () => {
    const built = table();
    // Two players; the ship is engaged with the second and passes to the first (an effect engaging it): it comes from a play area.
    const two = { ...built.state, seatCount: 2 as const, seats: [built.state.seats[0]!, { ...built.state.seats[1]!, eliminated: false }] as typeof built.state.seats };
    const away = moveCard(two, built.ids.corsair!, { zone: "engaged", seat: 1 });
    const moved = engageWith(away, 0, built.ids.corsair!, []);
    const settled = until(send({ ...moved, mode: "optionalEngage", phase: "Encounter", window: { kind: "optionalEngage" } }, { type: "DeclineEngage" }, built.ctx), built.ctx, (current) => current.phase === "Combat");
    expect(settled.corsairDeck).toHaveLength(3);
    expect(engagedCodes(settled)).toEqual(["corsair"]);
  });

  it("reads its X as the printed value plus what cards give and take, never below 0", () => {
    const { state, ids, ctx } = table(1);
    const give = { ...state, modifiers: [{ instanceId: ids.corsair!, sourceId: ids.corsair!, stat: "boarding" as const, amount: 1, until: "endOfRound" as const }] };
    expect(boardingOf(give, ids.corsair!, ctx)).toBe(2);
    const take = { ...state, modifiers: [{ instanceId: ids.corsair!, sourceId: ids.corsair!, stat: "boarding" as const, amount: -3, until: "endOfRound" as const }] };
    expect(boardingOf(take, ids.corsair!, ctx)).toBe(0);
  });

  it("gives a ship that prints no Boarding the value a card gives it (\"gains Boarding 1\")", () => {
    const built = seaTable({ cards: [hero("aragorn"), shipEnemy("skiff", { engagementCost: 20 })], effects: [], heroes: [{ code: "aragorn" }], staging: [{ code: "skiff" }] });
    const gained = { ...built.state, modifiers: [{ instanceId: built.ids.skiff!, sourceId: built.ids.skiff!, stat: "boarding" as const, amount: 1, until: "endOfRound" as const }] };
    expect(boardingOf(gained, built.ids.skiff!, built.ctx)).toBe(1);
    expect(boardingOf(built.state, built.ids.skiff!, built.ctx)).toBe(0);
  });

  it("changes nothing for an event that is not an engagement from the staging area", () => {
    const { state, ids, ctx } = table();
    const moved = { ...state, cards: { ...state.cards, [ids.corsair!]: { ...state.cards[ids.corsair!]!, zone: "engaged" as const, controller: 0 } } };
    expect(board(moved, { trigger: "engaged", seat: 0, subject: ids.corsair! }, ctx, [])).toBe(moved);
    expect(board(moved, { trigger: "revealed", seat: 0, subject: ids.corsair!, fromStaging: true }, ctx, [])).toBe(moved);
    // The engagement from the staging area pushes the keyword as a frame, under the Responses to the engagement; the frame reveals the cards when it resolves.
    const framed = board(moved, { trigger: "engaged", seat: 0, subject: ids.corsair!, fromStaging: true }, ctx, []);
    expect(framed.stack).toHaveLength(1);
    expect(engagedCodes(framed)).toEqual([]);
    expect(engagedCodes(boardNow(moved, ids.corsair!, 0, ctx, []))).toEqual(["pirate", "pirate"]);
  });
});
