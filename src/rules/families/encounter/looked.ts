// Rules: rr.encounter-deck, rr.search, rr.forced (data/rules/entries.json); ledger line 901506:A:1.
//
// "After a player looks at one or more cards in the encounter deck": a look at its top cards (LookAtTop) or a search of it (SearchMove, SearchReveal, PickEncounter) announces `lookedAtEncounterDeck` for the seat. Any card in play hears it.
// "After" is after the effect that looked has resolved in full (rr.forced), so a look inside an effect is noted on the effect's frame and announced when the frame ends (`releaseLooks`); an effect that looks and then arranges or picks the cards it saw acts on
// them before the shuffle. Queued only in a game with a card that hears it, so no other game's events change.
import type { ReduceContext } from "../../interpret/interpret.ts";
import { gameReads } from "../../core/game-reads.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { EffectData } from "../../windows/frame-types.ts";
import { queueEvent } from "../../windows/queue.ts";
import { patchTop, topFrame } from "../../windows/windows.ts";

export function announceLooked(state: ScenarioState, ctx: ReduceContext, seat: number): ScenarioState {
  if (!gameReads(state, ctx, '"trigger":"lookedAtEncounterDeck"')) return state;
  const top = topFrame(state);
  if (top?.data.kind === "effect") return patchTop(state, { data: { ...top.data, lookedBy: [...(top.data.lookedBy ?? []), seat] } });
  return queueEvent(state, { trigger: "lookedAtEncounterDeck", seat });
}

/** The effect is done: each look it made is announced now. */
export function releaseLooks(state: ScenarioState, data: EffectData): ScenarioState {
  return (data.lookedBy ?? []).reduce((current, seat) => queueEvent(current, { trigger: "lookedAtEncounterDeck", seat }), state);
}
