// Rules: rr.blank (data/rules/entries.json); ledger line 09054:A:1. "Treat each damaged character's printed text box as if it were blank, except for keywords and Traits": the card's own blankText modifier blanks the text box, and a `keepsKeywords` modifier on the same holders keeps the
// keywords it prints (core/keyword-flags.ts hasKeyword reads it).
import { heldBy } from "../../core/holder-classes.ts";
import { printedOf, type PrintedCard } from "../../core/printed.ts";
import { modifierActive, type ScenarioState } from "../../core/state.ts";

/** Whether a modifier on this card (or on a class of cards it belongs to) keeps its printed keywords although its text box is blank. */
export function keywordsKept(state: ScenarioState, id: string, cards: ReadonlyMap<string, PrintedCard>): boolean {
  const instance = state.cards[id];
  if (!instance) return false;
  for (const modifier of state.modifiers) {
    if (modifier.stat !== "keepsKeywords" || modifier.amount <= 0 || !modifierActive(state, modifier)) continue;
    if (modifier.instanceId === id || heldBy(modifier, instance, printedOf(cards, instance.code))) return true;
  }
  return false;
}
