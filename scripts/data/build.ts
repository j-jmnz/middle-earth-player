import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { Card } from "../../src/catalog/card-facts.ts";
import { DATA_DIR } from "./paths.ts";
import { buildCards, parseOverrides } from "./normalize/cards.ts";
import { loadRaw } from "./normalize/load-raw.ts";

// Offline and deterministic: data/raw -> data/cards. The same input writes the same bytes.
// DATA_OUT overrides the output directory so data:check can build into a temporary one.
function cardsFile(card: Card): string {
  return card.printings[0]?.pack ?? "unknown";
}

export function renderCardFile(cards: readonly Card[]): string {
  return `[\n${cards.map((card) => `  ${JSON.stringify(card)}`).join(",\n")}\n]\n`;
}

export function build(outDir = process.env.DATA_OUT ?? DATA_DIR): void {
  const overrides = parseOverrides(JSON.parse(readFileSync(path.join(DATA_DIR, "overrides.json"), "utf8")));
  const { cards, report } = buildCards(loadRaw(), overrides);
  const byPack = new Map<string, Card[]>();
  for (const card of cards) byPack.set(cardsFile(card), [...(byPack.get(cardsFile(card)) ?? []), card]);
  const dir = path.join(outDir, "cards");
  mkdirSync(dir, { recursive: true });
  for (const file of readdirSync(dir)) rmSync(path.join(dir, file));
  for (const [pack, list] of [...byPack].sort(([a], [b]) => a.localeCompare(b))) writeFileSync(path.join(dir, `${pack}.json`), renderCardFile(list));
  console.log(`cards: ${cards.length} in ${byPack.size} packs`);
  if (report.twinless.length > 0) console.log(`twinless without override: ${report.twinless.join(", ")}`);
  const unknown = Object.entries(report.unknownKeywords).sort(([a], [b]) => a.localeCompare(b));
  console.log(`unknown keyword tokens: ${unknown.length === 0 ? "none" : unknown.map(([k, n]) => `${k} x${n}`).join(", ")}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) build();
