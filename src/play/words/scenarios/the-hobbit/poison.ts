// Rules: hob.venom-poison, hob.unconscious-characters (data/rules/entries.json). The lines of the log and the banner for a character given poison and one made unconscious or readied from it.

/** "Bilbo Baggins gets 1 poison (1 of 3)": the poison the character has now of its printed hit points. */
export function poisonLine(card: string, count: number, hitPoints: number): string {
  return hitPoints > 0 ? `${card} gets 1 poison (${count} of ${hitPoints})` : `${card} gets 1 poison`;
}

/** "Arwen is made unconscious" and "Arwen is readied and no longer unconscious". */
export function unconsciousLine(card: string, ready: boolean): string {
  return ready ? `${card} is readied and no longer unconscious` : `${card} is made unconscious`;
}
