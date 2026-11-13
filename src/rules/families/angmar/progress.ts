// Rules: mec108.side-quests-in-play, faq.triggering-forced-effects (data/rules/entries.json); ledger line 10081:A:1. "If no progress was placed on Lie Low this round": each progress token placed on a side quest is noted as a modifier `progressPlacedHere` on that card until the end of the round (once a round),
// which a record reads with the condition `flag` (`holder: self`). Nothing but a side quest that took progress holds one, so a game without side quests is as it was.
import { flagged, type ScenarioState } from "../../core/state.ts";

/** The progress `placed` (more than 0) went on the side quest: it holds `progressPlacedHere` until the end of the round. */
export function noteProgressPlaced(state: ScenarioState, id: string, placed: number): ScenarioState {
  if (placed <= 0 || flagged(state, id, "progressPlacedHere")) return state;
  return { ...state, modifiers: [...state.modifiers, { instanceId: id, sourceId: id, stat: "progressPlacedHere", amount: 1, until: "endOfRound" }] };
}
