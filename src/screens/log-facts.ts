// How the Campaign Log's structured facts read on the log screen, in place of the paper log's Notes (docs/brief.md, Campaign): the cards used once
// this campaign ("Record in Campaign Log when used", 41044:A:3), and the resource tokens counted on a campaign card (41050:B:1). Pure, so a test reads it.

/** The cards used once, one per line, each named once however often the log lists it: "The Fervor of Lore". */
export function usedOnceWords(usedOnce: readonly string[], nameOf: (code: string) => string): string {
  return [...new Set(usedOnce)].map(nameOf).join("\n");
}

/** One row for each counter: the campaign card it is on and how many resource tokens it held when the scenario was won. */
export function counterRows(counters: Readonly<Record<string, number>>, nameOf: (code: string) => string): { code: string; label: string; value: string }[] {
  return Object.entries(counters).map(([code, count]) => ({ code, label: `Tokens on ${nameOf(code)}`, value: String(count) }));
}
