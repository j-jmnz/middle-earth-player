// Rules: hob.riddles, hob.riddles-steps-2-and-3, rr.first-player (data/rules/entries.json); ledger lines 131075:A:2, 131076:A:2, 131079:A:2, 131083:A:2, 131084:A:1. The sheets of a riddle on the live table: the choice between the riddle and the card, each name asked, Bilbo's Magic Ring and the type
// Not Fair! Not Fair! asks. Each sentence says its number, whose choice it is (two-handed the sentence leads with the player) and what the answer does (docs/design-system-table.md, Choice tray).
import { describe, expect, it } from "vitest";

import { legalIntents } from "../../rules/engine/legal.ts";
import { updateCard, type ScenarioState } from "../../rules/core/state.ts";
import { riddleTable, stacked, type RiddleTable } from "../../rules/families/riddles/fixture.ts";
import { revealFromTop, send } from "../../../test/harness/scene-kit.ts";
import { sheetFor } from "./sheets.ts";

const TITLES: Readonly<Record<string, string>> = { "131075": "Great Gray Wolf", "131076": "Wild Wargs", "131077": "The Wargs' Glade", "131083": "What's In My Pocket?", "131084": "Not Fair! Not Fair!", "131079": "Bilbo's Magic Ring" };
const sheetOf = (made: RiddleTable, state: ScenarioState) => {
  const names = { card: (id: string) => TITLES[state.cards[id]?.code ?? ""] ?? state.cards[id]?.code ?? id, line: () => null };
  const sheet = sheetFor(state, made.ctx, legalIntents(state, made.ctx), names);
  if (!sheet || sheet.kind !== "pick") throw new Error(`no pick sheet: ${JSON.stringify(state.window)}`);
  return { note: sheet.note, verb: sheet.verb, labels: sheet.options.map((option) => option.label) };
};
// The card is revealed and each of `picks` answers the next choice; the sheet of the choice left open.
function after(made: RiddleTable, state: ScenarioState, code: string, picks: readonly string[]): ScenarioState {
  let run = { state: revealFromTop(state, made.ctx, code, []).state, steps: [] as never[] };
  for (const optionId of picks) run = send(run, { type: "Choose", optionId }, made.ctx) as typeof run;
  return run.state;
}

describe("the sheets of a riddle", () => {
  it("131076:A:2 asks the first player to answer the riddle or resolve the card, with the cards it discards", () => {
    const made = riddleTable({ deckOf: ["01013", "01013"] });
    expect(sheetOf(made, after(made, made.state, "131076", []))).toEqual({
      note: "Wild Wargs: answer its riddle, or resolve the card as any other card? The riddle names a card type, then discards the top 2 cards of your deck.",
      verb: "Choose",
      labels: ["Answer the riddle: name a card type", "Resolve Wild Wargs as any other card"],
    });
  });

  it("131075:A:2 asks each name in turn, saying which of how many it is, and what the discards do", () => {
    const made = riddleTable({ deckOf: ["01013", "01013", "01013"] });
    expect(sheetOf(made, after(made, made.state, "131075", ["answer"])).note).toBe("Great Gray Wolf: name a card type for its riddle (1 of 3). Then your deck is shuffled and its top 3 cards are discarded: each one that matches every name puts 1 progress on stage 2.");
    expect(sheetOf(made, after(made, made.state, "131075", ["answer", "ally"])).note).toContain("name a sphere for its riddle (2 of 3)");
    const cost = sheetOf(made, after(made, made.state, "131075", ["answer", "ally", "leadership"]));
    expect(cost.note).toContain("name a cost, from 0 to 6 for its riddle (3 of 3)");
    expect(cost.labels).toEqual(["0", "1", "2", "3", "4", "5", "6"]);
  });

  it("131083:A:2 asks the first player at once, with no choice between the riddle and the card, and leads with the player two-handed", () => {
    const made = riddleTable({ seats: 2, deckOf: ["01013", "01013"] });
    const sheet = sheetOf(made, after(made, made.state, "131083", []));
    expect((sheet.note ?? "").startsWith("Player 1, What's In My Pocket?: name a sphere for its riddle (1 of 2).")).toBe(true);
    expect(sheet.labels).toEqual(["Leadership", "Spirit", "Lore", "Tactics", "Baggins"]);
  });

  it("131079:A:2 asks whether Bilbo's Magic Ring spends a Baggins resource for 1 more card, with the resources he holds", () => {
    const made = riddleTable({ deckOf: ["01013", "01013", "01013"] });
    const state = after(made, updateCard(made.state, made.bilbo, { resources: 2 }), "131076", ["answer", "ally"]);
    expect(sheetOf(made, state)).toEqual({
      note: "Bilbo's Magic Ring: only the first player may use it. Spend 1 of the 2 Baggins resources in Bilbo's pool to discard 1 more card from your deck? It is checked for a match like the others.",
      verb: "Choose",
      labels: ["Spend 1 Baggins resource: discard 1 more card", "Stop: discard no more cards"],
    });
  });

  it("131084:A:1 asks a card type, and says the 3 cards discarded and that stage 2 keeps its progress", () => {
    const made = riddleTable({ deck: ["131074", "131079", "f0", "f0", "treachery", "f0"] });
    const sheet = sheetOf(made, after(made, stacked(made.state, ["f0", "f0", "treachery"]), "131084", []));
    expect(sheet.note).toBe("Name a card type. The top 3 cards of the encounter deck are discarded. Stage 2 keeps its progress, since it cannot be removed except by answering riddles.");
    expect(sheet.labels).toEqual(["Enemy", "Location", "Treachery", "Objective"]);
  });
});
