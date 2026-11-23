// The Burglar's Turn (22024:B:2, B:3): the pill on a location its loot guards, and the pill on the contract while its loot deck lasts.
// Same shape as the held pill (words/scenarios/sea.ts): the text on the card, and the sentence a screen reader hears after its name.

/** "2 loot" on a location, and "Elven Mail and Ring Mail guarding it as loot" after its name. */
export function lootGuardWords(names: readonly string[]): { text: string; loses: boolean; speech: string } {
  return { text: `${names.length} loot`, loses: false, speech: `${names.join(" and ")} guarding it as loot` };
}

/** The choice at Setup when the side deck offers more than the loot deck's size (22024:A:2): the card to leave out, and how many more. */
export function lootLeaveOutWords(options: number, size: number): { verb: string; prompt: string } {
  const out = options - size;
  return { verb: "Leave out", prompt: `Choose ${out === 1 ? "an attachment" : `${out} attachments, one at a time,`} to leave out of your loot deck. The other ${size} are shuffled into it.` };
}

/** "11 left" on the contract, and "11 cards left in the loot deck" after its name. */
export function lootDeckWords(left: number): { text: string; loses: boolean; speech: string } {
  return { text: `${left} left`, loses: false, speech: `${left === 0 ? "No cards" : left === 1 ? "1 card" : `${left} cards`} left in the loot deck` };
}

/** The label of a loot card in its location's preview, where an attachment says "Attachment". */
export const LOOT_ROLE = "Guarded loot";
