// Rules: rr.step-3-4, rr.active-location, faq.progress-without-advancing (data/rules/entries.json); ledger line 901307:A:2.
//
// "Progress that would be placed on the current quest or on Snow locations are instead placed on Blinding Blizzard. When the 5th progress is placed on Blinding Blizzard, discard it": a card in the staging area holding
// progressRedirect (its constant) takes the progress that would go on the current quest stage or on a location with the Snow trait, in play or in the staging area, from questing and from a card effect alike. A Blizzard
// takes at most what brings it to 5, is discarded as the 5th is placed, and the progress it cannot take goes on as it would have without it (the card ends the replacement itself when it leaves play; agent recommendation, docs/brief.md, The Redhorn Gate).
// With two in the staging area the one that came first takes the progress first and the other what is left (the engine asks no player in the middle of a placement).
import { ruleCause } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { destroyCard } from "../../core/keywords.ts";
import { isLocationCard, printedOf, type PrintedCard } from "../../core/printed.ts";
import { flagged, updateCard, type ScenarioState } from "../../core/state.ts";

/** The progress tokens that discard a Blinding Blizzard. */
export const BLIZZARD_LIMIT = 5;

/** `amount` progress is about to be placed on `targetId`: the Blinding Blizzards in the staging area take what they can when it is the current quest stage or a Snow location, and `remaining` is what goes on. The state is returned as it was when none is in play. */
export function redirectProgress(state: ScenarioState, targetId: string, amount: number, cards: ReadonlyMap<string, PrintedCard>, steps: EngineStep[]): { state: ScenarioState; remaining: number } {
  if (amount <= 0 || state.modifiers.length === 0) return { state, remaining: amount };
  const target = state.cards[targetId];
  if (!target) return { state, remaining: amount };
  const printed = printedOf(cards, target.code);
  if (targetId !== state.questStage && !(isLocationCard(printed) && printed.traits.includes("Snow"))) return { state, remaining: amount };
  let next = state;
  let left = amount;
  for (const id of state.staging) {
    const card = next.cards[id];
    if (!card || left <= 0 || id === targetId || !flagged(next, id, "progressRedirect")) continue;
    const put = Math.min(left, BLIZZARD_LIMIT - card.progress);
    if (put <= 0) continue;
    next = updateCard(next, id, { progress: card.progress + put });
    steps.push({ kind: "progress", targetId: id, amount: put, cause: ruleCause("rr.step-3-4") });
    left -= put;
    if (card.progress + put >= BLIZZARD_LIMIT) next = updateCard(destroyCard(next, id, cards, steps), id, { progress: 0 });
  }
  return { state: next, remaining: left };
}
