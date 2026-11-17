// Rules: rr.deckbuilding (data/rules/entries.json). Whether a deck is ready to play, as the deck screens and the briefing both ask it:
// the Rules Reference's checks with its contract's deckbuilding rules (deck-save.ts, deck-rules.ts), then the loot deck a contract
// takes from the side deck (loot.ts, The Burglar's Turn).
import type { Effect } from "./boundary.ts";
import { deckRulesOf } from "./deck-rules.ts";
import { deckSaveRefusal, type DeckSaveCard, type DeckSaveEntry, type DeckSaveRefusal } from "./deck-save.ts";
import { lootRefusal, lootRuleOf } from "./loot.ts";

/**
 * The first rule the deck breaks, or null when it is ready to play. `side` is the side deck; a loadout stored before side decks has
 * none (undefined), and its loot deck is not asked for, so a game dealt then still opens.
 */
export function deckReadyRefusal(
  heroes: readonly string[],
  cards: readonly DeckSaveEntry[],
  facts: ReadonlyMap<string, DeckSaveCard>,
  effects: readonly Effect[],
  side: readonly DeckSaveEntry[] | undefined,
): DeckSaveRefusal | null {
  const codes = cards.map((card) => card.code);
  const refusal = deckSaveRefusal(heroes, cards, facts, [], deckRulesOf(effects, codes));
  if (refusal || side === undefined) return refusal;
  const loot = lootRuleOf(effects, codes);
  return loot ? lootRefusal(loot, side, facts) : null;
}
