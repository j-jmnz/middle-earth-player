// Rules: rr.deckbuilding (data/rules/entries.json). A contract prints deckbuilding rules on its side A; the effect records carry
// them as `DeckRule` instructions (src/catalog/families/sidequests.ts) and deckSaveRefusal (deck-save.ts) applies them.
import type { Effect } from "./boundary.ts";
import type { DeckRule } from "./families/sidequests.ts";

export type { DeckRule };

// The deckbuilding rules of these cards (a deck's contract): the `DeckRule` instructions of their constant records.
export function deckRulesOf(effects: readonly Effect[], codes: Iterable<string>): DeckRule[] {
  const wanted = new Set(codes);
  const rules: DeckRule[] = [];
  for (const effect of effects) {
    if (effect.timing !== "constant" || !wanted.has(effect.cardCode)) continue;
    for (const instruction of effect.instructions) if (instruction.verb === "DeckRule") rules.push(instruction.rule);
  }
  return rules;
}

// How many starting heroes the rules allow: three, unless the contract says otherwise ("You cannot choose more than 1 starting
// hero", "you may choose 4 heroes instead of 3").
export function heroLimit(rules: readonly DeckRule[]): number {
  for (const rule of rules) if (rule.kind === "heroes") return rule.max;
  return 3;
}
