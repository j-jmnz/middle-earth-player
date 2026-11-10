import { parseRingsDbCards, parseRingsDbPacks } from "../../../src/catalog/boundary.ts";

import { bytes, createLog, type Log } from "../../log.ts";
import { combinedPin, fetchText, writeRaw, type SourceFile, type SourceRecord } from "./fetch.ts";

const PACKS_URL = "https://ringsdb.com/api/public/packs/";
// Fan-made Alep packs are not official printings.
const ALEP_PREFIX = "ALeP -";

// The test decks (data/decks/test-decks.json): RingsDB decklists the fixture games play, by decklist id.
export const TEST_DECKLISTS: readonly number[] = [8682];

function decklistUrl(id: number): string {
  return `https://ringsdb.com/api/public/decklist/${id}`;
}

function cardUrl(packCode: string): string {
  return `https://ringsdb.com/api/public/cards/${encodeURIComponent(packCode)}.json`;
}

export async function syncRingsDb(log: Log = createLog("ringsdb")): Promise<SourceRecord> {
  const files: SourceFile[] = [];
  const packsBody = await fetchText(PACKS_URL, undefined, log);
  files.push(writeRaw("ringsdb/packs.json", PACKS_URL, packsBody));
  const all = parseRingsDbPacks(JSON.parse(packsBody) as unknown);
  const packs = all.filter((pack) => !pack.name.startsWith(ALEP_PREFIX));
  log.info(`${packs.length} packs (${all.length - packs.length} ALeP packs skipped)`);
  const tick = log.progress(packs.length, "pack");
  for (const pack of packs) {
    const url = cardUrl(pack.code);
    const body = await fetchText(url, undefined, log);
    // Validates the shape before the snapshot is kept.
    let count: number;
    try {
      count = parseRingsDbCards(JSON.parse(body) as unknown, pack.code).length;
    } catch (error) {
      throw new Error(`RingsDB cards for ${pack.code} (${pack.name}) did not parse`, { cause: error });
    }
    files.push(writeRaw(`ringsdb/cards/${pack.code}.json`, url, body));
    tick(`${pack.code} ${pack.name}: ${count} cards, ${bytes(body.length)}`);
  }
  for (const id of TEST_DECKLISTS) {
    const url = decklistUrl(id);
    const body = await fetchText(url, undefined, log);
    const parsed = JSON.parse(body) as { id?: unknown };
    if (parsed.id !== id) throw new Error(`RingsDB decklist ${id} came back as ${String(parsed.id)}`);
    files.push(writeRaw(`ringsdb/decklists/${id}.json`, url, body));
    log.info(`decklist ${id}: ${bytes(body.length)}`);
  }
  return { id: "ringsdb", site: "https://ringsdb.com", pin: { kind: "sha256", value: combinedPin(files) }, fetchedAt: new Date().toISOString(), files };
}
