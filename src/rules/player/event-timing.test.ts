// "When an event is played" is heard before the event's effects (`played`); "After an event is played" is heard once they are done and the
// event lies in the discard pile (`eventResolved`) (rr.forced, rr.response: when and after).
import { describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { cardMap, expectOk, fixtureDefinition, hero } from "../core/test-fixture.ts";
import { reduce } from "../engine/reduce.ts";
import { definePrinted } from "../core/printed.ts";
import { blankScenario, updateCard, withThreat, type ScenarioState } from "../core/state.ts";
import { spawn } from "../core/zones.ts";

const spiritHero = hero("eowyn", "spirit");
const event = definePrinted({ code: "spirit", name: "Unexpected", type: "event", sphere: "spirit", cost: 0 });
const place = definePrinted({ code: "place", name: "Place", type: "location", questPoints: 1, threat: 1 });
const cards = cardMap([spiritHero, event, place]);

const lower: Effect = { id: "spirit:action:1", cardCode: "spirit", lines: ["spirit:A:1"], timing: "action", instructions: [{ verb: "LowerThreat", amount: 3, who: "actor" }] };
const when: Effect = {
  id: "place:forced:1",
  cardCode: "place",
  lines: ["place:A:1"],
  timing: "forced",
  trigger: "played",
  subject: { type: "card", control: "any", cardType: "event" },
  instructions: [{ verb: "RaiseThreat", amount: 1, who: "eventSeat" }],
};
const after: Effect = { ...when, id: "place:forced:2", lines: ["place:A:2"], trigger: "eventResolved", instructions: [{ verb: "RaiseThreat", amount: 2, who: "eventSeat" }] };

function table(): { state: ScenarioState; cardId: string } {
  let state = blankScenario({ seatCount: 1, seed: 3, definition: fixtureDefinition(["stage"]) });
  const hero0 = spawn(state, "eowyn", { zone: "heroes", seat: 0 });
  state = updateCard(hero0.state, hero0.id, { resources: 3 });
  const staged = spawn(state, "place", { zone: "staging" });
  const played = spawn(staged.state, "spirit", { zone: "hand", seat: 0 });
  return { state: { ...withThreat(played.state, 0, 10), phase: "Planning", mode: "planning", window: { kind: "pass" }, activeSeat: 0 }, cardId: played.id };
}

describe("the timing of a card that hears an event played", () => {
  it("rr.forced: a When record resolves before the event's effects and an After record once they are done", () => {
    const { state, cardId } = table();
    const result = expectOk(reduce(state, { type: "PlayCard", cardId, payments: [] }, { effects: [lower, when, after], cards }));
    const threat = result.steps.filter((step) => step.kind === "threat").map((step) => (step.kind === "threat" ? step.amount : 0));
    expect(threat).toEqual([1, -3, 2]);
    expect(result.state.cards[cardId]?.zone).toBe("discard");
    expect(result.state.seats[0]?.threat).toBe(10);
  });

  it("rr.forced: an After record alone resolves after the event, and a When record does not hear it again", () => {
    const { state, cardId } = table();
    const result = expectOk(reduce(state, { type: "PlayCard", cardId, payments: [] }, { effects: [lower, after], cards }));
    expect(result.steps.filter((step) => step.kind === "threat").map((step) => (step.kind === "threat" ? step.amount : 0))).toEqual([-3, 2]);
  });
});
