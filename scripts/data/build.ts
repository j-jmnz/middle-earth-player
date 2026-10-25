import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { Card } from "../../src/catalog/card-facts.ts";
import { DATA_DIR, ROOT } from "./paths.ts";
import { buildIcons } from "./icons.ts";
import { buildCards, parseOverrides } from "./normalize/cards.ts";
import { loadRaw } from "./normalize/load-raw.ts";
import { generateEffects, renderGenerated } from "./effects/generate.ts";
import { applyPrinted } from "./normalize/printed.ts";
import { buildCampaignIndex } from "./normalize/campaigns.ts";
import { buildScenarios } from "./normalize/scenarios.ts";
import { loadPrebuiltDecks } from "./prebuilt-decks.ts";
import { loadStarterDecks } from "./starter-decks.ts";
import { loadLedger, verifyScans } from "./printed/ledger.ts";
import { extractAll, parseColumns } from "./rules/extract.ts";
import { buildSteps } from "./rules/steps.ts";
import { buildEntries, indexSchema } from "./rules/spans.ts";

// Offline and deterministic: data/raw -> data/cards. The same input writes the same bytes.
// DATA_OUT overrides the output directory so data:check can build into a temporary one.
function cardsFile(card: Card): string {
  return card.printings[0]?.pack ?? "unknown";
}

export function renderCardFile(cards: readonly Card[]): string {
  return `[\n${cards.map((card) => `  ${JSON.stringify(card)}`).join(",\n")}\n]\n`;
}

// The MEC109 page each scenario's setup span sits on (mec109.setup-<scenario id> in data/rules/index.json, checked against
// the booklet's text). A scenario with no such span has no page.
export function bookletPages(entries: readonly { id: string; page: number }[], scenarios: readonly string[]): Record<string, number> {
  const pages = new Map(entries.map((entry) => [entry.id, entry.page]));
  return Object.fromEntries(scenarios.flatMap((id) => (pages.has(`mec109.setup-${id}`) ? [[id, pages.get(`mec109.setup-${id}`) ?? 0]] : [])));
}

