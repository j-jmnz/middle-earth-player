// Rules: rr.the-word-choose (data/rules/entries.json). A game reads the asks file of its own scenario and no other (asks.ts): 115 encounter cards are dealt by more than one scenario, and an entry keyed by a card's
// record must not word that card in a scenario whose file has no entry for it. (No module mock: the suite shares modules between files, so the barrel is handed in.)
import { describe, expect, it } from "vitest";

import type { Instruction } from "../../catalog/boundary.ts";
import { scenarioDefinition } from "../../catalog/scenario-data.ts";
import { EFFECTS } from "../../effects/index.ts";
import { blankScenario } from "../../rules/core/state.ts";
import type { ReduceContext } from "../../rules/interpret/interpret.ts";
import { loadCards } from "../../../scripts/data/load-cards.ts";
import { loadCampaigns, loadScenario } from "../../../scripts/data/load-scenarios.ts";

import { asksChoose, asksOfScenario, type AsksTable } from "./asks.ts";
import type { ChoiceNames } from "./choice.ts";

// Urdug's Elite (19158:forced:1), a Choose at path 0, is dealt by The Fate of Wilderland; only that scenario's file words it.
const RECORD = "19158:forced:1";
const FILE: AsksTable = { [`${RECORD} @0 Choose`]: { note: "Urdug's Elite is worded here." } };
const BY: Readonly<Record<string, AsksTable>> = { "the-fate-of-wilderland": FILE };

const cards = new Map(loadCards().map((card) => [card.code, card]));
const campaigns = loadCampaigns();
const names: ChoiceNames = { card: (key) => cards.get(key)?.name ?? key, code: (code) => cards.get(code)?.name ?? code };
const ctx: ReduceContext = { effects: EFFECTS, cards: new Map() };
const tableOf = (id: string) => blankScenario({ seatCount: 1, seed: 1, definition: scenarioDefinition(loadScenario(id), campaigns.find((one) => one.scenarios.includes(id)) ?? campaigns[0]!, EFFECTS) });
const choose = EFFECTS.find((effect) => effect.id === RECORD)!.instructions[0] as Instruction;

describe("an asks file is read by the scenario it is named for", () => {
  it("words the record in its own scenario", () => {
    const game = tableOf("the-fate-of-wilderland");
    expect(asksOfScenario(game, BY)).toBe(FILE);
    expect(asksChoose({ game, ctx, names, instruction: choose, source: "19158" }, asksOfScenario(game, BY))?.note).toBe("Urdug's Elite is worded here.");
  });

  it("gives a scenario whose file has no entry for the same record no words from another's", () => {
    const other = tableOf("a-storm-on-cobas-haven");
    expect(asksOfScenario(other, BY)).toBeUndefined();
    // With no table of its own, asks.ts reads the barrel for the game's scenario: no file of this repository words the record there.
    expect(asksChoose({ game: other, ctx, names, instruction: choose, source: "19158" }, asksOfScenario(other, BY))).toBeUndefined();
  });
});
