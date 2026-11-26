// Rules: hrd.orcs-area, rr.quest-advancement (data/rules/entries.json); ledger lines 17047:A:1, 17051:B:2, 17038:A:3. What a banner says of the Orcs' advance, from the two states: the engine pushes no `advance` step for it (the step's
// `stormcaller` flag is the Stormcaller's), so the beat reads the Orcs' stage number before and after. The progress it places is a `progress` step, told as the quest's is. Pure.
import { flagged, type ScenarioState } from "../../../rules/core/state.ts";

import { mumakWords, ORCS_ADVANCE_TITLE, ORCS_STAGE_LOSS, orcsAdvanceLine } from "../../words/scenarios/haradrim/orcs-table.ts";

type Beat = { rank: number; title: string; tone: "bad"; lines: string[] };

/** The banner beat of an advance of the Orcs in this intent (one beat however many stages it passed), or none. */
export function orcsBeats(before: ScenarioState, after: ScenarioState, nameOf: (cardId: string) => string): Beat[] {
  const was = before.orcs;
  const now = after.orcs;
  if (!was || !now || now.number <= was.number) return [];
  const last = now.number + now.deck.length;
  const lines = [orcsAdvanceLine(now.number, last, nameOf(now.stage))];
  if (now.deck.length === 0) lines.push(ORCS_STAGE_LOSS);
  return [{ rank: 1, title: ORCS_ADVANCE_TITLE, tone: "bad", lines }];
}

/** The preview of a Tamed Mûmak in play, read from its own flag (`undefendedToMumak`, 17038:A:2): null for any other card. */
export function mumakDetail(game: ScenarioState, cardId: string): string | null {
  const card = game.cards[cardId];
  if (!card || card.zone !== "play" || !flagged(game, cardId, "undefendedToMumak")) return null;
  return mumakWords(game.seatCount > 1 && card.controller != null ? `Player ${card.controller + 1}` : "you");
}
