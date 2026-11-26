// Rules: rm.time-x, rr.forced (data/rules/entries.json); ledger line 08153:A:1. The rows of Raven Warrior's pick of the location that loses a time counter: each says the counters it holds, and a location on its last counter warns, before the confirm, what that last counter starts.
// The engine decided every number (the counters on the card, what is left to divide); nothing here changes one.
import type { Instruction } from "../../catalog/boundary.ts";
import type { ScenarioState } from "../../rules/core/state.ts";

import { lastCounterRowWords, locationRowWords } from "../words/scenarios/ring-maker/crown-table.ts";

/** The label and the caution of a row of the pick of a RemoveTimeCounters that divides its counters among the locations; null for any other pick or row. */
export function crownRow(instruction: Instruction, id: string, game: ScenarioState, nameOf: (id: string) => string): { label: string; caution?: string } | null {
  const card = game.cards[id];
  if (instruction.verb !== "RemoveTimeCounters" || instruction.distribute == null || card == null || card.resources <= 0) return null;
  const name = nameOf(id);
  const caution = card.resources === 1 ? lastCounterRowWords(card.code, name) : null;
  return { label: locationRowWords(name, card.resources), ...(caution ? { caution } : {}) };
}
