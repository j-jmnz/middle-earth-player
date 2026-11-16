// Rules: rr.damage, rr.forced, rr.cannot (data/rules/entries.json); ledger lines 02064:A:3, 900608:A:2.
//
// What shapes the damage one heal effect takes off a card, beside the table-wide `healCap` (dreamchaser/heal-cap.ts): the flag `healCapPerEffect` (Wilyador "cannot be healed of more than 5 wounds by a single
// effect") caps each heal, and the flag `healReducedToOne` (an attachment such as Noxious Supplies: "When attached character is healed by a card effect other than Athelas, the amount of damage healed is
// reduced to 1. Then, discard Noxious Supplies") cuts a heal to 1 and names the attachment that is then discarded. Both are read by `healDamage`, the one place every heal goes through.
import { heldLeast, modifierActive } from "../../core/state.ts";
import type { ScenarioState } from "../../core/state.ts";
import { printedOf } from "../../core/printed.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";

// Where a heal comes from: the card whose effect heals (`sourceId`), and `athelas` when the heal counts as an Athelas heal although its card is not named Athelas (the final stage of A Journey to Rhosgobel, 02062:B:1).
export type HealBy = { sourceId?: string | null; athelas?: boolean };

// The most one heal effect may take off the card (the amount itself with no cap).
export function perEffectCap(state: ScenarioState, id: string, amount: number): number {
  const cap = heldLeast(state, id, "healCapPerEffect");
  return cap > 0 ? Math.min(amount, cap) : amount;
}

// The attachment whose Forced reduces this heal to 1 and is discarded after it: none when the heal is an Athelas heal or no such attachment is on the card. The oldest holder first.
export function healReducer(state: ScenarioState, id: string, by: HealBy | undefined, ctx: ReduceContext): string | null {
  if (by?.athelas === true) return null;
  const source = by?.sourceId ? state.cards[by.sourceId] : undefined;
  if (source && printedOf(ctx.cards, source.code).name === "Athelas") return null;
  const holders = state.modifiers.filter((modifier) => modifier.stat === "healReducedToOne" && modifier.instanceId === id && modifier.amount > 0 && modifierActive(state, modifier) && state.cards[modifier.sourceId] != null);
  return holders[0]?.sourceId ?? null;
}
