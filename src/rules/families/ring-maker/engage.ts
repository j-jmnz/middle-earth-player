// Rules: rr.engaged, rr.encounter-deck (data/rules/entries.json); ledger line 07047:A:1.
// Dunland Chieftain: the topmost enemy with a Trait among the cards its discard from the encounter deck just made enters play engaged with the engaged player, as if it had engaged him, so its own Forced effects hear it.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { hasTrait } from "../../interpret/conditions.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { effectData, moveEncounter } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";

/** EngageTopDiscarded: of the cards the running effect discarded (DiscardEncounterTop), the enemy with the Trait that was discarded last and still lies in the encounter discard pile is put into play engaged with the acting seat. */
export function engageTopDiscarded(state: ScenarioState, instruction: Extract<Instruction, { verb: "EngageTopDiscarded" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const found = (effectData(state)?.looked ?? []).filter((id) => state.cards[id]?.zone === "encounterDiscard" && printedOf(ctx.cards, state.cards[id]?.code ?? "").type === "enemy" && hasTrait(state, id, instruction.trait, ctx));
  const top = found.at(-1);
  return top == null ? state : moveEncounter(state, top, "engaged", focus.seat, ctx, steps);
}
