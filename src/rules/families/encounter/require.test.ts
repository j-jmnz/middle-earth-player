// Rules: rr.search, rr.effects (data/rules/entries.json); ledger lines 145030:A:3, 142022:A:1, 142051:A:3.
// SearchMove `require`: "One of those enemies must be Corsair Captain, if able." The first search of the effect takes the required card while one is in the deck or discard pile; once it has, the other searches are free.
import { describe, expect, it } from "vitest";

import type { Instruction } from "../../../catalog/boundary.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import { settle } from "../../engine/machine.ts";
import { definePrinted } from "../../core/printed.ts";
import { cardMap } from "../../core/test-fixture.ts";
import type { ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { CARDS, deal, table } from "../wilderland/fixture.ts";

const ALL = cardMap([
  ...CARDS.values(),
  definePrinted({ code: "captain", name: "Corsair Captain", type: "enemy", traits: ["Corsair"], threat: 3, engagementCost: 49, attack: 5, defense: 3, health: 6 }),
  definePrinted({ code: "pirate", name: "Corsair of Umbar", type: "enemy", traits: ["Corsair"], threat: 2, engagementCost: 29, attack: 2, defense: 2, health: 3 }),
]);
const ctx: ReduceContext = { effects: [], cards: ALL };

const SEARCH: Instruction = { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "SearchMove", trait: "Corsair", type: "enemy", to: "staging", require: "captain" }] };

function run(state: ScenarioState): ScenarioState {
  return settle(pushEffectFrame(state, { frame: "travel", sourceId: "none", actor: 0, peril: false, effectId: "fixture:travel:1", instructions: [SEARCH], cancel: null, blockCancel: null }, []), ctx, []);
}

const twoSeats = (): ScenarioState => spawn(table(2), "mist", { zone: "encounterDeck" }).state;

describe("SearchMove require (145030:A:3)", () => {
  it("makes the first search take the Captain, and leaves the next search free to choose", () => {
    const { state } = deal(twoSeats(), ["captain", "captain", "pirate"], { zone: "encounterDeck" });
    const done = run(state);
    const staged = done.staging.map((id) => done.cards[id]?.code);
    expect(staged).toEqual(["captain"]);
    // Seat 1 may take either enemy now: the Captain left in the deck, or the other Corsair.
    expect(done.window).toMatchObject({ seat: 1 });
  });

  it("takes the Captain at once when only one copy exists, as 142022 and 142051 do for their single copies", () => {
    const { state } = deal(twoSeats(), ["captain", "pirate"], { zone: "encounterDiscard" });
    const done = run(state);
    expect(done.staging.map((id) => done.cards[id]?.code).sort()).toEqual(["captain", "pirate"]);
    expect(done.window?.kind).not.toBe("choose");
  });

  it("takes whatever is found when no Captain remains", () => {
    const { state } = deal(twoSeats(), ["pirate", "pirate"], { zone: "encounterDeck" });
    const done = run(state);
    expect(done.staging.map((id) => done.cards[id]?.code)).toEqual(["pirate", "pirate"]);
  });
});
