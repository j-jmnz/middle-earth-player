import type { Card } from "../../../src/catalog/card-facts.ts";
import { titleKey } from "./names.ts";

// The Dream-chaser Campaign Expansion reprints some cards of the Adventure Packs with a "Campaign Mode only" or "Upgraded" side (the
// rulebook's p29; docs/plans/dream-chaser.md, Facts). A reprint has the code `110` and its collector number (data/overrides.json,
// productCodes) and is the same card as its original: same name, type and encounter set. A campaign game deals the reprint where one
// exists; standalone play deals the original, which is what a scenario's piles name (ScenarioData.reprints maps one to the other).
export const isReprint = (card: Pick<Card, "code" | "printings">): boolean => /^110\d{3}$/.test(card.code) && card.printings.some((printing) => printing.pack === "DCCE");

// Original code -> reprint code.
export function reprintsOf(cards: readonly Card[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const reprint of cards.filter(isReprint)) {
    const originals = cards.filter(
      (card) => !isReprint(card) && card.type === reprint.type && card.encounterSet === reprint.encounterSet && titleKey(card.name) === titleKey(reprint.name) && card.printings.every((printing) => printing.pack !== "DCCE"),
    );
    const only = originals.length === 1 ? originals[0] : undefined;
    if (only) out.set(only.code, reprint.code);
  }
  return out;
}
