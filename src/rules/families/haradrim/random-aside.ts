// Rules: rr.reveal, rr.in-play-and-out-of-play, hrd.guarded-x-example (data/rules/entries.json); ledger lines 17106:A:1, 17107:A:1.
//
// The Black Serpent's Setup and stage 2A: "The first player randomly selects 1 set aside Harad objective, reveals it, and adds it to the staging area". The card is drawn by the game seed and revealed like any encounter card
// (the staging steps, so its Guarded (X) resolves); the players see the card, so the objectives left set aside are known.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { startReveal } from "../../windows/frames.ts";
import type { Focus } from "../index.ts";
import { drawRandomSetAside } from "../../core/set-aside-draw.ts";
import { printedOf } from "../../core/printed.ts";

/** RevealRandomSetAside: one set-aside card with the trait (the ids in order, one step of the seed) is revealed by the actor. Nothing happens with none set aside. */
export function revealRandomSetAside(state: ScenarioState, instruction: Extract<Instruction, { verb: "RevealRandomSetAside" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const drawn = drawRandomSetAside(state, (id) => printedOf(ctx.cards, state.cards[id]?.code ?? "").traits.includes(instruction.trait));
  return drawn ? startReveal({ ...state, seedCursor: state.seedCursor + 1 }, focus.seat, ctx, steps, drawn) : state;
}
