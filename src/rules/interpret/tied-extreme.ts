// The Pick filters that keep the lowest or highest card (lowestAflame, highestAttack, lowestAttack, lowestThreat): one tied-extreme filter, so the chooser decides only among the cards that tie.

/** Of the cards that matched, those whose value is the lowest or the highest; every one when tied. `valueOf` gives a card the number to compare (the caller says what a card with none counts as). */
export function tiedExtreme(found: readonly string[], valueOf: (id: string) => number, which: "lowest" | "highest"): string[] {
  const values = found.map(valueOf);
  const extreme = which === "lowest" ? Math.min(...values) : Math.max(...values);
  return found.filter((_id, at) => values[at] === extreme);
}
