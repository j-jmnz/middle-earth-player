import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { parse as parseJsonc } from "jsonc-parser";

import { EFFECTS } from "../../../src/effects/index.ts";
import { runScript, type Log } from "../../log.ts";
import type { Card } from "../../../src/catalog/card-facts.ts";
import { prebuiltDecksSchema } from "../../../src/catalog/prebuilt-deck.ts";
import { loadCards } from "../load-cards.ts";
import { dealtCodes, loadCampaign, loadScenario } from "../load-scenarios.ts";
import { keyOf, loadLedger } from "../printed/ledger.ts";
import { DATA_DIR, RAW_DIR, ROOT } from "../paths.ts";
import type { RuleEntry } from "../rules/spans.ts";
import { generateEffects, segmentsOf, type Unmatched } from "./generate.ts";
import { vocabulary } from "./vocabulary.ts";

// Usage: node --experimental-strip-types scripts/data/effects/draft.ts <scenario-id | starter-deck-id | prebuilt-deck-id>
// Writes .agent/drafts/<code>.md for every card in the scenario, or in the starter or pre-built deck (data/decks/prebuilt.json),
// that has a printed line no record covers yet.
// With --all it also drafts the lines that authored records already cover, to review or redo them.

function words(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[a-z]{4,}/g) ?? []);
}

function similarity(left: string, right: string): number {
  const a = words(left);
  const b = words(right);
  const shared = [...a].filter((word) => b.has(word)).length;
  return shared / Math.max(1, a.size + b.size - shared);
}

