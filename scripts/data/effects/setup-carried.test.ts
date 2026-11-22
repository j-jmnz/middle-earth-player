import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseOverrides } from "../normalize/overrides.ts";
import { DATA_DIR } from "../paths.ts";
import { loadCards } from "../load-cards.ts";
import { carriedByPiles, sentencesOf, splitCarried } from "./setup-carried.ts";

const rules = parseOverrides(JSON.parse(readFileSync(path.join(DATA_DIR, "overrides.json"), "utf8"))).scenarioPiles;
const names = new Map(loadCards().map((card) => [card.code, card.name]));
const nameOf = (code: string): string => names.get(code) ?? "";

describe("the Setup sentences the scenario's piles carry out", () => {
  it("splits a line into its sentences", () => {
    expect(sentencesOf("Setup: Add Dagnir to the staging area and set The First Forge aside, out of play. Create the Caves deck. Attach Wormsbane to a hero, Broken side face-up.")).toEqual([
      "Setup: Add Dagnir to the staging area and set The First Forge aside, out of play.",
      "Create the Caves deck.",
      "Attach Wormsbane to a hero, Broken side face-up.",
    ]);
  });

  it("marks the sentence that puts a card where the scenario's pile rule deals it, and no other", () => {
    expect(carriedByPiles("Attach Wormsbane to a hero, Broken side face-up.", "mount-gundabad", rules, nameOf)).toBe(true);
    expect(carriedByPiles("Search the encounter deck for Annúminas, add it to the staging area, and set its city strength to 20.", "the-siege-of-annuminas", rules, nameOf)).toBe(true);
    // The card is named but the sentence says another move, another scenario, or no card the rules move.
    expect(carriedByPiles("Discard Wormsbane from the game.", "mount-gundabad", rules, nameOf)).toBe(false);
    expect(carriedByPiles("Attach Wormsbane to a hero, Broken side face-up.", "the-siege-of-annuminas", rules, nameOf)).toBe(false);
    expect(carriedByPiles("Create the Caves deck and the quest deck (see insert).", "mount-gundabad", rules, nameOf)).toBe(false);
  });

  it("leaves the sentences no pile carries as the ones still open", () => {
    const line = "Setup: Add Dagnir to the staging area and set The First Forge aside, out of play. Create the Caves deck and the quest deck (see insert). Attach Wormsbane to a hero, Broken side face-up.";
    const { carried, open } = splitCarried(line, "mount-gundabad", rules, nameOf);
    expect(carried).toEqual(["Attach Wormsbane to a hero, Broken side face-up."]);
    expect(open).toHaveLength(2);
  });
});
