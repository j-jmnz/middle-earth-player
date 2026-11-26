// Rules: rm.time-x (data/rules/entries.json); ledger lines 08152:A:2, 08155:A:1, 08156:A:1, 08157:A:1, 08158:A:1.
// The time dials of The Antlered Crown's locations: each location in play that prints Time X, its counters left against what the next refresh phase takes, warming when that phase takes the last. The quest stages' dials are the Fords readout's (`FORDS_STAGES`). The engine decided every
// number (the counters on the card); nothing here changes one. Empty in any other scenario. Pure, so a test reads it.
import { inPlay } from "../../../rules/core/state.ts";
import type { ScenarioState } from "../../../rules/engine/reduce.ts";

import { isTimeLocation, locationTimeNearWords, locationTimeWords } from "../../words/scenarios/ring-maker/crown-table.ts";
import type { TableDial } from "../dials.ts";

export const CROWN = "the-antlered-crown";

export function crownDials(game: ScenarioState, nameOf: (code: string) => string): readonly TableDial[] {
  if (game.scenarioId !== CROWN) return [];
  return Object.values(game.cards)
    .filter((card) => inPlay(card.zone) && isTimeLocation(card.code) && card.zone !== "attached")
    .map((card): TableDial => ({
      id: `time:${card.id}`,
      testID: `crown-time:${card.id}`,
      label: "Time",
      name: `Time counters left on ${nameOf(card.code)}:`,
      value: card.resources,
      cardId: card.id,
      ...(card.resources <= 1 ? { warn: { level: "near" as const, words: locationTimeNearWords(card.code, card.resources) } } : {}),
      note: locationTimeWords(card.code, card.resources, 1),
    }));
}
