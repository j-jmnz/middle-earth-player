// Rules: rr.the-word-choose, hob.treasure-ohauh, hob.treasure-otd, hob.bilbo-baggins-ohauh, hob.bilbo-baggins-otd (data/rules/entries.json). The shared words of The Hobbit's cards (src/play/words/hobbit-asks.ts): every Pick and
// every ChooseX of Bilbo Baggins, the Baggins events and the nine treasures has an entry that fills and reads as a sentence, and every entry names a record path of one of those cards.
import { describe, expect, it } from "vitest";

import { scenarioDefinition } from "../../catalog/scenario-data.ts";
import { EFFECTS } from "../../effects/index.ts";
import { blankScenario } from "../../rules/core/state.ts";
import type { ReduceContext } from "../../rules/interpret/interpret.ts";
import { loadCards } from "../../../scripts/data/load-cards.ts";
import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { asksPlayer, walk } from "../../../test/harness/record-walk.ts";

import { asksPick, templatesOf, unknownPlaceholders } from "./asks.ts";
import type { ChoiceNames } from "./choice.ts";
import { HOBBIT_ASKS } from "./hobbit-asks.ts";

const SHARED = ["131001", "132001", "131019", "132013", "131020", "131021", "131022", "132019", "132020", "132021", "132022", "132023", "132024"];
const cards = new Map(loadCards().map((card) => [card.code, card]));
const names: ChoiceNames = { card: (key) => cards.get(key)?.name ?? key, code: (code) => cards.get(code)?.name ?? code };
const ctx: ReduceContext = { effects: EFFECTS, cards: new Map() };
const game = blankScenario({ seatCount: 2, seed: 1, definition: scenarioDefinition(loadAnyScenario("flies-and-spiders"), loadCampaign("the-hobbit"), EFFECTS) });
const records = EFFECTS.filter((effect) => SHARED.includes(effect.cardCode));

describe("the shared words of The Hobbit", () => {
  it("words every Pick and ChooseX of the shared cards in a sentence that fills", () => {
    const missing: string[] = [];
    const bad: string[] = [];
    for (const effect of records) {
      walk(effect.instructions, (instruction, _next, _after, path) => {
        if (!asksPlayer(instruction)) return;
        const key = `${effect.id} @${path} ${instruction.verb}`;
        const words = asksPick({ game, ctx, names, instruction, source: effect.cardCode, effectId: effect.id, options: [] }, HOBBIT_ASKS);
        if (!words) missing.push(key);
        else if (!/^[A-Z].*\.$/.test(words.prompt) || words.prompt.includes("{")) bad.push(`${key}: ${words.prompt}`);
      });
    }
    expect(missing).toEqual([]);
    expect(bad).toEqual([]);
  });

  it("holds only entries that name a record path of the shared cards, with every placeholder known", () => {
    const keys = new Set<string>();
    for (const effect of records) walk(effect.instructions, (instruction, _next, _after, path) => void keys.add(`${effect.id} @${path} ${instruction.verb}`));
    expect(Object.keys(HOBBIT_ASKS).filter((key) => !keys.has(key))).toEqual([]);
    expect(Object.values(HOBBIT_ASKS).flatMap((entry) => unknownPlaceholders(entry))).toEqual([]);
    expect(Object.values(HOBBIT_ASKS).flatMap(templatesOf).length).toBeGreaterThan(0);
  });
});
