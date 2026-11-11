// Rules: mec112.mire, mec112.gollum-smeagol, rr.first-player (data/rules/entries.json); ledger lines 144019:A:1, 144020:A:2, 144022:A:1, 144022:A:2, 144064:B:1, 144075:A:1, 144075:A:3, 144076:A:1. What the table says of The Passage of the Marshes' pieces: the Mire dial (the
// mire tokens on the location closest to its Mire X, warming toward it), Gollum's hit points while he is an enemy, and the held mark of the seat that is engaged with Gollum or controls Sméagol. The engine decided each number; nothing here changes one.
import { describe, expect, it } from "vitest";

import { idOf, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { settle } from "../../rules/engine/machine.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { updateCard, type ScenarioState } from "../../rules/core/state.ts";

import { gollumHeld, marshesDials } from "../readouts/marshes.ts";
import { heldDials } from "../readouts/widgets.ts";
import type { IsengardDial } from "../readouts/isengard.ts";
import type { AsksTable } from "../words/asks.ts";
import { ASKS } from "../words/asks/the-passage-of-the-marshes.ts";
import { GOLLUM_WORDS, gollumHeldWords, mireWords } from "../words/scenarios/marshes.ts";

const ID = "the-passage-of-the-marshes";
const table = (layout: Layout = {}) => tableFromLayout(ID, layout);
const names = (made: ReturnType<typeof table>) => (code: string) => made.cards.get(code)?.name ?? code;
const dialsOf = (layout: Layout): readonly IsengardDial[] => {
  const made = table(layout);
  return marshesDials(syncConstants(made.state, made.ctx), made.ctx, names(made));
};
const dial = (dials: readonly IsengardDial[], id: string) => dials.find((one) => one.id === id);

describe("the Mire dial", () => {
  it("144019:A:1 shows the mire tokens on the location closest to its Mire X against that X, warming toward it (no goal)", () => {
    const shown = dial(dialsOf({ staging: [{ code: "144019", resources: 1 }, { code: "144021", resources: 1 }] }), "mire");
    // Evil-smelling Fens (Mire 3) has 1 of 3, Haunted Mere (Mire 2) 1 of 2: the Mere is nearer.
    expect(shown).toMatchObject({ label: "Mire", value: 1, limit: 2, testID: "marshes-mire", name: "Mire tokens on Haunted Mere, the location closest to its limit" });
    expect(shown?.goal).toBeUndefined();
    expect(shown?.limitWords).toBe("Evil-smelling Fens 1 of 3, Haunted Mere 1 of 2; 1 mire token more and Haunted Mere is discarded by Mire");
  });

  it("144022:A:1 reads the active location too, and a location without the keyword is left out", () => {
    const made = table({ active: "144022", staging: ["144053"] });
    const state = updateCard(made.state, idOf(made.state, "144022"), { resources: 2 });
    const shown = dial(marshesDials(state, made.ctx, names(made)), "mire");
    expect(shown).toMatchObject({ value: 2, limit: 5 });
    expect(shown?.limitWords).toBe("Stagnant Pools 2 of 5; 3 mire tokens more and Stagnant Pools is discarded by Mire");
  });

  it("144019:A:1 is not there with no location with Mire in the staging area or active, and again as one arrives", () => {
    expect(dial(dialsOf({ staging: ["144053"] }), "mire")).toBeUndefined();
    expect(dial(dialsOf({ staging: ["144023"] }), "mire")).toMatchObject({ value: 0, limit: 1 });
  });

  it("144020:A:2 follows a location that Mire discards: the dial is gone with the last one", () => {
    const made = table({ staging: [{ code: "144023", resources: 0 }] });
    const id = idOf(made.state, "144023");
    const discarded = settle({ ...made.state, cards: { ...made.state.cards, [id]: { ...made.state.cards[id]!, zone: "encounterDiscard" } }, staging: [], window: null, mode: "stopped" }, made.ctx, []);
    expect(dial(marshesDials(discarded, made.ctx, names(made)), "mire")).toBeUndefined();
  });

  it("144019:A:1 words each location's tokens, and what the nearest still needs", () => {
    expect(mireWords([{ name: "Soft Mires", tokens: 0, limit: 1 }])).toBe("Soft Mires 0 of 1; 1 mire token more and Soft Mires is discarded by Mire");
    expect(mireWords([{ name: "Stagnant Pools", tokens: 3, limit: 5 }, { name: "Soft Mires", tokens: 0, limit: 1 }])).toBe("Stagnant Pools 3 of 5, Soft Mires 0 of 1; 1 mire token more and Soft Mires is discarded by Mire");
  });
});

describe("Gollum's dial and the seat that holds him", () => {
  it("144064:B:1 shows Gollum's hit points left as a goal dial while he is an enemy in play, and not once he is Sméagol", () => {
    const layout: Layout = { engaged: [{ code: "144075", seat: 0, damage: 2 }] };
    expect(dial(dialsOf(layout), "gollum")).toMatchObject({ label: "Gollum · HP", value: 3, limit: 5, filled: 2, goal: true, testID: "marshes-gollum", limitWords: GOLLUM_WORDS });
    expect(dial(dialsOf({ play: ["144076"] }), "gollum")).toBeUndefined();
    expect(dial(dialsOf({}), "gollum")).toBeUndefined();
  });

  it("144075:A:1 says Gollum is engaged with the first player on that seat's dial, the second seat when the token is there", () => {
    const made = table({ seats: 2, firstPlayer: 1, engaged: [{ code: "144075", seat: 1 }] });
    expect(gollumHeld(made.state)).toEqual([{ seat: 1, words: "Gollum is engaged with Player 2", mark: "hero" }]);
    const solo = table({ engaged: [{ code: "144075", seat: 0 }] });
    expect(gollumHeld(solo.state)[0]?.words).toBe("Gollum is engaged with you");
  });

  it("144076:A:1 says the first player controls Sméagol, exhausted after a flip, and the seat follows the token", () => {
    const made = table({ seats: 2, firstPlayer: 1, play: [{ code: "144076", seat: 0 }] });
    const settled = settle({ ...made.state, window: null, mode: "stopped" }, made.ctx, []);
    const tired = { ...settled, cards: { ...settled.cards, [idOf(settled, "144076")]: { ...settled.cards[idOf(settled, "144076")]!, exhausted: true } } } as ScenarioState;
    expect(gollumHeld(tired)).toEqual([{ seat: 1, words: "Player 2 controls Sméagol, exhausted", mark: "hero" }]);
    expect(gollumHeldWords("smeagol", "you", false)).toBe("You control Sméagol");
  });

  it("144075:A:1 joins the held dials of the table, beside any Captive's", () => {
    const made = table({ engaged: [{ code: "144075", seat: 0 }] });
    expect(heldDials(made.state, names(made), () => false)).toEqual([{ seat: 0, words: "Gollum is engaged with you", mark: "hero" }]);
    expect(heldDials(table({}).state, names(table({})), () => false)).toEqual([]);
  });
});

describe("the choices of The Passage of the Marshes", () => {
  const asks: AsksTable = ASKS;
  it("144055:A:2 says the cancel among the options of We Hates Them!, and who chooses", () => {
    expect(asks["144055:whenRevealed:1 @0 cancel"]).toMatchObject({ label: expect.stringContaining("Cancel this effect") });
    expect(JSON.stringify(asks["144055:whenRevealed:1 @0 Choose"])).toContain("{owner} chooses for all the players");
  });
});
