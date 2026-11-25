// Rules: rr.reveal, rr.guarded, rr.encounter-deck, rr.the-word-choose (data/rules/entries.json); ledger line 07067:B:2.
// The Angry Forest's Forced effect: each player chooses an enemy or objective lying in the encounter discard pile and reveals it, so Mugash found there is revealed as an objective (his Guarded resolves) and joins the staging area.
import type { Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { distinctChoices } from "../../core/state.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { askTarget } from "../../windows/choices.ts";
import { startReveal } from "../../windows/frames.ts";
import { effectData } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/**
 * RevealChosenFromDiscard: the actor chooses one card of the listed types in the encounter discard pile (asked when two different titles lie there; with one title it goes at once) and reveals it in full, wherever its type puts it. An eliminated actor, or a pile with no such card,
 * does nothing. Each player's own run takes a different card, as the one revealed has left the pile.
 */
export function revealChosenFromDiscard(state: ScenarioState, instruction: Verb<"RevealChosenFromDiscard">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (state.seats[focus.seat]?.eliminated) return state;
  const found = state.encounterDiscard.filter((id) => state.cards[id] != null && instruction.types.includes(printedOf(ctx.cards, state.cards[id]!.code).type as (typeof instruction.types)[number]));
  if (found.length === 0) return state;
  const options = distinctChoices(state, found);
  const chosen = focus.chosen != null && found.includes(focus.chosen) ? focus.chosen : options.length === 1 || !effectData(state) ? options[0] : undefined;
  if (chosen == null) return askTarget(state, { instruction, seat: focus.seat, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, options);
  return startReveal(state, focus.seat, ctx, steps, chosen, undefined, undefined, true);
}
