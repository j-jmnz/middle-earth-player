// Rules: rr.encounter-deck (data/rules/entries.json); ledger line 148003:A:1.
// ShuffleSetAsideIntoEncounterDeck `all` (sidequests family): every set-aside copy of the card goes into the encounter deck, and without `all` only the first. Stage 3A of Fog on the Barrow-downs.
import { describe, expect, it } from "vitest";

import { runInstruction } from "../../interpret/interpret.ts";
import { codeOf, focus, fogTable as table, GREAT_BARROW } from "../../../../test/scenarios/fog-on-the-barrow-downs/scene.ts";

describe("148003:A:1 shuffling each copy of Great Barrow into the encounter deck", () => {
  it("ShuffleSetAsideIntoEncounterDeck all puts every set-aside copy in, and without all only the first", () => {
    const t = table({ seats: 1, setAside: [GREAT_BARROW, GREAT_BARROW, GREAT_BARROW] });
    const one = runInstruction(t.state, { verb: "ShuffleSetAsideIntoEncounterDeck", code: GREAT_BARROW }, focus(0), t.ctx, []);
    expect(one.setAside.filter((id) => codeOf(one, id) === GREAT_BARROW)).toHaveLength(2);
    const all = runInstruction(t.state, { verb: "ShuffleSetAsideIntoEncounterDeck", code: GREAT_BARROW, all: true }, focus(0), t.ctx, []);
    expect(all.setAside.filter((id) => codeOf(all, id) === GREAT_BARROW)).toHaveLength(0);
    expect(all.encounterDeck.filter((id) => codeOf(all, id) === GREAT_BARROW)).toHaveLength(3);
  });
});

