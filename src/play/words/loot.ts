// The Burglar's Turn (22024:B:2, B:3): the pill on a location its loot guards, and the pill on the contract while its loot deck lasts.
// Same shape as the held pill (words/scenarios/sea.ts): the text on the card, and the sentence a screen reader hears after its name.

/** "2 loot" on a location, and "Elven Mail and Ring Mail guarding it as loot" after its name. */
export function lootGuardWords(names: readonly string[]): { text: string; loses: boolean; speech: string } {
  return { text: `${names.length} loot`, loses: false, speech: `${names.join(" and ")} guarding it as loot` };
}

/** "11 loot" on the contract, and "11 cards left in the loot deck" after its name. */
export function lootDeckWords(left: number): { text: string; loses: boolean; speech: string } {
  return { text: `${left} loot`, loses: false, speech: `${left === 0 ? "No cards" : left === 1 ? "1 card" : `${left} cards`} left in the loot deck` };
}