function main(log: Log): void {
  const scenarioId = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  if (!scenarioId) throw new Error("Usage: effects:draft <scenario-id | starter-deck-id | prebuilt-deck-id>");
  const campaign = loadCampaign();
  const prebuilt = prebuiltDecksSchema.parse(JSON.parse(readFileSync(path.join(DATA_DIR, "decks", "prebuilt.json"), "utf8")) as unknown).find((entry) => entry.id === scenarioId);
  const deck = campaign.starterDecks.find((entry) => entry.id === scenarioId) ?? (prebuilt ? { id: prebuilt.id, rows: [...prebuilt.heroes.map((code) => ({ code })), ...prebuilt.cards] } : undefined);
  const scenario = deck ? null : loadScenario(scenarioId);
  log.info(deck ? `deck ${deck.id}: ${deck.rows.length} rows` : `scenario ${scenarioId}`);
  const cards = loadCards();
  const ledger = loadLedger();
  const byCode = new Map(cards.map((card) => [card.code, card]));
  const entries = JSON.parse(readFileSync(path.join(DATA_DIR, "rules", "entries.json"), "utf8")) as RuleEntry[];
  const vocab = vocabulary();
  const automation = new Map<string, unknown>();
  for (const file of ["encounterCards.json", "playerCards.json"]) {
    const parsed = parseJsonc(readFileSync(path.join(RAW_DIR, "dragncards", file), "utf8")) as { automation?: { cards?: Record<string, unknown> } };
    for (const [guid, rules] of Object.entries(parsed.automation?.cards ?? {})) automation.set(guid, rules);
  }

  const generated = generateEffects(cards, scenario ? [scenario] : [], campaign, ledger);
  // Every card the scenario deals: its piles, its campaign card, the cards that card places (campaignPlaced) and the prelude.
  const dealt = deck ? new Set(deck.rows.map((row) => row.code)) : dealtCodes(campaign, scenario ? [scenario] : []);
  const all = process.argv.includes("--all");
  // A line the ledger marks inert (a reminder, a keyword the engine reads) is owned and needs no record.
  const inert = (lineId: string): boolean => {
    const [code = "", side = "", n] = lineId.split(":");
    return ledger.byKey.get(keyOf(code, side))?.inert.some((mark) => mark.line === Number(n)) ?? false;
  };
  const open: Unmatched[] = generated.unmatched.filter((line) => dealt.has(line.card.code) && (all || (!inert(line.lineId) && !EFFECTS.some((effect) => effect.lines.includes(line.lineId)))));
  const byCard = new Map<string, Unmatched[]>();
  for (const line of open) byCard.set(line.card.code, [...(byCard.get(line.card.code) ?? []), line]);

  const out = path.join(ROOT, ".agent", "drafts");
  mkdirSync(out, { recursive: true });
  for (const [code, lines] of byCard) {
    const card = byCode.get(code) as Card;
    const guid = card.printings.find((printing) => printing.octgnGuid)?.octgnGuid;
    const sections: string[] = [
      `# ${code} ${card.name}`,
      ``,
      `Scenario: ${scenarioId}. Write the records into src/effects/authored/fellowship-of-the-ring.ts, each with \`lines\` naming the line ids above, then run \`pnpm vitest run scripts/effect-coverage.test.ts\` and the scenario tests.`,
      ``,
      `## Lines without a record`,
      ...lines.map((line) => `- ${line.lineId} (${line.side}${line.timing ? `, ${line.timing}` : ""}) ${line.line}`),
      ``,
      `## Text of every printing`,
      ...card.printings.map((printing) => `- ${printing.pack} #${printing.number} (${printing.hobSlug ?? "RingsDB"})`),
      ``,
      "```",
      [card.text, card.back?.text && `Side B: ${card.back.text}`, card.shadowText].filter(Boolean).join("\n"),
      "```",
      ``,
      `## DragnCards automation`,
      guid && automation.has(guid) ? ["```json", JSON.stringify(automation.get(guid), null, 2), "```"].join("\n") : "None.",
      ``,
      `## Rules text that mentions its terms`,
    ];
    const haystack = lines.map((line) => line.line.toLowerCase()).join(" ");
    const related = entries.filter((entry) => (entry.doc === "rr" || entry.doc === "mec109") && entry.terms.some((term) => term.length >= 6 && haystack.includes(term))).slice(0, 6);
    for (const entry of related) sections.push(`### ${entry.id} (${entry.doc} p${entry.page})`, entry.text.slice(0, 900), ``);
    sections.push(
      `## Vocabulary (src/catalog/effect-schema.ts)`,
      `Verbs: ${vocab.verbs.join(", ")}`,
      `Conditions: ${vocab.conditions.join(", ")}`,
      `Triggers: ${vocab.triggers.join(", ")}`,
      `Timings: ${vocab.timings.join(", ")}`,
      `Costs: ${vocab.costs.join(", ")}`,
      `ModifyStat stats: ${vocab.stats.join(", ")}`,
      `ModifyStat targets: ${vocab.statTargets.join(", ")}`,
      `ModifyStat durations: ${vocab.durations.join(", ")}`,
      ``,
      `## The three most similar existing records`,
    );
    const lineText = lines.map((line) => line.line).join(" ");
    const near = EFFECTS.filter((effect) => effect.cardCode !== code)
      .map((effect) => {
        const other = byCode.get(effect.cardCode);
        const text = other ? segmentsOf(other, ledger).map((segment) => segment.line).join(" ") : "";
        return { effect, text, score: similarity(lineText, text) };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    for (const item of near) sections.push(`Card ${item.effect.cardCode}: ${item.text.slice(0, 300)}`, "```json", JSON.stringify(item.effect), "```", ``);
    writeFileSync(path.join(out, `${code}.md`), `${sections.join("\n")}\n`);
    log.debug(`${code}.md: ${lines.length} line${lines.length === 1 ? "" : "s"} (${lines.map((line) => line.lineId).join(", ")})`);
  }
  log.info(`${byCard.size} drafts (${open.length} lines) in .agent/drafts for ${scenarioId}; ${Object.values(generated.usage).reduce((sum, n) => sum + n, 0)} lines came from templates`);
}

void runScript("effects:draft", main);
