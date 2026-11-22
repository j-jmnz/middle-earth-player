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

// The hero limit each contract sets, by card code, built once for an effect list (the list is never changed after it is built).
const HERO_LIMITS = new WeakMap<readonly Effect[], ReadonlyMap<string, number>>();

function heroLimitsOf(effects: readonly Effect[]): ReadonlyMap<string, number> {
  const known = HERO_LIMITS.get(effects);
  if (known) return known;
  const limits = new Map<string, number>();
  for (const effect of effects) {
    if (effect.timing !== "constant") continue;
    for (const instruction of effect.instructions) if (instruction.verb === "DeckRule" && instruction.rule.kind === "heroes" && !limits.has(effect.cardCode)) limits.set(effect.cardCode, instruction.rule.max);
  }
  HERO_LIMITS.set(effects, limits);
  return limits;
}

/** How many starting heroes a deck holding these cards may have: `heroLimit` of its contract's rules, read from an index so a list screen can ask for every card. */
export function heroLimitOfCodes(effects: readonly Effect[], codes: Iterable<string>): number {
  const limits = heroLimitsOf(effects);
  if (limits.size === 0) return 3;
  for (const code of codes) {
    const limit = limits.get(code);
    if (limit != null) return limit;
  }
  return 3;
}

// How many starting heroes the rules allow: three, unless the contract says otherwise ("You cannot choose more than 1 starting
// hero", "you may choose 4 heroes instead of 3").
export function heroLimit(rules: readonly DeckRule[]): number {
  for (const rule of rules) if (rule.kind === "heroes") return rule.max;
  return 3;
}
