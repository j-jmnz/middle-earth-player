import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Card } from "../../src/catalog/card-facts.ts";
import { runScript, type Log } from "../log.ts";
import { loadCards } from "./load-cards.ts";
import { isNightmareCard, nightmareDeckOf, nightmareDeckOfCode } from "./nightmare-defs.ts";
import { dealtCodes, loadAnyScenario, loadCampaigns } from "./load-scenarios.ts";
import { DATA_DIR } from "./paths.ts";
import { keyOf, ledgerSchema, loadLedger, type Ledger, type LedgerEntry } from "./printed/ledger.ts";
import { playerScopeCodes, scanTargets, type ScanTarget } from "./printed/scope.ts";
import { codesArg, packsArg } from "./sources/scans.ts";
import { parseArgs } from "../cli-args.ts";

// `pnpm data ledger-seed <scenario-id>`: writes the ledger entries a scenario's cards are missing, from the source text (Hall of Beorn's, through data/cards),
// with `readBy` empty and the pinned scan named (data/sources.json). Every seeded line is still read against its scan before the scenario is playable: the
// effect coverage test refuses a playable scenario's card whose entry has no `readBy`. Run `pnpm data sync scans` first when the scenario's scans are not pinned.
// `--pack <id>` (repeatable) seeds the deck-legal player cards of those packs into data/printed/player-cards.json instead (`pnpm data sync scans --pack <id>` pins their scans first).
// `--codes <code,code,...>` does the same for single player cards (PLAYER_CODES in printed/scope.ts).
// `--nightmare` seeds the scenario's Nightmare deck instead (data/printed/nightmare.json): a Nightmare card's scan is its proxy picture, pinned under `pictures/`
// by `pnpm data sync nightmare`, which is read when `scans/` does not hold it yet.

export const SEED_CONVENTIONS = [
  "One entry per code and side. Side A is the front, side B the back of a double-sided card; a shadow effect is a line of side A.",
  "lines are the ability text of the text box in print order, one ability per line: no title, traits, stats, flavor text, or Victory line. Keyword lines (Surge., Hide 2.) stay.",
  "Icons are written as the words Hall of Beorn uses (Willpower, Attack, Defense, Threat, Lore, Fellowship). Apostrophes are straight.",
  "A printed typo is written corrected in lines, and the printed wording is kept under misprints.",
  "inert lists line numbers that need no effect record, with the reason. A line that is only keywords the engine reads is owned by the keyword.",
];

// RingsDB's player card text marks bold and italic with tags and icons with [sphere]: the ledger writes plain words (Response:, Willpower, Tactics).
const plainOf = (line: string): string => line.replace(/<\/?[a-z]+>/g, "").replace(/\[([a-z]+)\]/g, (_, word: string) => word.charAt(0).toUpperCase() + word.slice(1));

// Source text to ledger lines: one per source line, straight apostrophes and quotes. Hall of Beorn runs a printed Escape value (The Dead Marshes) into the sentence above it.
function linesOf(...texts: (string | null | undefined)[]): string[] {
  return texts
    .flatMap((text) => (text ?? "").replace(/([.)])(Escape: \d+)$/, "$1\n$2").split("\n"))
    .map((line) => plainOf(line).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').trim())
    .filter((line) => line !== "");
}

/** The entry for one scanned side: the source text of the card's front (with its shadow line) or back, `readBy` empty. */
export function seedEntry(card: Card, target: ScanTarget, scan: { url: string; sha256: string }): LedgerEntry {
  const lines = target.side === "A" ? linesOf(card.text, card.shadowText) : linesOf(card.back?.text);
  return { code: target.code, side: target.side, printing: target.printing, scan, lines, inert: [], misprints: [], readBy: "", confirmedBy: null };
}

type Pins = ReadonlyMap<string, { url: string; sha256: string }>;

