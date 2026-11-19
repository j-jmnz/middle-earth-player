// Rules: rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 50701:A:1, 50702:B:2 (docs/brief.md, Murder at the Prancing Pony, reading 23 and The table).
//
// The Investigation List of the insert as a top-bar dial: the names of the 5 Suspects and 5 Hideouts the players have checked off. A name is checked off once a look window showed its card (`seen`), or the card is in play, in the victory display or in the
// discard pile; a card that is set aside or in the Investigation deck and was never shown, and one removed from the game unseen, stays unchecked, so the dial never tells the hidden Suspect and Hideout apart from the deck. The Investigation deck itself is a pile that shows
// its count and a back only. The engine decided every flag; nothing here changes one. A tap on the dial says the names. Empty in any other scenario. Pure, so a test reads it.
import type { ScenarioState } from "../../../rules/core/state.ts";

import { listLimitWords, listWords } from "./pony-words.ts";
import type { TableDial } from "../dials.ts";

const SCENARIO = "murder-at-the-prancing-pony";
/** The Suspects and then the Hideouts, in the order of the insert's List. */
const SUSPECTS = ["50709", "50710", "50711", "50712", "50713"] as const;
const HIDEOUTS = ["50704", "50705", "50706", "50707", "50708"] as const;
/** The zones in which a card's name is not known to the players unless a look showed it. */
const UNKNOWN: ReadonlySet<string> = new Set(["setAside", "investigationDeck", "removed"]);

/** Whether the players know the card of a code: some copy of it was shown by a look or lies where everyone sees it. */
function checked(game: ScenarioState, code: string): boolean {
  return Object.values(game.cards).some((card) => card.code === code && (card.seen === true || !UNKNOWN.has(card.zone)));
}

/** The Investigation List dial now: none in any other scenario or before the Setup built the deck. */
export function ponyDials(game: ScenarioState, nameOf: (code: string) => string): readonly TableDial[] {
  if (game.scenarioId !== SCENARIO || game.piles?.investigationDeck === undefined) return [];
  const names = [...SUSPECTS, ...HIDEOUTS];
  const done = names.filter((code) => checked(game, code));
  const left = names.filter((code) => !done.includes(code));
  return [{ id: "list", testID: "pony-list", label: "List", name: "Investigation List", value: done.length, limit: names.length, limitWords: listLimitWords(), note: listWords(done.map(nameOf), left.map(nameOf)) }];
}
