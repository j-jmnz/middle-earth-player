import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { duration, runScript, type Log } from "../log.ts";
import { packBookletsHere } from "../pack-booklets.ts";
import { DATA_DIR } from "./paths.ts";
import { syncDragnCards } from "./sources/dragncards.ts";
import { recordChanges, type SourceRecord } from "./sources/fetch.ts";
import { syncHallOfBeorn } from "./sources/hallofbeorn.ts";
import { syncIcons } from "./sources/icons.ts";
import { syncPictures } from "./sources/pictures.ts";
import { syncRingsDb } from "./sources/ringsdb.ts";
import { syncRules } from "./sources/rules.ts";
import { syncScans } from "./sources/scans.ts";

// The only network command. Refreshes data/raw and .cache/pdf, then records every pin in data/sources.json.
// Usage: node --experimental-strip-types scripts/data/sync.ts [ringsdb|hallofbeorn|dragncards|rules|scans|pictures|icons]... [--verbose]
// --verbose logs every request with its status, size and time.
const ADAPTERS: Record<string, (log: Log) => Promise<SourceRecord>> = {
  ringsdb: syncRingsDb,
  hallofbeorn: syncHallOfBeorn,
  dragncards: syncDragnCards,
  rules: syncRules,
  scans: syncScans,
  pictures: syncPictures,
  icons: syncIcons,
};

function readSources(file: string, log: Log): Record<string, SourceRecord> {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    log.info(`${path.relative(process.cwd(), file)} does not exist yet: first run`);
    return {};
  }
  return (JSON.parse(text) as { sources: Record<string, SourceRecord> }).sources;
}

void runScript("data:sync", async (log) => {
  const wanted = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  const unknown = wanted.filter((id) => !ADAPTERS[id]);
  if (unknown.length > 0) throw new Error(`Unknown source ${unknown.join(", ")}. Sources: ${Object.keys(ADAPTERS).join(", ")}`);
  const ids = wanted.length > 0 ? wanted : Object.keys(ADAPTERS);
  // scans and pictures read data/cards, so they run after a build; a bare `data:sync` leaves them to the explicit command.
  if (wanted.length === 0) {
    for (const id of ["scans", "pictures"]) ids.splice(ids.indexOf(id), 1);
    log.info("scans and pictures are skipped without naming them (they read data/cards: run pnpm data:build, then pnpm data:sync scans pictures)");
  }
  log.info(`sources: ${ids.join(", ")}`);
  const file = path.join(DATA_DIR, "sources.json");
  const previous = readSources(file, log);
  const records: Record<string, SourceRecord> = { ...previous };
  const done: string[] = [];
  for (const id of ids) {
    const adapter = ADAPTERS[id];
    if (!adapter) continue;
    const sourceLog = log.child(id);
    const begin = performance.now();
    sourceLog.info("start");
    try {
      records[id] = await adapter(sourceLog);
    } catch (error) {
      // The raw files of the sources that finished are on disk, but their pins are not: say so before the error ends the run.
      if (done.length > 0) log.warn(`data/raw was refreshed for ${done.join(", ")}, but sources.json is not written: rerun those sources or restore data/raw with git`);
      throw new Error(`${id} failed after ${duration(performance.now() - begin)}`, { cause: error });
    }
    const record = records[id];
    if (record) sourceLog.info(`${recordChanges(previous[id], record)} (${duration(performance.now() - begin)})`);
    done.push(id);
  }
  const sorted = Object.fromEntries(Object.entries(records).sort(([a], [b]) => a.localeCompare(b)));
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(file, `${JSON.stringify({ sources: sorted }, null, 2)}\n`);
  log.info(`wrote ${path.relative(process.cwd(), file)}; run pnpm data:build next`);
  // The booklet PDFs the app bundles come from the rules just fetched (.cache/booklets, read by metro.config.js).
  if (ids.includes("rules")) await packBookletsHere(log.child("booklets"));
});
