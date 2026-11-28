// Rules: rr.reveal, rr.staging-area, rr.step-3-3 (data/rules/entries.json); vom.power-of-mordor-deck-the-temple-of-doom; ledger line 21053:A:1.
// The Power of Mordor deck (the pile `powerOfMordor`, src/rules/core/piles.ts): five encounter cards set beside the quest deck. Only Tribute to Mordor reveals one; the card is an encounter card as it is revealed
// and leaves play to the encounter discard pile, never back to its deck. A deck with no card left loses the game for the players when a card must be revealed.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import { NAMED_PILES, topOf } from "../../core/piles.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { startReveal } from "../../windows/frames.ts";
import { markPicked } from "../play/refs.ts";

/** RevealPowerOfMordor: the first player reveals the top card of the Power of Mordor deck (the card becomes the picked card of the running effect). With no card to reveal, `onEmpty: loseGame` loses the game. */
export function revealPowerOfMordor(state: ScenarioState, instruction: Extract<Instruction, { verb: "RevealPowerOfMordor" }>, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (state.lost) return state;
  const top = topOf(state, NAMED_PILES.powerOfMordor.deck);
  if (top === undefined) return instruction.onEmpty === "loseGame" ? { ...state, lost: true, lossReason: "No card is left in the Power of Mordor deck to reveal", window: null } : state;
  return startReveal(markPicked(state, top), state.firstPlayer, ctx, steps, top);
}
