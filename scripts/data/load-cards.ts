import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { z } from "zod";

import { cardSchema, type Card } from "../../src/catalog/card-facts.ts";
import { DATA_DIR } from "./paths.ts";

// Reads data/cards. Offline. The tests, the catalog build and data query all start here.
export function loadCards(dataDir = DATA_DIR): Card[] {
  const dir = path.join(dataDir, "cards");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .flatMap((name) => z.array(cardSchema).parse(JSON.parse(readFileSync(path.join(dir, name), "utf8"))));
}