export function build(outDir = process.env.DATA_OUT ?? DATA_DIR): void {
  const overrides = parseOverrides(JSON.parse(readFileSync(path.join(DATA_DIR, "overrides.json"), "utf8")));
  const raw = loadRaw();
  const sourceCards = buildCards(raw, overrides);
  const report = sourceCards.report;
  const ledger = loadLedger();
  const scanProblems = verifyScans(ledger);
  if (scanProblems.length > 0) throw new Error(`printed-text ledger: ${scanProblems.join("; ")}`);
  const printed = applyPrinted(sourceCards.cards, ledger);
  const cards = printed.cards;
  console.log(`printed: ${ledger.entries.length} ledger entries; ${printed.differences.length} differ from the source text`);
  for (const difference of printed.differences) console.log(`  ${difference.key}: ledger ${JSON.stringify(difference.ledger)} | source ${JSON.stringify(difference.source)}`);
  const byPack = new Map<string, Card[]>();
  for (const card of cards) byPack.set(cardsFile(card), [...(byPack.get(cardsFile(card)) ?? []), card]);
  const dir = path.join(outDir, "cards");
  mkdirSync(dir, { recursive: true });
  for (const file of readdirSync(dir)) rmSync(path.join(dir, file));
  for (const [pack, list] of [...byPack].sort(([a], [b]) => a.localeCompare(b))) writeFileSync(path.join(dir, `${pack}.json`), renderCardFile(list));
  // Rule text: re-extracted only when a cached PDF's sha256 differs from the committed markdown.
  const sources = JSON.parse(readFileSync(path.join(DATA_DIR, "sources.json"), "utf8")) as { sources: Record<string, { files: { path: string; sha256: string }[] }> };
  const pinned = new Map((sources.sources.rules?.files ?? []).map((file) => [file.path, file.sha256]));
  const docs = extractAll(outDir, pinned, parseColumns(readFileSync(path.join(DATA_DIR, "rules", "columns.json"), "utf8")));
  const entries = buildEntries(indexSchema.parse(JSON.parse(readFileSync(path.join(DATA_DIR, "rules", "index.json"), "utf8"))), docs);
  writeFileSync(path.join(outDir, "rules", "entries.json"), `[\n${entries.map((entry) => `  ${JSON.stringify(entry)}`).join(",\n")}\n]\n`);
  const steps = buildSteps(readFileSync(path.join(DATA_DIR, "raw", "dragncards", "steps.json"), "utf8"), entries);
  writeFileSync(path.join(outDir, "rules", "steps.json"), `[\n${steps.map((step) => `  ${JSON.stringify(step)}`).join(",\n")}\n]\n`);
  console.log(`rules: ${entries.length} entries, ${steps.length} framework steps`);
  const buildResult = buildScenarios(raw, cards, overrides, entries);
  // The starter decklists are a hand-checked input (data/starter-decks.json), pinned to the MEC109 span that prints them.
  const built = {
    ...buildResult,
    campaign: { ...buildResult.campaign, bookletPages: bookletPages(entries, buildResult.campaign.scenarios), starterDecks: loadStarterDecks(cards, entries) },
  };
  const scenarioDir = path.join(outDir, "scenarios");
  const campaignDir = path.join(outDir, "campaigns");
  mkdirSync(scenarioDir, { recursive: true });
  mkdirSync(campaignDir, { recursive: true });
  for (const file of readdirSync(scenarioDir)) rmSync(path.join(scenarioDir, file));
  for (const scenario of built.scenarios) writeFileSync(path.join(scenarioDir, `${scenario.id}.json`), `${JSON.stringify(scenario, null, 2)}\n`);
  writeFileSync(path.join(campaignDir, "fellowship-of-the-ring.json"), `${JSON.stringify(built.campaign, null, 2)}\n`);
  // Pre-built player decks (data/prebuilt-decks.json): the Learn to Play's core decks and the DragnCards starter decks.
  const prebuilt = loadPrebuiltDecks(raw, cards, entries);
  mkdirSync(path.join(outDir, "decks"), { recursive: true });
  writeFileSync(path.join(outDir, "decks", "prebuilt.json"), `${JSON.stringify(prebuilt, null, 2)}\n`);
  console.log(`pre-built decks: ${prebuilt.map((deck) => deck.id).join(", ")}`);
  const campaignIndex = buildCampaignIndex(raw, overrides, built.campaign);
  writeFileSync(path.join(campaignDir, "index.json"), `${JSON.stringify(campaignIndex, null, 2)}\n`);
  const effectsDir = process.env.EFFECTS_OUT ?? path.join(ROOT, "src", "effects", "generated");
  mkdirSync(effectsDir, { recursive: true });
  const generated = generateEffects(cards, built.scenarios, built.campaign, ledger);
  writeFileSync(path.join(effectsDir, "fellowship-of-the-ring.ts"), renderGenerated(generated.effects, built.campaign.id));
  const icons = buildIcons(process.env.ICONS_OUT ?? path.join(ROOT, "assets", "icons"), process.env.ICON_MODULES_OUT ?? path.join(ROOT, "src", "play", "icons"));
  console.log(`icons: ${icons.length} (${icons.filter((icon) => icon.kind === "vector").length} vector, ${icons.filter((icon) => icon.kind === "raster").length} raster)`);
  console.log(`effects: ${generated.effects.length} generated, ${generated.unmatched.length} lines without a template`);
  console.log(`templates: ${Object.entries(generated.usage).map(([id, lines]) => `${id} x${lines}`).join(", ")}`);
  console.log(`scenarios: ${built.scenarios.map((scenario) => scenario.id).join(", ") || "none"}`);
  if (built.problems.length > 0) {
    const perScenario = new Map<string, number>();
    for (const problem of built.problems) perScenario.set(problem.split(":")[0] ?? problem, (perScenario.get(problem.split(":")[0] ?? problem) ?? 0) + 1);
    console.log(`unbuilt scenarios (cross-checks failed; run with --verbose for each): ${[...perScenario].map(([name, count]) => `${name} ${count}`).join(", ")}`);
    if (process.argv.includes("--verbose")) console.log(`  ${built.problems.join("\n  ")}`);
  }
  console.log(`cards: ${cards.length} in ${byPack.size} packs`);
  if (report.twinless.length > 0) console.log(`twinless without override: ${report.twinless.join(", ")}`);
  const unknown = Object.entries(report.unknownKeywords).sort(([a], [b]) => a.localeCompare(b));
  console.log(`unknown keyword tokens: ${unknown.length === 0 ? "none" : unknown.map(([k, n]) => `${k} x${n}`).join(", ")}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) build();
