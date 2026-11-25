// Rules: hob.riddles, hob.riddles-steps-2-and-3, rr.first-player (data/rules/entries.json); ledger lines 131075:A:2, 131076:A:2, 131079:A:2, 131083:A:2, 131084:A:1. The sheets of a riddle on the live table: the choice between the riddle and the card, each name asked, Bilbo's Magic Ring and the type
// Not Fair! Not Fair! asks. Each sentence says its number, whose choice it is (two-handed the sentence leads with the player) and what the answer does (docs/design-system-table.md, Choice tray).
import { describe, expect, it } from "vitest";

import { legalIntents } from "../../rules/engine/legal.ts";
import { updateCard, type ScenarioState } from "../../rules/core/state.ts";
import { riddleTable, stacked, type RiddleTable } from "../../rules/families/riddles/fixture.ts";
import { revealFromTop, send } from "../../../test/harness/scene-kit.ts";
import { sheetFor } from "./sheets.ts";
import { dockFor } from "./table-choice.ts";

const TITLES: Readonly<Record<string, string>> = { "131075": "Great Gray Wolf", "131076": "Wild Wargs", "131077": "The Wargs' Glade", "131083": "What's In My Pocket?", "131084": "Not Fair! Not Fair!", "131079": "Bilbo's Magic Ring", "01013": "Guard of the Citadel", "01040": "Citadel Plate" };
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
      note: "Wild Wargs: answer its riddle, or resolve the card as any other card? The riddle names a card type, then discards the top 2 cards of your deck. With no match, Gollum attacks Bilbo.",
      verb: "Choose",
      labels: ["Answer the riddle: name a card type. No match: Gollum attacks Bilbo", "Resolve Wild Wargs as any other card"],
    });
  });

  it("131075:A:2 asks each name in turn, saying which of how many it is, and what the discards do", () => {
    const made = riddleTable({ deckOf: ["01013", "01013", "01013"] });
    expect(sheetOf(made, after(made, made.state, "131075", ["answer"])).note).toBe("Great Gray Wolf: name a card type for its riddle (1 of 3). Then your deck is shuffled and its top 3 cards are discarded: each one that matches every name puts 1 progress on stage 2.");
    expect(sheetOf(made, after(made, made.state, "131075", ["answer", "ally"])).note).toContain("name a sphere for its riddle (2 of 3)");
    const cost = sheetOf(made, after(made, made.state, "131075", ["answer", "ally", "leadership"]));
    expect(cost.note).toContain("name a cost from 0 to 6 for its riddle (3 of 3)");
    expect(cost.labels).toEqual(["0", "1", "2", "3", "4", "5", "6"]);
  });

  it("131077:A:2 says its one card in the singular, with the card's name once", () => {
    const made = riddleTable({ seats: 2, deckOf: ["01013", "01013"] });
    expect(sheetOf(made, after(made, made.state, "131077", [])).note).toBe("Player 1, The Wargs' Glade: answer its riddle, or resolve the card as any other card? The riddle names a sphere, then discards the top card of your deck. With no match, Gollum attacks Bilbo.");
    expect(sheetOf(made, after(made, made.state, "131077", ["answer"])).note).toBe("Player 1, The Wargs' Glade: name a sphere for its riddle. Then your deck is shuffled and its top card is discarded: if it matches every name, it puts 1 progress on stage 2.");
  });

  it("131083:A:2 asks the first player at once, with no choice between the riddle and the card, and leads with the player two-handed", () => {
    const made = riddleTable({ seats: 2, deckOf: ["01013", "01013"] });
    const sheet = sheetOf(made, after(made, made.state, "131083", []));
    expect((sheet.note ?? "").startsWith("Player 1, What's In My Pocket?: name a sphere for its riddle (1 of 2).")).toBe(true);
    expect(sheet.labels).toEqual(["Leadership", "Spirit", "Lore", "Tactics", "Baggins"]);
  });

  it("131079:A:2 asks whether Bilbo's Magic Ring spends a Baggins resource for 1 more card, after what the riddle found", () => {
    const made = riddleTable({ deckOf: ["01013", "01013", "01013"] });
    const state = after(made, updateCard(made.state, made.bilbo, { resources: 2 }), "131076", ["answer", "ally"]);
    expect(sheetOf(made, state)).toEqual({
      note: "Bilbo's Magic Ring: Discarded: Guard of the Citadel (match), Guard of the Citadel (match). 2 of 2 matched. Only the first player may use it. Spend 1 Baggins resource (Bilbo holds 2) to discard 1 more card from your deck? It is checked for a match like the others.",
      verb: "Choose",
      labels: ["Spend 1 Baggins resource: discard 1 more card", "Stop: 2 progress on stage 2"],
    });
  });

  it("131079:A:2 says that stopping with no match starts Gollum's attack, and titles the sheet with the Ring", () => {
    const made = riddleTable({ deckOf: ["01040", "01040", "01040"] });
    const state = after(made, updateCard(made.state, made.bilbo, { resources: 1 }), "131077", ["answer", "spirit"]);
    const names = { card: (id: string) => TITLES[state.cards[id]?.code ?? ""] ?? id, line: () => null };
    const sheet = sheetFor(state, made.ctx, legalIntents(state, made.ctx), names);
    expect(sheet?.title).toBe("Bilbo's Magic Ring");
    expect(sheet?.kind === "pick" ? sheet.options.map((option) => option.label) : []).toEqual(["Spend 1 Baggins resource: discard 1 more card", "Stop: no match, Gollum attacks Bilbo"]);
    expect(sheet?.kind === "pick" ? sheet.note : "").toContain("Discarded: Citadel Plate (no match). 0 of 1 matched. Only the first player may use it. Spend 1 Baggins resource (Bilbo holds 1) to discard 1 more card");
  });

  it("tells the dock of a sheet of words to pick a row, not a glowing card", () => {
    const made = riddleTable({ deckOf: ["01013", "01013"] });
    const state = after(made, made.state, "131076", ["answer"]);
    const names = { card: (id: string) => id, line: () => null };
    const legal = legalIntents(state, made.ctx);
    const sheet = sheetFor(state, made.ctx, legal, names);
    if (!sheet || sheet.kind !== "pick") throw new Error("no pick sheet");
    const dock = dockFor(sheet, { key: sheet.key, ids: [], shares: [] }, { game: state, ctx: made.ctx, legal, names }, { overlay: false, passLegal: false, surface: "table" });
    expect(dock.why).toBe("Pick one of the choices.");
  });

  it("131084:A:1 asks a card type, and says the 3 cards discarded and that stage 2 keeps its progress", () => {
    const made = riddleTable({ deck: ["131074", "131079", "f0", "f0", "treachery", "f0"] });
    const sheet = sheetOf(made, after(made, stacked(made.state, ["f0", "f0", "treachery"]), "131084", []));
    expect(sheet.note).toBe("Name a card type. The top 3 cards of the encounter deck are discarded. Stage 2 keeps its progress, since it cannot be removed except by answering riddles.");
    expect(sheet.labels).toEqual(["Enemy", "Location", "Treachery", "Objective"]);
  });
});
