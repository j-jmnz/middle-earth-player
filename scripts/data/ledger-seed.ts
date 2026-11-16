import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Card } from "../../src/catalog/card-facts.ts";
import { runScript, type Log } from "../log.ts";
import { loadCards } from "./load-cards.ts";
import { dealtCodes, loadAnyScenario, loadCampaigns } from "./load-scenarios.ts";
import { DATA_DIR } from "./paths.ts";
import { keyOf, ledgerSchema, loadLedger, type Ledger, type LedgerEntry } from "./printed/ledger.ts";
import { scanTargets, type ScanTarget } from "./printed/scope.ts";

// `pnpm data ledger-seed <scenario-id>`: writes the ledger entries a scenario's cards are missing, from the source text (Hall of Beorn's, through data/cards),
// with `readBy` empty and the pinned scan named (data/sources.json). Every seeded line is still read against its scan before the scenario is playable: the
// effect coverage test refuses a playable scenario's card whose entry has no `readBy`. Run `pnpm data sync scans` first when the scenario's scans are not pinned.

export const SEED_CONVENTIONS = [
  "One entry per code and side. Side A is the front, side B the back of a double-sided card; a shadow effect is a line of side A.",
  "lines are the ability text of the text box in print order, one ability per line: no title, traits, stats, flavor text, or Victory line. Keyword lines (Surge., Hide 2.) stay.",
  "Icons are written as the words Hall of Beorn uses (Willpower, Attack, Defense, Threat, Lore, Fellowship). Apostrophes are straight.",
  "A printed typo is written corrected in lines, and the printed wording is kept under misprints.",
  "inert lists line numbers that need no effect record, with the reason. A line that is only keywords the engine reads is owned by the keyword.",
];

// Source text to ledger lines: one per source line, straight apostrophes and quotes.
function linesOf(...texts: (string | null | undefined)[]): string[] {
  return texts
    .flatMap((text) => (text ?? "").split("\n"))
    .map((line) => line.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').trim())
    .filter((line) => line !== "");
}

/** The entry for one scanned side: the source text of the card's front (with its shadow line) or back, `readBy` empty. */
export function seedEntry(card: Card, target: ScanTarget, scan: { url: string; sha256: string }): LedgerEntry {
  const lines = target.side === "A" ? linesOf(card.text, card.shadowText) : linesOf(card.back?.text);
  return { code: target.code, side: target.side, printing: target.printing, scan, lines, inert: [], misprints: [], readBy: "", confirmedBy: null };
}

type Pins = ReadonlyMap<string, { url: string; sha256: string }>;

/** data/sources.json's pinned scans by "<code>.<side>". */
export function pinnedScans(sourcesFile = path.join(DATA_DIR, "sources.json")): Pins {
  const sources = JSON.parse(readFileSync(sourcesFile, "utf8")) as { sources: Record<string, { files: { path: string; url: string; sha256: string }[] }> };
  return new Map((sources.sources.scans?.files ?? []).map((file) => [file.path.replace(/^scans\//, "").replace(/\.(jpg|png)$/, ""), { url: file.url, sha256: file.sha256 }]));
}

/** The entries to add: every scanned side of the codes that no ledger holds yet, in code and side order. A side with no pinned scan is reported, not seeded. */
export function seedEntries(codes: ReadonlySet<string>, held: Ledger, cards: readonly Card[], pins: Pins): { entries: LedgerEntry[]; unpinned: string[] } {
  const byCode = new Map(cards.map((card) => [card.code, card]));
  const entries: LedgerEntry[] = [];
  const unpinned: string[] = [];
  const targets = scanTargets([...codes].sort()).filter((target) => !held.byKey.has(keyOf(target.code, target.side)));
  for (const target of targets) {
    const key = keyOf(target.code, target.side);
    const pin = pins.get(key);
    const card = byCode.get(target.code);
    if (!pin || !card) unpinned.push(key);
    else entries.push(seedEntry(card, target, pin));
  }
  entries.sort((a, b) => a.code.localeCompare(b.code) || a.side.localeCompare(b.side));
  return { entries, unpinned };
}

/** `file` with the seeded entries appended (a new file takes the conventions). An entry the file already holds is never rewritten. */
export function withSeeded(file: unknown | null, campaign: string, seeded: readonly LedgerEntry[]): { campaign: string; conventions: string[]; entries: LedgerEntry[] } {
  const current = file === null ? { campaign, conventions: SEED_CONVENTIONS, entries: [] } : ledgerSchema.parse(file);
  const have = new Set(current.entries.map((entry) => keyOf(entry.code, entry.side)));
  const entries = [...current.entries, ...seeded.filter((entry) => !have.has(keyOf(entry.code, entry.side)))];
  return { campaign: current.campaign, conventions: [...current.conventions], entries };
}

function main(log: Log): void {
  const id = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  if (!id) throw new Error("Usage: pnpm data ledger-seed <scenario-id>");
  const campaign = loadCampaigns().find((one) => one.scenarios.includes(id));
  if (!campaign) throw new Error(`No built campaign or cycle holds the scenario ${id}`);
  const scenario = loadAnyScenario(id);
  const file = path.join(DATA_DIR, "printed", `${campaign.id}.json`);
  const existing = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as unknown) : null;
  const codes = dealtCodes(campaign, [scenario], { nightmare: false });
  const { entries, unpinned } = seedEntries(codes, loadLedger(), loadCards(), pinnedScans());
  for (const key of unpinned) log.warn(`${key} has no pinned scan: run pnpm data sync scans`);
  const next = withSeeded(existing, campaign.id, entries);
  writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
  log.info(`${id}: ${entries.length} sides seeded into ${path.relative(process.cwd(), file)} (${next.entries.length} in all), readBy empty`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void runScript("data:ledger-seed", main);
