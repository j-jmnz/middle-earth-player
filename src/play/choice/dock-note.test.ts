// Rules: rr.optional-engagement (data/rules/entries.json). The dock keeps one line of a sheet's note, so a card name the title already says is left out of it (table-choice.ts, `dockNote`).
import { describe, expect, it } from "vitest";

import { dockNote } from "./table-choice.ts";

describe("the dock's note", () => {
  it("leaves out the card's name when the title already says it, and keeps any other note", () => {
    expect(dockNote("Street Fighting", "Street Fighting: choose a hero you control to exhaust.")).toBe("Choose a hero you control to exhaust.");
    expect(dockNote("Counter-attack", "Player 2: Counter-attack: return your highest-Threat location.")).toBe("Player 2: Return your highest-Threat location.");
    expect(dockNote("Street Fighting", "Uruk Soldier destroyed a character: choose a location.")).toBe("Uruk Soldier destroyed a character: choose a location.");
    expect(dockNote("Street Fighting", "Street Fighting: ")).toBe("Street Fighting: ");
    expect(dockNote("Street Fighting", null)).toBeNull();
  });
});
