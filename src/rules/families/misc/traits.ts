// Rules: rr.modifiers, rr.lasting-effects (data/rules/entries.json).
//
// A Trait a card gains from a modifier rather than from an attachment: "each Gondor card in play gains the Rohan trait" (a
// lasting effect) and "Lothíriel gains the Rohan trait" (a constant), held as the flags traitRohan and traitGondor. And the
// count of different Traits a player's characters have.
import { characters } from "../../combat/combat.ts";
import { grantedTraits } from "../../interpret/conditions.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged, modifierActive } from "../../core/state.ts";

export function flaggedTrait(state: ScenarioState, id: string, trait: string): boolean {
  if (state.modifiers.length === 0) return false;
  if (state.modifiers.some((modifier) => modifier.stat === "traitGained" && modifier.trait === trait && modifier.instanceId === id && modifierActive(state, modifier))) return true;
  if (trait === "Rohan") return flagged(state, id, "traitRohan");
  if (trait === "Gondor") return flagged(state, id, "traitGondor");
  if (trait === "Mount") return flagged(state, id, "traitMount");
  return false;
}

/** A Trait the holder loses, printed or gained ("Attached character loses the Eagle trait", 900607:A:2): the flag `losesEagle`. */
export function lostTrait(state: ScenarioState, id: string, trait: string): boolean {
  return trait === "Eagle" && flagged(state, id, "losesEagle");
}

// "When counting the number of Dwarf characters you control, Bombur counts as two": the extra cards a count of Dwarf characters
// gets from the cards that hold countsAsTwoDwarves.
export function countsExtra(state: ScenarioState, found: readonly string[], spec: { trait?: string | undefined; control: string }): number {
  if (spec.trait !== "Dwarf" || spec.control === "other" || state.modifiers.length === 0) return 0;
  return found.filter((id) => flagged(state, id, "countsAsTwoDwarves")).length;
}

// The different Traits the characters a seat controls have between them, the ones they gain included ("a total of at least 9
// different Traits between them", 17064:A:1).
export function distinctTraitCount(state: ScenarioState, seat: number, ctx: ReduceContext): number {
  const traits = new Set<string>();
  for (const id of characters(state, seat, ctx.cards)) {
    const card = state.cards[id];
    if (!card) continue;
    for (const trait of printedOf(ctx.cards, card.code).traits) traits.add(trait);
    for (const trait of grantedTraits(state, id, ctx)) traits.add(trait);
    for (const trait of ["Rohan", "Gondor"]) if (flaggedTrait(state, id, trait)) traits.add(trait);
  }
  return traits.size;
}
