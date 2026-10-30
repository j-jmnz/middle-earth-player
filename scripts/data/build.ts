import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { Card } from "../../src/catalog/card-facts.ts";
import { createLog, runScript, verbose, type Log } from "../log.ts";
import { DATA_DIR, ROOT } from "./paths.ts";
import { buildIcons } from "./icons.ts";
import { buildCards, parseOverrides } from "./normalize/cards.ts";
import { loadRaw } from "./normalize/load-raw.ts";
import { boxCodes, boxOwners, generateEffects, renderGenerated } from "./effects/generate.ts";
import { applyPrinted } from "./normalize/printed.ts";
import { buildCampaignIndex } from "./normalize/campaigns.ts";
import { buildScenarios } from "./normalize/scenarios.ts";
import { loadPrebuiltDecks } from "./prebuilt-decks.ts";
import { loadStarterDecks } from "./starter-decks.ts";
import { loadLedger, verifyScans } from "./printed/ledger.ts";
import { withPool } from "./printed/pool.ts";
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

// The page of a campaign's booklet where each scenario's setup span sits (<prefix>.setup-<scenario id> in data/rules/index.json,
// checked against the booklet's text), `doc` being the booklet's rules document. A scenario with no such span in that booklet
// has no page: Mirkwood Paths opens the Learn to Play, which does not print The Oath's setup.
export function bookletPages(entries: readonly { id: string; doc?: string; page: number }[], scenarios: readonly string[], doc = "mec109"): Record<string, number> {
  const pages = new Map(entries.filter((entry) => entry.doc === undefined || entry.doc === doc).map((entry) => [entry.id.replace(/^[a-z0-9]+\./, ""), entry.page]));
  return Object.fromEntries(scenarios.flatMap((id) => (pages.has(`setup-${id}`) ? [[id, pages.get(`setup-${id}`) ?? 0]] : [])));
}

const buildLog = createLog("data:build");

