// Rules: mec108.side-quests-in-play, faq.simultaneous-effects (data/rules/entries.json); ledger line 10101:A:1. "While Forbidden Descent is in the staging area, the first 2 progress that would be placed on a quest each round must be placed on Forbidden Descent, instead":
// every progress that would land on a quest card (the main quest card or a side quest: from questing, from a card effect) first fills the sponges in the staging area, 2 each round for each copy, in the order the copies were added; what they cannot take goes on.
import { ruleCause } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { addModifier } from "../../core/keywords.ts";
import { flagged, heldAmount, updateCard, type ScenarioState } from "../../core/state.ts";

/** The progress a card in the staging area with `progressSponge` takes each round. */
export const SPONGE_ROUND = 2;

/** `amount` progress is about to be placed on a quest card: the sponges in the staging area take what they can, and `remaining` is what goes on. The state is returned as it was when no sponge is in play. */
export function absorbProgress(state: ScenarioState, amount: number, steps: EngineStep[]): { state: ScenarioState; remaining: number } {
  if (amount <= 0 || state.modifiers.length === 0) return { state, remaining: amount };
  let next = state;
  let left = amount;
  for (const id of state.staging) {
    const card = next.cards[id];
    if (!card || left <= 0 || !flagged(next, id, "progressSponge")) continue;
    const put = Math.min(left, SPONGE_ROUND - heldAmount(next, id, "spongeTaken"));
    if (put <= 0) continue;
    next = addModifier(updateCard(next, id, { progress: card.progress + put }), id, id, "spongeTaken", put, "endOfRound");
    steps.push({ kind: "progress", targetId: id, amount: put, cause: ruleCause("mec108.side-quests-in-play") });
    left -= put;
  }
  return { state: next, remaining: left };
}
