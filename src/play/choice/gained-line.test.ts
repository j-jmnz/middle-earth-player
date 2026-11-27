import { describe, expect, it } from "vitest";

import { gainedSentence } from "./gained-line.ts";

describe("the sentence of a gained ability", () => {
  it("keeps only the gained Response's own words (Mûmak Trail, 17020:A:1)", () => {
    const line = "While Mûmak Trail is the active location, it gains: \"Response: When Mûmak Trail leaves play as an explored location, search the encounter deck and discard pile for a Wild Mûmak and add it to the staging area. Shuffle the encounter deck.\"";
    expect(gainedSentence(line)).toBe("When Mûmak Trail leaves play as an explored location, search the encounter deck and discard pile for a Wild Mûmak and add it to the staging area. Shuffle the encounter deck.");
    expect(gainedSentence("While Sheltered Valley is the active location, it gains: \"Response: When Sheltered Valley is explored, heal all damage from 1 character.\"")).toBe("When Sheltered Valley is explored, heal all damage from 1 character.");
  });

  it("leaves any other printed line as it is", () => {
    expect(gainedSentence("Response: After Gandalf enters play, draw 3 cards.")).toBe("Response: After Gandalf enters play, draw 3 cards.");
    expect(gainedSentence("Travel: Raise each player's threat by 1 to travel here.")).toBe("Travel: Raise each player's threat by 1 to travel here.");
  });

  it("fits the six lines of a row on a short phone: the sentence is shorter than the printed line by the lead", () => {
    const line = "While Mûmak Trail is the active location, it gains: \"Response: When Mûmak Trail leaves play as an explored location, search the encounter deck and discard pile for a Wild Mûmak and add it to the staging area. Shuffle the encounter deck.\"";
    expect(gainedSentence(line)?.length ?? 0).toBeLessThan(line.length - 40);
  });
});
