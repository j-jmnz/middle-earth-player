// How the Campaign Log's structured facts read on the log screen, in place of the paper log's Notes (docs/brief.md, Campaign): the cards used once
// this campaign ("Record in Campaign Log when used", 41044:A:3). Pure, so a test reads it.

/** The cards used once, one per line, each named once however often the log lists it: "The Fervor of Lore". */
export function usedOnceWords(usedOnce: readonly string[], nameOf: (code: string) => string): string {
  return [...new Set(usedOnce)].map(nameOf).join("\n");
}

/** A pool card as the path and the log read it: "The Fervor of Lore on Gimli", and "· used" once its once-per-campaign Action is recorded as used. */
export function poolCardWords(card: { code: string; attachedTo?: string | null }, usedOnce: readonly string[], nameOf: (code: string) => string): string {
  const named = card.attachedTo ? `${nameOf(card.code)} on ${nameOf(card.attachedTo)}` : nameOf(card.code);
  return usedOnce.includes(card.code) ? `${named} · used` : named;
}
