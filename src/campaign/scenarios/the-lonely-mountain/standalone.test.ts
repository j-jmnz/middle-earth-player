// Rules: rr.setup, hob.setup-the-lonely-mountain, hob.treasure-otd, hob.bilbo-baggins-otd (data/rules/entries.json); docs/scenarios/the-hobbit.md (The Lonely Mountain).
import { describe, expect, it } from "vitest";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";

import { MOUNTAIN_GOLDENS } from "../../../../test/scenarios/the-lonely-mountain/game.ts";

// What is The Lonely Mountain's own in the standalone game. The cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a standalone run with nothing earned, the loss reasons) are the golden suite's
// (test/harness/golden-suite.ts, standalone: true); the opening each golden starts with is the golden's own (golden.test.ts).
const mountain = loadAnyScenario("the-lonely-mountain");
const pileOf = (code: string): string | undefined => mountain.cards.find((card) => card.code === code)?.pile;

describe("The Lonely Mountain in the the-hobbit cycle", () => {
  it("has no Nightmare deck", () => {
    expect(mountain.nightmare).toBeUndefined();
  });

  it("deals Smaug the Golden and The Lonely Mountain to the staging area and sets Smaug the Magnificent, A Bare Patch and the five Erebor treasures aside", () => {
    expect(["132040", "132043"].map(pileOf)).toEqual(["staging", "staging"]);
    expect(["132041", "132039", "132020", "132021", "132022", "132023", "132024"].map(pileOf)).toEqual(Array(7).fill("setAside"));
  });

  it("deals Bilbo Baggins by the loadout, not by a pile", () => {
    expect(mountain.sagaStart).toEqual({ hero: "132001" });
    expect(mountain.cards.some((card) => card.code === "132001")).toBe(false);
  });

  it("removes 2 Fighting Among Friends and 1 Weighed Down on Easy (the Easy Mode sheet)", () => {
    const copies = (code: string) => mountain.cards.find((card) => card.code === code);
    expect([copies("132037")?.normal, copies("132037")?.easy, copies("132038")?.normal, copies("132038")?.easy]).toEqual([2, 0, 2, 1]);
  });

  it("pins goldens on Normal and Easy, solo and two-handed, with a win and each loss", () => {
    expect(MOUNTAIN_GOLDENS.filter((golden) => golden.outcome === "won").map((golden) => [golden.seatCount, golden.difficulty])).toEqual([[1, "Normal"], [2, "Easy"]]);
    expect(new Set(MOUNTAIN_GOLDENS.map((golden) => golden.difficulty))).toEqual(new Set(["Normal", "Easy"]));
    expect(new Set(MOUNTAIN_GOLDENS.map((golden) => golden.seatCount))).toEqual(new Set([1, 2]));
    expect(MOUNTAIN_GOLDENS.filter((golden) => golden.outcome === "lost").map((golden) => golden.lossReason)).toEqual(["No seats remain", "Bilbo Baggins left play"]);
  });
});
