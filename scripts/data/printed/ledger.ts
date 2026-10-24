import { existsSync, readFileSync } from "node:fs";
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
  inert: z.array(z.strictObject({ line: z.number().int().positive(), reason: z.string().min(1) })),
  // Typos on the card itself. `lines` holds the corrected reading, this the printed wording of that line.
  misprints: z.array(z.strictObject({ line: z.number().int().positive(), printed: z.string().min(1) })),
  readBy: z.string().min(1),
  // "user" for a call the user made, "sources" for one settled from several sources (named in basis), else null.
  confirmedBy: z.enum(["user", "sources"]).nullable(),
  basis: z.array(z.string().min(1)).optional(),
  notes: z.string().optional(),
});
export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;

export const ledgerSchema = z.strictObject({
  campaign: z.string().min(1),
  conventions: z.array(z.string()),
  entries: z.array(ledgerEntrySchema),
});
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

export function loadLedger(dataDir = DATA_DIR, campaign = "fellowship-of-the-ring"): Ledger {
  return parseLedger(JSON.parse(readFileSync(path.join(dataDir, "printed", `${campaign}.json`), "utf8")) as unknown);
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
