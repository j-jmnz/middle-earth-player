// Rules: rr.guarded (data/rules/entries.json); ledger lines 01108:A:2, 12134:A:2.
import type { ScenarioState } from "../../core/state.ts";
import { inPlay } from "../../core/state.ts";

// An objective in the staging area with no encounter card attached to it is free of encounters, so it can be claimed (rr.guarded).
export function freeOfEncounters(state: ScenarioState, sourceId: string | null): boolean {
  const source = sourceId ? state.cards[sourceId] : undefined;
  // Only an encounter card still hosted by the objective and in play guards it (Iron Shackles sent to a deck is not).
  return source != null && !source.attachments.some((id) => state.cards[id]?.host === source.id && inPlay(state.cards[id]?.zone ?? "removed"));
}
