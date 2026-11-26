// Rules: rm.time-x (data/rules/entries.json); ledger lines 08152:A:2, 08155:A:1, 08156:A:1, 08157:A:1, 08158:A:1.
// The time dials of The Antlered Crown's locations: each location in play that prints Time X, its counters left against what the next refresh phase takes, warming when that phase takes the last. The quest stages' dials are the Fords readout's (`FORDS_STAGES`). The engine decided every
// number (the counters on the card); nothing here changes one. Empty in any other scenario. Pure, so a test reads it.
import { inPlay } from "../../../rules/core/state.ts";
import type { ScenarioState } from "../../../rules/engine/reduce.ts";

import { isTimeLocation, locationDialLabel, locationPreviewWords, locationTimeNearWords, locationTimeWords } from "../../words/scenarios/ring-maker/crown-table.ts";
import type { TableDial } from "../dials.ts";

export const CROWN = "the-antlered-crown";

export function crownDials(game: ScenarioState, nameOf: (code: string) => string): readonly TableDial[] {
  if (game.scenarioId !== CROWN) return [];
  return Object.values(game.cards)
    // A location with no counter left has no dial: its last counter is gone and the words of the last one would be false.
    .filter((card) => inPlay(card.zone) && isTimeLocation(card.code) && card.zone !== "attached" && card.resources > 0)
    // The fewest counters first: the location nearest its last counter stands first in the row, where a row that scrolls shows it.
    .sort((a, b) => a.resources - b.resources)
    .map((card): TableDial => {
      const active = game.activeLocation === card.id;
      return {
        id: `time:${card.id}`,
        testID: `crown-time:${card.id}`,
        label: locationDialLabel(card.code),
        name: `Time counters left on ${nameOf(card.code)}:`,
        value: card.resources,
        cardId: card.id,
        ...(active ? { current: true as const } : {}),
        // The next refresh phase takes one counter, so only a location on exactly 1 counter loses its last.
        ...(card.resources === 1 ? { warn: { level: "near" as const, words: locationTimeNearWords(card.code, card.resources) } } : {}),
        note: locationTimeWords(card.code, card.resources, 1, active),
      };
    });
}

/** The time words the card preview of a location says: what the dial warns of, else its standing rule. Null for a card that has no time dial here. */
export function crownLocationWords(game: ScenarioState, cardId: string): string | null {
  const card = game.cards[cardId];
  if (game.scenarioId !== CROWN || card == null || !inPlay(card.zone) || !isTimeLocation(card.code) || card.resources <= 0) return null;
  return locationPreviewWords(card.code, card.resources, 1);
}
