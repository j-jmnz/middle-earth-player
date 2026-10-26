// The printed lines and rule titles the table shows as causes: a card's line from the printed-text ledger (data/printed), a
// rule's title from data/rules/entries.json. Both are committed data; the phone reads no other source for them.
import rules from "../../data/rules/entries.json";

import { shippedLedger } from "../catalog/printed-ledger.ts";
import { parseRuleEntries } from "../catalog/rule-entry.ts";

let lines: Map<string, string> | null = null;
let titles: Map<string, string> | null = null;

/** The printed line a "<code>:<side>:<n>" ledger id names, or null when the ledger does not hold it. */
export function ledgerLine(id: string): string | null {
  if (!lines) {
    lines = new Map();
    for (const sides of shippedLedger().values()) {
      for (const entry of sides) entry.lines.forEach((line, at) => lines?.set(`${entry.code}:${entry.side}:${at + 1}`, line));
    }
  }
  return lines.get(id) ?? null;
}

/** The title of a rule span id, or null when data/rules has no such span. */
export function ruleTitle(id: string): string | null {
  if (!titles) titles = new Map(parseRuleEntries(rules).map((entry) => [entry.id, entry.title]));
  return titles.get(id) ?? null;
}
