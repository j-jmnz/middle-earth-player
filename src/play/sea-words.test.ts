// Rules: dcce.boarding, dcce.sailing-tests, dcce.corsair-deck, dcce.heading (data/rules/entries.json). The words of the sea family's pieces: Boarding's beat in the banner, the Sailing test's
// titles and readouts, the pile words and the web list's lines. Every sentence is read here; every number in them is the engine's.
import { describe, expect, it } from "vitest";

import { expectOk } from "../rules/fixture.ts";
import { legalIntents, reduce, type PlayerIntent, type ScenarioState } from "../rules/reduce.ts";
import { enemy, hero, seaTable, shipEnemy } from "../rules/families/sea-table.ts";
import { spawn } from "../rules/zones.ts";

import { momentOf } from "./outcome.ts";
import {
  boardingWords,
  headingChangeWords,
  headingLine,
  lookRowWords,
  medallionCount,
  pileCountWords,
  SAILING_COMMIT_NOTE,
  SAILING_COMMIT_TITLE,
  SAILING_NO_ACTIONS,
  sailingLookWords,
  sailingTitle,
  secondSlotLine,
  seaWords,
  shipsLine,
} from "./sea-words.ts";

describe("Boarding's beat", () => {
  it("names the count, the ship and who is boarded", () => {
    expect(boardingWords({ ship: "Corsair Warship", count: 2, seat: 0, seats: 2 })).toBe("Boarding 2 · Corsair Warship: 2 Corsairs engage Player 1");
    expect(boardingWords({ ship: "Corsair Warship", count: 1, seat: 1, seats: 2 })).toBe("Boarding 1 · Corsair Warship: 1 Corsair engages Player 2");
    expect(boardingWords({ ship: "Corsair Warship", count: 2, seat: 0, seats: 1 })).toBe("Boarding 2 · Corsair Warship: 2 Corsairs engage you");
  });

  it("is one beat of the banner for a whole boarding, the ship's own card ringed, as the engine's steps tell it", () => {
    const built = seaTable({
      seatCount: 2,
      cards: [hero("aragorn"), hero("gimli"), shipEnemy("galley", { keywords: { boarding: 2 }, engagementCost: 20 }), enemy("pirate", { health: 3 })],
      effects: [],
      heroes: [{ code: "aragorn" }, { code: "gimli", seat: 1 }],
      staging: [{ code: "galley" }],
    });
    let state: ScenarioState = { ...built.state, corsairDeck: [], corsairDiscard: [] };
    for (let at = 0; at < 3; at += 1) state = spawn(state, "pirate", { zone: "corsairDeck" }).state;
    // The engagement check engages the ship from staging, and Boarding reveals two Corsair cards engaged with that player, all in the one reduce that runs the check.
    let result = expectOk(reduce(state, { type: "DeclineEngage" }, built.ctx));
    for (let guard = 0; guard < 20 && !result.steps.some((step) => step.kind === "engage"); guard += 1) {
      state = result.state;
      const next = legalIntents(state, built.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineEngage" || intent.type === "DeclineAttack" || intent.type === "DeclineTravel");
      if (!next) break;
      result = expectOk(reduce(state, next as PlayerIntent, built.ctx));
    }
    expect(result.steps.filter((step) => step.kind === "engage")).toHaveLength(3);
    const moment = momentOf(state, result.state, result.steps, { card: (id) => (id === built.ids.galley ? "Corsair Warship" : "Corsair") });
    expect(moment?.title).toBe("Corsair Warship engages");
    const lines = moment?.lines.map((line) => line.text) ?? [];
    expect(lines).toContain("Boarding 2 · Corsair Warship: 2 Corsairs engage Player 1");
    // The ship's line and the Boarding line: the Corsairs are not a beat of their own.
    expect(lines.filter((text) => / engages? /.test(text))).toHaveLength(2);
    expect(moment?.lines.find((line) => line.text.startsWith("Boarding"))?.cards).toEqual([built.ids.galley]);
  });

  it("tells an engagement with no ship before it as any other", () => {
    const built = seaTable({ cards: [hero("aragorn"), enemy("pirate")], effects: [], heroes: [{ code: "aragorn" }], enemies: [{ code: "pirate" }] });
    const moment = momentOf(built.state, built.state, [{ kind: "engage", seat: 0, enemyId: built.ids.pirate! }], { card: () => "Pirate" });
    expect(moment?.lines.map((line) => line.text)).toEqual(["Pirate engages you"]);
  });
});

describe("the Sailing test's words", () => {
  it("titles the look by the symbols found", () => {
    expect(sailingTitle(2)).toBe("Sailing test · 2 successes");
    expect(sailingTitle(1)).toBe("Sailing test · 1 success");
    expect(sailingTitle(0)).toBe("Sailing test · 0 successes");
    expect(SAILING_COMMIT_TITLE).toBe("Commit to the Sailing test");
    expect(SAILING_COMMIT_NOTE).toContain("add no willpower");
    expect(SAILING_NO_ACTIONS).toBe("Actions are not used during a Sailing test.");
  });

  it("reads how many cards the commit looks at, and what counts as more than one", () => {
    expect(sailingLookWords(1, [])).toBe("Looks at 1 card");
    expect(sailingLookWords(3, [{ name: "Dream-chaser", weight: 2, sources: [] }])).toBe("Looks at 3 cards · the Dream-chaser counts as 2");
    expect(sailingLookWords(4, [{ name: "Dream-chaser", weight: 3, sources: ["Enlarged Quarters"] }])).toBe("Looks at 4 cards · the Dream-chaser counts as 3 (Enlarged Quarters)");
    expect(sailingLookWords(5, [{ name: "Dream-chaser", weight: 3, sources: ["Enlarged Quarters", "Sea-ward Tower"] }])).toContain("(Enlarged Quarters, Sea-ward Tower)");
  });

  it("reads the heading change and the rows of the look", () => {
    expect(headingChangeWords("Rain", "Sun")).toBe("Rain to Sun");
    expect(headingChangeWords("Sun", "Sun")).toBe("Sun, no change");
    expect(lookRowWords("Calm Seas", 0)).toBe("Calm Seas");
    expect(lookRowWords("Fair Wind", 1)).toBe("Fair Wind · Success");
    expect(lookRowWords("Fair Wind", 2)).toBe("Fair Wind · Success ×2");
    expect(medallionCount(2)).toBe("×2");
    expect(medallionCount(1)).toBeNull();
    expect(medallionCount(0)).toBeNull();
  });
});

describe("the piles and the web list's words", () => {
  it("say a pile's count, the second slot on one line, the ships and the heading", () => {
    expect(pileCountWords("Corsair deck", 9)).toBe("Corsair deck, 9 cards");
    expect(pileCountWords("Corsair discard pile", 2)).toBe("Corsair discard pile, 2 cards");
    expect(pileCountWords("Corsair deck", 1)).toBe("Corsair deck, 1 card");
    expect(secondSlotLine([{ name: "Corsair deck", count: 9 }, { name: "Corsair discard pile", count: 2 }])).toBe("Corsair deck 9 · Corsair discard pile 2");
    expect(shipsLine([{ name: "Dream-chaser", damage: 3 }, { name: "Dawn Star", damage: 0 }])).toBe("Ships: Dream-chaser, 3 damage; Dawn Star");
    expect(headingLine("Rain", false)).toBe("Heading: Rain (off-course)");
    expect(headingLine("Sun", true)).toBe("Heading: Sun (on-course)");
  });

  it("keep the words of the verbs inside a choice (phase 39)", () => {
    expect(seaWords({ verb: "ShiftHeading", direction: "offCourse" })).toBe("shift your heading off-course");
  });
});
