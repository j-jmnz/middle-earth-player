// The printed lines and rule titles the table shows as causes: a card's line from the printed-text ledger (data/printed), a
// rule's title from data/rules/entries.json. Both are committed data; the phone reads no other source for them.
import printed from "../../data/printed/fellowship-of-the-ring.json";
import rules from "../../data/rules/entries.json";

import { parseRuleEntries } from "../catalog/rule-entry.ts";

type LedgerEntry = { code: string; side: string; lines: string[] };

let lines: Map<string, string> | null = null;
let titles: Map<string, string> | null = null;

/** The printed line a "<code>:<side>:<n>" ledger id names, or null when the ledger does not hold it. */
export function ledgerLine(id: string): string | null {
  if (!lines) {
    lines = new Map();
    for (const entry of (printed as { entries: LedgerEntry[] }).entries) {
      entry.lines.forEach((line, at) => lines?.set(`${entry.code}:${entry.side}:${at + 1}`, line));
    }
  }
  return lines.get(id) ?? null;
}

/** The title of a rule span id, or null when data/rules has no such span. */
export function ruleTitle(id: string): string | null {
  if (!titles) titles = new Map(parseRuleEntries(rules).map((entry) => [entry.id, entry.title]));
  return titles.get(id) ?? null;
}
