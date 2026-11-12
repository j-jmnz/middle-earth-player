// Rules: rr.effects, rr.encounter-deck, rr.staging (data/rules/entries.json); ledger line 146077:A:1. Discarding the encounter deck until some locations are found.
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf } from "../../core/printed.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { moveEncounter } from "../encounter/moves.ts";

/** DiscardUntilLocations: cards come off the top of the encounter deck into its discard pile until `count` locations are among them, or the deck is empty (rr.effects: as many as there are); each of those locations is then added to the staging area. */
export function discardUntilLocations(state: ScenarioState, count: number, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = state;
  const found: string[] = [];
  while (found.length < count) {
    const top = next.encounterDeck[0];
    if (!top) break;
    next = updateCard(moveCard(next, top, { zone: "encounterDiscard" }), top, { face: "up" });
    if (printedOf(ctx.cards, next.cards[top]?.code ?? "").type === "location") found.push(top);
  }
  for (const id of found) next = moveEncounter(next, id, "staging", next.firstPlayer, ctx, steps);
  return next;
}
