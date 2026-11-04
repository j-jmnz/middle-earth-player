import type { Card } from "../../src/catalog/card-facts.ts";

// A card of a box that a campaign's scenarios never deal (and no campaign, scenario or deck names) is a card whose
// lines no scenario's coverage ever sees. The check names every such card.
const PLAYER_TYPES: ReadonlySet<string> = new Set(["hero", "ally", "attachment", "event", "player-side-quest", "contract"]);

// The packs the codes' cards are printed in, `Nightmare` excluded (its deck is dealt on Nightmare only).
export function boxPacks(cards: readonly Card[], codes: Iterable<string>): Set<string> {
  const byCode = new Map(cards.map((card) => [card.code, card]));
  const packs = new Set<string>();
  for (const code of codes) for (const printing of byCode.get(code)?.printings ?? []) packs.add(printing.pack);
  packs.delete("Nightmare");
  return packs;
}

// The cards of those packs that have text and are an encounter-side card (a non-player type) or a boon or burden, and are not dealt.
export function undealtBoxCards(cards: readonly Card[], packs: ReadonlySet<string>, dealt: ReadonlySet<string>): string[] {
  return cards
    .filter((card) => card.text != null && card.text !== "")
    .filter((card) => card.printings.some((printing) => packs.has(printing.pack)))
    .filter((card) => !PLAYER_TYPES.has(card.type) || card.campaignKind != null)
    .filter((card) => !dealt.has(card.code))
    .map((card) => card.code)
    .sort();
}