export function build(outDir = process.env.DATA_OUT ?? DATA_DIR, log: Log = buildLog): void {
  log.debug(`writing into ${outDir}`);
  const overrides = parseOverrides(JSON.parse(readFileSync(path.join(DATA_DIR, "overrides.json"), "utf8")));
  const raw = log.step("read data/raw", () => loadRaw());
  const sourceCards = log.step("normalize cards", () => buildCards(raw, overrides));
  const report = sourceCards.report;
  const ledger = loadLedger();
  const scanProblems = verifyScans(ledger);
  if (scanProblems.length > 0) throw new Error(`printed-text ledger: ${scanProblems.join("; ")}`);
  const printed = applyPrinted(sourceCards.cards, ledger);
  const cards = printed.cards;
  log.info(`printed: ${ledger.entries.length} ledger entries; ${printed.differences.length} differ from the source text${printed.differences.length > 0 && !verbose() ? " (--verbose lists them)" : ""}`);
  for (const difference of printed.differences) log.debug(`  ${difference.key}: ledger ${JSON.stringify(difference.ledger)} | source ${JSON.stringify(difference.source)}`);
  const byPack = new Map<string, Card[]>();
  for (const card of cards) byPack.set(cardsFile(card), [...(byPack.get(cardsFile(card)) ?? []), card]);
  const dir = path.join(outDir, "cards");
  log.step(`write ${byPack.size} card files`, () => {
    mkdirSync(dir, { recursive: true });
    for (const file of readdirSync(dir)) rmSync(path.join(dir, file));
    for (const [pack, list] of [...byPack].sort(([a], [b]) => a.localeCompare(b))) writeFileSync(path.join(dir, `${pack}.json`), renderCardFile(list));
  });
  // Rule text: re-extracted only when a cached PDF's sha256 differs from the committed markdown.
  const sources = JSON.parse(readFileSync(path.join(DATA_DIR, "sources.json"), "utf8")) as { sources: Record<string, { files: { path: string; sha256: string }[] }> };
  const pinned = new Map((sources.sources.rules?.files ?? []).map((file) => [file.path, file.sha256]));
  const { entries, steps } = log.step("rules", () => {
    const docs = extractAll(outDir, pinned, parseColumns(readFileSync(path.join(DATA_DIR, "rules", "columns.json"), "utf8")));
    const ruleEntries = buildEntries(indexSchema.parse(JSON.parse(readFileSync(path.join(DATA_DIR, "rules", "index.json"), "utf8"))), docs);
    writeFileSync(path.join(outDir, "rules", "entries.json"), `[\n${ruleEntries.map((entry) => `  ${JSON.stringify(entry)}`).join(",\n")}\n]\n`);
    const ruleSteps = buildSteps(readFileSync(path.join(DATA_DIR, "raw", "dragncards", "steps.json"), "utf8"), ruleEntries);
    writeFileSync(path.join(outDir, "rules", "steps.json"), `[\n${ruleSteps.map((step) => `  ${JSON.stringify(step)}`).join(",\n")}\n]\n`);
    return { entries: ruleEntries, steps: ruleSteps };
  });
  log.info(`rules: ${entries.length} entries, ${steps.length} framework steps`);
  const buildResult = log.step("scenarios", () => buildScenarios(raw, cards, overrides, entries));
  if (buildResult.problems.length > 0) {
    const perScenario = new Map<string, number>();
    for (const problem of buildResult.problems) perScenario.set(problem.split(":")[0] ?? problem, (perScenario.get(problem.split(":")[0] ?? problem) ?? 0) + 1);
    log.info(`unbuilt scenarios (cross-checks failed${verbose() ? "" : "; run with --verbose for each"}): ${[...perScenario].map(([name, count]) => `${name} ${count}`).join(", ")}`);
    log.debug(`  ${buildResult.problems.join("\n  ")}`);
  }
  if (buildResult.notes.length > 0) {
    log.info(`Hall of Beorn's counts differ from the DragnCards load list in ${buildResult.notes.length} places${verbose() ? "" : " (--verbose lists them)"}`);
    log.debug(`  ${buildResult.notes.join("\n  ")}`);
  }
  // The starter decklists are a hand-checked input (data/starter-decks.json), pinned to the MEC109 span that prints them.
  // Only the saga campaign has them. Key order is the file's: the booklet fields come last so the Fellowship's lines stay put.
  const built = {
    ...buildResult,
    campaigns: buildResult.campaigns.map(({ data: campaign, def }) => ({
      id: campaign.id,
      name: campaign.name,
      scenarios: campaign.scenarios,
      campaignCards: campaign.campaignCards,
      prelude: campaign.prelude,
      starterDecks: campaign.saga ? loadStarterDecks(cards, entries) : [],
      bookletPages: bookletPages(entries, campaign.scenarios, def.bookletDoc),
      bookletId: campaign.bookletId,
      saga: campaign.saga,
    })),
  };
  const scenarioDir = path.join(outDir, "scenarios");
  const campaignDir = path.join(outDir, "campaigns");
  mkdirSync(scenarioDir, { recursive: true });
  mkdirSync(campaignDir, { recursive: true });
  for (const file of readdirSync(scenarioDir)) rmSync(path.join(scenarioDir, file));
  for (const scenario of built.scenarios) writeFileSync(path.join(scenarioDir, `${scenario.id}.json`), `${JSON.stringify(scenario, null, 2)}\n`);
  for (const file of readdirSync(campaignDir)) rmSync(path.join(campaignDir, file));
  for (const campaign of built.campaigns) writeFileSync(path.join(campaignDir, `${campaign.id}.json`), `${JSON.stringify(campaign, null, 2)}\n`);
  // Pre-built player decks (data/prebuilt-decks.json): the Learn to Play's core decks and the DragnCards starter decks.
  const prebuilt = log.step("pre-built decks", () => loadPrebuiltDecks(raw, cards, entries));
  mkdirSync(path.join(outDir, "decks"), { recursive: true });
  writeFileSync(path.join(outDir, "decks", "prebuilt.json"), `${JSON.stringify(prebuilt, null, 2)}\n`);
  log.info(`pre-built decks: ${prebuilt.length}`);
  log.debug(`  ${prebuilt.map((deck) => deck.id).join(", ")}`);
  const campaignIndex = buildCampaignIndex(raw, overrides, built.campaigns);
  writeFileSync(path.join(campaignDir, "index.json"), `${JSON.stringify(campaignIndex, null, 2)}\n`);
  const effectsDir = process.env.EFFECTS_OUT ?? path.join(ROOT, "src", "effects", "generated");
  mkdirSync(effectsDir, { recursive: true });
  const generated = log.step("effects", () => generateEffects(cards, built.scenarios, built.campaigns, withPool(ledger, cards)));
  // One generated file per campaign, holding the box cards of its product; the rest of the player pool is player-pool.ts.
  const box = boxCodes(built.campaigns, built.scenarios);
  const owners = boxOwners(built.campaigns, built.scenarios);
  for (const campaign of built.campaigns) {
    writeFileSync(path.join(effectsDir, `${campaign.id}.ts`), renderGenerated(generated.effects.filter((effect) => owners.get(effect.cardCode) === campaign.id), campaign.id));
  }
  writeFileSync(path.join(effectsDir, "player-pool.ts"), renderGenerated(generated.effects.filter((effect) => !box.has(effect.cardCode)), "player pool", "POOL_GENERATED_EFFECTS"));
  const icons = log.step("icons", () => buildIcons(process.env.ICONS_OUT ?? path.join(ROOT, "assets", "icons"), process.env.ICON_MODULES_OUT ?? path.join(ROOT, "src", "play", "icons")));
  log.info(`icons: ${icons.length} (${icons.filter((icon) => icon.kind === "vector").length} vector, ${icons.filter((icon) => icon.kind === "raster").length} raster)`);
  log.info(`effects: ${generated.effects.length} generated, ${generated.unmatched.length} lines without a template`);
  const usage = Object.entries(generated.usage);
  log.info(`templates: ${usage.length} used for ${usage.reduce((sum, [, lines]) => sum + lines, 0)} lines${verbose() ? "" : " (--verbose lists them)"}`);
  log.debug(`  ${usage.map(([id, lines]) => `${id} x${lines}`).join(", ")}`);
  log.info(`scenarios: ${built.scenarios.map((scenario) => scenario.id).join(", ") || "none"}`);
  log.info(`cards: ${cards.length} in ${byPack.size} packs`);
  if (report.twinless.length > 0) log.warn(`twinless without override: ${report.twinless.join(", ")}`);
  const unknown = Object.entries(report.unknownKeywords).sort(([a], [b]) => a.localeCompare(b));
  log.info(`unknown keyword tokens: ${unknown.length === 0 ? "none" : unknown.map(([k, n]) => `${k} x${n}`).join(", ")}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) void runScript("data:build", (log) => build(undefined, log));
