import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { Effect } from "../../../src/catalog/boundary.ts";
import { EFFECTS } from "../../../src/effects/index.ts";
import { splitCodes } from "../../codes.ts";
import { runScript, type Log } from "../../log.ts";
import { loadCards } from "../load-cards.ts";
import { dealtCodes, loadCampaigns, loadScenario } from "../load-scenarios.ts";
import { ROOT } from "../paths.ts";
import { keyOf, lineId, loadLedger } from "../printed/ledger.ts";
import { withPool } from "../printed/pool.ts";
import { segmentsOf } from "./generate.ts";
import { renderCard } from "./render/cards.ts";

// Usage: pnpm effects:render <scenario-id | code,code,... | code code ...> [--out <file>] [--all-dealt]
// Prints each card's printed ledger lines with the effect records that name them rendered as plain English beneath, so a reader (the reading-judge agent,
// docs/plans/scenario-fast-track.md, F2) checks each record against the line it implements. A piece with no template prints as compact JSON.
// A scenario id renders the cards that have a record in src/effects/authored/<scenario-id>.ts; --all-dealt renders every card the scenario deals.

// The cards the scenario's authored file has records for, or null when it has no such file (the caller says so and renders every dealt card). A file that fails to load throws: it is not "no file".
async function authoredCodes(scenarioId: string, log: Log): Promise<Set<string> | null> {
  const file = path.join(ROOT, "src", "effects", "authored", `${scenarioId}.ts`);
  if (!existsSync(file)) {
    log.warn(`src/effects/authored/${scenarioId}.ts does not exist: rendering every card the scenario deals (as --all-dealt does)`);
    return null;
  }
  const loaded = (await import(pathToFileURL(file).href)) as { AUTHORED_EFFECTS?: readonly Effect[] };
  if (!loaded.AUTHORED_EFFECTS) throw new Error(`src/effects/authored/${scenarioId}.ts exports no AUTHORED_EFFECTS`);
  return new Set(loaded.AUTHORED_EFFECTS.map((effect) => effect.cardCode));
}

async function main(log: Log): Promise<void> {
  const args = process.argv.slice(2);
  const outAt = args.indexOf("--out");
  const out = outAt >= 0 ? args[outAt + 1] : undefined;
  const targets = args.filter((arg, at) => !arg.startsWith("--") && at !== outAt + 1);
  const pieces = splitCodes(targets);
  const cards = loadCards();
  const byCode = new Map(cards.map((card) => [card.code, card]));
  const asCodes = pieces.length > 0 && pieces.every((piece) => byCode.has(piece));
  if (pieces.length === 0) throw new Error("Usage: effects:render <scenario-id | code,code,... | code code ...> [--out <file>] [--all-dealt]");
  let codes: string[];
  const piles = new Map<string, string>();
  if (asCodes) codes = pieces;
  else {
    const scenario = loadScenario(pieces[0] ?? "");
    const dealt = [...dealtCodes(loadCampaigns(), [scenario])];
    const owned = args.includes("--all-dealt") ? null : await authoredCodes(scenario.id, log);
    codes = dealt.filter((code) => owned === null || owned.has(code)).sort();
    for (const card of scenario.cards) piles.set(card.code, card.pile);
    log.info(`scenario ${scenario.id}: ${codes.length} cards`);
  }
  const ledger = withPool(loadLedger(), cards);
  const inertIds = new Set(ledger.entries.flatMap((entry) => entry.inert.map((mark) => `${entry.code}:${entry.side}:${mark.line}`)));
  const sections: string[] = [];
  // The cards the scenario's piles place with no record (the staging and quest piles), so a Setup line that says "Add X to the staging area" is seen to be done by the piles.
  const placed = [...piles].filter(([, pile]) => pile !== "encounter").map(([code, pile]) => `${pile}: ${code} ${byCode.get(code)?.name ?? ""}`);
  if (placed.length > 0) sections.push(`Scenario piles that place cards with no record (${placed.join("; ")})`);
  const total = { template: 0, json: 0 };
  for (const code of codes) {
    const card = byCode.get(code);
    if (!card) continue;
    const rawLines = (["A", "B"] as const).flatMap((side) => (ledger.byKey.get(keyOf(code, side))?.lines ?? []).map((line, at) => ({ lineId: lineId(code, side, at + 1), line })));
    const rendered = renderCard(card, segmentsOf(card, ledger), EFFECTS, inertIds, { ...(rawLines.length > 0 ? { rawLines } : {}), ...(piles.has(code) ? { pile: piles.get(code) } : {}) });
    total.template += rendered.tally.template;
    total.json += rendered.tally.json;
    sections.push(rendered.text);
  }
  const text = `${sections.join("\n\n")}\n\n(rendered pieces: ${total.template} by template, ${total.json} as JSON)\n`;
  if (out) {
    mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    writeFileSync(out, text);
    log.info(`wrote ${out}`);
  } else process.stdout.write(text);
  log.info(`${total.template} pieces by template, ${total.json} as JSON`);
}

runScript("effects:render", main);
