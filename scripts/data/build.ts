import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { Card } from "../../src/catalog/card-facts.ts";
import { DATA_DIR, ROOT } from "./paths.ts";
import { buildCards, parseOverrides } from "./normalize/cards.ts";
import { loadRaw } from "./normalize/load-raw.ts";
import { generateEffects, renderGenerated } from "./effects/generate.ts";
import { buildScenarios } from "./normalize/scenarios.ts";
import { extractAll } from "./rules/extract.ts";
import { buildSteps } from "./rules/steps.ts";
import { splitEntries } from "./rules/split.ts";

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
  // Rule text: re-extracted only when a cached PDF's sha256 differs from the committed markdown.
  const sources = JSON.parse(readFileSync(path.join(DATA_DIR, "sources.json"), "utf8")) as { sources: Record<string, { files: { path: string; sha256: string }[] }> };
  const pinned = new Map((sources.sources.rules?.files ?? []).map((file) => [file.path, file.sha256]));
  const docs = extractAll(outDir, pinned);
  const entries = splitEntries(docs);
  writeFileSync(path.join(outDir, "rules", "entries.json"), `[\n${entries.map((entry) => `  ${JSON.stringify(entry)}`).join(",\n")}\n]\n`);
  const steps = buildSteps(readFileSync(path.join(DATA_DIR, "raw", "dragncards", "steps.json"), "utf8"), entries);
  writeFileSync(path.join(outDir, "rules", "steps.json"), `[\n${steps.map((step) => `  ${JSON.stringify(step)}`).join(",\n")}\n]\n`);
  console.log(`rules: ${entries.length} entries, ${steps.length} framework steps`);
  const effectsDir = process.env.EFFECTS_OUT ?? path.join(ROOT, "src", "effects", "generated");
  mkdirSync(effectsDir, { recursive: true });
  const generated = generateEffects(cards, built.scenarios, built.campaign);
  writeFileSync(path.join(effectsDir, "fellowship-of-the-ring.ts"), renderGenerated(generated.effects, built.campaign.id));
  console.log(`effects: ${generated.effects.length} generated, ${generated.unmatched.length} lines without a template`);
  console.log(`scenarios: ${built.scenarios.map((scenario) => scenario.id).join(", ") || "none"}`);
  for (const note of built.notes) console.log(`note: ${note}`);
  if (built.problems.length > 0) console.log(`unbuilt scenarios, problems:\n  ${built.problems.join("\n  ")}`);
  console.log(`cards: ${cards.length} in ${byPack.size} packs`);
  if (report.twinless.length > 0) console.log(`twinless without override: ${report.twinless.join(", ")}`);
  const unknown = Object.entries(report.unknownKeywords).sort(([a], [b]) => a.localeCompare(b));
  console.log(`unknown keyword tokens: ${unknown.length === 0 ? "none" : unknown.map(([k, n]) => `${k} x${n}`).join(", ")}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) build();
