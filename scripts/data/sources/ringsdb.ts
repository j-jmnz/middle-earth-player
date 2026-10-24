import { parseRingsDbCards, parseRingsDbPacks } from "../../../src/catalog/boundary.ts";

import { combinedPin, fetchText, writeRaw, type SourceFile, type SourceRecord } from "./fetch.ts";

const PACKS_URL = "https://ringsdb.com/api/public/packs/";
// Fan-made Alep packs are not official printings.
const ALEP_PREFIX = "ALeP -";

function cardUrl(packCode: string): string {
  return `https://ringsdb.com/api/public/cards/${encodeURIComponent(packCode)}.json`;
}

export async function syncRingsDb(): Promise<SourceRecord> {
  const files: SourceFile[] = [];
  const packsBody = await fetchText(PACKS_URL);
  files.push(writeRaw("ringsdb/packs.json", PACKS_URL, packsBody));
  const packs = parseRingsDbPacks(JSON.parse(packsBody) as unknown).filter((pack) => !pack.name.startsWith(ALEP_PREFIX));
  for (const pack of packs) {
    const url = cardUrl(pack.code);
    const body = await fetchText(url);
    // Validates the shape before the snapshot is kept.
    parseRingsDbCards(JSON.parse(body) as unknown, pack.code);
    files.push(writeRaw(`ringsdb/cards/${pack.code}.json`, url, body));
  }
  return { id: "ringsdb", site: "https://ringsdb.com", pin: { kind: "sha256", value: combinedPin(files) }, fetchedAt: new Date().toISOString(), files };
}
