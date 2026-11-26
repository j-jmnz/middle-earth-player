// Rules: rm.raven-deck, rr.first-player, rr.cannot, rr.victory (data/rules/entries.json); ledger lines 08150:A:1, 08150:A:2, 08150:A:3, 08151:A:1, 08152:A:1, 08149:B:3.
// The line a card of The Antlered Crown says about itself in the card preview (preview.ts): Chief Turch under the first player's control, Raven Chief and Raven Chief's Camp, and what the last time counter of a location does. The engine decided each; nothing here changes one. Pure.
import { inPlay, livingSeats, type ScenarioState } from "../../../rules/core/state.ts";

import { crownLocationWords } from "../../readouts/ring-maker/crown.ts";
import { campWords, ravenChiefWonWords, ravenChiefWords, turchControlledWords } from "../../words/scenarios/ring-maker/crown-table.ts";

const TURCH = "08150";
const RAVEN_CHIEF = "08151";
const CAMP = "08152";
const STAGE_3 = "08149";

export function crownDetail(game: ScenarioState, cardId: string): string | null {
  const card = game.cards[cardId];
  if (card == null || game.scenarioId !== "the-antlered-crown") return null;
  if (card.code === TURCH && card.controller != null && card.zone === "play") return turchControlledWords(livingSeats(game).length > 1 ? `Player ${card.controller + 1}` : null);
  if (card.code === RAVEN_CHIEF) return ravenChiefWords(Object.values(game.cards).some((other) => other.code === CAMP && inPlay(other.zone)));
  // A location that prints Time X says what its dial says (what its last counter does), so the preview a tap on the dial opens holds it; the Camp's own line leads.
  const time = crownLocationWords(game, cardId);
  return card.code === CAMP ? [campWords(), time].filter((part) => part != null).join(" ") : time;
}

/** The lines stage 3's preview adds to its objective: the win is met while Raven Chief lies in the victory display. Empty on any other stage, and in any other scenario. */
export function crownStageLines(game: ScenarioState, stageCode: string): string[] {
  return game.scenarioId === "the-antlered-crown" && stageCode === STAGE_3 && Object.values(game.cards).some((card) => card.code === RAVEN_CHIEF && card.zone === "victory") ? [ravenChiefWonWords()] : [];
}
