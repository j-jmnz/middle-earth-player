// Rules: rr.step-3-4 (data/rules/entries.json).
//
// What a tap on the quest meter lists (docs/design-system-table.md, Reading panels): the cards that make up the threat the meter draws, the
// most Threat first, and what held effects add to or take from their sum. It reads the engine's own breakdown (stagingThreatSources), for the
// same seat as the meter (the acting seat's own staging area once stages are separate), so the list always adds up to the meter's number. Pure.
import { stagingThreatSources, type ThreatSource } from "../../rules/quest/quest.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";

import { questSeat } from "../store/selectors.ts";

export type ThreatSources = { total: number; sources: ThreatSource[]; adjust: number; seat: number | null };

export function threatSourcesOf(game: ScenarioState, ctx: ReduceContext): ThreatSources {
  const seat = questSeat(game);
  const { sources, adjust } = stagingThreatSources(game, ctx.cards, seat);
  // Highest Threat first; a tie keeps the table's order.
  const sorted = [...sources].sort((left, right) => right.threat - left.threat);
  const total = sources.reduce((sum, source) => sum + source.threat, adjust);
  return { total, sources: sorted, adjust, seat: seat != null && game.seatCount > 1 ? seat : null };
}

/** The line under the list when held effects change the sum: "Other effects: +2 Threat", "Other effects: −1 Threat". */
export function adjustWords(adjust: number): string | null {
  if (adjust === 0) return null;
  return `Other effects: ${adjust > 0 ? `+${adjust}` : `−${-adjust}`} Threat`;
}
