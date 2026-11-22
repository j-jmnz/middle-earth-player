import { describe, expect, it } from "vitest";

import { unlabelledForm } from "./generate.ts";

// An unlabelled line numbers from the constant or the triggered counter, so its form fixes the id an authored record takes.
describe("unlabelledForm", () => {
  it("reads an If that names a state and raises a stat as constant", () => {
    expect(unlabelledForm("If the players have crossed the Anduin, Uruk Vanguard gets +3 Attack.")).toBe("constant");
    expect(unlabelledForm("If you are off-course (Cloud, Rain, or Storm), Coast of Anfalas gets +2 Threat.")).toBe("constant");
  });

  it("reads a conditional or timed sentence with an event as triggered, and a plain line as constant", () => {
    expect(unlabelledForm("If a character is destroyed, each player raises his threat by 1.")).toBe("triggered");
    expect(unlabelledForm("When this enemy attacks, deal 1 damage to each hero.")).toBe("triggered");
    expect(unlabelledForm("Each time a location leaves play, draw a card.")).toBe("triggered");
    expect(unlabelledForm("Uruk Vanguard gets +1 Attack.")).toBe("constant");
  });
});
