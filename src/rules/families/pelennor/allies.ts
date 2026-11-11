// Rules: rr.in-play-and-out-of-play, rr.ownership-and-control, rr.destroy (data/rules/entries.json); ledger lines 145074:A:1, 145074:B:1, 145074:B:2, 145075:A:1.
// The allies of Retreat from Osgiliath: discarded from a player's deck into the staging area, under nobody's control, and taken back by their owners at stage 3A.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import { uniqueBlocked } from "../../core/keywords.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { queueEvent } from "../../windows/queue.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** DiscardAllyToStaging: the actor's top cards are discarded until an ally that is not in play is discarded; it joins the staging area, faceup, its owner's and nobody's to control, with its text box blank until the end of the phase. */
export function discardAllyToStaging(state: ScenarioState, _instruction: Verb<"DiscardAllyToStaging">, focus: Focus, ctx: ReduceContext, _steps: EngineStep[]): ScenarioState {
  const seat = focus.seat;
  let next = state;
  for (;;) {
    const top = next.seats[seat]?.deck[0];
    const card = top ? next.cards[top] : undefined;
    if (!top || !card) return next;
    next = queueEvent(moveCard(next, top, { zone: "discard", seat }), { trigger: "discardedFromDeck", seat, cardId: top });
    const printed = printedOf(ctx.cards, card.code);
    if (printed.type !== "ally" || uniqueBlocked(next, printed, ctx.cards)) continue;
    const staged = updateCard(moveCard(next, top, { zone: "staging" }), top, { face: "up", controller: null, owner: seat });
    return { ...staged, modifiers: [...staged.modifiers, { instanceId: top, sourceId: focus.sourceId ?? top, stat: "blankText", amount: 1, until: "endOfPhase" }] };
  }
}

/** TakeControlOfStagedAllies: each ally the actor owns in the staging area comes into their play area, exhausted. */
export function takeControlOfStagedAllies(state: ScenarioState, _instruction: Verb<"TakeControlOfStagedAllies">, focus: Focus, ctx: ReduceContext): ScenarioState {
  let next = state;
  for (const id of [...state.staging]) {
    const card = next.cards[id];
    if (!card || card.owner !== focus.seat || printedOf(ctx.cards, card.code).type !== "ally") continue;
    next = updateCard(moveCard(next, id, { zone: "play", seat: focus.seat }), id, { exhausted: true, owner: undefined });
  }
  return next;
}

/** "X is the total cost of all allies in the staging area" (145074:B:1): the printed costs added up, a card with none counting 0. */
export function stagedAlliesCost(state: ScenarioState, ctx: ReduceContext): number {
  return state.staging.reduce((total, id) => {
    const card = state.cards[id];
    const printed = card ? printedOf(ctx.cards, card.code) : undefined;
    return printed?.type === "ally" ? total + (printed.cost ?? 0) : total;
  }, 0);
}
