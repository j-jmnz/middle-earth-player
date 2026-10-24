import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { Card } from "../../src/catalog/card-facts.ts";
import { DATA_DIR } from "./paths.ts";
import { buildCards, parseOverrides } from "./normalize/cards.ts";
import { loadRaw } from "./normalize/load-raw.ts";
import { buildScenarios } from "./normalize/scenarios.ts";

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
  const raw = loadRaw();
  const { cards, report } = buildCards(raw, overrides);
  const byPack = new Map<string, Card[]>();
  for (const card of cards) byPack.set(cardsFile(card), [...(byPack.get(cardsFile(card)) ?? []), card]);
  const dir = path.join(outDir, "cards");
  mkdirSync(dir, { recursive: true });
  for (const file of readdirSync(dir)) rmSync(path.join(dir, file));
  for (const [pack, list] of [...byPack].sort(([a], [b]) => a.localeCompare(b))) writeFileSync(path.join(dir, `${pack}.json`), renderCardFile(list));
  const existing = JSON.parse(readFileSync(path.join(DATA_DIR, "campaigns", "fellowship-of-the-ring.json"), "utf8")) as unknown;
  const built = buildScenarios(raw, cards, overrides, existing);
  const scenarioDir = path.join(outDir, "scenarios");
  const campaignDir = path.join(outDir, "campaigns");
  mkdirSync(scenarioDir, { recursive: true });
  mkdirSync(campaignDir, { recursive: true });
  for (const file of readdirSync(scenarioDir)) rmSync(path.join(scenarioDir, file));
  for (const scenario of built.scenarios) writeFileSync(path.join(scenarioDir, `${scenario.id}.json`), `${JSON.stringify(scenario, null, 2)}\n`);
  writeFileSync(path.join(campaignDir, "fellowship-of-the-ring.json"), `${JSON.stringify(built.campaign, null, 2)}\n`);
  console.log(`scenarios: ${built.scenarios.map((scenario) => scenario.id).join(", ") || "none"}`);
  for (const note of built.notes) console.log(`note: ${note}`);
  if (built.problems.length > 0) console.log(`unbuilt scenarios, problems:\n  ${built.problems.join("\n  ")}`);
  console.log(`cards: ${cards.length} in ${byPack.size} packs`);
  if (report.twinless.length > 0) console.log(`twinless without override: ${report.twinless.join(", ")}`);
  const unknown = Object.entries(report.unknownKeywords).sort(([a], [b]) => a.localeCompare(b));
  console.log(`unknown keyword tokens: ${unknown.length === 0 ? "none" : unknown.map(([k, n]) => `${k} x${n}`).join(", ")}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) build();
