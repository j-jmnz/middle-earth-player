// Rules: rr.guarded (data/rules/entries.json). The Burglar's Turn (22024:B:2): the table's pills for the loot deck on the contract and
// the loot a location guards (card-effects.ts, lootMark).
import { describe, expect, it } from "vitest";

import { RECORDS } from "../../effects/authored/families/sidequests.ts";
import { codes, fixtureDefinition } from "../../rules/core/test-fixture.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { reduce, startScenario } from "../../rules/engine/reduce.ts";
import { queueEvent } from "../../rules/windows/queue.ts";
import { updateCard, type ScenarioState } from "../../rules/core/state.ts";
import { put, run, SIDE_CARDS, synced } from "../../rules/families/sidequests/fixture.ts";
import { slotNumbers } from "./card-effects.ts";

const filler = codes("f", 20);
const cards = new Map([...SIDE_CARDS, ...filler.map((code) => [code, definePrinted({ code, name: code, type: "event", sphere: "neutral", cost: 0 })] as const)]);
const ctx = { effects: RECORDS, cards };

function started(): ScenarioState {
  const opening = startScenario(
    { seatCount: 1, seed: 7, threatModifier: 0, definition: fixtureDefinition(["stage"]), seats: [{ heroes: ["dwarf"], deck: ["22024", ...filler], loot: ["rblade", "rblade", "rblade"] }], encounterDeck: [], questDeck: ["stage"] },
    ctx,
  );
  const kept = reduce(opening, { type: "Keep" }, ctx);
  return kept.ok ? kept.state : opening;
}

describe("loot pills on the table (22024:B:2)", () => {
  it("shows the loot deck on the contract and the guarded loot on the location", () => {
    const made = put(started(), "forest-road", "play");
    const active: ScenarioState = updateCard({ ...made.state, activeLocation: made.id }, made.id, { zone: "activeLocation" });
    const traveled = synced(run(queueEvent(synced(active, ctx), { trigger: "traveled", seat: 0, subject: made.id }), ctx), ctx);
    const contract = Object.values(traveled.cards).find((card) => card.code === "22024")!;
    expect(slotNumbers(traveled, ctx, contract.id).under).toMatchObject({ text: "2 left", speech: "2 cards left in the loot deck" });
    expect(slotNumbers(traveled, ctx, made.id).under?.text).toBe("1 loot");
    // A contract whose player chose no loot deck (another seat's, two-handed) has no pill.
    const unchosen: ScenarioState = { ...traveled, lootPlan: [[]] };
    expect(slotNumbers(unchosen, ctx, contract.id).under).toBeNull();
  });
});
