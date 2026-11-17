// Rules: sotm.guarding-gollum (data/rules/entries.json); ledger lines 02126:A:1, 02131:A:1, 900907:A:2. The words of the held mark of the player guarding Gollum (`guardianHeld`, src/play/readouts/widgets.ts).

/** What the dial of the seat guarding Gollum says: who he is guarding for, and, while a card says the guard cannot change (The Spiders' Ring, Isolation), that nobody can take Gollum from him. */
export function guardianHeldWords(who: string, locked: boolean): string {
  return `${who === "you" ? "You are" : `${who} is`} guarding Gollum${locked ? ", and the guard cannot change" : ""}`;
}
