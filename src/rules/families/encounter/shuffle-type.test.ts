import { describe, expect, it } from "vitest";

import { runInstruction } from "../../interpret/interpret.ts";
import { definePrinted } from "../../core/printed.ts";
import { spawn } from "../../core/zones.ts";
import { enemy, hero, table } from "../defense/table.ts";

// Rules: rr.encounter-deck, rr.search (data/rules/entries.json); ledger line 03039:A:2 (docs/scenarios/dwarrowdelf.md, Into the Pit). ShuffleEncounterDiscard with `type`: only the cards of that printed type go back into the deck.

const place = definePrinted({ code: "place", name: "Place", type: "location", threat: 1 });

describe("ShuffleEncounterDiscard type (03039:A:2)", () => {
  it("shuffles the locations of the discard pile into the deck and leaves the other cards there", () => {
    const built = table({ cards: [hero("a"), enemy("e"), place], effects: [], heroes: [{ code: "a" }] });
    let state = built.state;
    const location = spawn(state, "place", { zone: "encounterDiscard" });
    const foe = spawn(location.state, "e", { zone: "encounterDiscard" });
    state = foe.state;
    const next = runInstruction(state, { verb: "ShuffleEncounterDiscard", type: "location" }, { seat: 0, sourceId: null }, built.ctx, []);
    expect(next.encounterDeck).toEqual([location.id]);
    expect(next.encounterDiscard).toEqual([foe.id]);
  });
});
