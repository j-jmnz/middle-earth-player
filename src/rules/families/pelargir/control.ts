// Rules: ats.ally-objectives, rr.ownership-and-control, rr.staging-area (data/rules/entries.json); ledger line 05070:B:1.
// The first player takes control of the ally objectives in the staging area (Celador and the Ithilien Guardians): the one change of control that ends their commitment by their own text.
import type { Instruction } from "../../../catalog/boundary.ts";

import { printedOf } from "../../core/printed.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { hasTrait } from "../../interpret/conditions.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** TakeControlOfStagedObjectives: each objective card with the Trait in the staging area comes into the first player's play area, faceup, ready and committed to nothing. Nothing happens when there is none. */
export function takeControlOfStagedObjectives(state: ScenarioState, instruction: Verb<"TakeControlOfStagedObjectives">, ctx: ReduceContext): ScenarioState {
  let next = state;
  for (const id of [...state.staging]) {
    const card = next.cards[id];
    if (!card || printedOf(ctx.cards, card.code).type !== "objective" || !hasTrait(next, id, instruction.trait, ctx)) continue;
    next = updateCard(moveCard(next, id, { zone: "play", seat: next.firstPlayer }), id, { face: "up", exhausted: false, committed: false });
  }
  return next;
}
