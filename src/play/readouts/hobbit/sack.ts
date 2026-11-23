// Rules: hob.sack-deck, hob.sack-x (data/rules/entries.json); ledger lines 131023:A:1, 131032:A:2, 131044:A:1 (docs/scenarios/the-hobbit/we-must-away-ere-break-of-day.md, We Must Away, Ere Break of Day, The table).
//
// The Sack deck as a top-bar dial: how many of the 7 Sack cards the deck still holds, and how many are attached to characters. The deck itself is a pile that shows its count and a back only (the cards are facedown and the players never look at them);
// a Sack card lies under the character it is attached to, like any attachment. The dial's limit is the 7 the Setup builds the deck from, and it warns when the deck is empty, since an empty Sack deck ignores Sack X (hob.sack-x). The engine decided every card's place;
// nothing here changes one. Empty in any other scenario. Pure, so a test reads it.
import type { ScenarioState } from "../../../rules/core/state.ts";

import type { TableDial } from "../dials.ts";

const SCENARIO = "we-must-away-ere-break-of-day";
const SACKS = 7;
/** The seven Sack cards (131044 to 131050). */
const SACK_CODES: ReadonlySet<string> = new Set(["131044", "131045", "131046", "131047", "131048", "131049", "131050"]);

/** The Sack dial now: none in any other scenario, or before the Setup built the deck. */
export function sackDials(game: ScenarioState): readonly TableDial[] {
  const deck = game.piles?.sackDeck;
  if (game.scenarioId !== SCENARIO || deck === undefined) return [];
  const attached = Object.values(game.cards).filter((card) => SACK_CODES.has(card.code) && card.zone === "attached").length;
  const words = `${deck.length} of the ${SACKS} Sack cards ${deck.length === 1 ? "is" : "are"} in the Sack deck, ${attached} attached to characters`;
  return [{ id: "sack", testID: "sack-deck", label: "Sacks", name: "Sack deck", value: deck.length, limit: SACKS, limitWords: `The Sack deck starts with ${SACKS} Sack cards`, note: `${words}.`, ...(deck.length === 0 ? { warn: { level: "near" as const, words: "The Sack deck is empty: Sack X is ignored" } } : {}) }];
}
