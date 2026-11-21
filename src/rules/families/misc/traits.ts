// Rules: rr.modifiers, rr.lasting-effects (data/rules/entries.json).
//
// A Trait a card gains from a modifier rather than from an attachment: "each Gondor card in play gains the Rohan trait" (a
// lasting effect) and "Lothíriel gains the Rohan trait" (a constant), held as the flags traitRohan and traitGondor. And the
// count of different Traits a player's characters have.
import { characters } from "../../combat/combat.ts";
import { countedTraits, grantedTraits } from "../../interpret/conditions.ts";
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

// The Traits flaggedTrait finds on the card: those a traitGained modifier names, and Rohan, Gondor or Mount from their flags.
export function flaggedTraits(state: ScenarioState, id: string): string[] {
  if (state.modifiers.length === 0) return [];
  const named = state.modifiers.flatMap((modifier) => (modifier.stat === "traitGained" && modifier.trait != null && modifier.instanceId === id && modifierActive(state, modifier) ? [modifier.trait] : []));
  return [...new Set([...named, ...["Rohan", "Gondor", "Mount"].filter((trait) => flaggedTrait(state, id, trait))])];
}

/** A Trait the holder loses, printed or gained ("Attached character loses the Eagle trait", 900607:A:2): the flag `losesEagle`. */
export function lostTrait(state: ScenarioState, id: string, trait: string): boolean {
  return trait === "Eagle" && flagged(state, id, "losesEagle");
}

// Every Trait the card has now: its printed ones (unless blanked or lost) and those it gains from an attachment, a modifier or a
// "counts as" record (rr.traits). A "shares a Trait" check compares these lists, so a gained Trait counts on both sides (22027:A:2).
export function traitsOf(state: ScenarioState, id: string, ctx: ReduceContext): string[] {
  const instance = state.cards[id];
  if (instance == null) return [];
  const printed = flagged(state, id, "blanksTraits") ? [] : printedOf(ctx.cards, instance.code).traits;
  const all = new Set([...printed, ...grantedTraits(state, id, ctx), ...flaggedTraits(state, id), ...countedTraits(state, id, ctx)]);
  return [...all].filter((trait) => !lostTrait(state, id, trait));
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
    for (const trait of traitsOf(state, id, ctx)) traits.add(trait);
  }
  return traits.size;
}
