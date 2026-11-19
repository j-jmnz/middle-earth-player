// Rules: rr.reveal, rr.travel, rr.encounter-deck (data/rules/entries.json); ledger line 901506:A:2.
//
// "Reveal the topmost Tentacle enemy in the encounter discard pile to travel here": the enemy of the trait that was put on the discard pile last is revealed by the actor in full (staging, When Revealed, keywords). With none in the pile the cost cannot be paid.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { hasTrait } from "../../interpret/conditions.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { startReveal } from "../../windows/frames.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** The enemy with the trait lying topmost in the encounter discard pile (the last put there), or null. */
export function topmostInDiscard(state: ScenarioState, trait: string, ctx: ReduceContext): string | null {
  return [...state.encounterDiscard].reverse().find((id) => state.cards[id] != null && printedOf(ctx.cards, state.cards[id]!.code).type === "enemy" && hasTrait(state, id, trait, ctx)) ?? null;
}

export function revealFromDiscard(state: ScenarioState, instruction: Verb<"RevealFromDiscard">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = topmostInDiscard(state, instruction.trait, ctx);
  if (!id || state.seats[focus.seat]?.eliminated) return state;
  return startReveal(state, focus.seat, ctx, steps, id, undefined, undefined, true);
}
