// The scenarios whose dealt cards have an effect record for every printed line (the effect coverage test keeps
// this list honest both ways). Campaign-dealt cards have no inactive-text path, so a scenario not listed here is not
// dealt as a standalone game. Scenarios 5 and 6 join as phases 15 and 16 write their records (src/effects/open-lines.ts lists what is left); Mirkwood Paths follows, one scenario per phase (29 to 33; Escape from Dol Guldur is part 3, The Oath part 4 and The Dark of Mirkwood part 1).
export const PLAYABLE_SCENARIOS: readonly string[] = ["a-shadow-of-the-past", "a-knife-in-the-dark", "flight-to-the-ford", "the-ring-goes-south", "passage-through-mirkwood", "journey-along-the-anduin", "escape-from-dol-guldur", "the-oath", "the-caves-of-nibin-dum"];

export function isPlayable(scenarioId: string): boolean {
  return PLAYABLE_SCENARIOS.includes(scenarioId);
}

// The playable scenarios whose Nightmare deck (data/scenarios/<id>.json `nightmare`) also has an effect record for every printed
// line: its setup card's and its cards' (docs/plans/nightmare-mode.md). Only these offer Nightmare on the briefing; the effect
// coverage test keeps the list honest both ways, as it does PLAYABLE_SCENARIOS.
export const NIGHTMARE_PLAYABLE: readonly string[] = ["a-shadow-of-the-past", "a-knife-in-the-dark", "flight-to-the-ford", "the-ring-goes-south", "passage-through-mirkwood"];

export function isNightmarePlayable(scenarioId: string): boolean {
  return isPlayable(scenarioId) && NIGHTMARE_PLAYABLE.includes(scenarioId);
}
