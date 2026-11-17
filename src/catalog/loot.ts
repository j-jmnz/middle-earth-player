// Rules: rr.deckbuilding (data/rules/entries.json). The Rules Reference has no contract span; this follows The Burglar's Turn
// (22024:A:2): "Setup: Choose 14 different Item or Artifact attachments from your collection and shuffle them together. This is your
// loot deck." The app keeps no collection, so the deck's side deck stands for it (the sideboard is the loot deck, as OCTGN plays it):
// the deck is not ready to play until its side deck holds at least that many different titles that qualify. The start deals one of each
// (StartSeat.loot), and with more than the size the player leaves the rest out at Setup (src/rules/families/sidequests/loot.ts). Other
// cards in the side deck are left alone.
import type { Effect } from "./boundary.ts";
import { traitTokens, type DeckSaveCard, type DeckSaveRefusal } from "./deck-save.ts";

/** What a loot deck is made of: `size` different cards of `type` with one of `traits`, and the card that asks for it. */
export type LootRule = { cardCode: string; size: number; type: string; traits: readonly string[] };

type Entry = { code: string; count: number };
type Facts = ReadonlyMap<string, Pick<DeckSaveCard, "name" | "typeCode" | "traits">>;

// The BuildLootDeck instruction of a Setup record of one of these cards (the deck's contract), or null.
export function lootRuleOf(effects: readonly Effect[], codes: Iterable<string>): LootRule | null {
  const wanted = new Set(codes);
  for (const effect of effects) {
    if (effect.timing !== "setup" || !wanted.has(effect.cardCode)) continue;
    for (const instruction of effect.instructions) {
      if (instruction.verb === "BuildLootDeck") return { cardCode: effect.cardCode, size: instruction.size, type: instruction.type, traits: instruction.traits };
    }
  }
  return null;
}

/** Whether this card can go in the loot deck: the rule's card type, with one of its traits. */
export function qualifiesForLoot(rule: LootRule, fact: Pick<DeckSaveCard, "typeCode" | "traits"> | undefined): boolean {
  if (!fact || fact.typeCode !== rule.type) return false;
  const traits = traitTokens(fact.traits);
  return rule.traits.some((trait) => traits.includes(trait));
}

/** The side deck's cards that qualify, one code for each title, in the side deck's order. */
export function lootCodes(rule: LootRule, side: readonly Entry[], facts: Facts): string[] {
  const titles = new Set<string>();
  const codes: string[] = [];
  for (const { code, count } of side) {
    const fact = facts.get(code);
    if (count < 1 || !fact || !qualifiesForLoot(rule, fact) || titles.has(fact.name)) continue;
    titles.add(fact.name);
    codes.push(code);
  }
  return codes;
}

// "Item or Artifact": the traits as the card prints them.
function traitWords(traits: readonly string[]): string {
  return traits.length <= 1 ? (traits[0] ?? "") : `${traits.slice(0, -1).join(", ")} or ${traits.at(-1)}`;
}

/** "14 different Item or Artifact attachments": what the loot deck is made of. */
export function lootWords(rule: LootRule): string {
  return `${rule.size} different ${traitWords(rule.traits)} ${rule.type}s`;
}

/** The refusal while the side deck holds fewer titles than the loot deck the rule asks for, or null. Named for the contract. */
export function lootRefusal(rule: LootRule, side: readonly Entry[], facts: Facts): DeckSaveRefusal | null {
  const found = lootCodes(rule, side, facts).length;
  if (found >= rule.size) return null;
  return { cardCode: rule.cardCode, cardName: facts.get(rule.cardCode)?.name ?? null, rule: `The side deck needs at least ${lootWords(rule)} for the loot deck (it has ${found}).` };
}
