import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { DATA_DIR } from "./paths.ts";
import { syncDragnCards } from "./sources/dragncards.ts";
import type { SourceRecord } from "./sources/fetch.ts";
import { syncHallOfBeorn } from "./sources/hallofbeorn.ts";
import { syncRingsDb } from "./sources/ringsdb.ts";
import { syncRules } from "./sources/rules.ts";
import { syncScans } from "./sources/scans.ts";

// The only network command. Refreshes data/raw and .cache/pdf, then records every pin in data/sources.json.
// Usage: node --experimental-strip-types scripts/data/sync.ts [ringsdb|hallofbeorn|dragncards|rules|scans]...
const ADAPTERS: Record<string, () => Promise<SourceRecord>> = {
  ringsdb: syncRingsDb,
  hallofbeorn: syncHallOfBeorn,
  dragncards: syncDragnCards,
  rules: syncRules,
  scans: syncScans,
};

async function main(): Promise<void> {
  const wanted = process.argv.slice(2);
  const ids = wanted.length > 0 ? wanted : Object.keys(ADAPTERS);
  // scans reads data/cards, so it runs after a build; a bare `data:sync` leaves it to the explicit command.
  if (wanted.length === 0) ids.splice(ids.indexOf("scans"), 1);
  const records: Record<string, SourceRecord> = {};
  const file = path.join(DATA_DIR, "sources.json");
  try {
    const previous = (await import(file, { with: { type: "json" } })) as { default: { sources: Record<string, SourceRecord> } };
    Object.assign(records, previous.default.sources);
  } catch {
    // First run.
  }
  for (const id of ids) {
    const adapter = ADAPTERS[id];
    if (!adapter) throw new Error(`Unknown source ${id}`);
    console.log(`sync ${id}`);
    records[id] = await adapter();
  }
  const sorted = Object.fromEntries(Object.entries(records).sort(([a], [b]) => a.localeCompare(b)));
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(file, `${JSON.stringify({ sources: sorted }, null, 2)}\n`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
