// Rules: vom.the-one-ring (data/rules/entries.json). 21001:A:2 with two Rings, the first player's choice names whose copy each option is.
import { describe, expect, it } from "vitest";

import { RECORDS as AUTHORED } from "../../effects/authored/families/misc.ts";
import { cardMap, codes, fixtureDefinition } from "../../rules/core/test-fixture.ts";
import { legalIntents, startScenario } from "../../rules/engine/reduce.ts";
import { MISC_CARDS } from "../../rules/families/misc/fixture.ts";
import { sheetFor } from "../choice/sheets.ts";
import type { SheetNames } from "../choice/sheet-types.ts";
import { instructionWords } from "./instruction.ts";
import { pickWords, type ChoiceNames } from "./choice.ts";
import { miscPickWords } from "./misc.ts";

const filler = codes("f", 8);
const cards = cardMap([...MISC_CARDS.values(), ...filler.map((code) => ({ ...MISC_CARDS.get("filler")!, code, name: code }))]);
const ctx = { effects: AUTHORED, cards };
const deck = ["21001", "master", ...filler];
const choiceNames: ChoiceNames = { card: () => "The One Ring", code: () => "The One Ring" };
const sheetNames: SheetNames = { card: (id) => (id.length > 0 ? cards.get("21001")?.name ?? id : id), line: () => null };

function twoRings() {
  return startScenario({ seatCount: 2, seed: 5, threatModifier: 0, definition: fixtureDefinition(["stage"]), seats: [{ heroes: ["dwarf", "rohan"], deck }, { heroes: ["dwarf", "rohan"], deck }], encounterDeck: [], questDeck: ["stage"] }, ctx);
}

describe("The One Ring's choice of copy (21001:A:2)", () => {
  it("21001:A:2 words each row of the first player's sheet with the player whose Ring it is, and the confirm with what it does", () => {
    const state = twoRings();
    const sheet = sheetFor(state, ctx, legalIntents(state, ctx), sheetNames);
    expect(sheet?.kind).toBe("pick");
    if (sheet?.kind !== "pick") return;
    expect(sheet.options.map((row) => row.label)).toEqual(["The One Ring of Player 1", "The One Ring of Player 2"]);
    expect(sheet.verb).toBe("Put into play");
    expect(sheet.confirm).toBe("Put into play");
    expect(sheet.note).toContain("Choose which player puts a copy of this card into play. Each other copy is removed from the game.");
  });

  it("21001:A:2 words the choice and the instruction", () => {
    const state = twoRings();
    const words = pickWords({ verb: "KeepOneCopy" }, undefined, choiceNames, null, 2, state);
    expect(words).toEqual(miscPickWords({ verb: "KeepOneCopy" }));
    expect(instructionWords({ verb: "KeepOneCopy" }, state, choiceNames, null)).toContain("the first player decides which copy is put into play");
  });
});
