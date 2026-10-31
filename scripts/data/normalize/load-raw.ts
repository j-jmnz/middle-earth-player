import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { z } from "zod";

import { parseRingsDbCards, parseRingsDbPacks, type RingsDbCard, type RingsDbPack } from "../../../src/catalog/boundary.ts";
import { RAW_DIR } from "../paths.ts";
import { hobCardSchema, hobScenarioIndexSchema, hobScenarioSchema, type HobCard } from "../sources/hallofbeorn.ts";

export type RawData = {
  packs: RingsDbPack[];
  ringsdb: Map<string, RingsDbCard[]>;
  hob: HobCard[];
  scenarios: z.infer<typeof hobScenarioSchema>[];
  // Hall of Beorn's list of every scenario with its product and number (Scenarios.json).
  scenarioIndex: z.infer<typeof hobScenarioIndexSchema>;
  // DragnCards cardDb rows by databaseId, which equals Hall of Beorn's OctgnGuid for the Black Riders and Road Darkens printings.
  dragn: Map<string, Record<string, string>>;
  // The same rows by databaseId with the two sides of a double-sided card kept apart: DragnCards files a side B as a second row of the
  // id (picture `<id>.B.jpg`), and `dragn` keeps the last row of an id, so the Dream-chaser build reads the sides from here.
  dragnSides: Map<string, { a?: Record<string, string>; b?: Record<string, string> }>;
  // The DragnCards JSON-with-comments files as fetched; the scenario builder parses them.
  dragnRaw: { preBuiltDecks: string };
  // Where DragnCards keeps card pictures, for example https://dragncards-lotrlcg.s3.amazonaws.com/cards/English/.
  dragnImagePrefix: string;
};

function readDragnCards(): Pick<RawData, "dragn" | "dragnSides"> {
  const lines = readFileSync(path.join(RAW_DIR, "dragncards", "cardDb.tsv"), "utf8").split("\n");
  const header = (lines[0] ?? "").split("\t");
  const rows = new Map<string, Record<string, string>>();
  const sides = new Map<string, { a?: Record<string, string>; b?: Record<string, string> }>();
  for (const line of lines.slice(1)) {
    if (line === "") continue;
    const cells = line.split("\t");
    const row = Object.fromEntries(header.map((key, index) => [key, cells[index] ?? ""]));
    if (!row.databaseId) continue;
    rows.set(row.databaseId, row);
    const have = sides.get(row.databaseId) ?? {};
    sides.set(row.databaseId, /\.B\.[a-z]+$/.test(row.imageUrl ?? "") ? { ...have, b: row } : { ...have, a: row });
  }
  return { dragn: rows, dragnSides: sides };
}

function readJson(...parts: string[]): unknown {
  return JSON.parse(readFileSync(path.join(RAW_DIR, ...parts), "utf8")) as unknown;
}

// Reads data/raw only. No network.
export function loadRaw(): RawData {
  const packs = parseRingsDbPacks(readJson("ringsdb", "packs.json"));
  const ringsdb = new Map<string, RingsDbCard[]>();
  for (const file of readdirSync(path.join(RAW_DIR, "ringsdb", "cards")).sort()) {
    const pack = file.replace(/\.json$/, "");
    const cards = parseRingsDbCards(readJson("ringsdb", "cards", file), pack);
    if (cards.length > 0) ringsdb.set(pack, cards);
  }
  const hob = ["EncounterCards", "QuestCards", "PlayerCards"].flatMap((kind) => z.array(hobCardSchema).parse(readJson("hallofbeorn", `${kind}.json`)));
  const scenarios = readdirSync(path.join(RAW_DIR, "hallofbeorn", "Scenarios"))
    .sort()
    .map((file) => hobScenarioSchema.parse(readJson("hallofbeorn", "Scenarios", file)));
  return { packs: packs.filter((pack) => ringsdb.has(pack.code)), ringsdb, hob, scenarios, scenarioIndex: hobScenarioIndexSchema.parse(readJson("hallofbeorn", "Scenarios.json")), ...readDragnCards(), dragnImagePrefix: (readJson("dragncards", "imageUrlPrefix.json") as { imageUrlPrefix: { English: string } }).imageUrlPrefix.English, dragnRaw: { preBuiltDecks: readFileSync(path.join(RAW_DIR, "dragncards", "preBuiltDecks.json"), "utf8") } };
}
