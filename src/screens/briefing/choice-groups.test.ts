import { describe, expect, it } from "vitest";

import { hostOffered, optionCard, optionLabel, pairedChoice, pairOption, pickPair } from "./choice-groups";

// The Oath's Adaptation boons for a party of Gandalf, Théodred and Éowyn, after seat 1 took The Fervor of Lore (41050:A:2).
const OATH = ["41045>142002", "41045>01002", "41045>01007", "41046>142002", "41046>01002", "41046>01007"];
const NAMES: Record<string, string> = { "41045": "The Might of Tactics", "41046": "The Power of Spirit", "142002": "Gandalf", "01002": "Théodred" };
const nameOf = (code: string) => NAMES[code] ?? code;

describe("pairedChoice", () => {
  it("splits a card-for-a-hero choice into its cards and heroes, in order", () => {
    expect(pairedChoice(OATH)).toEqual({ cards: ["41045", "41046"], hosts: ["142002", "01002", "01007"], skip: false });
  });

  it("keeps Skip apart", () => {
    expect(pairedChoice([...OATH, "skip"])?.skip).toBe(true);
  });

  it("is null for a choice of cards alone or of words", () => {
    expect(pairedChoice(["142011", "142012", "skip"])).toBeNull();
    expect(pairedChoice(["skip"])).toBeNull();
  });
});

describe("pairOption and hostOffered", () => {
  it("finds the pair a card and a hero make, and only an offered one", () => {
    expect(pairOption(OATH, "41046", "01002")).toBe("41046>01002");
    expect(pairOption(OATH, "41044", "01002")).toBeNull();
  });

  it("offers a hero for the picked card, or for any card while none is picked", () => {
    const narrow = ["41045>142002", "41046>01002"];
    expect(hostOffered(narrow, "41045", "01002")).toBe(false);
    expect(hostOffered(narrow, "41046", "01002")).toBe(true);
    expect(hostOffered(narrow, null, "01002")).toBe(true);
  });
});

describe("optionLabel", () => {
  it("names a pair, Skip, a card and an option with its own words", () => {
    expect(optionLabel("41045>142002", nameOf, {})).toBe("The Might of Tactics on Gandalf");
    expect(optionLabel("skip", nameOf, {})).toBe("Skip");
    expect(optionLabel("41046", nameOf, {})).toBe("The Power of Spirit");
    expect(optionLabel("resources", nameOf, {}, { resources: "Put 1 resource on each hero" })).toBe("Put 1 resource on each hero");
  });
});

describe("pickPair", () => {
  const narrow = ["41045>142002", "41046>01002"];

  it("makes the pair once a card and then a hero are picked", () => {
    expect(pickPair(narrow, "41045", null)).toEqual({ card: "41045", host: null, option: null });
    expect(pickPair(narrow, "41045", "142002")).toEqual({ card: "41045", host: "142002", option: "41045>142002" });
  });

  it("lets go of a hero picked first when the card then picked cannot go on them", () => {
    expect(pickPair(narrow, null, "01002")).toEqual({ card: null, host: "01002", option: null });
    expect(pickPair(narrow, "41045", "01002")).toEqual({ card: "41045", host: null, option: null });
    expect(pickPair(narrow, "41046", "01002")).toEqual({ card: "41046", host: "01002", option: "41046>01002" });
  });

  it("reads the card an option names", () => {
    expect(optionCard("41045>142002")).toBe("41045");
    expect(optionCard("142011")).toBe("142011");
  });
});
