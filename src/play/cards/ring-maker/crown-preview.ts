// Rules: rm.raven-deck, rr.first-player, rr.cannot, rr.victory (data/rules/entries.json); ledger lines 08150:A:1, 08150:A:2, 08150:A:3, 08151:A:1, 08152:A:1, 08149:B:3.
// The line a card of The Antlered Crown says about itself in the card preview (preview.ts): Chief Turch under the first player's control, Raven Chief and Raven Chief's Camp. The engine decided each; nothing here changes one. Pure.
import { inPlay, livingSeats, type ScenarioState } from "../../../rules/core/state.ts";

import { campWords, ravenChiefWords, turchControlledWords } from "../../words/scenarios/ring-maker/crown-table.ts";

const TURCH = "08150";
const RAVEN_CHIEF = "08151";
const CAMP = "08152";

export function crownDetail(game: ScenarioState, cardId: string): string | null {
  const card = game.cards[cardId];
  if (card == null || game.scenarioId !== "the-antlered-crown") return null;
  if (card.code === TURCH && card.controller != null && card.zone === "play") return turchControlledWords(livingSeats(game).length > 1 ? `Player ${card.controller + 1}` : null);
  if (card.code === RAVEN_CHIEF) return ravenChiefWords(Object.values(game.cards).some((other) => other.code === CAMP && inPlay(other.zone)));
  return card.code === CAMP ? campWords() : null;
}
