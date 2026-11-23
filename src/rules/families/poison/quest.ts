// Rules: hob.unconscious-characters, ltp.commit-characters (data/rules/entries.json).
import { forgetCommitted } from "../costs/pay.ts";
import { flaggedByClass } from "../../core/holder-classes.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { hasTrait } from "../../interpret/conditions.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { queueHeard } from "../quest/events.ts";
import { poisonOf } from "./poison.ts";

/** The character leaves the quest it was committed to, and hears it (the same step as the verb RemoveFromQuest). A character that is not committed is left as it is. */
export function removeFromQuest(state: ScenarioState, id: string, ctx: ReduceContext): ScenarioState {
  const card = state.cards[id];
  return card?.committed ? queueHeard(forgetCommitted(updateCard(state, id, { committed: false }), id), ctx, { trigger: "removedFromQuest", seat: card.controller, subject: id }) : state;
}

/** Settle sweep: an unconscious character, and a poisoned one that a card bars from questing (Forest Stream), is removed from the quest and adds no Willpower (agent recommendation, docs/scenarios/the-hobbit/flies-and-spiders.md, Flies and Spiders, Unconscious). Any other character that cannot quest stays as it is: the reading covers these two. */
export function sweepCommitted(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  let next = state;
  for (const card of Object.values(state.cards)) {
    if (!card.committed) continue;
    const barredPoisoned = poisonOf(state, card.id) > 0 && flaggedByClass(state, card, printedOf(ctx.cards, card.code), "cannotQuest", (trait) => hasTrait(state, card.id, trait, ctx));
    if (card.unconscious === true || barredPoisoned) next = removeFromQuest(next, card.id, ctx);
  }
  return next;
}
