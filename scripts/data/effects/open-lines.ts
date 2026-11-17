import type { Effect } from "../../../src/catalog/boundary.ts";
import type { Card } from "../../../src/catalog/card-facts.ts";
import type { CampaignData, AnyScenarioData } from "../../../src/catalog/scenario-data.ts";
import { dealtCodes } from "../load-scenarios.ts";
import { isKeywordLine } from "../normalize/keywords.ts";
import { lineId, type Ledger } from "../printed/ledger.ts";
import { isPoolCard } from "../printed/pool.ts";

// The printed lines no effect record owns yet, for every card a game can hold: each deck-legal player card and every card
// the built scenarios deal. A line is owned by a record that names it, by keywords the engine reads (a line of keywords
// only), or by an inert mark in the box ledger. The list is src/effects/open-lines.ts, which the app reads
// for the inactive mark; every card is meant to leave it (user decision, 2026-10-26).
export function openLines(cards: readonly Card[], ledger: Ledger, campaign: CampaignData | readonly CampaignData[], scenarios: readonly AnyScenarioData[], effects: readonly Effect[]): string[] {
  const owned = new Set(effects.flatMap((effect) => effect.lines));
  const wanted = new Set([...dealtCodes(campaign, scenarios), ...cards.filter(isPoolCard).map((card) => card.code)]);
  const open: string[] = [];
  for (const entry of ledger.entries) {
    if (!wanted.has(entry.code)) continue;
    entry.lines.forEach((line, at) => {
      const id = lineId(entry.code, entry.side, at + 1);
      if (owned.has(id) || isKeywordLine(line) || entry.inert.some((mark) => mark.line === at + 1)) return;
      open.push(id);
    });
  }
  return open.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export function renderOpenLines(open: readonly string[]): string {
  return [
    `// Written by pnpm effects open from data/ and src/effects. Do not edit.`,
    `// Printed lines that no effect record owns yet ("<code>:<side>:<n>"). A card with one here shows its text as inactive.`,
    `export const OPEN_LINES: readonly string[] = [`,
    ...open.map((id) => `  "${id}",`),
    `];`,
    ``,
  ].join("\n");
}
