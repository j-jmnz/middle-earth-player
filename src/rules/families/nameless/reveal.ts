// Rules: rr.reveal, rr.travel, rr.encounter-deck, dwd.nameless-enemies (data/rules/entries.json); ledger line 901706:A:2.
//
// Nest of Horrors' Travel: each player at the stage discards the top card of the encounter deck, then each Nameless enemy discarded that way is revealed.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { hasTrait } from "../../interpret/conditions.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { patchTop } from "../../windows/windows.ts";
import { startReveal } from "../../windows/frames.ts";
import { effectData } from "../encounter/moves.ts";
import { sharing } from "../breaking/areas.ts";
import { queueFront } from "../play/refs.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** DiscardEncounterPerPlayer: one card from the top of the encounter deck for each player at the source's stage goes to the encounter discard pile; they are the cards the effect looked at. */
export function discardEncounterPerPlayer(state: ScenarioState, focus: Focus): ScenarioState {
  let next = state;
  const ids: string[] = [];
  for (let taken = 0; taken < sharing(state, focus.seat).length; taken += 1) {
    const id = next.encounterDeck[0];
    if (id === undefined) break;
    ids.push(id);
    next = updateCard(moveCard(next, id, { zone: "encounterDiscard" }), id, { face: "up", controller: null });
  }
  const data = effectData(next);
  return data ? patchTop(next, { data: { ...data, looked: ids } }) : next;
}

/** RevealDiscarded: the actor reveals the next enemy of the trait among the cards the effect discarded that still lie in the discard pile, and the verb comes round again while more are left. */
export function revealDiscarded(state: ScenarioState, instruction: Verb<"RevealDiscarded">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const options = (effectData(state)?.looked ?? []).filter((id) => state.cards[id]?.zone === "encounterDiscard" && printedOf(ctx.cards, state.cards[id]?.code ?? "").type === "enemy" && hasTrait(state, id, instruction.trait, ctx));
  const first = options[0];
  if (first === undefined || state.seats[focus.seat]?.eliminated) return state;
  const more = options.length > 1 ? queueFront(state, [{ instruction, seat: focus.seat, chosen: null }]) : state;
  return startReveal(more, focus.seat, ctx, steps, first, undefined, undefined, true);
}
