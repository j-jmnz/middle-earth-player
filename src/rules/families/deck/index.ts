// Rules: rr.in-play-and-out-of-play, rr.search, rr.play-and-put-into-play, rr.ownership-and-control, rr.doomed-x,
// rr.mulligan (data/rules/entries.json).
import type { Instruction } from "../../../catalog/boundary.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { actAs, addToX, discardFromDeck, givePicked, moveCardVerb, shuffleDiscardIn, shuffleHandIn, swapPicked } from "./moves.ts";
import { keepOpeningHand, playFrom } from "./play.ts";
import type { Focus } from "../index.ts";

// The verbs src/catalog/families/deck.ts adds, for the player's deck, hand and discard pile: look, arrange, search, return, play from the discard pile. Null when the verb is not one of them.
// ReducePlayCost is read when its card is played (deck-play.ts): it does nothing when run.
export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "MoveCard":
      return moveCardVerb(state, instruction, focus, ctx, steps);
    case "GivePicked":
      return givePicked(state);
    case "SwapPicked":
      return swapPicked(state);
    case "ShuffleDiscardIntoDeck":
      return shuffleDiscardIn(state, instruction, focus);
    case "ShuffleHandIntoDeck":
      return shuffleHandIn(state, focus);
    case "DiscardFromDeck":
      return discardFromDeck(state, instruction, focus, ctx);
    case "AddToX":
      return addToX(state, instruction, focus, ctx);
    case "ActAs":
      return actAs(state, instruction);
    case "PlayFrom":
      return playFrom(state, instruction, focus, ctx, steps);
    case "ReduceNextDoomed":
      // A seat's lasting effect, spent by the next Doomed event it plays (deck-rules.ts doomedRaise).
      return { ...state, modifiers: [...state.modifiers, { instanceId: `seat:${focus.seat}`, sourceId: focus.sourceId ?? `seat:${focus.seat}`, stat: "doomedReduction", amount: instruction.amount, until: instruction.until }] };
    case "KeepOpeningHand":
      return keepOpeningHand(state, focus);
    case "ReducePlayCost":
      return state;
    default:
      return null;
  }
}