/** data/sources.json's pinned scans by "<code>.<side>". */
export function pinnedScans(sourcesFile = path.join(DATA_DIR, "sources.json"), { nightmare = false }: { nightmare?: boolean } = {}): Pins {
  const sources = JSON.parse(readFileSync(sourcesFile, "utf8")) as { sources: Record<string, { files: { path: string; url: string; sha256: string }[] }> };
  const keyed = (kind: string) => (sources.sources[kind]?.files ?? []).map((file) => [file.path.replace(/^[a-z]+\//, "").replace(/\.(jpg|png)$/, ""), { url: file.url, sha256: file.sha256 }] as const);
  // A Nightmare card's proxy picture is pinned by the `nightmare` source (sources/nightmare.ts), as its scan; the scans' own pin, once synced, wins.
  return new Map([...(nightmare ? keyed("nightmare") : []), ...keyed("scans")]);
}

/** The codes of a scenario's Nightmare deck: its setup card and its cards. */
export function nightmareDeckCodes(scenarioId: string, cards: readonly Card[]): Set<string> {
  const deck = nightmareDeckOf(scenarioId);
  if (!deck) throw new Error(`The scenario ${scenarioId} has no Nightmare deck (scripts/data/nightmare-defs.ts)`);
  return new Set(cards.filter((card) => isNightmareCard(card) && nightmareDeckOfCode(card.code) === deck).map((card) => card.code));
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

/** The indent a ledger file is written with (nightmare.json uses one space), so seeding leaves the entries it holds byte-identical. */
export function indentOf(raw: string | null): number {
  return /^( +)"/m.exec(raw ?? "")?.[1]?.length ?? 2;
}

/** `file` with the seeded entries appended (a new file takes the conventions). An entry the file already holds is never rewritten. */
export function withSeeded(file: unknown | null, campaign: string, seeded: readonly LedgerEntry[]): { campaign: string; conventions: string[]; entries: LedgerEntry[] } {
  const current = file === null ? { campaign, conventions: SEED_CONVENTIONS, entries: [] } : ledgerSchema.parse(file);
  const have = new Set(current.entries.map((entry) => keyOf(entry.code, entry.side)));
  const entries = [...current.entries, ...seeded.filter((entry) => !have.has(keyOf(entry.code, entry.side)))];
  return { campaign: current.campaign, conventions: [...current.conventions], entries };
}

export const PLAYER_LEDGER_ID = "player-cards";

export const LEDGER_SEED_USAGE = "Usage: pnpm data ledger-seed <scenario-id> [--nightmare] | --pack <pack>... | --codes <code,code,...>";

/** The arguments of a run: a misspelt flag (`--nightmar` would seed the campaign's ledger) throws, and `--help` asks for the usage. */
export function ledgerSeedArguments(args: readonly string[]): { id: string | undefined; nightmare: boolean; help: boolean } {
  const parsed = parseArgs(args, LEDGER_SEED_USAGE, { flags: ["nightmare"], spaced: ["pack", "codes"] });
  return { id: parsed.positional[0], nightmare: parsed.flags.has("nightmare"), help: parsed.help };
}

function main(log: Log): void {
  const args = process.argv.slice(2);
  const { id, nightmare, help } = ledgerSeedArguments(args);
  if (help) {
    log.info(LEDGER_SEED_USAGE);
    return;
  }
  const packs = packsArg(args);
  const listed = codesArg(args);
  const player = packs.length > 0 || listed.length > 0;
  if (!id && !player) throw new Error(LEDGER_SEED_USAGE);
  const cards = loadCards();
  const campaign = id ? loadCampaigns().find((one) => one.scenarios.includes(id)) : undefined;
  if (!player && !campaign && !nightmare) throw new Error(`No built campaign or cycle holds the scenario ${id}`);
  const ledgerId = player ? PLAYER_LEDGER_ID : nightmare ? "nightmare" : (campaign?.id ?? (id as string));
  const label = player ? [...(packs.length > 0 ? [`packs ${packs.join(", ")}`] : []), ...(listed.length > 0 ? [`codes ${listed.join(", ")}`] : [])].join(" and ") : `${id}${nightmare ? " (Nightmare)" : ""}`;
  const file = path.join(DATA_DIR, "printed", `${ledgerId}.json`);
  const raw = existsSync(file) ? readFileSync(file, "utf8") : null;
  const existing = raw === null ? null : (JSON.parse(raw) as unknown);
  const codes = player ? new Set(playerScopeCodes(packs, listed, cards)) : nightmare ? nightmareDeckCodes(id as string, cards) : dealtCodes(campaign as NonNullable<typeof campaign>, [loadAnyScenario(id as string)], { nightmare: false });
  const { entries, unpinned } = seedEntries(codes, loadLedger(), cards, pinnedScans(undefined, { nightmare }));
  for (const key of unpinned) log.warn(`${key} has no pinned scan: run pnpm data sync ${nightmare ? "nightmare" : player ? `scans${packs.map((pack) => ` --pack ${pack}`).join("")}${listed.length > 0 ? ` --codes ${listed.join(",")}` : ""}` : "scans"}`);
  const next = withSeeded(existing, ledgerId, entries);
  writeFileSync(file, `${JSON.stringify(next, null, indentOf(raw))}\n`);
  log.info(`${label}: ${entries.length} sides seeded into ${path.relative(process.cwd(), file)} (${next.entries.length} in all), readBy empty`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void runScript("data:ledger-seed", main);
