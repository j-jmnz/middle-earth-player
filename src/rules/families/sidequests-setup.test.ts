// Rules: rr.setup, mec109.setup, rr.campaign-pool, rr.victory (data/rules/entries.json).
// The Setup lines of heroes, the Lórien gifts (attach in Setup, leave the campaign pool when used), and the quest area at the start.
import { describe, expect, it } from "vitest";

import { RECORDS } from "../../effects/authored/families/sidequests.ts";
import { codes, expectOk, fixtureDefinition } from "../fixture.ts";
import { definePrinted } from "../printed.ts";
import { reduce, startScenario } from "../reduce.ts";
import type { ScenarioState } from "../state.ts";
import { SIDE_CARDS } from "./sidequests-fixture.ts";

const filler = codes("f", 20);
const cards = new Map([...SIDE_CARDS, ...filler.map((code) => [code, definePrinted({ code, name: code, type: "event", sphere: "neutral", cost: 0 })] as const)]);
const gameCtx = { effects: RECORDS, cards };

function started(heroes: readonly string[], deck: readonly string[], seats: 1 | 2 = 1, seed = 5): ScenarioState {
  const begun = startScenario(
    {
      seatCount: seats,
      seed,
      threatModifier: 0,
      definition: fixtureDefinition(["stage"]),
      seats: Array.from({ length: seats }, () => ({ heroes, deck })),
      encounterDeck: [],
      questDeck: ["stage"],
    },
    gameCtx,
  );
  return begun;
}

// Keeps the opening hands: the Setup lines of the heroes resolve.
function kept(state: ScenarioState): ScenarioState {
  let next = state;
  for (let guard = 0; guard < 6 && next.window?.kind === "mulligan"; guard += 1) next = expectOk(reduce(next, { type: "Keep" }, gameCtx)).state;
  return next;
}

describe("Setup lines of heroes", () => {
  it("Denethor adds 2 resources to his own pool (12001:A:1)", () => {
    const state = kept(started(["12001", "dwarf"], filler));
    const denethor = state.seats[0].heroes.find((id) => state.cards[id]?.code === "12001") ?? "";
    // Setup gave 2; the first resource phase gave 1 more.
    expect(state.cards[denethor]?.resources).toBe(3);
  });

  it("Éowyn reduces her player's threat by 3 (145002:A:1)", () => {
    const without = kept(started(["dwarf", "rohan"], filler));
    const withEowyn = kept(started(["145002", "rohan"], filler));
    // Starting threat is the heroes' threat costs: Dain 9 and Theodred 9, Éowyn 9.
    expect(without.seats[0].threat).toBe(18);
    expect(withEowyn.seats[0].threat).toBe(18 - 3);
  });

  it("Thurindir searches the deck for a side quest, adds it to the hand, and shuffles (17028:A:2)", () => {
    const state = kept(started(["17028"], ["09014", ...filler]));
    const quest = Object.values(state.cards).find((card) => card.code === "09014");
    expect(quest?.zone).toBe("hand");
    // Two side quests to choose from: the player is asked. (The opening hand is drawn first: a seed that leaves both in the deck.)
    const deck = ["09014", "10034", ...filler];
    const asked = kept([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((seed) => started(["17028"], deck, 1, seed)).find((state) => ["09014", "10034"].every((code) => Object.values(state.cards).some((card) => card.code === code && card.zone === "deck"))) as ScenarioState);
    expect(asked.window).toMatchObject({ kind: "choose", seat: 0 });
    const chosen = expectOk(reduce(asked, { type: "Choose", optionId: Object.values(asked.cards).find((card) => card.code === "10034" && card.zone === "deck")?.id ?? "" }, gameCtx)).state;
    expect(Object.values(chosen.cards).find((card) => card.code === "10034")?.zone).toBe("hand");
  });

  it("each player's heroes resolve their Setup, a player without such a hero is left alone", () => {
    const state = kept(started(["12001"], filler, 2));
    for (const seat of [0, 1]) {
      const denethor = state.seats[seat]?.heroes[0] ?? "";
      expect(state.cards[denethor]?.resources).toBe(3);
    }
  });
});

describe("the Lórien gifts", () => {
  it("Phial of Galadriel: Setup attaches it to a hero; its Action goes to the victory display, leaves the pool, and weakens engaged enemies (142015)", () => {
    const state = kept(started(["dwarf"], ["142015", ...filler]));
    const phial = Object.values(state.cards).find((card) => card.code === "142015");
    expect(phial).toMatchObject({ zone: "play", host: state.seats[0].heroes[0] });
  });
});
