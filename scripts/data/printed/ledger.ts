import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { z } from "zod";

import { DATA_DIR, SCAN_CACHE_DIR } from "../paths.ts";
import { sha256 } from "../sources/fetch.ts";

// The printed-text ledger: what is printed on a card, read from its scan by an agent. data/printed/<campaign>.json.
// A line has the id "<code>:<side>:<n>", n counting from 1 in the entry's `lines`.
export const ledgerEntrySchema = z.strictObject({
  code: z.string().min(1),
  side: z.enum(["A", "B"]),
  // The pack whose printing the scan shows.
  printing: z.string().min(1),
  scan: z.strictObject({ url: z.string().url(), sha256: z.string().regex(/^[0-9a-f]{64}$/) }),
  lines: z.array(z.string().min(1)),
  // Lines that need no effect record.
  // `keyword` names a card keyword (card.keywords) that owns the line; the coverage test checks the card has it.
  inert: z.array(z.strictObject({ line: z.number().int().positive(), reason: z.string().min(1), keyword: z.string().optional() })),
  // Typos on the card itself. `lines` holds the corrected reading, this the printed wording of that line.
  misprints: z.array(z.strictObject({ line: z.number().int().positive(), printed: z.string().min(1) })),
  readBy: z.string().min(1),
  // "user" for a call the user made, "sources" for one settled from several sources (named in basis), else null.
  confirmedBy: z.enum(["user", "sources"]).nullable(),
  basis: z.array(z.string().min(1)).optional(),
  notes: z.string().optional(),
  // Dream-chaser's encounter cards: how many Sailing success symbols the card prints in the bottom left corner of its text box (Calm Waters
  // prints two), which a Sailing test counts (dcce.sailing-tests). No source carries it, so the reader records it, 0 included, for every
  // card the encounter deck can hold.
  sailingSuccess: z.number().int().nonnegative().optional(),
  // The Return of the King's encounter cards: how many Sauron's Eye icons the card prints in the bottom left corner of its text box (Orc-hold prints one,
  // The Lidless Eye two), which a Fortitude test counts (mec113.fortitude-tests). The line that prints the icon in its text is written with the words Sauron's Eye.
  eyeIcons: z.number().int().nonnegative().optional(),
});
export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;

export const ledgerSchema = z.strictObject({
  campaign: z.string().min(1),
  conventions: z.array(z.string()),
  entries: z.array(ledgerEntrySchema),
});
// `campaign` names the ledger files it holds: one id for a single file, the ids joined by "+" for the merged ledger.
export type Ledger = { campaign: string; entries: LedgerEntry[]; byKey: ReadonlyMap<string, LedgerEntry> };

export const keyOf = (code: string, side: string): string => `${code}.${side}`;
export const lineId = (code: string, side: string, n: number): string => `${code}:${side}:${n}`;

export function parseLedger(raw: unknown): Ledger {
  const parsed = ledgerSchema.parse(raw);
  const byKey = new Map<string, LedgerEntry>();
  for (const entry of parsed.entries) {
    const key = keyOf(entry.code, entry.side);
    if (byKey.has(key)) throw new Error(`Ledger has two entries for ${key}`);
    for (const mark of [...entry.inert, ...entry.misprints]) {
      if (mark.line > entry.lines.length) throw new Error(`Ledger ${key}: line ${mark.line} does not exist`);
    }
    if (entry.confirmedBy === "sources" && (entry.basis?.length ?? 0) === 0) throw new Error(`Ledger ${key}: confirmed by sources without a basis`);
    byKey.set(key, entry);
  }
  return { campaign: parsed.campaign, entries: parsed.entries, byKey };
}

// Reads every data/printed/*.json and merges them. A card side is read once: two files holding the same key fail, so the
// campaigns that share cards (the Oath is in two) cannot disagree about what is printed on them.
export function loadLedger(dataDir = DATA_DIR): Ledger {
  const dir = path.join(dataDir, "printed");
  const ledgers = readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => ({ name, ledger: parseLedger(JSON.parse(readFileSync(path.join(dir, name), "utf8")) as unknown) }));
  return mergeLedgers(ledgers);
}

export function mergeLedgers(ledgers: readonly { name: string; ledger: Ledger }[]): Ledger {
  const byKey = new Map<string, LedgerEntry>();
  const owner = new Map<string, string>();
  const entries: LedgerEntry[] = [];
  for (const { name, ledger } of ledgers) {
    for (const entry of ledger.entries) {
      const key = keyOf(entry.code, entry.side);
      if (byKey.has(key)) throw new Error(`Ledger ${name} and ${owner.get(key) ?? "?"} both hold ${key}`);
      byKey.set(key, entry);
      owner.set(key, name);
      entries.push(entry);
    }
  }
  return { campaign: ledgers.map(({ ledger }) => ledger.campaign).join("+"), entries, byKey };
}

type Pinned = { path: string; url: string; sha256: string };

// The build fails when a ledgered scan is no longer the one pinned in data/sources.json, and, when the scan
// is cached, when the cached file no longer hashes to it.
export function verifyScans(ledger: Ledger, sourcesFile = path.join(DATA_DIR, "sources.json")): string[] {
  const sources = JSON.parse(readFileSync(sourcesFile, "utf8")) as { sources: Record<string, { files: Pinned[] }> };
  const pinned = new Map((sources.sources.scans?.files ?? []).map((file) => [file.path.replace(/^scans\//, "").replace(/\.(jpg|png)$/, ""), file]));
  const problems: string[] = [];
  for (const entry of ledger.entries) {
    const key = keyOf(entry.code, entry.side);
    const pin = pinned.get(key);
    if (!pin) problems.push(`${key} is ledgered but data/sources.json pins no scan for it`);
    else if (pin.sha256 !== entry.scan.sha256 || pin.url !== entry.scan.url) problems.push(`${key}: the ledger names a different scan than data/sources.json pins`);
    for (const extension of ["jpg", "png"]) {
      const cached = path.join(SCAN_CACHE_DIR, `${key}.${extension}`);
      if (existsSync(cached) && sha256(readFileSync(cached)) !== entry.scan.sha256) problems.push(`${key}: the cached scan no longer matches the ledger sha256`);
    }
  }
  return problems;
}
