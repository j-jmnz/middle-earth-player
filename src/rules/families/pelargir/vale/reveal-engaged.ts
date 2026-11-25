// Rules: rr.reveal, rr.engaged, rr.player-elimination, rr.surge, rr.running-out-of-cards, faq.reveal-and-add (data/rules/entries.json); ledger line 06151:A:1.
// Murzag reveals the top card of the encounter deck in full: the reveal frame of the engine (windows/frames.ts) runs its Doomed threat, the Responses that cancel it, its When Revealed effects, the Forced effects that hear a reveal and its Surge. An enemy is put into play engaged with the player the frame
// is for (the frame's `engage`, as a search that puts an enemy into play uses), so it is never staged and no shadow card is dealt to it; a location or an objective goes to the staging area and a treachery is discarded after its effects, as in any reveal. An empty deck is reset from the discard pile only in the quest phase (rr.running-out-of-cards, which the frame reads): Murzag attacks in the combat phase, so with an empty deck nothing is revealed.
import type { Instruction } from "../../../../catalog/boundary.ts";

import type { EngineStep } from "../../../core/intents.ts";
import { livingSeats, type ScenarioState } from "../../../core/state.ts";
import type { ReduceContext } from "../../../interpret/interpret.ts";
import { startReveal } from "../../../windows/frames.ts";
import type { Focus } from "../../index.ts";

/** RevealTopEngaging: see the schema entry. The revealing seat is the acting player. When the attack eliminated that player, the card is revealed for the first living seat with no engagement (an enemy goes to the staging area, as the enemies of an eliminated player do: rr.player-elimination), so its Surge, the Hide check and the controller go to a seat in the game. */
export function revealTopEngaging(state: ScenarioState, _instruction: Extract<Instruction, { verb: "RevealTopEngaging" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const gone = state.seats[focus.seat]?.eliminated === true;
  const seat = gone ? (livingSeats(state)[0] ?? focus.seat) : focus.seat;
  return startReveal(state, seat, ctx, steps, undefined, undefined, !gone);
}
