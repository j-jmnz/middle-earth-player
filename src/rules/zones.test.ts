import { describe, expect, it } from "vitest";

import { cardMap, expectOk, fixtureDefinition, hero } from "./fixture.ts";
import { definePrinted } from "./printed.ts";
import { reduce } from "./reduce.ts";
import { blankScenario, withThreat } from "./state.ts";
import { spawn } from "./zones.ts";

describe("zone identity", () => {
  it("keeps the hand array when threat changes", () => {
    const doomed = definePrinted({
      code: "doomed",
      name: "Doomed",
      type: "treachery",
      threat: 0,
      keywords: { doomed: 2 },
    });
    const cards = cardMap([hero("aragorn", "leadership", 10, 0), doomed, definePrinted({ code: "card", name: "Card", type: "event", cost: 0 })]);
    let state = blankScenario({ seatCount: 1, seed: 1, definition: fixtureDefinition(["stage"]) });
    state = spawn(state, "aragorn", { zone: "heroes", seat: 0 }).state;
    const hand = spawn(state, "card", { zone: "hand", seat: 0 });
    state = withThreat(hand.state, 0, 10);
    state = spawn(state, "doomed", { zone: "encounterDeck" }).state;
    state = { ...state, phase: "Quest", mode: "questCommit", window: { kind: "pass" }, activeSeat: 0 };
    const handBefore = state.seats[0].hand;
    const resolved = expectOk(reduce(state, { type: "Pass" }, { effects: [], cards }));
    expect(resolved.state.seats[0].threat).toBe(12);
    expect(resolved.state.seats[0].hand).toBe(handBefore);
    expect(resolved.state.secondActiveLocation).toBeNull();
  });
});
