// Rules: rr.gains, rr.attachment-cards (data/rules/entries.json).
//
// A hero that gains the game text of a hero card attached to its Thorongil (22146:A:2): the records of the lent card are its own
// besides the ones it has. The card the attachment lends sits set aside (misc-collection.ts); only an attachment still on the hero
// lends, so the text goes with Thorongil.
import type { Effect } from "../../catalog/boundary.ts";

import { effectsOf } from "../listen.ts";
import { recordsOfFace } from "./dreamchaser-faces.ts";
import type { CardInstance, ScenarioState } from "../state.ts";

// The hero card an attachment of this card lends it, or null.
export function lentCard(state: ScenarioState, instance: CardInstance): CardInstance | null {
  for (const id of instance.attachments) {
    const lent = state.cards[id]?.lends;
    if (lent && state.cards[lent]) return state.cards[lent] ?? null;
  }
  return null;
}

// The effect records of a card: those of its own code, and those of a hero card its attachments lend it.
export function effectsOfCard(state: ScenarioState, ctx: { effects: readonly Effect[] }, instance: CardInstance): readonly Effect[] {
  // A card shows one side (families/dreamchaser-faces.ts): the records of the side it does not show do not work.
  const own = recordsOfFace(instance, effectsOf(ctx, instance.code));
  if (instance.attachments.length === 0) return own;
  const lent = lentCard(state, instance);
  return lent ? [...own, ...effectsOf(ctx, lent.code)] : own;
}
