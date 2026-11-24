// Rules: rr.reveal, rr.surge, rr.treachery-cards, rr.running-out-of-cards, rr.step-3-3 (data/rules/entries.json); ledger lines 06016:A:1, 06016:A:2.
// The Hand of Castamir reveals the top card of the encounter deck, resolves its effects and discards it. The card goes faceup to the encounter discard pile at once and never lies in the staging area, so no location of it enters play (no Underworld, no
// "enters play" Forced effect) and nothing of it is added to the staging area. Its reveal runs from the step after the staging in a reveal frame of the engine (windows/frames.ts): its Doomed threat, the Responses that cancel it, its When Revealed effects, the Forced
// effects that hear a card revealed from the encounter deck (06016:A:2) and its Surge, so a Surge it gains from its own effect (A Knife in the Back) counts. The frame ends with the card in the discard pile, where the reveal of a treachery leaves it too.
import type { Instruction } from "../../../catalog/boundary.ts";

import { currentCause, ruleCause } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { reshuffleDiscard } from "../../interpret/verbs.ts";
import { offerResponses } from "../../windows/responses.ts";
import { patchTop, pushFrame } from "../../windows/windows.ts";
import type { Focus } from "../index.ts";

/** RevealTopThenDiscard: see the schema entry. An empty encounter deck is reset from the discard pile first; with nothing in either, nothing happens. */
export function revealTopThenDiscard(state: ScenarioState, _instruction: Extract<Instruction, { verb: "RevealTopThenDiscard" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const ready = reshuffleDiscard(state, steps, "rr.running-out-of-cards");
  const id = ready.encounterDeck[0];
  const card = id ? ready.cards[id] : undefined;
  if (!id || !card) return ready;
  const seat = focus.seat;
  const discarded = updateCard(moveCard(ready, id, { zone: "encounterDiscard" }), id, { face: "up", controller: null });
  steps.push({ kind: "reveal", seat, cardId: id, cause: currentCause(steps, ruleCause("rr.reveal")) });
  // The frame starts after the step that places the card in the staging area (step 0), at the Doomed step; the Responses that cancel the effects of a card just revealed are offered, as that step offers them.
  const pushed = patchTop(pushFrame(discarded, { frame: "reveal", cardId: id, seat, peril: false, data: { kind: "reveal", hide: null, surge: false, fromDeck: true } }, steps), { step: 1 });
  return offerResponses(pushed, { trigger: "encounterRevealed", seat, subject: id }, ctx, steps);
}
