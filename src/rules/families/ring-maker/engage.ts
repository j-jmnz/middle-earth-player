// Rules: rr.engaged, rr.encounter-deck (data/rules/entries.json); ledger line 07047:A:1.
// Dunland Chieftain: the topmost enemy with a Trait among the cards its discard from the encounter deck just made enters play engaged with the engaged player, as if it had engaged him, so its own Forced effects hear it.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { engageWith } from "../../quest/quest.ts";
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

/**
 * The settle sweep both engaging cards share (Mugash's Guard, 07025:A:1; the Guardians, 08036:B:1 to 08039:B:1): each enemy in the staging area or engaged with a player for which `seatOf` gives a seat engages that seat at once, whatever its engagement cost. An enemy already engaged with that seat stays,
 * one engaged with another seat moves (an enemy is engaged with one player only). `seatOf` returns null for an enemy that engages no one.
 */
export function engageEnemies(state: ScenarioState, steps: EngineStep[], seatOf: (state: ScenarioState, id: string) => number | null): ScenarioState {
  return [...state.staging, ...state.seats.flatMap((seat) => seat.engaged)].reduce((next, id) => {
    const card = next.cards[id];
    if (card?.zone !== "staging" && card?.zone !== "engaged") return next;
    const seat = seatOf(next, id);
    return seat == null || (card.zone === "engaged" && card.controller === seat) ? next : engageWith(next, seat, id, steps);
  }, state);
}
