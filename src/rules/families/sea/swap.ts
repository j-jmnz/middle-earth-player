// Rules: dcce.from-sea-to-land, rr.victory, rr.destroy, rr.discard-pile-and-victory-display (data/rules/entries.json); ledger lines 12148:A:1 and 12148:B:1. The Coast of Umbar's second encounter deck takes the place of the
// first at stage 2B: the first deck and its discard pile are set aside, inactive, with the cards the stage's search carries across, and the ships and the sea leave play.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { AmountScope } from "../../interpret/amounts.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay, updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { moveEncounter } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** SetAsideEncounterDeck: the encounter deck and its discard pile are set aside, facedown, inactive (the Corsair piles are not part of them). The copies of the `carry` codes found there stay in the encounter deck,
 * those from the discard pile moving to it: "search the encounter deck and discard pile for each copy of Battle-hardened and each copy of Watch Tower, and shuffle them into the second encounter deck" (12148:B:1).
 * Copies in play are not looked at. The second deck joins the encounter deck after this (ShuffleSetAsideSet, then EndCorsairDeck for the Corsair piles). */
export function setAsideEncounterDeck(state: ScenarioState, instruction: Verb<"SetAsideEncounterDeck">): ScenarioState {
  const carry = new Set(instruction.carry ?? []);
  let next = state;
  for (const id of [...state.encounterDeck, ...state.encounterDiscard]) {
    const card = state.cards[id];
    if (!card) continue;
    if (!carry.has(card.code)) next = updateCard(moveCard(next, id, { zone: "setAside" }), id, { face: "down", controller: null });
    else if (card.zone === "encounterDiscard") next = updateCard(moveCard(next, id, { zone: "encounterDeck" }), id, { face: "down" });
  }
  return next;
}

/** DiscardAllInPlay: each card in play that matches the pick is discarded as an encounter card is (not destroyed: no Victory display, no "when destroyed" effect, rr.destroy, rr.victory), its attachments with it. */
export function discardAllInPlay(state: ScenarioState, instruction: Verb<"DiscardAllInPlay">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = state;
  for (const id of pickCandidates(state, instruction.pick, focus.seat, [], focus.sourceId, ctx)) {
    const card = next.cards[id];
    if (card && inPlay(card.zone)) next = moveEncounter(next, id, "discard", focus.seat, ctx, steps);
  }
  return next;
}

/** The `damageOn` amount: the damage tokens on the cards that match, added up. */
export function damageOnMatching(state: ScenarioState, pick: Verb<"DiscardAllInPlay">["pick"], scope: AmountScope, ctx: ReduceContext): number {
  return pickCandidates(state, pick, scope.actor, [], scope.sourceId, ctx, undefined, undefined, true).reduce((sum, id) => sum + (state.cards[id]?.damage ?? 0), 0);
}
